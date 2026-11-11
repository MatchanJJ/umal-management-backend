import { Hono } from 'hono';
import { z } from 'zod';
import { CancelAssignmentInput } from '../../shared/assignments';
import { getDb } from '../db/client';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { requireAdviser } from '../middleware/auth';
import { cancelAssignment } from '../services/assignment-writer';
import { validate } from '../validate';

const IdParam = z.object({ id: z.coerce.number().int().positive() });

// Mounted at /api/assignments. Creation lives on POST /api/events/:id/assignments.
export const assignments = new Hono<AppEnv>().post(
  '/:id/cancel',
  ...requireAdviser,
  validate('param', IdParam),
  validate('json', CancelAssignmentInput),
  async (c) => {
    const r = await cancelAssignment(getDb(c.env), c.get('member')!.id, c.req.valid('param').id, c.req.valid('json').reason);
    if (!r.ok) return apiError(c, r.status, r.code, r.message, r.details);
    return c.json({ ok: true });
  },
);
