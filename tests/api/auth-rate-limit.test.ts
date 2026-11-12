import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { app } from '../../server/app';
import type { Env } from '../../server/env';

// Better Auth only rate-limits when NODE_ENV=production, which Workers never set, so it is switched on from ENV.
const signIn = (ENV: Env['ENV'], ip: string) =>
  app.fetch(
    new Request('http://x/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, origin: env.BETTER_AUTH_URL },
      body: JSON.stringify({ provider: 'google' }),
    }),
    { ...env, ENV },
  );

describe('auth rate limiting', () => {
  it.each(['production', 'preview'] as const)('is_on_in_%s', async (ENV) => {
    const ip = ENV === 'production' ? '203.0.113.1' : '203.0.113.2';
    const statuses = [];
    for (let i = 0; i < 31; i++) statuses.push((await signIn(ENV, ip)).status);
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true); // a class signing in from one campus IP
    expect(statuses[30]).toBe(429);
    expect((await signIn(ENV, '203.0.113.9')).status).toBe(200); // per client IP
  });

  it('is_off_in_test', async () => {
    for (let i = 0; i < 5; i++) expect((await signIn('test', '203.0.113.3')).status).toBe(200);
  });
});
