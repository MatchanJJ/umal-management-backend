// Role/status changes with the TRD §5 lock-out guards, audited in the same batch. Deactivation also cancels future shifts.
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { eq } from 'drizzle-orm';
import type { MemberDTO, MemberPatch } from '../../shared/api';
import { manilaNow } from '../../shared/time';
import type { Db } from '../db/client';
import * as schema from '../db/schema';
import type { ErrorCode } from '../errors';
import { toMemberDTO } from '../routes/me';

export type MemberUpdateResult = { ok: true; member: MemberDTO } | { ok: false; status: 403 | 404 | 409; code: ErrorCode; message: string };

const fail = (status: 403 | 404 | 409, code: ErrorCode, message: string): MemberUpdateResult => ({ ok: false, status, code, message });

export const DEACTIVATED_REASON = 'Member deactivated';

/**
 * Deactivation frees the member's not-yet-started shifts on live events: one write-guard block per event
 * (Schema §9 rule 8), each statement conditional on the member row having just been deactivated (`updated_at = now`),
 * so a lost race on the member UPDATE cancels nothing. History (started, attended, completed) is kept.
 */
async function cancelFuture(D: D1Database, actorId: number, memberId: number, now: string): Promise<D1PreparedStatement[]> {
  const rows = (
    await D.prepare(
      `SELECT a.id, a.event_id AS eventId, e.version FROM assignments a JOIN shifts s ON s.id = a.shift_id JOIN events e ON e.id = a.event_id
       WHERE a.member_id = ?1 AND a.status = 'assigned' AND s.start_at > ?2 AND e.status IN ('draft','published')`,
    )
      .bind(memberId, manilaNow())
      .all<{ id: number; eventId: number; version: number }>()
  ).results;
  // Bound at positions n, n+1 of each statement.
  const applied = (n: number) => `EXISTS (SELECT 1 FROM members WHERE id = ?${n} AND status = 'inactive' AND updated_at = ?${n + 1})`;
  const byEvent = Map.groupBy(rows, (r) => r.eventId);
  return [...byEvent].flatMap(([eventId, list]) => [
    D.prepare(`INSERT INTO write_guards (ok) SELECT CASE WHEN version = ?2 THEN 1 ELSE 0 END FROM events WHERE id = ?1`).bind(eventId, list[0].version),
    D.prepare(`UPDATE events SET version = version + 1, updated_at = ?2 WHERE id = ?1 AND ${applied(3)}`).bind(eventId, now, memberId, now),
    ...list.flatMap((a) => [
      D.prepare(
        `UPDATE assignments SET status = 'cancelled', cancelled_by = ?2, cancelled_at = ?3, cancel_reason = ?4 WHERE id = ?1 AND status = 'assigned' AND ${applied(5)}`,
      ).bind(a.id, actorId, now, DEACTIVATED_REASON, memberId, now),
      D.prepare(
        `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, data_json, created_at) SELECT ?1, 'assignment.cancel', 'assignment', ?2, ?3, ?4 WHERE ${applied(5)}`,
      ).bind(actorId, a.id, JSON.stringify({ eventId, reason: DEACTIVATED_REASON }), now, memberId, now),
    ]),
    D.prepare(`DELETE FROM write_guards`),
  ]);
}

export async function updateMember(db: Db, actorId: number, targetId: number, patch: MemberPatch): Promise<MemberUpdateResult> {
  if (actorId === targetId) return fail(403, 'FORBIDDEN', "You can't change your own role or status");
  const D = db.$client;
  const read = () => db.select().from(schema.members).where(eq(schema.members.id, targetId)).get();
  const cur = await read();
  if (!cur) return fail(404, 'NOT_FOUND', 'Member not found');

  const role = patch.role ?? cur.role;
  const status = patch.status ?? cur.status;
  if (role === cur.role && status === cur.status) return { ok: true, member: toMemberDTO(cur) };

  const now = new Date().toISOString();
  const losesAdviser = cur.role === 'adviser' && cur.status === 'active' && (role !== 'adviser' || status !== 'active');
  // The guard lives in the UPDATE itself, so two advisers demoting each other at once can't both succeed.
  const update = D.prepare(
    `UPDATE members SET role = ?2, status = ?3, updated_at = ?4 WHERE id = ?1 AND role = ?5 AND status = ?6
     ${losesAdviser ? `AND EXISTS (SELECT 1 FROM members o WHERE o.role = 'adviser' AND o.status = 'active' AND o.id <> ?1)` : ''}`,
  ).bind(targetId, role, status, now, cur.role, cur.status);
  // Audit rows only land if the UPDATE above did (same batch, same timestamp).
  const audit = (action: 'member.role_change' | 'member.status_change', from: string, to: string) =>
    D.prepare(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, data_json, created_at)
       SELECT ?1, ?2, 'member', ?3, ?4, ?5 WHERE EXISTS (SELECT 1 FROM members WHERE id = ?3 AND updated_at = ?5 AND role = ?6 AND status = ?7)`,
    ).bind(actorId, action, targetId, JSON.stringify({ from, to }), now, role, status);
  let res;
  try {
    [res] = await D.batch([
      update,
      ...(role !== cur.role ? [audit('member.role_change', cur.role, role)] : []),
      ...(status !== cur.status ? [audit('member.status_change', cur.status, status)] : []),
      ...(status === 'inactive' && cur.status === 'active' ? await cancelFuture(D, actorId, targetId, now) : []),
    ]);
  } catch (e) {
    if (String((e as Error)?.cause ?? e).includes('write_guards_ok')) return fail(409, 'VERSION_CONFLICT', 'A roster changed meanwhile. Try again.');
    throw e;
  }
  if (!res.meta.changes) {
    return losesAdviser
      ? fail(409, 'LAST_ADVISER', 'UMAL needs at least one active adviser. Promote someone else first.')
      : fail(409, 'CONFLICT', 'This member changed meanwhile. Reload and try again.');
  }
  return { ok: true, member: toMemberDTO((await read())!) };
}
