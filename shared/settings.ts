import { z } from 'zod';

const halfStep = z.number().min(0).max(10).multipleOf(0.5);
export const ScoringWeights = z.object({ load: halfStep, recency: halfStep, reliability: halfStep }).strict();

/** Settings keys, value types and ranges (Backend Schema §6). Every key is optional in a PUT. */
export const SettingsPatch = z
  .object({
    'auth.allowedEmailDomain': z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Enter a domain like umindanao.edu.ph')
      .nullable(),
    'assignment.requireSchedule': z.boolean(),
    'scoring.weights': ScoringWeights,
    'scoring.loadUnitHours': z.number().min(1).max(12),
    'ai.turnsPerHour': z.number().int().min(1).max(100),
    'schoolYear.startMonth': z.number().int().min(1).max(12),
  })
  .partial()
  .strict();

export type Settings = Required<z.infer<typeof SettingsPatch>>;

/** Fixed AssignAI ceilings over a rolling 24 h, on top of `ai.turnsPerHour`, so no setting can lift spend without bound. */
export const AI_TURNS_PER_DAY = 150; // per adviser
export const AI_TURNS_PER_DAY_ALL = 600; // all advisers together

export const SETTINGS_DEFAULTS: Settings = {
  'auth.allowedEmailDomain': 'umindanao.edu.ph',
  'assignment.requireSchedule': true,
  'scoring.weights': { load: 3, recency: 1, reliability: 1 },
  'scoring.loadUnitHours': 4,
  'ai.turnsPerHour': 40,
  'schoolYear.startMonth': 8,
};

/** UM has three terms a school year. Names are built from kind + year so every term is named the same way. */
export const TERM_KINDS = ['1st Semester', '2nd Semester', 'Summer'] as const;
export type TermKind = (typeof TERM_KINDS)[number];

/** Semesters span a school year ("1st Semester AY 2026-2027"); summer is one calendar year ("Summer 2027"). */
export function termName(kind: TermKind, year: number): string {
  return kind === 'Summer' ? `Summer ${year}` : `${kind} AY ${year}-${year + 1}`;
}

/** Inverse of termName; null for names typed before this format (the editor then starts from defaults). */
export function parseTermName(name: string): { kind: TermKind; year: number } | null {
  const sem = /^(1st|2nd) Semester AY (\d{4})-(\d{4})$/.exec(name);
  if (sem && Number(sem[3]) === Number(sem[2]) + 1) return { kind: `${sem[1]} Semester` as TermKind, year: Number(sem[2]) };
  const summer = /^Summer (\d{4})$/.exec(name);
  return summer ? { kind: 'Summer', year: Number(summer[1]) } : null;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const TermInput = z
  .object({ name: z.string().trim().min(1).max(80), startDate: isoDate, endDate: isoDate })
  .strict()
  .refine((t) => t.startDate < t.endDate, { message: 'End date must be after the start date', path: ['endDate'] });
export const TermPatch = z
  .object({ name: z.string().trim().min(1).max(80), startDate: isoDate, endDate: isoDate })
  .partial()
  .strict();

const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,12}$/, 'Use 2–12 letters, digits or dashes');
const name = z.string().trim().min(1).max(120);
export const CollegeInput = z.object({ code, name }).strict();
export const CollegePatch = z.object({ code, name, active: z.boolean() }).partial().strict();
export const CourseInput = z.object({ collegeId: z.number().int().positive(), code, name }).strict();
export const CoursePatch = z.object({ code, name, active: z.boolean() }).partial().strict();
