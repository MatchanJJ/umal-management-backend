import { and, asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { UnavailabilityInput, type UnavailabilityDTO } from '../../shared/schedule';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { requireMember } from '../middleware/auth';
import { termForDate } from '../services/terms';
import { validate } from '../validate';

const u = schema.unavailability;
const IdParam = z.object({ id: z.coerce.number().int().positive() });
const toDTO = (r: typeof u.$inferSelect): UnavailabilityDTO => ({
  id: r.id,
  termId: r.termId,
  kind: r.kind,
  dayOfWeek: r.dayOfWeek,
  date: r.date,
  startTime: r.startTime,
  endTime: r.endTime,
  reason: r.reason,
});

// Mounted at /api/me/unavailability. Lists the caller's blocks in the active term plus every date block.
export const unavailability = new Hono<AppEnv>()
  .get('/', ...requireMember, async (c) => {
    const rows = await getDb(c.env)
      .select()
      .from(u)
      .where(eq(u.memberId, c.get('member')!.id))
      .orderBy(asc(u.kind), asc(u.dayOfWeek), asc(u.date), asc(u.startTime));
    return c.json(rows.map(toDTO));
  })

  .post('/', ...requireMember, validate('json', UnavailabilityInput), async (c) => {
    const input = c.req.valid('json');
    const db = getDb(c.env);
    // Weekly blocks belong to a term (given or active); date blocks to the term containing the date.
    const term =
      input.kind === 'date'
        ? await termForDate(db, input.date)
        : input.termId
          ? await db.select().from(schema.terms).where(eq(schema.terms.id, input.termId)).get()
          : await db.select().from(schema.terms).where(eq(schema.terms.isActive, true)).get();
    if (!term) {
      return input.kind === 'date'
        ? apiError(c, 422, 'NO_TERM_FOR_DATE', 'That date is outside every term', { field: 'date' })
        : apiError(c, 422, 'VALIDATION', 'There is no active term yet', { field: 'termId' });
    }
    const [row] = await db
      .insert(u)
      .values({
        memberId: c.get('member')!.id,
        termId: term.id,
        kind: input.kind,
        dayOfWeek: input.kind === 'weekly' ? input.dayOfWeek : null,
        date: input.kind === 'date' ? input.date : null,
        startTime: input.startTime!,
        endTime: input.endTime!,
        reason: input.reason ?? null,
        createdAt: new Date().toISOString(),
      })
      .returning();
    return c.json(toDTO(row), 201);
  })

  .delete('/:id', ...requireMember, validate('param', IdParam), async (c) => {
    const { id } = c.req.valid('param');
    // Scoped to the caller: someone else's block is indistinguishable from a missing one.
    const [gone] = await getDb(c.env)
      .delete(u)
      .where(and(eq(u.id, id), eq(u.memberId, c.get('member')!.id)))
      .returning({ id: u.id });
    if (!gone) return apiError(c, 404, 'NOT_FOUND', 'Block not found');
    return c.json({ ok: true });
  });
