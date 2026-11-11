import { z } from 'zod';

/** 'HH:MM' 24 h, zero-padded so string order = time order. '24:00' is valid only as an end time. */
export const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24 h)');
export const EndTime = z.union([TimeOfDay, z.literal('24:00')]);

export const ClassEntry = z
  .object({
    dayOfWeek: z.number().int().min(1).max(7), // ISO: 1 = Monday … 7 = Sunday
    startTime: TimeOfDay,
    endTime: EndTime,
    label: z.string().trim().max(60).nullish(),
  })
  .strict()
  .refine((e) => e.startTime < e.endTime, { message: 'End time must be after the start time', path: ['endTime'] });
export type ClassEntry = z.infer<typeof ClassEntry>;

export const ScheduleInput = z
  .object({ termId: z.number().int().positive(), entries: z.array(ClassEntry).max(80) })
  .strict();

export type ScheduleResponse = {
  termId: number | null;
  submitted: boolean;
  entries: { dayOfWeek: number; startTime: string; endTime: string; label: string | null }[];
  previousTermAvailable: boolean;
  previousTermId: number | null;
};

/** First pair of entries on the same day whose times overlap (touching end = start is fine), else null. */
export function findOverlap<T extends Pick<ClassEntry, 'dayOfWeek' | 'startTime' | 'endTime'>>(entries: T[]): [T, T] | null {
  const sorted = [...entries].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    const [a, b] = [sorted[i - 1], sorted[i]];
    if (a.dayOfWeek === b.dayOfWeek && b.startTime < a.endTime) return [a, b];
  }
  return null;
}

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
