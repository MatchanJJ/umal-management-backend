// FR-27 attendance (App Flow §8). Mounted at /api/events next to the events routes.
import { Hono } from 'hono';
import { z } from 'zod';
import { MarkAttendanceInput } from '../../shared/assignments';
import { manilaNow } from '../../shared/time';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { requireAdviser } from '../middleware/auth';
import { auditStmt } from '../services/audit';
import { guardedBatch } from '../services/write-guard';
import { validate } from '../validate';

const IdParam = z.object({ id: z.coerce.number().int().positive() });

export const attendance = new Hono<AppEnv>().put(
  '/:id/attendance',
  ...requireAdviser,
  validate('param', IdParam),
  validate('json', MarkAttendanceInput),
  async (c) => {
    const D = c.env.DB;
    const eventId = c.req.valid('param').id;
    const { entries } = c.req.valid('json');
    const actorId = c.get('member')!.id;

    const ev = await D.prepare(`SELECT status, version FROM events WHERE id = ?1`).bind(eventId).first<{ status: string; version: number }>();
    if (!ev) return apiError(c, 404, 'NOT_FOUND', 'Event not found');
    // Completed events stay open for corrections (App Flow §8.4).
    if (ev.status !== 'published' && ev.status !== 'completed') return apiError(c, 409, 'CONFLICT', `Attendance can't be marked on a ${ev.status} event`);

    const rows = (
      await D.prepare(
        `SELECT a.id, a.status, s.label, s.end_at AS endAt FROM assignments a JOIN shifts s ON s.id = a.shift_id
         WHERE a.event_id = ?1 AND a.id IN (SELECT value FROM json_each(?2))`,
      )
        .bind(eventId, JSON.stringify(entries.map((e) => e.assignmentId)))
        .all<{ id: number; status: string; label: string; endAt: string }>()
    ).results;
    if (rows.length !== entries.length) return apiError(c, 404, 'NOT_FOUND', 'Assignment not found on this event');
    if (rows.some((r) => r.status === 'cancelled')) return apiError(c, 409, 'CONFLICT', 'Cancelled assignments have no attendance');
    const now = manilaNow();
    const open = rows.find((r) => now < r.endAt);
    if (open) return apiError(c, 409, 'CONFLICT', `${open.label} hasn't ended yet`);

    const before = new Map(rows.map((r) => [r.id, r.status]));
    const markedAt = new Date().toISOString();
    const writes = entries
      .filter((e) => before.get(e.assignmentId) !== e.status)
      .flatMap((e) => [
        D.prepare(`UPDATE assignments SET status = ?2, attendance_marked_by = ?3, attendance_marked_at = ?4 WHERE id = ?1`).bind(e.assignmentId, e.status, actorId, markedAt),
        auditStmt(D, actorId, 'attendance.mark', 'assignment', e.assignmentId, { eventId, from: before.get(e.assignmentId), to: e.status }),
      ]);
    // Runs even when nothing changed, so re-saving after the last (empty) shift ends still completes the event.
    const complete = D.prepare(
      `UPDATE events SET status = 'completed' WHERE id = ?1 AND status = 'published'
         AND NOT EXISTS (SELECT 1 FROM shifts WHERE event_id = ?1 AND active = 1 AND end_at > ?2)
         AND NOT EXISTS (SELECT 1 FROM assignments WHERE event_id = ?1 AND status = 'assigned')`,
    ).bind(eventId, now);

    const results = await guardedBatch(D, eventId, ev.version, [...writes, complete]);
    if (!results) return apiError(c, 409, 'VERSION_CONFLICT', 'The roster changed; reload and try again');
    const completed = results.at(-1)!.meta.changes > 0;
    return c.json({ eventStatus: completed ? 'completed' : ev.status, version: ev.version + 1 });
  },
);
