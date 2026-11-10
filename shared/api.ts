// API response shapes shared by the client and server.
import { z } from 'zod';
import { ACCESS_STATUS, ROLES, type AccessStatus, type MemberStatus, type Role } from './enums';

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
