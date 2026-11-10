import { z } from 'zod';
import { GENDERS, TSHIRT_SIZES } from './enums';

/** FR-5 onboarding fields with the Backend Schema §4 checks. `.strict()` keeps role/email out of self-edits. */
export const OnboardingInput = z
  .object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    studentNumber: z.string().trim().regex(/^[A-Za-z0-9-]{3,20}$/, 'Use 3–20 letters, digits or dashes'),
    gender: z.enum(GENDERS),
    collegeId: z.number().int().positive(),
    // Optional while a college has no courses yet; advisers add courses after launch.
    courseId: z.number().int().positive().nullable().optional(),
    yearLevel: z.number().int().min(1).max(5),
    batchYear: z.number().int().min(2000).max(2100),
    heightCm: z.number().int().min(100).max(230),
    tshirtSize: z.enum(TSHIRT_SIZES),
  })
  .strict();
export type OnboardingInput = z.infer<typeof OnboardingInput>;

export const ProfileInput = OnboardingInput.partial().strict();
export type ProfileInput = z.infer<typeof ProfileInput>;

export type CatalogResponse = {
  colleges: { id: number; code: string; name: string; courses: { id: number; code: string; name: string }[] }[];
};
