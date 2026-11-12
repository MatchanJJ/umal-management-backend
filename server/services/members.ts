// Role/status changes with the TRD §5 lock-out guards, audited in the same batch.
import { eq } from 'drizzle-orm';
import type { MemberDTO, MemberPatch } from '../../shared/api';
import type { Db } from '../db/client';
import * as schema from '../db/schema';
import type { ErrorCode } from '../errors';
import { toMemberDTO } from '../routes/me';

export type MemberUpdateResult = { ok: true; member: MemberDTO } | { ok: false; status: 403 | 404 | 409; code: ErrorCode; message: string };

const fail = (status: 403 | 404 | 409, code: ErrorCode, message: string): MemberUpdateResult => ({ ok: false, status, code, message });

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
  const [res] = await D.batch([
    update,
    ...(role !== cur.role ? [audit('member.role_change', cur.role, role)] : []),
    ...(status !== cur.status ? [audit('member.status_change', cur.status, status)] : []),
  ]);
  if (!res.meta.changes) {
    return losesAdviser
      ? fail(409, 'LAST_ADVISER', 'UMAL needs at least one active adviser. Promote someone else first.')
      : fail(409, 'CONFLICT', 'This member changed meanwhile. Reload and try again.');
  }
  return { ok: true, member: toMemberDTO((await read())!) };
}
