import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '../../server/db/client';
import { getSettings } from '../../server/services/settings';
import { termForDate } from '../../server/services/terms';
import { signIn } from './helpers/auth';

let adviser: Headers;
let member: Headers;

beforeAll(async () => {
  adviser = (await signIn(env, { role: 'adviser' })).headers;
  member = (await signIn(env, { role: 'member' })).headers;
});

function send(method: string, path: string, body: unknown, headers: Headers) {
  const h = new Headers(headers);
  h.set('content-type', 'application/json');
  return SELF.fetch(`http://x/api${path}`, { method, headers: h, body: JSON.stringify(body) });
}

async function createTerm(name: string, startDate: string, endDate: string) {
  const res = await send('POST', '/terms', { name, startDate, endDate }, adviser);
  return { res, body: (await res.json()) as { id: number; isActive: boolean } };
}

describe('terms', () => {
  it('activate_term_deactivates_previous', async () => {
    const a = await createTerm('1st Sem AY 2026–2027', '2026-08-01', '2026-12-20');
    const b = await createTerm('2nd Sem AY 2026–2027', '2027-01-05', '2027-05-25');
    expect(a.res.status).toBe(201);
    expect((await send('POST', `/terms/${a.body.id}/activate`, {}, adviser)).status).toBe(200);
    expect((await send('POST', `/terms/${b.body.id}/activate`, {}, adviser)).status).toBe(200);
    const { results } = await env.DB.prepare('SELECT id FROM terms WHERE is_active = 1').all<{ id: number }>();
    expect(results.map((r) => r.id)).toEqual([b.body.id]);
    const audit = await env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'term.activate'`).first();
    expect(audit).toEqual({ n: 2 });
  });

  it('overlapping_terms_rejected', async () => {
    const res = await send('POST', '/terms', { name: 'Overlap', startDate: '2026-12-01', endDate: '2027-01-10' }, adviser);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  });

  it('patch_cannot_move_into_overlap', async () => {
    const t = await createTerm('Summer 2027', '2027-06-01', '2027-07-15');
    expect(t.res.status).toBe(201);
    const res = await send('PATCH', `/terms/${t.body.id}`, { startDate: '2027-05-20' }, adviser);
    expect(res.status).toBe(422);
    expect((await send('PATCH', `/terms/${t.body.id}`, { name: 'Summer Term 2027' }, adviser)).status).toBe(200);
  });

  // Terms get extended (make-up classes, typhoon suspensions), so advisers edit the dates and name in place.
  it('patch_extends_end_date_and_renames', async () => {
    const t = await createTerm('Midyear 2028', '2028-06-01', '2028-07-15');
    const res = await send('PATCH', `/terms/${t.body.id}`, { name: 'Midyear 2028 (extended)', endDate: '2028-07-31' }, adviser);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: 'Midyear 2028 (extended)', startDate: '2028-06-01', endDate: '2028-07-31' });
  });

  it('patch_rename_to_existing_name_409', async () => {
    await createTerm('Taken 2029', '2029-01-05', '2029-02-05');
    const t = await createTerm('Other 2029', '2029-03-05', '2029-04-05');
    const res = await send('PATCH', `/terms/${t.body.id}`, { name: 'Taken 2029' }, adviser);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'CONFLICT' } });
    expect((await send('PATCH', `/terms/${t.body.id}`, { name: 'Other 2029', endDate: '2029-04-20' }, adviser)).status).toBe(200); // own name is fine
  });

  it('end_before_start_400', async () => {
    const res = await send('POST', '/terms', { name: 'Bad', startDate: '2028-05-01', endDate: '2028-04-01' }, adviser);
    expect(res.status).toBe(400);
  });

  it('termForDate_inclusive_bounds', async () => {
    const db = getDb(env);
    expect((await termForDate(db, '2027-01-05'))?.name).toBe('2nd Sem AY 2026–2027');
    expect((await termForDate(db, '2027-05-25'))?.name).toBe('2nd Sem AY 2026–2027');
    expect(await termForDate(db, '2027-01-04')).toBeNull();
  });

  it('anyone_signed_in_can_list_terms_but_only_advisers_write', async () => {
    const list = await SELF.fetch('http://x/api/terms', { headers: member });
    expect(list.status).toBe(200);
    expect(((await list.json()) as unknown[]).length).toBeGreaterThanOrEqual(3);
    expect((await send('POST', '/terms', { name: 'X', startDate: '2030-01-01', endDate: '2030-02-01' }, member)).status).toBe(403);
  });
});

describe('catalog', () => {
  it('catalog_get_hides_inactive', async () => {
    const created = await send('POST', '/catalog/colleges', { code: 'TMP', name: 'Temporary College' }, adviser);
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: number };
    const course = await send('POST', '/catalog/courses', { collegeId: id, code: 'BSX', name: 'BS X' }, adviser);
    expect(course.status).toBe(201);

    expect((await send('PATCH', `/catalog/colleges/${id}`, { active: false }, adviser)).status).toBe(200);
    const pub = (await (await SELF.fetch('http://x/api/catalog', { headers: member })).json()) as { colleges: { code: string }[] };
    expect(pub.colleges.map((c) => c.code)).not.toContain('TMP');

    // advisers can still see (and re-activate) inactive rows
    const all = (await (await SELF.fetch('http://x/api/catalog?all=1', { headers: adviser })).json()) as {
      colleges: { code: string; active: boolean }[];
    };
    expect(all.colleges.find((c) => c.code === 'TMP')).toMatchObject({ active: false });
    expect((await SELF.fetch('http://x/api/catalog?all=1', { headers: member })).status).toBe(403);
  });

  it('duplicate_course_code_in_college_409', async () => {
    const cce = (await env.DB.prepare(`SELECT id FROM colleges WHERE code = 'CCE'`).first<{ id: number }>())!.id;
    expect((await send('POST', '/catalog/courses', { collegeId: cce, code: 'BSIT-X', name: 'BS IT' }, adviser)).status).toBe(201);
    const dup = await send('POST', '/catalog/courses', { collegeId: cce, code: 'BSIT-X', name: 'Again' }, adviser);
    expect(dup.status).toBe(409);
    expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'catalog.update'`).first()).toMatchObject({
      n: expect.any(Number),
    });
  });

  it('member_cannot_edit_catalog_403', async () => {
    expect((await send('POST', '/catalog/colleges', { code: 'NO', name: 'Nope' }, member)).status).toBe(403);
  });
});

describe('settings', () => {
  it('getSettings_returns_defaults', async () => {
    expect(await getSettings(getDb(env))).toEqual({
      'auth.allowedEmailDomain': 'umindanao.edu.ph',
      'assignment.requireSchedule': true,
      'scoring.weights': { load: 3, recency: 1, reliability: 1 },
      'scoring.loadUnitHours': 4,
      'ai.turnsPerHour': 40,
      'schoolYear.startMonth': 8,
    });
  });

  it('settings_put_validates_weights_range', async () => {
    const bad = await send('PUT', '/settings', { 'scoring.weights': { load: 11, recency: 1, reliability: 1 } }, adviser);
    expect(bad.status).toBe(400);
    const offStep = await send('PUT', '/settings', { 'scoring.weights': { load: 2.25, recency: 1, reliability: 1 } }, adviser);
    expect(offStep.status).toBe(400);
    const ok = await send('PUT', '/settings', { 'scoring.weights': { load: 2.5, recency: 0, reliability: 1 } }, adviser);
    expect(ok.status).toBe(200);
    expect((await getSettings(getDb(env)))['scoring.weights']).toEqual({ load: 2.5, recency: 0, reliability: 1 });
    expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'settings.update'`).first()).toEqual({ n: 1 });
  });

  it('settings_put_rejects_unknown_keys', async () => {
    expect((await send('PUT', '/settings', { 'nope.key': 1 }, adviser)).status).toBe(400);
  });

  it('domain_can_be_cleared_to_null', async () => {
    expect((await send('PUT', '/settings', { 'auth.allowedEmailDomain': null }, adviser)).status).toBe(200);
    const body = (await (await SELF.fetch('http://x/api/settings', { headers: adviser })).json()) as Record<string, unknown>;
    expect(body['auth.allowedEmailDomain']).toBeNull();
  });
});
