// Schema-generation config for the Better Auth CLI only (`pnpm db:auth-schema`).
// Holds just what changes the auth tables; the runtime config is createAuth() in server/auth.ts.
import { betterAuth } from 'better-auth';

export const auth = betterAuth({
  socialProviders: { google: { clientId: 'cli', clientSecret: 'cli' } },
});
