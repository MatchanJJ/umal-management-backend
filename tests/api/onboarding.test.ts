import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { signIn } from './helpers/auth';

let cceId: number;
let caeId: number;
let bscsId: number;

beforeAll(async () => {
  const col = (code: string) =>
    env.DB.prepare('SELECT id FROM colleges WHERE code = ?1').bind(code).first<{ id: number }>().then((r) => r!.id);
  cceId = await col('CCE');
  caeId = await col('CAE');
  await env.DB.prepare(`INSERT INTO courses (college_id, code, name, created_at) VALUES (?1, 'BSCS', 'BS Computer Science', '2026-11-10T00:00:00.000Z')`)
    .bind(cceId)
    .run();
  bscsId = (await env.DB.prepare(`SELECT id FROM courses WHERE code = 'BSCS'`).first<{ id: number }>())!.id;
});

let seq = 0;
/** A UM student email: initial.lastname.<6-digit id>@umindanao.edu.ph */
const umEmail = (id = 546600 + ++seq) => `a.cruz.${id}@umindanao.edu.ph`;

function profile(over: Record<string, unknown> = {}) {
  return {
    firstName: 'Ana',
    lastName: 'Cruz',
    gender: 'F',
    collegeId: cceId,
    courseId: bscsId,
    yearLevel: 3,
    batchYear: 2024,
    heightCm: 162,
    tshirtSize: 'M',
    ...over,
  };
}

function send(method: string, path: string, body: unknown, headers: Headers) {
  const h = new Headers(headers);
  h.set('content-type', 'application/json');
  return SELF.fetch(`http://x/api${path}`, { method, headers: h, body: JSON.stringify(body) });
}

describe('POST /api/me/onboarding', () => {
  it('onboarding_sets_onboarded_at', async () => {
    const email = umEmail(546616);
    const u = await signIn(env, { onboarded: false, email });
    const body = profile();
    const res = await send('POST', '/me/onboarding', body, u.headers);
    expect(res.status).toBe(200);
    const row = await env.DB.prepare('SELECT * FROM members WHERE id = ?1').bind(u.memberId).first<Record<string, unknown>>();
    expect(row).toMatchObject({
      first_name: 'Ana',
      last_name: 'Cruz',
      student_number: '546616', // derived from the email
      gender: 'F',
      college_id: cceId,
      course_id: bscsId,
      year_level: 3,
      batch_year: 2024,
      height_cm: 162,
      tshirt_size: 'M',
    });
    expect(row?.onboarded_at).toEqual(expect.any(String));
    const audit = await env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'member.onboard' AND entity_id = ?1`)
      .bind(u.memberId)
      .first();
    expect(audit).toEqual({ n: 1 });
    // now the member can use protected routes
    expect((await SELF.fetch('http://x/api/me/assignments', { headers: u.headers })).status).toBe(200);
  });

  it('course_must_belong_to_college', async () => {
    const u = await signIn(env, { onboarded: false });
    const res = await send('POST', '/me/onboarding', profile({ collegeId: caeId, courseId: bscsId }), u.headers);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  });

  it('course_is_optional_while_a_college_has_none', async () => {
    const u = await signIn(env, { onboarded: false });
    const res = await send('POST', '/me/onboarding', profile({ collegeId: caeId, courseId: null }), u.headers);
    expect(res.status).toBe(200);
  });

  it('duplicate_student_number_409', async () => {
    // Two different emails carrying the same ID number.
    const first = await signIn(env, { onboarded: false, email: 'a.cruz.777001@umindanao.edu.ph' });
    expect((await send('POST', '/me/onboarding', profile(), first.headers)).status).toBe(200);
    const second = await signIn(env, { onboarded: false, email: 'b.reyes.777001@umindanao.edu.ph' });
    const res = await send('POST', '/me/onboarding', profile(), second.headers);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'STUDENT_NUMBER_TAKEN' } });
  });

  it('email_without_id_number_leaves_student_number_empty', async () => {
    const u = await signIn(env, { onboarded: false, email: 'prof.santos@umindanao.edu.ph' });
    expect((await send('POST', '/me/onboarding', profile(), u.headers)).status).toBe(200);
    expect(await env.DB.prepare('SELECT student_number FROM members WHERE id = ?1').bind(u.memberId).first()).toEqual({ student_number: null });
  });

  it('student_number_cannot_be_sent_400', async () => {
    const u = await signIn(env, { onboarded: false, email: umEmail() });
    const res = await send('POST', '/me/onboarding', profile({ studentNumber: '999999' }), u.headers);
    expect(res.status).toBe(400);
  });

  it('rejects_out_of_range_height_400', async () => {
    const u = await signIn(env, { onboarded: false });
    const res = await send('POST', '/me/onboarding', profile({ heightCm: 99 }), u.headers);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  });

  it('protected_route_before_onboarding_403_ONBOARDING_REQUIRED', async () => {
    const u = await signIn(env, { onboarded: false });
    const res = await SELF.fetch('http://x/api/me/assignments', { headers: u.headers });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: 'ONBOARDING_REQUIRED' } });
  });

  it('pending_user_cannot_onboard', async () => {
    const u = await signIn(env, { access: 'pending' });
    expect((await send('POST', '/me/onboarding', profile(), u.headers)).status).toBe(403);
  });
});

describe('PATCH /api/me/profile', () => {
  it('updates_own_profile_fields', async () => {
    const u = await signIn(env, { onboarded: false });
    await send('POST', '/me/onboarding', profile(), u.headers);
    const res = await send('PATCH', '/me/profile', { heightCm: 170, tshirtSize: 'L' }, u.headers);
    expect(res.status).toBe(200);
    const row = await env.DB.prepare('SELECT height_cm, tshirt_size, first_name FROM members WHERE id = ?1').bind(u.memberId).first();
    expect(row).toEqual({ height_cm: 170, tshirt_size: 'L', first_name: 'Ana' });
  });

  it('cannot_change_role_or_email', async () => {
    const u = await signIn(env, { onboarded: false });
    await send('POST', '/me/onboarding', profile(), u.headers);
    const res = await send('PATCH', '/me/profile', { role: 'adviser', email: 'x@umindanao.edu.ph' }, u.headers);
    expect(res.status).toBe(400);
    const row = await env.DB.prepare('SELECT role, email FROM members WHERE id = ?1').bind(u.memberId).first();
    expect(row).toEqual({ role: 'member', email: u.email });
  });
});

describe('GET /api/catalog', () => {
  it('approved_not_onboarded_can_read_catalog', async () => {
    const u = await signIn(env, { onboarded: false });
    const res = await SELF.fetch('http://x/api/catalog', { headers: u.headers });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { colleges: { code: string; courses: { code: string }[] }[] };
    expect(body.colleges).toHaveLength(14);
    expect(body.colleges.find((c) => c.code === 'CCE')?.courses.map((c) => c.code)).toEqual(['BSCS']);
  });
});
