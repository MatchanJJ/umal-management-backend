import { z } from 'zod';

const halfStep = z.number().min(0).max(10).multipleOf(0.5);

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
    'scoring.weights': z.object({ load: halfStep, recency: halfStep, reliability: halfStep }).strict(),
    'scoring.loadUnitHours': z.number().min(1).max(12),
    'ai.turnsPerHour': z.number().int().min(1).max(500),
    'schoolYear.startMonth': z.number().int().min(1).max(12),
  })
  .partial()
  .strict();

export type Settings = Required<z.infer<typeof SettingsPatch>>;

export const SETTINGS_DEFAULTS: Settings = {
  'auth.allowedEmailDomain': 'umindanao.edu.ph',
  'assignment.requireSchedule': true,
  'scoring.weights': { load: 3, recency: 1, reliability: 1 },
  'scoring.loadUnitHours': 4,
  'ai.turnsPerHour': 40,
  'schoolYear.startMonth': 8,
};

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
