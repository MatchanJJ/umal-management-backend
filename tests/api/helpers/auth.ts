import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { authOptions } from '../../../server/auth';
import type { Env } from '../../../server/env';
import type { Role } from '../../../shared/enums';

/** Production auth options + Better Auth's test-utils plugin (test-only; never in createAuth). */
export function createTestAuth(env: Env) {
  return betterAuth({ ...authOptions(env), plugins: [testUtils()] });
}

export async function testHelpers(env: Env) {
  return (await createTestAuth(env).$context).test;
}

let seq = 0;

export type SignInOpts = {
  role?: Role;
  access?: 'approved' | 'pending' | 'rejected';
  onboarded?: boolean;
  status?: 'active' | 'inactive';
  email?: string;
};

/**
 * Creates a user in the given access state and returns request headers carrying its session cookie.
 * Goes through the real sign-in hooks (user.create.after → resolveAccess).
 */
export async function signIn(env: Env, opts: SignInOpts = {}) {
  const { role = 'member', access = 'approved', onboarded = true, status = 'active' } = opts;
  const email = opts.email ?? `t${++seq}-${role}-${access}@umindanao.edu.ph`;
  const now = new Date().toISOString();
  if (access !== 'pending') {
    await env.DB.prepare(
      `INSERT INTO access_requests (email, status, role, source, created_at) VALUES (?1, ?2, ?3, 'bulk', ?4)`,
    )
      .bind(email, access, role, now)
      .run();
  }
  const test = await testHelpers(env);
  const user = await test.saveUser(test.createUser({ email }));
  if (access === 'approved') {
    await env.DB.prepare(`UPDATE members SET onboarded_at = ?1, status = ?2 WHERE email = ?3`)
      .bind(onboarded ? now : null, status, email)
      .run();
  }
  const { headers } = await test.login({ userId: user.id });
  const member = await env.DB.prepare('SELECT id FROM members WHERE email = ?1').bind(email).first<{ id: number }>();
  return { headers, email, userId: user.id, memberId: member?.id };
}
