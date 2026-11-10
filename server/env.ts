import type { D1Database } from '@cloudflare/workers-types';

export type Env = {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  AI_GATEWAY_URL?: string;
  BOOTSTRAP_ADVISER_EMAIL: string;
  ENV: 'local' | 'test' | 'preview' | 'production';
};

export type Role = 'member' | 'adviser';

/** Set on `c.var.member` by the auth middleware chain (Task 1.3). */
export type MemberCtx = {
  id: number;
  role: Role;
  status: 'active' | 'inactive';
  email: string;
  onboarded: boolean;
};

/** The signed-in Better Auth user, set by `requireSession`. */
export type AuthUser = { id: string; email: string; name: string; image: string | null };

export type AppEnv = { Bindings: Env; Variables: { member?: MemberCtx; authUser?: AuthUser } };
