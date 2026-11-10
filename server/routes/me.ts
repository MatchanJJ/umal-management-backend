import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { MeResponse, MemberDTO, TermDTO } from '../../shared/api';
import { createAuth } from '../auth';
import * as schema from '../db/schema';
import { getDb } from '../db/client';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { requireMember } from '../middleware/auth';
import { isBootstrapAdviser, rerequestAt, type MemberRow } from '../services/access';

export function toMemberDTO(m: MemberRow): MemberDTO {
  return {
    id: m.id,
    email: m.email,
    role: m.role,
    status: m.status,
    firstName: m.firstName,
    lastName: m.lastName,
    studentNumber: m.studentNumber,
    gender: m.gender,
    collegeId: m.collegeId,
    courseId: m.courseId,
    yearLevel: m.yearLevel,
    batchYear: m.batchYear,
    heightCm: m.heightCm,
    tshirtSize: m.tshirtSize,
    onboardedAt: m.onboardedAt,
  };
}

export function toTermDTO(t: typeof schema.terms.$inferSelect): TermDTO {
  return { id: t.id, name: t.name, startDate: t.startDate, endDate: t.endDate, isActive: t.isActive };
}

export const me = new Hono<AppEnv>().get('/', async (c) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return apiError(c, 401, 'UNAUTHENTICATED', 'Sign in required');

  const db = getDb(c.env);
  const { user } = session;
  const [member, request, activeTerm] = await Promise.all([
    db.select().from(schema.members).where(eq(schema.members.userId, user.id)).get(),
    db.select().from(schema.accessRequests).where(eq(schema.accessRequests.email, user.email)).get(),
    db.select().from(schema.terms).where(eq(schema.terms.isActive, true)).get(),
  ]);

  const accessStatus = request?.status ?? (member || isBootstrapAdviser(user.email, c.env) ? 'approved' : 'pending');

  let scheduleSubmitted = false;
  if (member && activeTerm) {
    const sched = await db
      .select({ id: schema.classSchedules.id })
      .from(schema.classSchedules)
      .where(and(eq(schema.classSchedules.memberId, member.id), eq(schema.classSchedules.termId, activeTerm.id)))
      .get();
    scheduleSubmitted = !!sched;
  }

  const body: MeResponse = {
    user: { id: user.id, email: user.email, name: user.name, image: user.image ?? null },
    accessStatus,
    accessRerequestAt: accessStatus === 'rejected' ? rerequestAt(request?.decidedAt ?? null) : null,
    onboarded: !!member?.onboardedAt,
    member: member ? toMemberDTO(member) : null,
    activeTerm: activeTerm ? toTermDTO(activeTerm) : null,
    scheduleSubmitted,
  };
  return c.json(body);
})
  // Stub with its final guard (Task 1.3). Task 4.3 implements the member's own assignments.
  .get('/assignments', ...requireMember, (c) => c.json({ stub: true }));
