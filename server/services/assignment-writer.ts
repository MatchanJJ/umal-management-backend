// TRD §8.5: the only path that creates assignments. All checks first, then one guarded D1 batch.
import type { AssignmentDTO, CreateAssignmentsInput, IneligibleDetail } from '../../shared/assignments';
import type { Constraints } from '../../shared/constraints';
import type { Db } from '../db/client';
import { checkEligibility, type CandidateFacts } from '../engine';
import type { ErrorCode } from '../errors';
import { auditStmt } from './audit';
import { loadCandidates } from './candidate-loader';
import { guardedBatch } from './write-guard';

export type WriteResult =
  | { ok: true; created: AssignmentDTO[]; version: number }
  | { ok: false; status: 404 | 409 | 422; code: ErrorCode; message: string; details?: unknown };

const fail = (status: 404 | 409 | 422, code: ErrorCode, message: string, details?: unknown): WriteResult => ({ ok: false, status, code, message, details });
type Pair = [shiftId: number, memberId: number];

export async function writeAssignments(db: Db, actorId: number, eventId: number, input: CreateAssignmentsInput): Promise<WriteResult> {
  const D = db.$client;
  const shiftIds = [...new Set(input.items.map((i) => i.shiftId))];
  const memberIds = [...new Set(input.items.flatMap((i) => i.memberIds))];

  // 1. Facts for exactly these members and shifts.
  const loaded = await loadCandidates(db, eventId, { memberIds, shiftIds });
  if (!loaded) return fail(404, 'NOT_FOUND', 'Event not found');
  const { event, shifts } = loaded;
  if (event.status !== 'draft' && event.status !== 'published') return fail(409, 'CONFLICT', `This event is ${event.status}`);
  const missing = shiftIds.find((id) => !shifts.some((s) => s.shiftId === id));
  if (missing) return fail(404, 'NOT_FOUND', `Shift ${missing} is not an active shift of this event`);
  const ended = shifts.find((s) => s.endAt <= s.now);
  if (ended) return fail(422, 'VALIDATION', 'Volunteers can only be added to shifts that haven’t ended', { shiftId: ended.shiftId });

  // AI approvals use the session's allowClassConflicts; manual adds need an explicit per-member override.
  let allowClassConflicts = false;
  let session: { id: number; constraints_json: string; last_result_json: string | null } | null = null;
  if (input.source === 'ai') {
    if (!input.aiSessionId) return fail(422, 'VALIDATION', 'aiSessionId is required for AI approvals');
    session = await D.prepare(`SELECT id, constraints_json, last_result_json FROM ai_sessions WHERE id = ?1 AND event_id = ?2 AND status = 'open'`)
      .bind(input.aiSessionId, eventId)
      .first<{ id: number; constraints_json: string; last_result_json: string | null }>();
    if (!session) return fail(404, 'NOT_FOUND', 'No open AssignAI session for this event');
    allowClassConflicts = (JSON.parse(session.constraints_json) as Constraints).allowClassConflicts;
  }

  // 2. Eligibility in chronological shift order; earlier items become bookings so one request can't double-book.
  const facts = new Map<number, CandidateFacts>(loaded.facts.map((f) => [f.memberId, f]));
  const byShift = new Map(shifts.map((s) => [s.shiftId, s]));
  const items = [...input.items].sort((a, b) => byShift.get(a.shiftId)!.startAt.localeCompare(byShift.get(b.shiftId)!.startAt));
  const problems: IneligibleDetail[] = [];
  const overrides: Pair[] = [];
  for (const item of items) {
    const shift = byShift.get(item.shiftId)!;
    for (const memberId of item.memberIds) {
      const f = facts.get(memberId);
      if (!f) {
        problems.push({ shiftId: item.shiftId, memberId, reasons: ['NOT_ASSIGNABLE'] });
        continue;
      }
      const e = checkEligibility(f, shift, { include: [], exclude: [] });
      const conflict = e.soft.includes('CLASS_CONFLICT');
      const overridden = conflict && !allowClassConflicts && (item.overrideConflictIds ?? []).includes(memberId);
      const reasons = [...e.hard, ...(conflict && !allowClassConflicts && !overridden ? (['CLASS_CONFLICT'] as const) : [])];
      if (reasons.length) problems.push({ shiftId: item.shiftId, memberId, reasons });
      if (overridden) overrides.push([item.shiftId, memberId]);
      facts.set(memberId, { ...f, bookings: [...f.bookings, { shiftId: shift.shiftId, start: shift.startAt, end: shift.endAt }] });
    }
  }
  if (problems.length) return fail(422, 'INELIGIBLE', 'Some volunteers can’t be assigned', problems);

  // 3. Capacity per shift.
  const full = items
    .map((i) => ({ shiftId: i.shiftId, remaining: byShift.get(i.shiftId)!.remainingSlots, adding: i.memberIds.length }))
    .filter((x) => x.adding > x.remaining);
  if (full.length) return fail(409, 'OVER_CAPACITY', 'Not enough open slots', full);

  // 4. Version (the guard in the batch closes the race between this check and the write).
  if (event.version !== input.expectedVersion) return versionConflict();

  const now = new Date().toISOString();
  const pairs: Pair[] = items.flatMap((i) => i.memberIds.map((m): Pair => [i.shiftId, m]));
  const isOverride = (p: Pair) => overrides.some(([s, m]) => s === p[0] && m === p[1]);
  const inserts = pairs.map(([shiftId, memberId]) =>
    D.prepare(
      `INSERT INTO assignments (event_id, shift_id, member_id, status, source, ai_session_id, conflict_override, assigned_by, assigned_at)
       VALUES (?1, ?2, ?3, 'assigned', ?4, ?5, ?6, ?7, ?8)
       RETURNING id, event_id AS eventId, shift_id AS shiftId, member_id AS memberId, status, source, conflict_override AS conflictOverride, assigned_at AS assignedAt`,
    ).bind(eventId, shiftId, memberId, input.source, session?.id ?? null, isOverride([shiftId, memberId]) ? 1 : 0, actorId, now),
  );
  // Audit rows reference the new assignment ids: inside the batch, the assignment for (shift, member) is the active one.
  const assignmentId = `(SELECT id FROM assignments WHERE shift_id = ?3 AND member_id = ?4 AND status <> 'cancelled')`;
  const audit = (action: 'assignment.create' | 'assignment.override_conflict', [shiftId, memberId]: Pair) =>
    D.prepare(`INSERT INTO audit_log (actor_id, action, entity_type, entity_id, data_json, created_at) VALUES (?1, ?2, 'assignment', ${assignmentId}, ?5, ?6)`).bind(
      actorId,
      action,
      shiftId,
      memberId,
      JSON.stringify({ eventId, shiftId, memberId, source: input.source }),
      now,
    );
  const writes = [...inserts, ...pairs.map((p) => audit('assignment.create', p)), ...overrides.map((p) => audit('assignment.override_conflict', p))];

  if (session) {
    const recommended: Pair[] = session.last_result_json
      ? (JSON.parse(session.last_result_json) as { picks: { shiftId: number; memberId: number }[] }).picks.map((p): Pair => [p.shiftId, p.memberId])
      : [];
    const has = (list: Pair[], p: Pair) => list.some(([s, m]) => s === p[0] && m === p[1]);
    const outcome = {
      recommended,
      approved: pairs,
      accepted: pairs.filter((p) => has(recommended, p)),
      removed: recommended.filter((p) => !has(pairs, p)),
      added: pairs.filter((p) => !has(recommended, p)),
    };
    writes.push(
      D.prepare(`UPDATE ai_sessions SET status = 'approved', outcome_json = ?2, updated_at = ?3 WHERE id = ?1`).bind(session.id, JSON.stringify(outcome), now),
    );
  }

  const results = await guardedBatch(D, eventId, input.expectedVersion, writes);
  if (!results) return versionConflict();
  const created = results.slice(0, inserts.length).map((r) => {
    const row = (r.results as (Omit<AssignmentDTO, 'conflictOverride'> & { conflictOverride: number })[])[0];
    return { ...row, conflictOverride: row.conflictOverride === 1 };
  });
  return { ok: true, created, version: event.version + 1 };
}

function versionConflict(): WriteResult {
  return fail(409, 'VERSION_CONFLICT', 'The roster changed since you loaded it. Refresh and try again.');
}

/** Soft-cancel one assignment (adviser), through the same version guard. */
export async function cancelAssignment(db: Db, actorId: number, assignmentId: number, reason: string): Promise<WriteResult | { ok: true }> {
  const D = db.$client;
  const a = await D.prepare(
    `SELECT a.id, a.event_id, a.status, e.version, e.status AS event_status FROM assignments a JOIN events e ON e.id = a.event_id WHERE a.id = ?1`,
  )
    .bind(assignmentId)
    .first<{ id: number; event_id: number; status: string; version: number; event_status: string }>();
  if (!a) return fail(404, 'NOT_FOUND', 'Assignment not found');
  if (a.status === 'cancelled') return fail(409, 'CONFLICT', 'Already cancelled');
  if (a.event_status === 'cancelled' || a.event_status === 'completed') return fail(409, 'CONFLICT', `This event is ${a.event_status}`);
  const now = new Date().toISOString();
  const ok = await guardedBatch(D, a.event_id, a.version, [
    D.prepare(`UPDATE assignments SET status = 'cancelled', cancelled_by = ?2, cancelled_at = ?3, cancel_reason = ?4 WHERE id = ?1`).bind(a.id, actorId, now, reason),
    auditStmt(D, actorId, 'assignment.cancel', 'assignment', a.id, { eventId: a.event_id, reason }),
  ]);
  return ok ? { ok: true } : versionConflict();
}
