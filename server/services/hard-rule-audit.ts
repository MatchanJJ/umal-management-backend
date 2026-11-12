// Hard-rule audit (Schema §8.3; success metric 1, also a test fixture): finalized assignments that break a hard rule.
// Read-only. Double-booking in SQL; everything else re-checked with the engine against today's facts.
import { checkEligibility } from '../engine';
import type { Db } from '../db/client';
import { loadCandidates } from './candidate-loader';

export type HardRuleViolation = { assignmentId: number; eventId: number; shiftId: number; memberId: number; reasons: string[] };

/** Every non-cancelled assignment on a non-cancelled event, re-checked. Empty = healthy. */
export async function hardRuleAudit(db: Db): Promise<HardRuleViolation[]> {
  const D = db.$client;
  const [doubles, live] = await D.batch([
    D.prepare(
      `SELECT DISTINCT a1.id FROM assignments a1
       JOIN shifts s1 ON s1.id = a1.shift_id JOIN events e1 ON e1.id = a1.event_id
       JOIN assignments a2 ON a2.member_id = a1.member_id AND a2.id <> a1.id AND a2.status <> 'cancelled'
       JOIN shifts s2 ON s2.id = a2.shift_id JOIN events e2 ON e2.id = a2.event_id
       WHERE a1.status <> 'cancelled' AND e1.status <> 'cancelled' AND e2.status <> 'cancelled'
         AND s1.start_at < s2.end_at AND s2.start_at < s1.end_at`,
    ),
    D.prepare(
      `SELECT a.id AS assignmentId, a.event_id AS eventId, a.shift_id AS shiftId, a.member_id AS memberId FROM assignments a JOIN events e ON e.id = a.event_id
       WHERE a.status <> 'cancelled' AND e.status <> 'cancelled' ORDER BY a.event_id, a.id`,
    ),
  ]);
  const doubleIds = new Set((doubles.results as { id: number }[]).map((r) => r.id));
  const rows = live.results as Omit<HardRuleViolation, 'reasons'>[];

  const out: HardRuleViolation[] = [];
  for (const [eventId, list] of Map.groupBy(rows, (r) => r.eventId)) {
    const loaded = await loadCandidates(db, eventId, { memberIds: [...new Set(list.map((r) => r.memberId))], shiftIds: [...new Set(list.map((r) => r.shiftId))] });
    for (const a of list) {
      const reasons = new Set<string>(doubleIds.has(a.assignmentId) ? ['DOUBLE_BOOKED'] : []);
      const facts = loaded?.facts.find((f) => f.memberId === a.memberId);
      const shift = loaded?.shifts.find((s) => s.shiftId === a.shiftId);
      // No facts = the member is no longer active/onboarded; their assignment was valid when made.
      if (facts && shift) {
        // ALREADY_ON_SHIFT is expected (they are on it). Classes are soft, never a violation here.
        for (const r of checkEligibility(facts, shift, { include: [], exclude: [] }).hard) if (r !== 'ALREADY_ON_SHIFT') reasons.add(r);
      }
      if (reasons.size) out.push({ ...a, reasons: [...reasons] });
    }
  }
  return out;
}
