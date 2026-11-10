import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '../../server/db/client';
import { resolveAccess } from '../../server/services/access';
import { signIn } from './helpers/auth';

let adviser: Headers;
let adviserMemberId: number;
let member: Headers;

beforeAll(async () => {
  const a = await signIn(env, { role: 'adviser' });
  adviser = a.headers;
  adviserMemberId = a.memberId!;
  member = (await signIn(env, { role: 'member' })).headers;
});

function post(path: string, body: unknown, headers: Headers) {
  const h = new Headers(headers);
  h.set('content-type', 'application/json');
  return SELF.fetch(`http://x/api/access-requests${path}`, { method: 'POST', headers: h, body: JSON.stringify(body) });
}

async function pendingRequest(email: string) {
  await env.DB.prepare(`INSERT INTO user (id, name, email, email_verified) VALUES (?1, 'P', ?2, 1)`)
    .bind(`u-${email}`, email)
    .run();
  await resolveAccess(getDb(env), email, env);
  return (await env.DB.prepare('SELECT id FROM access_requests WHERE email = ?1').bind(email).first<{ id: number }>())!.id;
}

describe('POST /api/access-requests/bulk', () => {
  it('bulk_dedupes_and_reports_invalid', async () => {
    const res = await post('/bulk', { emails: ['A@x.com', 'a@x.com', 'bad'], role: 'member' }, adviser);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ created: 1, alreadyApproved: 0, invalid: ['bad'] });
    const row = await env.DB.prepare(`SELECT status, role, source FROM access_requests WHERE email = 'a@x.com'`).first();
    expect(row).toEqual({ status: 'approved', role: 'member', source: 'bulk' });
  });

  it('bulk_counts_already_approved_and_approves_pending', async () => {
    await pendingRequest('waiting@umindanao.edu.ph');
    const res = await post('/bulk', { emails: ['a@x.com', 'waiting@umindanao.edu.ph'], role: 'adviser' }, adviser);
    expect(await res.json()).toEqual({ created: 1, alreadyApproved: 1, invalid: [] });
    // the waiting user already signed in, so approval creates their member row now
    const m = await env.DB.prepare(`SELECT role FROM members WHERE email = 'waiting@umindanao.edu.ph'`).first();
    expect(m).toEqual({ role: 'adviser' });
  });

  it('bulk_handles_more_emails_than_d1_bind_limit', async () => {
    const emails = Array.from({ length: 250 }, (_, i) => `many${i}@umindanao.edu.ph`);
    const res = await post('/bulk', { emails, role: 'member' }, adviser);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ created: 250, alreadyApproved: 0, invalid: [] });
    const again = await post('/bulk', { emails, role: 'member' }, adviser);
    expect(await again.json()).toEqual({ created: 0, alreadyApproved: 250, invalid: [] });
  });

  it('bulk_rejects_bad_body_400', async () => {
    const res = await post('/bulk', { emails: 'nope', role: 'member' }, adviser);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  });
});

describe('approve / reject', () => {
  it('member_cannot_approve_403', async () => {
    const id = await pendingRequest('p1@umindanao.edu.ph');
    const res = await post(`/${id}/approve`, { role: 'member' }, member);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('approve_writes_audit_row', async () => {
    const id = await pendingRequest('p2@umindanao.edu.ph');
    const res = await post(`/${id}/approve`, { role: 'member' }, adviser);
    expect(res.status).toBe(200);
    const req = await env.DB.prepare('SELECT status, role, decided_by FROM access_requests WHERE id = ?1').bind(id).first();
    expect(req).toEqual({ status: 'approved', role: 'member', decided_by: adviserMemberId });
    const audit = await env.DB.prepare(`SELECT actor_id, entity_type, entity_id FROM audit_log WHERE action = 'access.approve'`).first();
    expect(audit).toEqual({ actor_id: adviserMemberId, entity_type: 'access_request', entity_id: id });
    const m = await env.DB.prepare(`SELECT role, onboarded_at FROM members WHERE email = 'p2@umindanao.edu.ph'`).first();
    expect(m).toEqual({ role: 'member', onboarded_at: null });
  });

  it('approve_unknown_id_404', async () => {
    const res = await post('/99999/approve', { role: 'member' }, adviser);
    expect(res.status).toBe(404);
  });

  it('reject_blocks_rerequest_for_7_days', async () => {
    const email = 'p3@umindanao.edu.ph';
    const id = await pendingRequest(email);
    const res = await post(`/${id}/reject`, { note: 'not a member' }, adviser);
    expect(res.status).toBe(200);
    expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'access.reject' AND entity_id = ?1`).bind(id).first()).toEqual({ n: 1 });

    // signing in again within 7 days stays rejected
    expect((await resolveAccess(getDb(env), email, env)).status).toBe('rejected');

    // after 7 days the next sign-in reopens the request as pending
    const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000).toISOString();
    await env.DB.prepare('UPDATE access_requests SET decided_at = ?1 WHERE id = ?2').bind(eightDaysAgo, id).run();
    expect((await resolveAccess(getDb(env), email, env)).status).toBe('pending');
    const row = await env.DB.prepare('SELECT status, decided_at, decided_by FROM access_requests WHERE id = ?1').bind(id).first();
    expect(row).toEqual({ status: 'pending', decided_at: null, decided_by: null });
  });
});

describe('rejected user view', () => {
  it('me_shows_earliest_rerequest_date', async () => {
    const u = await signIn(env, { access: 'pending' });
    const { id } = (await env.DB.prepare('SELECT id FROM access_requests WHERE email = ?1').bind(u.email).first<{ id: number }>())!;
    await post(`/${id}/reject`, {}, adviser);
    const me = (await (await SELF.fetch('http://x/api/me', { headers: u.headers })).json()) as {
      accessStatus: string;
      accessRerequestAt: string | null;
    };
    expect(me.accessStatus).toBe('rejected');
    const { decided_at } = (await env.DB.prepare('SELECT decided_at FROM access_requests WHERE id = ?1').bind(id).first<{ decided_at: string }>())!;
    expect(Date.parse(me.accessRerequestAt!) - Date.parse(decided_at)).toBe(7 * 86_400_000);
  });
});

describe('GET /api/access-requests', () => {
  it('lists by status with total', async () => {
    await pendingRequest('list1@umindanao.edu.ph');
    const res = await SELF.fetch('http://x/api/access-requests?status=pending&pageSize=100', { headers: adviser });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { email: string; status: string }[]; total: number };
    expect(body.total).toBe(body.items.length);
    expect(body.items.every((i) => i.status === 'pending')).toBe(true);
    expect(body.items.map((i) => i.email)).toContain('list1@umindanao.edu.ph');
  });
});
