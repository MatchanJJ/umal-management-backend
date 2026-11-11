// Events API (TRD §6, App Flow §5). Every mutation = one guarded D1 batch (version bump + audit) — TRD §8.5.
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  CancelEventInput,
  DailyShiftsInput,
  EventInput,
  EventListQuery,
  EventPatch,
  shiftSetError,
  type EventDTO,
  type ShiftDTO,
  type ShiftInput,
} from '../../shared/events';
import { getDb } from '../db/client';
import { averageHours, checkEligibility, daysBetween, scoreCandidate } from '../engine';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { requireAdviser, requireMember } from '../middleware/auth';
import { CreateAssignmentsInput } from '../../shared/assignments';
import { writeAssignments } from '../services/assignment-writer';
import { auditStmt } from '../services/audit';
import { loadCandidates } from '../services/candidate-loader';
import { termForDate } from '../services/terms';
import { guardedBatch } from '../services/write-guard';
import { validate } from '../validate';

const IdParam = z.object({ id: z.coerce.number().int().positive() });
const CandidatesQuery = z.object({ shiftId: z.coerce.number().int().positive(), search: z.string().trim().max(80).optional() });
type NewShift = Omit<ShiftInput, 'id'>;
type EventRow = Omit<EventDTO, 'shifts'>;

const EVENT_COLS = `id, term_id AS termId, title, description, venue, start_at AS startAt, end_at AS endAt, status, cancel_reason AS cancelReason, version`;
const SHIFT_COLS = `s.id, s.event_id AS eventId, s.label, s.start_at AS startAt, s.end_at AS endAt, s.required_volunteers AS requiredVolunteers, s.position,
  (SELECT COUNT(*) FROM assignments a WHERE a.shift_id = s.id AND a.status <> 'cancelled') AS activeCount`;

async function readEvents(D: D1Database, where: string, binds: unknown[]): Promise<EventDTO[]> {
  const events = (await D.prepare(`SELECT ${EVENT_COLS} FROM events WHERE ${where} ORDER BY start_at`).bind(...binds).all<EventRow>()).results;
  if (!events.length) return [];
  const ids = JSON.stringify(events.map((e) => e.id));
  const shifts = (
    await D.prepare(`SELECT ${SHIFT_COLS} FROM shifts s WHERE s.active = 1 AND s.event_id IN (SELECT value FROM json_each(?1)) ORDER BY s.start_at, s.position`)
      .bind(ids)
      .all<ShiftDTO & { eventId: number }>()
  ).results;
  const dto = (s: ShiftDTO & { eventId: number }): ShiftDTO => ({
    id: s.id,
    label: s.label,
    startAt: s.startAt,
    endAt: s.endAt,
    requiredVolunteers: s.requiredVolunteers,
    position: s.position,
    activeCount: s.activeCount,
  });
  return events.map((e) => ({ ...e, shifts: shifts.filter((s) => s.eventId === e.id).map(dto) }));
}
const readEvent = async (D: D1Database, id: number) => (await readEvents(D, 'id = ?1', [id]))[0];

/** Span + term for a final shift set, or an error response. */
async function spanAndTerm(c: Context<AppEnv>, shifts: NewShift[]) {
  const err = shiftSetError(shifts);
  if (err) return { error: apiError(c, 422, 'VALIDATION', err) };
  const startAt = shifts.reduce((m, s) => (s.startAt < m ? s.startAt : m), shifts[0].startAt);
  const endAt = shifts.reduce((m, s) => (s.endAt > m ? s.endAt : m), shifts[0].endAt);
  const term = await termForDate(getDb(c.env), startAt.slice(0, 10));
  if (!term) return { error: apiError(c, 422, 'NO_TERM_FOR_DATE', `No term covers ${startAt.slice(0, 10)}. Add the term in Settings first.`) };
  return { startAt, endAt, termId: term.id };
}

const insertShift = (D: D1Database, eventIdSql: string, s: NewShift, position: number, now: string, binds: unknown[] = []) =>
  D.prepare(
    `INSERT INTO shifts (event_id, label, start_at, end_at, required_volunteers, position, created_at, updated_at)
     VALUES (${eventIdSql}, ?${binds.length + 1}, ?${binds.length + 2}, ?${binds.length + 3}, ?${binds.length + 4}, ?${binds.length + 5}, ?${binds.length + 6}, ?${binds.length + 6})`,
  ).bind(...binds, s.label, s.startAt, s.endAt, s.requiredVolunteers, position, now);

// Removed shifts are kept (no hard deletes) but renamed so the label can be reused.
const removeShift = (D: D1Database, id: number, now: string) =>
  D.prepare(`UPDATE shifts SET active = 0, label = label || ' (removed #' || id || ')', updated_at = ?2 WHERE id = ?1`).bind(id, now);

function editable(c: Context<AppEnv>, e: EventRow | undefined) {
  if (!e) return apiError(c, 404, 'NOT_FOUND', 'Event not found');
  if (e.status === 'cancelled' || e.status === 'completed') return apiError(c, 409, 'CONFLICT', `This event is ${e.status} and can't be changed`);
  return null;
}

const conflict = (c: Context<AppEnv>) => apiError(c, 409, 'VERSION_CONFLICT', 'The event changed since you loaded it. Refresh and try again.');

export const events = new Hono<AppEnv>()
  .get('/', ...requireMember, validate('query', EventListQuery), async (c) => {
    const q = c.req.valid('query');
    const memberView = c.get('member')!.role === 'member';
    // FR-14: members only ever see published and completed events.
    const where = [
      memberView ? `status IN ('published', 'completed')` : '1 = 1',
      q.status ? `status = ?1` : '?1 IS NULL',
      q.from ? `end_at >= ?2` : '?2 IS NULL',
      q.to ? `start_at <= ?3` : '?3 IS NULL',
    ].join(' AND ');
    const items = await readEvents(c.env.DB, where, [q.status ?? null, q.from ?? null, q.to ? `${q.to}T24:00` : null]);
    return c.json({ items, total: items.length });
  })

  .get('/:id', ...requireMember, validate('param', IdParam), async (c) => {
    const e = await readEvent(c.env.DB, c.req.valid('param').id);
    const hidden = c.get('member')!.role === 'member' && e && !['published', 'completed'].includes(e.status);
    if (!e || hidden) return apiError(c, 404, 'NOT_FOUND', 'Event not found');
    return c.json(e);
  })

  .post('/', ...requireAdviser, validate('json', EventInput), async (c) => {
    const input = c.req.valid('json');
    const shifts: NewShift[] = input.shifts ?? [
      { label: 'Main', startAt: input.startAt!, endAt: input.endAt!, requiredVolunteers: input.requiredVolunteers! },
    ];
    const st = await spanAndTerm(c, shifts);
    if ('error' in st) return st.error;
    const D = c.env.DB;
    const actor = c.get('member')!.id;
    const now = new Date().toISOString();
    // One transaction: inside a D1 batch writes are serialized, so MAX(id) is the event inserted just before.
    const [created] = await D.batch([
      D.prepare(
        `INSERT INTO events (term_id, title, description, venue, start_at, end_at, status, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'draft', ?7, ?8, ?8) RETURNING id`,
      ).bind(st.termId, input.title, input.description ?? null, input.venue ?? null, st.startAt, st.endAt, actor, now),
      ...[...shifts].sort((a, b) => a.startAt.localeCompare(b.startAt)).map((s, i) => insertShift(D, '(SELECT MAX(id) FROM events)', s, i + 1, now)),
      D.prepare(
        `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, data_json, created_at) VALUES (?1, 'event.create', 'event', (SELECT MAX(id) FROM events), ?2, ?3)`,
      ).bind(actor, JSON.stringify({ title: input.title, shifts: shifts.length }), now),
    ]);
    const id = (created.results as { id: number }[])[0].id;
    return c.json(await readEvent(D, id), 201);
  })

  .patch('/:id', ...requireAdviser, validate('param', IdParam), validate('json', EventPatch), async (c) => {
    const { id } = c.req.valid('param');
    const p = c.req.valid('json');
    const D = c.env.DB;
    const current = await readEvent(D, id);
    const blocked = editable(c, current);
    if (blocked) return blocked;
    if (current.version !== p.expectedVersion) return conflict(c);

    const actor = c.get('member')!.id;
    const now = new Date().toISOString();
    const writes: D1PreparedStatement[] = [];
    let span = { startAt: current.startAt, endAt: current.endAt, termId: current.termId };

    if (p.shifts) {
      const byId = new Map(current.shifts.map((s) => [s.id, s]));
      const unknown = p.shifts.find((s) => s.id !== undefined && !byId.has(s.id));
      if (unknown) return apiError(c, 422, 'VALIDATION', `Shift ${unknown.id} is not part of this event`);
      // Schema §9 rule 3: staffed shifts can't be removed or moved; required can't drop below active.
      for (const cur of current.shifts) {
        const next = p.shifts.find((s) => s.id === cur.id);
        const staffed = cur.activeCount > 0;
        if (staffed && (!next || next.startAt !== cur.startAt || next.endAt !== cur.endAt)) {
          return apiError(c, 409, 'SHIFT_HAS_ASSIGNMENTS', `Cancel the ${cur.activeCount} volunteer(s) on "${cur.label}" first`, { shiftId: cur.id });
        }
        if (next && next.requiredVolunteers < cur.activeCount) {
          return apiError(c, 422, 'VALIDATION', `"${cur.label}" already has ${cur.activeCount} volunteers`, { shiftId: cur.id });
        }
      }
      const st = await spanAndTerm(c, p.shifts);
      if ('error' in st) return st.error;
      span = st;
      const ordered = [...p.shifts].sort((a, b) => a.startAt.localeCompare(b.startAt));
      for (const cur of current.shifts.filter((s) => !p.shifts!.some((n) => n.id === s.id))) {
        writes.push(removeShift(D, cur.id, now), auditStmt(D, actor, 'shift.remove', 'event', id, { shiftId: cur.id, label: cur.label }));
      }
      ordered.forEach((s, i) => {
        if (s.id === undefined) {
          writes.push(insertShift(D, '?1', s, i + 1, now, [id]), auditStmt(D, actor, 'shift.create', 'event', id, { label: s.label }));
        } else {
          writes.push(
            D.prepare(`UPDATE shifts SET label = ?2, start_at = ?3, end_at = ?4, required_volunteers = ?5, position = ?6, updated_at = ?7 WHERE id = ?1`).bind(
              s.id,
              s.label,
              s.startAt,
              s.endAt,
              s.requiredVolunteers,
              i + 1,
              now,
            ),
          );
        }
      });
    }

    if (p.status === 'draft' && current.status === 'published' && current.shifts.some((s) => s.activeCount > 0)) {
      return apiError(c, 409, 'CONFLICT', 'Cancel its volunteers before unpublishing');
    }
    const status = p.status ?? current.status;
    writes.push(
      D.prepare(
        `UPDATE events SET title = ?2, description = ?3, venue = ?4, status = ?5, start_at = ?6, end_at = ?7, term_id = ?8, updated_at = ?9 WHERE id = ?1`,
      ).bind(
        id,
        p.title ?? current.title,
        p.description === undefined ? current.description : p.description,
        p.venue === undefined ? current.venue : p.venue,
        status,
        span.startAt,
        span.endAt,
        span.termId,
        now,
      ),
      auditStmt(D, actor, status === 'published' && current.status !== 'published' ? 'event.publish' : 'event.update', 'event', id, {
        changed: Object.keys(p).filter((k) => k !== 'expectedVersion'),
      }),
    );
    if (!(await guardedBatch(D, id, p.expectedVersion, writes))) return conflict(c);
    return c.json(await readEvent(D, id));
  })

  // FR-13a daily helper: replaces the (unstaffed) shifts with one shift per day, "Day 1…n".
  .post('/:id/shifts/daily', ...requireAdviser, validate('param', IdParam), validate('json', DailyShiftsInput), async (c) => {
    const { id } = c.req.valid('param');
    const d = c.req.valid('json');
    const D = c.env.DB;
    const current = await readEvent(D, id);
    const blocked = editable(c, current);
    if (blocked) return blocked;
    if (current.version !== d.expectedVersion) return conflict(c);
    const staffed = current.shifts.find((s) => s.activeCount > 0);
    if (staffed) return apiError(c, 409, 'SHIFT_HAS_ASSIGNMENTS', `Cancel the volunteers on "${staffed.label}" first`, { shiftId: staffed.id });

    const n = daysBetween(d.fromDate, d.toDate) + 1;
    if (n < 1 || n > 14) return apiError(c, 422, 'VALIDATION', 'Pick between 1 and 14 days');
    const day = (i: number) => new Date(Date.parse(`${d.fromDate}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    const endOf = (date: string) => (d.endTime === '24:00' ? `${new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)}T00:00` : `${date}T${d.endTime}`);
    const shifts: NewShift[] = Array.from({ length: n }, (_, i) => ({
      label: `Day ${i + 1}`,
      startAt: `${day(i)}T${d.startTime}`,
      endAt: endOf(day(i)),
      requiredVolunteers: d.requiredVolunteers,
    }));
    const st = await spanAndTerm(c, shifts);
    if ('error' in st) return st.error;
    const actor = c.get('member')!.id;
    const now = new Date().toISOString();
    const writes = [
      ...current.shifts.map((s) => removeShift(D, s.id, now)),
      ...shifts.map((s, i) => insertShift(D, '?1', s, i + 1, now, [id])),
      D.prepare(`UPDATE events SET start_at = ?2, end_at = ?3, term_id = ?4 WHERE id = ?1`).bind(id, st.startAt, st.endAt, st.termId),
      auditStmt(D, actor, 'shift.create', 'event', id, { daily: { from: d.fromDate, to: d.toDate, start: d.startTime, end: d.endTime, required: d.requiredVolunteers } }),
    ];
    if (!(await guardedBatch(D, id, d.expectedVersion, writes))) return conflict(c);
    return c.json(await readEvent(D, id));
  })

  // Cancel (any non-final state): all active assignments are cancelled with the reason (App Flow §5).
  .post('/:id/cancel', ...requireAdviser, validate('param', IdParam), validate('json', CancelEventInput), async (c) => {
    const { id } = c.req.valid('param');
    const { reason, expectedVersion } = c.req.valid('json');
    const D = c.env.DB;
    const current = await readEvent(D, id);
    const blocked = editable(c, current);
    if (blocked) return blocked;
    const actor = c.get('member')!.id;
    const now = new Date().toISOString();
    const ok = await guardedBatch(D, id, expectedVersion, [
      D.prepare(`UPDATE events SET status = 'cancelled', cancel_reason = ?2 WHERE id = ?1`).bind(id, reason),
      D.prepare(
        `UPDATE assignments SET status = 'cancelled', cancelled_by = ?2, cancelled_at = ?3, cancel_reason = ?4 WHERE event_id = ?1 AND status <> 'cancelled'`,
      ).bind(id, actor, now, `Event cancelled: ${reason}`),
      auditStmt(D, actor, 'event.cancel', 'event', id, { reason }),
    ]);
    if (!ok) return conflict(c);
    return c.json(await readEvent(D, id));
  })

  // TRD §8.5: the only route that creates assignments (manual adds and AI approvals).
  .post('/:id/assignments', ...requireAdviser, validate('param', IdParam), validate('json', CreateAssignmentsInput), async (c) => {
    const r = await writeAssignments(getDb(c.env), c.get('member')!.id, c.req.valid('param').id, c.req.valid('json'));
    if (!r.ok) return apiError(c, r.status, r.code, r.message, r.details);
    return c.json({ created: r.created, version: r.version }, 201);
  })

  // Manual-add dialog (App Flow §6): every active member with their eligibility and score for one shift.
  .get('/:id/candidates', ...requireAdviser, validate('param', IdParam), validate('query', CandidatesQuery), async (c) => {
    const { id } = c.req.valid('param');
    const { shiftId, search } = c.req.valid('query');
    const loaded = await loadCandidates(getDb(c.env), id, { shiftIds: [shiftId] });
    const shift = loaded?.shifts[0];
    if (!loaded || !shift) return apiError(c, 404, 'NOT_FOUND', 'Shift not found on this event');

    const ids = JSON.stringify(loaded.facts.map((f) => f.memberId));
    const people = new Map(
      (
        await c.env.DB.prepare(`SELECT id, first_name, last_name, email, student_number FROM members WHERE id IN (SELECT value FROM json_each(?1))`)
          .bind(ids)
          .all<{ id: number; first_name: string | null; last_name: string | null; email: string; student_number: string | null }>()
      ).results.map((p) => [p.id, p]),
    );
    const needle = search?.toLowerCase();
    const scoreCtx = { avgTermHours: averageHours(loaded.facts), loadUnitHours: shift.loadUnitHours, today: shift.today, weights: shift.weights };
    const items = loaded.facts
      .map((f) => {
        const p = people.get(f.memberId)!;
        return {
          member: {
            id: f.memberId,
            firstName: p.first_name,
            lastName: p.last_name,
            email: p.email,
            studentNumber: p.student_number,
            collegeCode: f.collegeCode,
            yearLevel: f.yearLevel,
            termHours: f.termHours,
          },
          eligibility: checkEligibility(f, shift, { include: [], exclude: [] }),
          score: scoreCandidate(f, scoreCtx),
        };
      })
      .filter((i) => !needle || [i.member.firstName, i.member.lastName, i.member.email, i.member.studentNumber].some((v) => v?.toLowerCase().includes(needle)))
      // Eligible first, then class conflicts, then the rest; best score first within each.
      .sort((a, b) => rank(a.eligibility) - rank(b.eligibility) || b.score.total - a.score.total);
    return c.json({ items });
  });

const rank = (e: { hard: string[]; soft: string[] }) => (e.hard.length ? 2 : e.soft.includes('CLASS_CONFLICT') ? 1 : 0);
