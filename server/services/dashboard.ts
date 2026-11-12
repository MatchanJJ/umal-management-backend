// Adviser dashboard numbers (App Flow §2) and AI health (App Flow §10). Read-only.
import type { D1Database } from '@cloudflare/workers-types';
import type { AiHealth, DashboardResponse } from '../../shared/api';
import { manilaNow } from '../../shared/time';
import { overlaps, segments, type Weekday } from '../engine';

type FutureRow = {
  assignmentId: number;
  memberId: number;
  memberName: string;
  eventId: number;
  eventTitle: string;
  shiftId: number;
  shiftLabel: string;
  startAt: string;
  endAt: string;
  termId: number;
  termStart: string;
  termEnd: string;
};
type ClassRow = { memberId: number; termId: number; day: number; start: string; end: string };

// Not-yet-started, non-overridden assignments on live events. A class conflict on one of these can only
// come from a schedule edited after assigning (adding over a conflict needs an override).
const FUTURE = `FROM assignments a JOIN shifts s ON s.id = a.shift_id JOIN events e ON e.id = a.event_id
  WHERE a.status = 'assigned' AND a.conflict_override = 0 AND e.status IN ('draft','published') AND s.active = 1 AND s.start_at > ?1`;

export async function dashboard(D: D1Database, now = manilaNow()): Promise<DashboardResponse> {
  const [missing, attendance, future, classes] = await D.batch([
    D.prepare(
      `SELECT COUNT(*) AS n FROM members m JOIN terms t ON t.is_active = 1
       WHERE m.role = 'member' AND m.status = 'active' AND m.onboarded_at IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM class_schedules cs WHERE cs.member_id = m.id AND cs.term_id = t.id)`,
    ),
    D.prepare(
      `SELECT e.id, e.title, e.end_at AS endAt, COUNT(a.id) AS unmarked
       FROM events e JOIN shifts s ON s.event_id = e.id AND s.active = 1 JOIN assignments a ON a.shift_id = s.id AND a.status = 'assigned'
       WHERE e.status = 'published' AND s.end_at <= ?1 GROUP BY e.id ORDER BY e.end_at`,
    ).bind(now),
    D.prepare(
      `SELECT a.id AS assignmentId, a.member_id AS memberId,
              COALESCE(NULLIF(TRIM(COALESCE(m.first_name, '') || ' ' || COALESCE(m.last_name, '')), ''), m.email) AS memberName,
              e.id AS eventId, e.title AS eventTitle, s.id AS shiftId, s.label AS shiftLabel, s.start_at AS startAt, s.end_at AS endAt,
              e.term_id AS termId, t.start_date AS termStart, t.end_date AS termEnd
       ${FUTURE.replace('WHERE', 'JOIN terms t ON t.id = e.term_id JOIN members m ON m.id = a.member_id WHERE')} ORDER BY s.start_at`,
    ).bind(now),
    D.prepare(
      `SELECT cs.member_id AS memberId, cs.term_id AS termId, ce.day_of_week AS day, ce.start_time AS start, ce.end_time AS end
       FROM class_entries ce JOIN class_schedules cs ON cs.id = ce.schedule_id
       WHERE (cs.member_id, cs.term_id) IN (SELECT a.member_id, e.term_id ${FUTURE})`,
    ).bind(now),
  ]);

  const byMemberTerm = new Map<string, ClassRow[]>();
  for (const r of classes.results as ClassRow[]) {
    const k = `${r.memberId}:${r.termId}`;
    byMemberTerm.set(k, [...(byMemberTerm.get(k) ?? []), r]);
  }
  // Same rule as checkEligibility: per local day, only days inside the event's term.
  const conflicts = (future.results as FutureRow[]).filter((f) => {
    const entries = byMemberTerm.get(`${f.memberId}:${f.termId}`);
    return (
      entries &&
      segments(f.startAt, f.endAt).some(
        (s) => s.date >= f.termStart && s.date <= f.termEnd && entries.some((e) => (e.day as Weekday) === s.weekday && overlaps(e.start, e.end, s.start, s.end)),
      )
    );
  });

  return {
    missingSchedules: (missing.results[0] as { n: number } | undefined)?.n ?? 0,
    needsAttendance: attendance.results as DashboardResponse['needsAttendance'],
    newConflicts: conflicts.map((f) => ({
      assignmentId: f.assignmentId,
      eventId: f.eventId,
      eventTitle: f.eventTitle,
      shiftId: f.shiftId,
      shiftLabel: f.shiftLabel,
      startAt: f.startAt,
      endAt: f.endAt,
      memberId: f.memberId,
      memberName: f.memberName,
    })),
  };
}

export async function aiHealth(D: D1Database, nowMs = Date.now()): Promise<AiHealth> {
  const since = new Date(nowMs - 7 * 86_400_000).toISOString();
  const [turns, last] = await D.batch([
    D.prepare(`SELECT provider, latency_ms AS latencyMs FROM ai_turns WHERE kind <> 'manual_edit' AND created_at >= ?1`).bind(since),
    D.prepare(`SELECT error, created_at AS at FROM ai_turns WHERE error IS NOT NULL ORDER BY id DESC LIMIT 1`),
  ]);
  const rows = turns.results as { provider: string; latencyMs: number | null }[];
  const providers: Record<string, number> = {};
  for (const r of rows) providers[r.provider] = (providers[r.provider] ?? 0) + 1;
  const lat = rows.filter((r) => r.provider !== 'none' && r.latencyMs !== null).map((r) => r.latencyMs!).sort((a, b) => a - b);
  const e = last.results[0] as { error: string; at: string } | undefined;
  return {
    turns7d: rows.length,
    providers,
    fallbacks7d: providers.groq ?? 0,
    failures7d: providers.none ?? 0,
    p50LatencyMs: lat.length ? lat[Math.floor((lat.length - 1) / 2)] : null,
    lastError: e ? { at: e.at, message: e.error } : null,
  };
}
