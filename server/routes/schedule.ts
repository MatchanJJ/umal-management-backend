import { and, asc, desc, eq, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { DAY_NAMES, findOverlap, ScheduleInput, type ScheduleResponse } from '../../shared/schedule';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { requireMember } from '../middleware/auth';
import { validate } from '../validate';

const { classSchedules: cs, classEntries: ce, terms } = schema;
const Query = z.object({ termId: z.coerce.number().int().positive().optional() });

// Mounted at /api/me/schedule.
export const schedule = new Hono<AppEnv>()
  .get('/', ...requireMember, validate('query', Query), async (c) => {
    const memberId = c.get('member')!.id;
    const db = getDb(c.env);
    const q = c.req.valid('query');
    const term = q.termId
      ? await db.select().from(terms).where(eq(terms.id, q.termId)).get()
      : await db.select().from(terms).where(eq(terms.isActive, true)).get();
    const empty: ScheduleResponse = { termId: null, submitted: false, entries: [], previousTermAvailable: false, previousTermId: null };
    if (!term) return q.termId ? apiError(c, 404, 'NOT_FOUND', 'Term not found') : c.json(empty);

    const [own, entries, prev] = await db.batch([
      db.select({ id: cs.id }).from(cs).where(and(eq(cs.memberId, memberId), eq(cs.termId, term.id))).limit(1),
      db
        .select({ dayOfWeek: ce.dayOfWeek, startTime: ce.startTime, endTime: ce.endTime, label: ce.label })
        .from(ce)
        .innerJoin(cs, eq(cs.id, ce.scheduleId))
        .where(and(eq(cs.memberId, memberId), eq(cs.termId, term.id)))
        .orderBy(asc(ce.dayOfWeek), asc(ce.startTime)),
      // Most recent earlier term in which this member submitted a schedule ("Copy from previous term").
      db
        .select({ termId: cs.termId })
        .from(cs)
        .innerJoin(terms, eq(terms.id, cs.termId))
        .where(and(eq(cs.memberId, memberId), lt(terms.startDate, term.startDate)))
        .orderBy(desc(terms.startDate))
        .limit(1),
    ]);
    const body: ScheduleResponse = {
      termId: term.id,
      submitted: own.length > 0,
      entries,
      previousTermAvailable: prev.length > 0,
      previousTermId: prev[0]?.termId ?? null,
    };
    return c.json(body);
  })

  .put('/', ...requireMember, validate('json', ScheduleInput), async (c) => {
    const { termId, entries } = c.req.valid('json');
    const memberId = c.get('member')!.id;
    const db = getDb(c.env);
    if (!(await db.select({ id: terms.id }).from(terms).where(eq(terms.id, termId)).get())) {
      return apiError(c, 422, 'VALIDATION', 'Unknown term', { field: 'termId' });
    }
    const clash = findOverlap(entries);
    if (clash) {
      const [a, b] = clash;
      return apiError(
        c,
        422,
        'VALIDATION',
        `${DAY_NAMES[a.dayOfWeek - 1]} ${a.startTime}–${a.endTime} overlaps ${b.startTime}–${b.endTime}`,
        { overlap: clash },
      );
    }

    // One D1 batch (a transaction): upsert the schedule, drop its entries, insert the new set.
    const now = new Date().toISOString();
    const D = c.env.DB;
    const scheduleId = `(SELECT id FROM class_schedules WHERE member_id = ?1 AND term_id = ?2)`;
    await D.batch([
      D.prepare(
        `INSERT INTO class_schedules (member_id, term_id, submitted_at, updated_at) VALUES (?1, ?2, ?3, ?3)
         ON CONFLICT (member_id, term_id) DO UPDATE SET submitted_at = excluded.submitted_at, updated_at = excluded.updated_at`,
      ).bind(memberId, termId, now),
      D.prepare(`DELETE FROM class_entries WHERE schedule_id = ${scheduleId}`).bind(memberId, termId),
      ...entries.map((e) =>
        D.prepare(
          `INSERT INTO class_entries (schedule_id, day_of_week, start_time, end_time, label) VALUES (${scheduleId}, ?3, ?4, ?5, ?6)`,
        ).bind(memberId, termId, e.dayOfWeek, e.startTime, e.endTime, e.label ?? null),
      ),
    ]);
    return c.json({ termId, submitted: true, entries: entries.length });
  });
