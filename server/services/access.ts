import { APIError } from 'better-auth/api';
import { eq, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { AccessStatus } from '../../shared/enums';
import * as schema from '../db/schema';
import type { Env } from '../env';
import { getSetting } from './settings';

type Db = DrizzleD1Database<typeof schema>;
export type MemberRow = typeof schema.members.$inferSelect;

const nowIso = () => new Date().toISOString();

export function isBootstrapAdviser(email: string, env: Pick<Env, 'BOOTSTRAP_ADVISER_EMAIL'>): boolean {
  const boot = env.BOOTSTRAP_ADVISER_EMAIL?.trim().toLowerCase();
  return !!boot && email.trim().toLowerCase() === boot;
}

/**
 * Sign-in gate (TRD §5 step 1). Throws DOMAIN_NOT_ALLOWED when `auth.allowedEmailDomain` is set and the
 * email is outside it. The bootstrap adviser is always allowed.
 */
export async function assertEmailAllowed(db: Db, email: string, env: Env): Promise<void> {
  if (isBootstrapAdviser(email, env)) return;
  const domain = await getSetting(db, 'auth.allowedEmailDomain');
  if (!domain) return;
  if (!email.trim().toLowerCase().endsWith(`@${domain.toLowerCase()}`)) {
    throw new APIError('FORBIDDEN', {
      code: 'DOMAIN_NOT_ALLOWED',
      message: `Sign in with your @${domain} account.`,
    });
  }
}

/**
 * Resolves (and records) an email's access on sign-in (TRD §5 step 2):
 * approved → ensure a members row with the approved role; pending/missing → upsert pending; rejected → rejected.
 * The bootstrap adviser is approved as `adviser`.
 */
export async function resolveAccess(
  db: Db,
  email: string,
  env: Env,
): Promise<{ status: AccessStatus; member?: MemberRow }> {
  const addr = email.trim();
  const ar = schema.accessRequests;

  if (isBootstrapAdviser(addr, env)) {
    await db
      .insert(ar)
      .values({ email: addr, status: 'approved', role: 'adviser', source: 'sign_in', decidedAt: nowIso(), createdAt: nowIso() })
      .onConflictDoUpdate({ target: ar.email, set: { status: 'approved', role: 'adviser' } });
  }

  const req = await db.select().from(ar).where(eq(ar.email, addr)).get();
  if (!req) {
    await db
      .insert(ar)
      .values({ email: addr, status: 'pending', role: 'member', source: 'sign_in', createdAt: nowIso() })
      .onConflictDoNothing();
    return { status: 'pending' };
  }
  if (req.status === 'rejected') {
    if (!canRerequest(req.decidedAt)) return { status: 'rejected' };
    // FR-6: after the cool-down, signing in again reopens the request.
    await db
      .update(ar)
      .set({ status: 'pending', source: 'sign_in', decidedBy: null, decidedAt: null })
      .where(eq(ar.id, req.id));
    return { status: 'pending' };
  }
  if (req.status === 'pending') return { status: 'pending' };

  const member = await ensureMember(db, addr, req.role);
  return member ? { status: 'approved', member } : { status: 'approved' };
}

/** FR-6: a rejected email can request access again this many days after the decision. */
export const REREQUEST_DAYS = 7;

/** Earliest ISO time a rejected request can be re-opened, or null when unknown. */
export function rerequestAt(decidedAt: string | null): string | null {
  if (!decidedAt) return null;
  return new Date(Date.parse(decidedAt) + REREQUEST_DAYS * 86_400_000).toISOString();
}

function canRerequest(decidedAt: string | null, now = Date.now()): boolean {
  const at = rerequestAt(decidedAt);
  return at !== null && Date.parse(at) <= now;
}

/** Creates the members row for an approved email if its auth user exists (idempotent). */
export async function ensureMember(db: Db, email: string, role: MemberRow['role']): Promise<MemberRow | undefined> {
  const m = schema.members;
  const existing = await db.select().from(m).where(eq(m.email, email)).get();
  if (existing) return existing;

  const u = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(sql`lower(${schema.user.email}) = lower(${email})`)
    .get();
  if (!u) return undefined; // no auth user yet; created on their first sign-in

  const now = nowIso();
  await db
    .insert(m)
    .values({ userId: u.id, email, role, status: 'active', createdAt: now, updatedAt: now })
    .onConflictDoNothing();
  return db.select().from(m).where(eq(m.email, email)).get();
}
