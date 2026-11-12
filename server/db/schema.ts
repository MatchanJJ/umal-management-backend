// Drizzle schema — Backend Schema §4. TS names camelCase, columns snake_case.
// Timestamps are ISO-8601 UTC TEXT; event/schedule times are local strings (no TZ math).
import { sql, type SQL } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import {
  ACCESS_SOURCE,
  ACCESS_STATUS,
  AI_PROVIDER,
  AI_SESSION_STATUS,
  AI_TURN_KIND,
  ASSIGNMENT_SOURCE,
  ASSIGNMENT_STATUS,
  EVENT_STATUS,
  GENDERS,
  MEMBER_STATUS,
  ROLES,
  TSHIRT_SIZES,
  UNAVAILABILITY_KIND,
} from '../../shared/enums';
import { user } from './auth-schema';

export * from './auth-schema';

/** TEXT COLLATE NOCASE — drizzle has no column collation option. */
const textNocase = customType<{ data: string }>({ dataType: () => 'text COLLATE NOCASE' });

/** `<col> IN ('a', 'b', ...)` for enum CHECK constraints (values are compile-time constants). */
function oneOf(col: AnySQLiteColumn, values: readonly string[]): SQL {
  return sql`${col} IN (${sql.raw(values.map((v) => `'${v}'`).join(', '))})`;
}

// ── Catalog ────────────────────────────────────────────────────────────────
export const colleges = sqliteTable('colleges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const courses = sqliteTable(
  'courses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    collegeId: integer('college_id')
      .notNull()
      .references(() => colleges.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
  },
  (t) => [unique('courses_college_code').on(t.collegeId, t.code)],
);

export const terms = sqliteTable(
  'terms',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    check('terms_dates', sql`${t.startDate} < ${t.endDate}`),
    uniqueIndex('terms_one_active').on(t.isActive).where(sql`${t.isActive} = 1`),
  ],
);

// ── Access & people ───────────────────────────────────────────────────────
export const accessRequests = sqliteTable(
  'access_requests',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: textNocase('email').notNull().unique(),
    status: text('status', { enum: ACCESS_STATUS }).notNull().default('pending'),
    role: text('role', { enum: ROLES }).notNull().default('member'),
    source: text('source', { enum: ACCESS_SOURCE }).notNull(),
    decidedBy: integer('decided_by').references((): AnySQLiteColumn => members.id),
    decidedAt: text('decided_at'),
    note: text('note'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    check('access_requests_status', oneOf(t.status, ACCESS_STATUS)),
    check('access_requests_role', oneOf(t.role, ROLES)),
    check('access_requests_source', oneOf(t.source, ACCESS_SOURCE)),
    index('access_requests_status_idx').on(t.status, t.createdAt),
  ],
);

export const members = sqliteTable(
  'members',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id),
    email: textNocase('email').notNull().unique(),
    role: text('role', { enum: ROLES }).notNull(),
    status: text('status', { enum: MEMBER_STATUS }).notNull().default('active'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    studentNumber: text('student_number').unique(),
    gender: text('gender', { enum: GENDERS }),
    collegeId: integer('college_id').references(() => colleges.id),
    courseId: integer('course_id').references(() => courses.id),
    yearLevel: integer('year_level'),
    batchYear: integer('batch_year'),
    heightCm: integer('height_cm'),
    tshirtSize: text('tshirt_size', { enum: TSHIRT_SIZES }),
    onboardedAt: text('onboarded_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    check('members_role', oneOf(t.role, ROLES)),
    check('members_status', oneOf(t.status, MEMBER_STATUS)),
    check('members_gender', oneOf(t.gender, GENDERS)),
    check('members_year_level', sql`${t.yearLevel} BETWEEN 1 AND 5`),
    check('members_batch_year', sql`${t.batchYear} BETWEEN 2000 AND 2100`),
    check('members_height', sql`${t.heightCm} BETWEEN 100 AND 230`),
    check('members_tshirt', oneOf(t.tshirtSize, TSHIRT_SIZES)),
    index('members_role_status').on(t.role, t.status),
    index('members_college').on(t.collegeId),
  ],
);

// ── Schedules & availability ──────────────────────────────────────────────
export const classSchedules = sqliteTable(
  'class_schedules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id),
    termId: integer('term_id')
      .notNull()
      .references(() => terms.id),
    submittedAt: text('submitted_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [unique('class_schedules_member_term').on(t.memberId, t.termId)],
);

export const classEntries = sqliteTable(
  'class_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    scheduleId: integer('schedule_id')
      .notNull()
      .references(() => classSchedules.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    label: text('label'),
  },
  (t) => [
    check('class_entries_day', sql`${t.dayOfWeek} BETWEEN 1 AND 7`),
    check('class_entries_times', sql`${t.startTime} < ${t.endTime}`),
    index('class_entries_schedule_day').on(t.scheduleId, t.dayOfWeek),
  ],
);

export const unavailability = sqliteTable(
  'unavailability',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id),
    termId: integer('term_id')
      .notNull()
      .references(() => terms.id),
    kind: text('kind', { enum: UNAVAILABILITY_KIND }).notNull(),
    dayOfWeek: integer('day_of_week'),
    date: text('date'),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    reason: text('reason'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    check('unavailability_kind', oneOf(t.kind, UNAVAILABILITY_KIND)),
    check('unavailability_day', sql`${t.dayOfWeek} BETWEEN 1 AND 7`),
    check('unavailability_times', sql`${t.startTime} < ${t.endTime}`),
    check(
      'unavailability_kind_fields',
      sql`(${t.kind} = 'weekly' AND ${t.dayOfWeek} IS NOT NULL AND ${t.date} IS NULL) OR (${t.kind} = 'date' AND ${t.date} IS NOT NULL AND ${t.dayOfWeek} IS NULL)`,
    ),
    index('unavailability_member_term').on(t.memberId, t.termId),
    index('unavailability_date').on(t.date).where(sql`${t.kind} = 'date'`),
  ],
);

// ── Events & assignments ──────────────────────────────────────────────────
export const events = sqliteTable(
  'events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    termId: integer('term_id')
      .notNull()
      .references(() => terms.id),
    title: text('title').notNull(),
    description: text('description'),
    venue: text('venue'),
    startAt: text('start_at').notNull(),
    endAt: text('end_at').notNull(),
    status: text('status', { enum: EVENT_STATUS }).notNull().default('draft'),
    cancelReason: text('cancel_reason'),
    version: integer('version').notNull().default(0),
    createdBy: integer('created_by')
      .notNull()
      .references(() => members.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    check('events_status', oneOf(t.status, EVENT_STATUS)),
    check('events_span', sql`${t.startAt} < ${t.endAt}`),
    index('events_start').on(t.startAt),
    index('events_end').on(t.endAt),
    index('events_term_status').on(t.termId, t.status),
  ],
);

export const shifts = sqliteTable(
  'shifts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id),
    label: text('label').notNull(),
    startAt: text('start_at').notNull(),
    endAt: text('end_at').notNull(),
    requiredVolunteers: integer('required_volunteers').notNull(),
    position: integer('position').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    check('shifts_required', sql`${t.requiredVolunteers} BETWEEN 1 AND 200`),
    check('shifts_span', sql`${t.startAt} < ${t.endAt}`),
    unique('shifts_event_label').on(t.eventId, t.label),
    index('shifts_event').on(t.eventId, t.position),
    index('shifts_time').on(t.startAt, t.endAt),
  ],
);

export const aiSessions = sqliteTable(
  'ai_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id),
    createdBy: integer('created_by')
      .notNull()
      .references(() => members.id),
    status: text('status', { enum: AI_SESSION_STATUS }).notNull().default('open'),
    constraintsJson: text('constraints_json').notNull(),
    pinsJson: text('pins_json').notNull().default('{"include":[],"exclude":[]}'),
    scopeJson: text('scope_json').notNull(),
    lastResultJson: text('last_result_json'),
    outcomeJson: text('outcome_json'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    check('ai_sessions_status', oneOf(t.status, AI_SESSION_STATUS)),
    uniqueIndex('ai_sessions_one_open').on(t.eventId, t.createdBy).where(sql`${t.status} = 'open'`),
  ],
);

export const assignments = sqliteTable(
  'assignments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id),
    shiftId: integer('shift_id')
      .notNull()
      .references(() => shifts.id),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id),
    status: text('status', { enum: ASSIGNMENT_STATUS }).notNull().default('assigned'),
    source: text('source', { enum: ASSIGNMENT_SOURCE }).notNull(),
    aiSessionId: integer('ai_session_id').references(() => aiSessions.id),
    conflictOverride: integer('conflict_override', { mode: 'boolean' }).notNull().default(false),
    assignedBy: integer('assigned_by')
      .notNull()
      .references(() => members.id),
    assignedAt: text('assigned_at').notNull(),
    attendanceMarkedBy: integer('attendance_marked_by').references(() => members.id),
    attendanceMarkedAt: text('attendance_marked_at'),
    cancelledBy: integer('cancelled_by').references(() => members.id),
    cancelledAt: text('cancelled_at'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    check('assignments_status', oneOf(t.status, ASSIGNMENT_STATUS)),
    check('assignments_source', oneOf(t.source, ASSIGNMENT_SOURCE)),
    check(
      'assignments_cancel_fields',
      sql`${t.status} <> 'cancelled' OR (${t.cancelledAt} IS NOT NULL AND ${t.cancelReason} IS NOT NULL)`,
    ),
    check('assignments_ai_session', sql`${t.source} <> 'ai' OR ${t.aiSessionId} IS NOT NULL`),
    uniqueIndex('assignments_one_active').on(t.shiftId, t.memberId).where(sql`${t.status} <> 'cancelled'`),
    index('assignments_member_status').on(t.memberId, t.status),
    index('assignments_event').on(t.eventId, t.status),
    index('assignments_shift').on(t.shiftId, t.status),
  ],
);

/** Optimistic-concurrency guard used inside D1 batches (TRD §8.5). Always empty after a batch. */
export const writeGuards = sqliteTable(
  'write_guards',
  { ok: integer('ok').notNull() },
  (t) => [check('write_guards_ok', sql`${t.ok} = 1`)],
);

export const aiTurns = sqliteTable(
  'ai_turns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => aiSessions.id),
    createdBy: integer('created_by')
      .notNull()
      .references(() => members.id),
    kind: text('kind', { enum: AI_TURN_KIND }).notNull(),
    userMessage: text('user_message'),
    reply: text('reply'),
    assumptionsJson: text('assumptions_json').notNull().default('[]'),
    constraintsJson: text('constraints_json').notNull(),
    provider: text('provider', { enum: AI_PROVIDER }).notNull(),
    model: text('model'),
    latencyMs: integer('latency_ms'),
    error: text('error'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    check('ai_turns_kind', oneOf(t.kind, AI_TURN_KIND)),
    check('ai_turns_provider', oneOf(t.provider, AI_PROVIDER)),
    index('ai_turns_session').on(t.sessionId, t.id),
    index('ai_turns_rate').on(t.createdBy, t.createdAt),
    index('ai_turns_created').on(t.createdAt), // app-wide daily AI cap and AI health window
  ],
);

// ── Audit & settings ──────────────────────────────────────────────────────
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    actorId: integer('actor_id').references(() => members.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id'),
    dataJson: text('data_json').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('audit_entity').on(t.entityType, t.entityId),
    index('audit_actor_time').on(t.actorId, t.createdAt),
    index('audit_time').on(t.createdAt),
  ],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedBy: integer('updated_by').references(() => members.id),
  updatedAt: text('updated_at').notNull(),
});
