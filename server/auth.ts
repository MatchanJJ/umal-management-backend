import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import * as authSchema from './db/auth-schema';
import { getDb } from './db/client';
import type { Env } from './env';
import { assertEmailAllowed, resolveAccess } from './services/access';

const DAY = 60 * 60 * 24;

/** Better Auth options (TRD §5). Kept separate so tests can add the test-utils plugin to a test-only instance. */
export function authOptions(env: Env) {
  const db = getDb(env);
  return {
    appName: 'UMAL Management',
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: 'select_account',
      },
    },
    session: { expiresIn: 30 * DAY, updateAge: DAY },
    advanced: {
      defaultCookieAttributes: { httpOnly: true, secure: true, sameSite: 'lax' },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            await assertEmailAllowed(db, user.email, env);
          },
          after: async (user) => {
            await resolveAccess(db, user.email, env);
          },
        },
      },
      session: {
        create: {
          // Re-checked on every sign-in so a domain restriction added later still applies.
          before: async (session) => {
            const u = await db
              .select({ email: authSchema.user.email })
              .from(authSchema.user)
              .where(eq(authSchema.user.id, session.userId))
              .get();
            if (u) await assertEmailAllowed(db, u.email, env);
          },
        },
      },
    },
  } satisfies BetterAuthOptions;
}

export function createAuth(env: Env) {
  return betterAuth(authOptions(env));
}
