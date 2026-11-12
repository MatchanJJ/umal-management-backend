// API response shapes shared by the client and server.
import { z } from 'zod';
import { ACCESS_STATUS, AUDIT_ACTIONS, MEMBER_STATUS, ROLES, type AccessStatus, type AuditAction, type MemberStatus, type Role } from './enums';

export type MemberDTO = {
  id: number;
  email: string;
  role: Role;
  status: MemberStatus;
  firstName: string | null;
  lastName: string | null;
  studentNumber: string | null;
  gender: 'M' | 'F' | null;
  collegeId: number | null;
  courseId: number | null;
  yearLevel: number | null;
  batchYear: number | null;
  heightCm: number | null;
  tshirtSize: string | null;
  onboardedAt: string | null;
};

export type TermDTO = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export type MeResponse = {
  user: { id: string; email: string; name: string; image: string | null };
  accessStatus: AccessStatus;
  /** When rejected: earliest time a new sign-in reopens the request (FR-6). */
  accessRerequestAt: string | null;
  onboarded: boolean;
  member: MemberDTO | null;
  activeTerm: TermDTO | null;
  scheduleSubmitted: boolean;
};

// ── Request schemas (Zod) ─────────────────────────────────────────────────

export const Pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const AccessListQuery = Pagination.extend({ status: z.enum(ACCESS_STATUS).optional() });

/** Raw strings; the server trims, lower-cases, dedupes and reports invalid ones. */
export const BulkAccessInput = z.object({
  emails: z.array(z.string().max(320)).min(1).max(500),
  role: z.enum(ROLES),
});
export type BulkAccessResult = { created: number; alreadyApproved: number; invalid: string[] };

export const ApproveInput = z.object({ role: z.enum(ROLES) });
export const RejectInput = z.object({ note: z.string().trim().max(500).optional() });

export type AccessRequestDTO = {
  id: number;
  email: string;
  status: AccessStatus;
  role: Role;
  source: 'sign_in' | 'bulk';
  decidedBy: number | null;
  decidedAt: string | null;
  note: string | null;
  createdAt: string;
};

export type Paged<T> = { items: T[]; total: number };

// ── Members directory, audit, dashboard (Task 6.3) ───────────────────────────

export const MemberListQuery = Pagination.extend({
  search: z.string().trim().max(80).optional(),
  college: z.string().trim().max(12).optional(), // college code
  yearLevel: z.coerce.number().int().min(1).max(5).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(MEMBER_STATUS).optional(),
  schedule: z.enum(['submitted', 'missing']).optional(), // for the active term
});
export type MemberListQuery = z.infer<typeof MemberListQuery>;

/** TRD §6: role and/or status; lock-out guards in services/members.ts. */
export const MemberPatch = z
  .object({ role: z.enum(ROLES), status: z.enum(MEMBER_STATUS) })
  .partial()
  .strict()
  .refine((p) => p.role !== undefined || p.status !== undefined, 'Change the role or the status');
export type MemberPatch = z.infer<typeof MemberPatch>;

export type MemberListItem = {
  id: number;
  name: string;
  email: string;
  studentNumber: string | null;
  role: Role;
  status: MemberStatus;
  collegeCode: string | null;
  yearLevel: number | null;
  onboarded: boolean;
  scheduleSubmitted: boolean;
};

export type MemberStats = { hours: number; shifts: number; attended: number; noShow: number; excused: number };
export type MemberHistoryItem = { id: number; eventId: number; eventTitle: string; shiftLabel: string; startAt: string; endAt: string; status: string; source: 'ai' | 'manual' };
export type MemberDetail = {
  member: MemberDTO;
  collegeCode: string | null;
  courseName: string | null;
  activeTerm: TermDTO | null;
  scheduleSubmitted: boolean;
  stats: MemberStats; // active term
  assignments: MemberHistoryItem[]; // newest first
};

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const AuditQuery = Pagination.extend({
  actor: z.coerce.number().int().positive().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  entityType: z.enum(['event', 'assignment', 'member', 'access_request', 'term', 'settings', 'catalog']).optional(),
  from: isoDay.optional(), // Asia/Manila dates, inclusive
  to: isoDay.optional(),
  eventId: z.coerce.number().int().positive().optional(), // the event and its assignments (Activity tab)
});
export type AuditQuery = z.infer<typeof AuditQuery>;
export type AuditItem = {
  id: number;
  createdAt: string;
  actor: { id: number; name: string } | null;
  action: AuditAction;
  entityType: string;
  entityId: number | null;
  data: unknown;
};

export type DashboardResponse = {
  missingSchedules: number; // active, onboarded members without a schedule for the active term (null term → 0)
  needsAttendance: { id: number; title: string; endAt: string; unmarked: number }[];
  newConflicts: { assignmentId: number; eventId: number; eventTitle: string; shiftId: number; shiftLabel: string; startAt: string; endAt: string; memberId: number; memberName: string }[];
};

export type AiHealth = {
  turns7d: number;
  providers: Record<string, number>; // turns by provider in the last 7 days (LLM turns only)
  fallbacks7d: number; // answered by groq
  failures7d: number; // no provider answered
  p50LatencyMs: number | null;
  lastError: { at: string; message: string } | null;
};
