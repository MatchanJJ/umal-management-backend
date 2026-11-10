import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'ACCESS_PENDING'
  | 'ACCESS_REJECTED'
  | 'ONBOARDING_REQUIRED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'INELIGIBLE'
  | 'OVER_CAPACITY'
  | 'VERSION_CONFLICT'
  | 'NO_TERM_FOR_DATE'
  | 'AI_RATE_LIMITED'
  | 'NOT_FOUND'
  | 'DOMAIN_NOT_ALLOWED'
  | 'LAST_ADVISER'
  | 'SHIFT_HAS_ASSIGNMENTS'
  | 'STUDENT_NUMBER_TAKEN'
  | 'CONFLICT'
  | 'INTERNAL';

export type ErrorBody = { error: { code: ErrorCode; message: string; details?: unknown } };

export function apiError(
  c: Context,
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
  details?: unknown,
) {
  const body: ErrorBody = { error: details === undefined ? { code, message } : { code, message, details } };
  return c.json(body, status);
}
