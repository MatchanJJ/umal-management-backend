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

/** UM registrar day codes (as printed on the study load) → ISO weekdays. A class is entered once and plotted on each day. */
export const DAY_CODES = [
  { code: 'M-Sa', hint: 'Mon–Sat', days: [1, 2, 3, 4, 5, 6] },
  { code: 'M-SA1', hint: 'Mon–Wed', days: [1, 2, 3] },
  { code: 'M-SA2', hint: 'Thu–Sat', days: [4, 5, 6] },
  { code: 'Mon', hint: 'Monday', days: [1] },
  { code: 'Tue', hint: 'Tuesday', days: [2] },
  { code: 'Wed', hint: 'Wednesday', days: [3] },
  { code: 'Thu', hint: 'Thursday', days: [4] },
  { code: 'Fri', hint: 'Friday', days: [5] },
  { code: 'Sa', hint: 'Saturday', days: [6] },
] as const;
export type DayCode = (typeof DAY_CODES)[number]['code'];

/** One class row per weekday the code covers (storage stays per day, so conflicts and the engine are unchanged). */
export function entriesForDayCode<T extends Omit<ClassEntry, 'dayOfWeek'>>(code: DayCode, entry: T): (T & { dayOfWeek: number })[] {
  return DAY_CODES.find((d) => d.code === code)!.days.map((dayOfWeek) => ({ ...entry, dayOfWeek }));
}

// ── Unavailability (FR-8) ─────────────────────────────────────────────────
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const blockTimes = {
  startTime: TimeOfDay.optional(),
  endTime: EndTime.optional(),
  /** Shorthand for 00:00–24:00. */
  wholeDay: z.boolean().optional(),
  reason: z.string().trim().max(120).nullish(),
};

export const UnavailabilityInput = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('weekly'), dayOfWeek: z.number().int().min(1).max(7), termId: z.number().int().positive().optional(), ...blockTimes }).strict(),
    z.object({ kind: z.literal('date'), date: isoDate, ...blockTimes }).strict(),
  ])
  .transform(({ wholeDay, ...b }) => (wholeDay ? { ...b, startTime: '00:00', endTime: '24:00' } : b))
  .refine((b) => b.startTime && b.endTime, { message: 'Give a start and end time, or mark it whole day', path: ['startTime'] })
  .refine((b) => b.startTime! < b.endTime!, { message: 'End time must be after the start time', path: ['endTime'] });

export type UnavailabilityDTO = {
  id: number;
  termId: number;
  kind: 'weekly' | 'date';
  dayOfWeek: number | null;
  date: string | null;
  startTime: string;
  endTime: string;
  reason: string | null;
};
