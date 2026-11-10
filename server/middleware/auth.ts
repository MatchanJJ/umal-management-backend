// Middleware chain for protected routes (TRD §5):
// requireSession → 401, requireApproved → 403 ACCESS_PENDING/ACCESS_REJECTED, requireOnboarded → 403
// ONBOARDING_REQUIRED, requireRole(...) → 403 FORBIDDEN. Client-side hiding is UX only; these are the gate.
import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import type { Role } from '../../shared/enums';
import { createAuth } from '../auth';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import type { AppEnv, AuthUser, MemberCtx } from '../env';
import { apiError } from '../errors';

export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return apiError(c, 401, 'UNAUTHENTICATED', 'Sign in required');
  const { id, email, name, image } = session.user;
  c.set('authUser', { id, email, name, image: image ?? null } satisfies AuthUser);
  await next();
});

export const requireApproved = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('authUser');
  if (!user) return apiError(c, 401, 'UNAUTHENTICATED', 'Sign in required');

  const db = getDb(c.env);
  const [member, request] = await db.batch([
    db.select().from(schema.members).where(eq(schema.members.userId, user.id)).limit(1),
    db
      .select({ status: schema.accessRequests.status })
      .from(schema.accessRequests)
      .where(eq(schema.accessRequests.email, user.email))
      .limit(1),
  ]);
  const m = member[0];
  const accessStatus = request[0]?.status;

  if (accessStatus === 'rejected') return apiError(c, 403, 'ACCESS_REJECTED', 'Your access request was declined');
  if (!m) return apiError(c, 403, 'ACCESS_PENDING', 'Your access request is awaiting approval');
  if (m.status !== 'active') return apiError(c, 403, 'FORBIDDEN', 'Your account is inactive');

  c.set('member', {
    id: m.id,
    role: m.role,
    status: m.status,
    email: m.email,
    onboarded: m.onboardedAt !== null,
  } satisfies MemberCtx);
  await next();
});

export const requireOnboarded = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('member')?.onboarded) {
    return apiError(c, 403, 'ONBOARDING_REQUIRED', 'Complete your profile first');
  }
  await next();
});

export function requireRole(...roles: Role[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const member = c.get('member');
    if (!member || !roles.includes(member.role)) {
      return apiError(c, 403, 'FORBIDDEN', 'You do not have permission to do this');
    }
    await next();
  });
}

/** Signed in, approved, active and onboarded: the default for every app route. */
export const requireMember = [requireSession, requireApproved, requireOnboarded] as const;

/** requireMember + adviser role. */
export const requireAdviser = [...requireMember, requireRole('adviser')] as const;
