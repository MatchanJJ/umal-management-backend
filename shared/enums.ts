// Enumerations mirrored from Backend Schema §5 (and TRD §7.2 for priorities).
// The DB CHECK constraints in server/db/schema.ts are built from these arrays.

export const ROLES = ['member', 'adviser'] as const;
export type Role = (typeof ROLES)[number];

export const MEMBER_STATUS = ['active', 'inactive'] as const;
export type MemberStatus = (typeof MEMBER_STATUS)[number];

export const ACCESS_STATUS = ['pending', 'approved', 'rejected'] as const;
export type AccessStatus = (typeof ACCESS_STATUS)[number];

export const ACCESS_SOURCE = ['sign_in', 'bulk'] as const;

export const EVENT_STATUS = ['draft', 'published', 'completed', 'cancelled'] as const;
export type EventStatus = (typeof EVENT_STATUS)[number];

export const ASSIGNMENT_STATUS = ['assigned', 'attended', 'no_show', 'excused', 'cancelled'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS)[number];

export const ASSIGNMENT_SOURCE = ['ai', 'manual'] as const;
export type AssignmentSource = (typeof ASSIGNMENT_SOURCE)[number];

export const REASONS = [
  'ALREADY_ON_SHIFT',
  'DOUBLE_BOOKED',
  'UNAVAILABLE',
  'SCHEDULE_MISSING',
  'CLASS_CONFLICT',
  'PINNED_EXCLUDE',
] as const;
export type Reason = (typeof REASONS)[number];

export const PRIORITIES = [
  'least_assigned_first',
  'reliable_first',
  'new_first',
  'returning_first',
  'tallest_first',
  'shortest_first',
  'male_first',
  'female_first',
] as const;
export type Priority = (typeof PRIORITIES)[number];

export const GENDERS = ['M', 'F'] as const;
export const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const;
export const UNAVAILABILITY_KIND = ['weekly', 'date'] as const;
export const AI_SESSION_STATUS = ['open', 'approved', 'abandoned'] as const;
export const AI_TURN_KIND = ['update', 'answer', 'clarify', 'confirm_request', 'manual_edit'] as const;
export const AI_PROVIDER = ['gemini', 'groq', 'none'] as const;

export const AUDIT_ACTIONS = [
  'access.approve',
  'access.reject',
  'access.bulk_approve',
  'member.role_change',
  'member.status_change',
  'member.onboard',
  'event.create',
  'event.update',
  'event.publish',
  'event.cancel',
  'shift.create',
  'shift.update',
  'shift.remove',
  'assignment.create',
  'assignment.override_conflict',
  'assignment.cancel',
  'attendance.mark',
  'term.create',
  'term.activate',
  'settings.update',
  'catalog.update',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
