import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { authOptions } from '../../../server/auth';
import type { Env } from '../../../server/env';

/** Production auth options + Better Auth's test-utils plugin (test-only; never in createAuth). */
export function createTestAuth(env: Env) {
  return betterAuth({ ...authOptions(env), plugins: [testUtils()] });
}

export async function testHelpers(env: Env) {
  return (await createTestAuth(env).$context).test;
}
