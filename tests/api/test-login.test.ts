import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { app } from '../../server/app';

const login = (body: object, target: (req: Request) => Promise<Response> = (r) => SELF.fetch(r)) =>
  target(new Request('http://x/api/test/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

describe('POST /api/test/login (e2e only)', () => {
  it('creates_an_onboarded_signed_in_user_in_test_env', async () => {
    const res = await login({ email: 'e2e.adviser@umindanao.edu.ph', role: 'adviser' });
    expect(res.status).toBe(200);
    const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    expect(cookie).toContain('session_token');
    const me = (await (await SELF.fetch('http://x/api/me', { headers: { cookie } })).json()) as { accessStatus: string; onboarded: boolean; member: { role: string } };
    expect(me).toMatchObject({ accessStatus: 'approved', onboarded: true, member: { role: 'adviser' } });
    // signing in again reuses the same member
    expect((await login({ email: 'e2e.adviser@umindanao.edu.ph', role: 'adviser' })).status).toBe(200);
    expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM members WHERE email = 'e2e.adviser@umindanao.edu.ph'`).first()).toEqual({ n: 1 });
  });

  it.each(['production', 'preview', undefined])('is_404_when_ENV_is_%s', async (ENV) => {
    const res = await login({ email: 'x.attacker.123456@umindanao.edu.ph', role: 'adviser' }, (req) => Promise.resolve(app.fetch(req, { ...env, ENV })));
    expect(res.status).toBe(404);
    expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM access_requests WHERE email = 'x.attacker.123456@umindanao.edu.ph'`).first()).toEqual({ n: 0 });
  });
});
