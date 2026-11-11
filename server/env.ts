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
  /** 'fake' selects the deterministic e2e provider (honoured only when ENV is local/test). */
  AI_PROVIDER?: string;
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

/** Variables set by middleware. `aiProviders` is only ever set by tests (dependency injection); prod uses env keys. */
export type AppEnv = {
  Bindings: Env;
  Variables: { member?: MemberCtx; authUser?: AuthUser; aiProviders?: import('./ai/interpret').Provider[] };
};
