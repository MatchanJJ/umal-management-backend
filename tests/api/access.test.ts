import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { MeResponse } from '../../shared/api';
import { testHelpers } from './helpers/auth';
import { getDb } from '../../server/db/client';
import { assertEmailAllowed, resolveAccess } from '../../server/services/access';

const NOW = '2026-11-10T00:00:00.000Z';

async function insertUser(id: string, email: string) {
  await env.DB.prepare(`INSERT INTO user (id, name, email, email_verified) VALUES (?1, ?2, ?3, 1)`)
    .bind(id, email.split('@')[0], email)
    .run();
}

async function accessRow(email: string) {
  return env.DB.prepare('SELECT status, role, source FROM access_requests WHERE email = ?1')
    .bind(email)
    .first<{ status: string; role: string; source: string }>();
}

async function memberRow(email: string) {
  return env.DB.prepare('SELECT role, status, onboarded_at FROM members WHERE email = ?1')
    .bind(email)
    .first<{ role: string; status: string; onboarded_at: string | null }>();
}

async function setDomain(value: string | null) {
  await env.DB.prepare(`UPDATE settings SET value_json = ?1 WHERE key = 'auth.allowedEmailDomain'`)
    .bind(JSON.stringify(value))
    .run();
}

describe('resolveAccess', () => {
  it('unknown_email_creates_pending_request', async () => {
    const email = 'new1@umindanao.edu.ph';
    await insertUser('u-new1', email);
    const res = await resolveAccess(getDb(env), email, env);
    expect(res.status).toBe('pending');
    expect(res.member).toBeUndefined();
    expect(await accessRow(email)).toEqual({ status: 'pending', role: 'member', source: 'sign_in' });
    expect(await memberRow(email)).toBeNull();
  });

  it('bulk_preapproved_email_creates_member_with_role', async () => {
    const email = 'adv1@umindanao.edu.ph';
    await env.DB.prepare(
      `INSERT INTO access_requests (email, status, role, source, created_at) VALUES (?1, 'approved', 'adviser', 'bulk', ?2)`,
    )
      .bind(email, NOW)
      .run();
    await insertUser('u-adv1', email);
    const res = await resolveAccess(getDb(env), email, env);
    expect(res.status).toBe('approved');
    expect(res.member?.role).toBe('adviser');
    expect(await memberRow(email)).toEqual({ role: 'adviser', status: 'active', onboarded_at: null });
    // idempotent: a second sign-in doesn't create a second member
    await resolveAccess(getDb(env), email, env);
    const { n } = (await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE email = ?1').bind(email).first<{ n: number }>())!;
    expect(n).toBe(1);
  });

  it('rejected_email_returns_rejected', async () => {
    const email = 'rej1@umindanao.edu.ph';
    await env.DB.prepare(
      `INSERT INTO access_requests (email, status, role, source, created_at) VALUES (?1, 'rejected', 'member', 'sign_in', ?2)`,
    )
      .bind(email, NOW)
      .run();
    await insertUser('u-rej1', email);
    const res = await resolveAccess(getDb(env), email, env);
    expect(res.status).toBe('rejected');
    expect(await memberRow(email)).toBeNull();
  });

  it('bootstrap_adviser_auto_approved_as_adviser', async () => {
    const email = env.BOOTSTRAP_ADVISER_EMAIL; // a gmail address in the test env
    await setDomain('umindanao.edu.ph');
    await expect(assertEmailAllowed(getDb(env), email, env)).resolves.toBeUndefined();
    await insertUser('u-boot', email);
    const res = await resolveAccess(getDb(env), email, env);
    expect(res.status).toBe('approved');
    expect(res.member?.role).toBe('adviser');
    expect(await accessRow(email)).toMatchObject({ status: 'approved', role: 'adviser' });
  });

  it('domain_restriction_rejects_other_domain', async () => {
    await setDomain('umindanao.edu.ph');
    await expect(assertEmailAllowed(getDb(env), 'x@gmail.com', env)).rejects.toMatchObject({
      body: { code: 'DOMAIN_NOT_ALLOWED' },
    });
    await expect(assertEmailAllowed(getDb(env), 'X@UMINDANAO.EDU.PH', env)).resolves.toBeUndefined();
    await setDomain(null);
    await expect(assertEmailAllowed(getDb(env), 'x@gmail.com', env)).resolves.toBeUndefined();
    await setDomain('umindanao.edu.ph');
  });
});

describe('sign-in hooks', () => {
  it('new_user_from_other_domain_is_refused', async () => {
    await setDomain('umindanao.edu.ph');
    const test = await testHelpers(env);
    await expect(test.saveUser(test.createUser({ email: 'outsider@gmail.com' }))).rejects.toMatchObject({
      body: { code: 'DOMAIN_NOT_ALLOWED' },
    });
    expect(await accessRow('outsider@gmail.com')).toBeNull();
  });

  it('existing_user_refused_once_domain_restricted', async () => {
    await setDomain(null);
    const test = await testHelpers(env);
    const u = await test.saveUser(test.createUser({ email: 'early@gmail.com' }));
    await setDomain('umindanao.edu.ph');
    await expect(test.login({ userId: u.id })).rejects.toMatchObject({ body: { code: 'DOMAIN_NOT_ALLOWED' } });
  });
});

describe('GET /api/me', () => {
  it('me_without_session_401', async () => {
    const res = await SELF.fetch('http://x/api/me');
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('me_with_session_reports_pending_access', async () => {
    const test = await testHelpers(env);
    const u = await test.saveUser(test.createUser({ email: 'pend2@umindanao.edu.ph', name: 'Pen Ding' }));
    await resolveAccess(getDb(env), u.email, env);
    const { headers } = await test.login({ userId: u.id });
    const res = await SELF.fetch('http://x/api/me', { headers });
    expect(res.status).toBe(200);
    const body = (await res.json()) as MeResponse;
    expect(body).toMatchObject({
      user: { id: u.id, email: 'pend2@umindanao.edu.ph', name: 'Pen Ding' },
      accessStatus: 'pending',
      onboarded: false,
      member: null,
      activeTerm: null,
      scheduleSubmitted: false,
    });
  });

  it('me_for_approved_member_includes_member_and_active_term', async () => {
    await env.DB.prepare(
      `INSERT INTO terms (name, start_date, end_date, is_active, created_at) VALUES ('1st Sem', '2026-08-01', '2026-12-20', 1, ?1)`,
    )
      .bind(NOW)
      .run();
    await env.DB.prepare(
      `INSERT INTO access_requests (email, status, role, source, created_at) VALUES ('mem3@umindanao.edu.ph', 'approved', 'member', 'bulk', ?1)`,
    )
      .bind(NOW)
      .run();
    const test = await testHelpers(env);
    const u = await test.saveUser(test.createUser({ email: 'mem3@umindanao.edu.ph' }));
    await resolveAccess(getDb(env), u.email, env);
    const { headers } = await test.login({ userId: u.id });
    const body = (await (await SELF.fetch('http://x/api/me', { headers })).json()) as MeResponse;
    expect(body.accessStatus).toBe('approved');
    expect(body.member).toMatchObject({ email: 'mem3@umindanao.edu.ph', role: 'member', status: 'active' });
    expect(body.onboarded).toBe(false);
    expect(body.activeTerm).toMatchObject({ name: '1st Sem', startDate: '2026-08-01', endDate: '2026-12-20' });
  });
});
