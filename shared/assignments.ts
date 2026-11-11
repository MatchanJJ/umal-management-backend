import { z } from 'zod';

const ids = z.array(z.number().int().positive());

/** TRD §8.5 request. `memberIds` must be unique within an item. */
export const CreateAssignmentsInput = z
  .object({
    items: z
      .array(
        z
          .object({
            shiftId: z.number().int().positive(),
            memberIds: ids.min(1).max(200).refine((m) => new Set(m).size === m.length, 'Each member can be listed once per shift'),
            overrideConflictIds: ids.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    source: z.enum(['ai', 'manual']),
    aiSessionId: z.number().int().positive().optional(),
    expectedVersion: z.number().int().min(0),
  })
  .strict();
export type CreateAssignmentsInput = z.infer<typeof CreateAssignmentsInput>;

export const CancelAssignmentInput = z.object({ reason: z.string().trim().min(3).max(300) }).strict();

export const ATTENDANCE_STATUSES = ['attended', 'no_show', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** TRD §6 `PUT /api/events/:id/attendance`. Each assignment at most once. */
export const MarkAttendanceInput = z
  .object({
    entries: z
      .array(z.object({ assignmentId: z.number().int().positive(), status: z.enum(ATTENDANCE_STATUSES) }).strict())
      .min(1)
      .max(500)
      .refine((e) => new Set(e.map((x) => x.assignmentId)).size === e.length, 'Each assignment can be listed once'),
  })
  .strict();
export type MarkAttendanceInput = z.infer<typeof MarkAttendanceInput>;

/** Reasons a member can't be added: engine reasons plus NOT_ASSIGNABLE (not an active, onboarded member). */
export type IneligibleDetail = { shiftId: number; memberId: number; reasons: string[] };

export type AssignmentDTO = {
  id: number;
  eventId: number;
  shiftId: number;
  memberId: number;
  status: 'assigned' | 'attended' | 'no_show' | 'excused' | 'cancelled';
  source: 'ai' | 'manual';
  conflictOverride: boolean;
  assignedAt: string;
};
