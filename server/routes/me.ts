import { and, eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import type { MeResponse, MemberDTO, TermDTO } from '../../shared/api';
import { OnboardingInput, ProfileInput, studentNumberFromEmail } from '../../shared/profile';
import { createAuth } from '../auth';
import * as schema from '../db/schema';
import { getDb } from '../db/client';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { requireApproved, requireMember, requireSession } from '../middleware/auth';
import { isBootstrapAdviser, rerequestAt, type MemberRow } from '../services/access';
import { auditInsert } from '../services/audit';
import { validate } from '../validate';
import { schedule } from './schedule';

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
  .post('/onboarding', requireSession, requireApproved, validate('json', OnboardingInput), async (c) =>
    saveProfile(c, c.req.valid('json'), true),
  )
  .patch('/profile', ...requireMember, validate('json', ProfileInput), async (c) => saveProfile(c, c.req.valid('json'), false))
  .route('/schedule', schedule)
  // Stub with its final guard (Task 1.3). Task 4.3 implements the member's own assignments.
  .get('/assignments', ...requireMember, (c) => c.json({ stub: true }));

/** Writes the caller's own profile (FR-5). Role and email are never accepted here (schemas are strict). */
async function saveProfile(c: Context<AppEnv>, input: ProfileInput, onboard: boolean) {
  const actor = c.get('member')!;
  const db = getDb(c.env);
  const current = (await db.select().from(schema.members).where(eq(schema.members.id, actor.id)).get())!;

  // Schema §9 rule 5: the course must belong to the college (checked against the merged result).
  const collegeId = input.collegeId ?? current.collegeId;
  const courseId = input.courseId === undefined ? current.courseId : input.courseId;
  if (courseId !== null) {
    const course = await db
      .select({ id: schema.courses.id })
      .from(schema.courses)
      .where(and(eq(schema.courses.id, courseId), eq(schema.courses.collegeId, collegeId ?? -1), eq(schema.courses.active, true)))
      .get();
    if (!course) return apiError(c, 422, 'VALIDATION', 'Pick a course from the selected college', { field: 'courseId' });
  }

  const now = new Date().toISOString();
  const set = {
    ...input,
    updatedAt: now,
    ...(onboard ? { studentNumber: studentNumberFromEmail(current.email) } : {}),
    ...(onboard && !current.onboardedAt ? { onboardedAt: now } : {}),
  };
  try {
    await db.batch([
      db.update(schema.members).set(set).where(eq(schema.members.id, actor.id)),
      ...(onboard ? [auditInsert(db, actor.id, 'member.onboard', 'member', actor.id)] : []),
    ]);
  } catch (e) {
    if (String((e as Error)?.cause ?? e).includes('members.student_number')) {
      return apiError(c, 409, 'STUDENT_NUMBER_TAKEN', 'Already registered, contact an adviser', { field: 'studentNumber' });
    }
    throw e;
  }
  const saved = (await db.select().from(schema.members).where(eq(schema.members.id, actor.id)).get())!;
  return c.json(toMemberDTO(saved));
}
