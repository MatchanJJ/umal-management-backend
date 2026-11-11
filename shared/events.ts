import { z } from 'zod';
import { EVENT_STATUS } from './enums';
import { EndTime, TimeOfDay } from './schedule';

/** Local 'YYYY-MM-DDTHH:MM' (Asia/Manila, no conversion). */
export const LocalDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, 'Use YYYY-MM-DDTHH:MM');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const ShiftInput = z
  .object({
    id: z.number().int().positive().optional(), // present = update that shift; absent = create
    label: z.string().trim().min(1).max(40),
    startAt: LocalDateTime,
    endAt: LocalDateTime,
    requiredVolunteers: z.number().int().min(1).max(200),
  })
  .strict();
export type ShiftInput = z.infer<typeof ShiftInput>;

const details = {
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullish(),
  venue: z.string().trim().max(120).nullish(),
};

/** Either a single block (startAt/endAt/requiredVolunteers → one "Main" shift) or explicit shifts. */
export const EventInput = z
  .object({
    ...details,
    startAt: LocalDateTime.optional(),
    endAt: LocalDateTime.optional(),
    requiredVolunteers: z.number().int().min(1).max(200).optional(),
    shifts: z.array(ShiftInput.omit({ id: true })).min(1).max(30).optional(),
  })
  .strict()
  .refine((e) => e.shifts || (e.startAt && e.endAt && e.requiredVolunteers), {
    message: 'Give start, end and volunteers needed, or a list of shifts',
    path: ['shifts'],
  });
export type EventInput = z.infer<typeof EventInput>;

/** `shifts`, when present, is the full desired list of active shifts. */
export const EventPatch = z
  .object({
    title: details.title.optional(),
    description: details.description,
    venue: details.venue,
    status: z.enum(['draft', 'published']).optional(),
    shifts: z.array(ShiftInput).min(1).max(30).optional(),
    expectedVersion: z.number().int().min(0),
  })
  .strict();
export type EventPatch = z.infer<typeof EventPatch>;

export const DailyShiftsInput = z
  .object({
    fromDate: isoDate,
    toDate: isoDate,
    startTime: TimeOfDay,
    endTime: EndTime,
    requiredVolunteers: z.number().int().min(1).max(200),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const CancelEventInput = z.object({ reason: z.string().trim().min(1).max(300), expectedVersion: z.number().int().min(0) }).strict();

export const EventListQuery = z.object({
  status: z.enum(EVENT_STATUS).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export type ShiftDTO = { id: number; label: string; startAt: string; endAt: string; requiredVolunteers: number; position: number; activeCount: number };
export type EventDTO = {
  id: number;
  termId: number;
  title: string;
  description: string | null;
  venue: string | null;
  startAt: string;
  endAt: string;
  status: (typeof EVENT_STATUS)[number];
  cancelReason: string | null;
  version: number;
  shifts: ShiftDTO[];
};

/** Validation that Zod can't express (Schema §9 rule 2): returns a message, or null when the shift set is valid. */
export function shiftSetError(shifts: Pick<ShiftInput, 'label' | 'startAt' | 'endAt'>[]): string | null {
  const hours = (a: string, b: string) => (Date.parse(`${b}Z`) - Date.parse(`${a}Z`)) / 3_600_000;
  for (const s of shifts) {
    if (s.startAt >= s.endAt) return `${s.label}: the end must be after the start`;
    if (hours(s.startAt, s.endAt) > 24) return `${s.label}: a shift can last at most 24 hours`;
  }
  const labels = shifts.map((s) => s.label.toLowerCase());
  if (new Set(labels).size !== labels.length) return 'Shift labels must be unique';
  const start = shifts.reduce((m, s) => (s.startAt < m ? s.startAt : m), shifts[0].startAt);
  const end = shifts.reduce((m, s) => (s.endAt > m ? s.endAt : m), shifts[0].endAt);
  if (hours(start, end) > 14 * 24) return 'An event can span at most 14 days';
  return null;
}
