import { z } from 'zod';
import { GENDERS, TSHIRT_SIZES } from './enums';

/**
 * UM student emails end in the 6-digit ID number: `m.palma.546616@umindanao.edu.ph` → `546616`.
 * Anything else (advisers, the bootstrap Gmail) has no student number.
 */
export function studentNumberFromEmail(email: string): string | null {
  return /\.(\d{6})@umindanao\.edu\.ph$/i.exec(email.trim())?.[1] ?? null;
}

/** FR-5 onboarding fields (student number is derived from the email, never sent) with the Backend Schema §4 checks. `.strict()` keeps role/email out of self-edits. */
export const OnboardingInput = z
  .object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
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
