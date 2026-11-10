import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodType } from 'zod';

/** zValidator that rethrows the ZodError so app.onError renders `400 VALIDATION` in the standard error shape. */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) {
  return zValidator(target, schema, (result) => {
    if (!result.success) throw result.error;
  });
}
