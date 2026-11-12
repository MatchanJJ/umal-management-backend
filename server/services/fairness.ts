// Term fairness report (TRD §9, Schema §8.2): SQL for per-member counts, TypeScript for the statistics.
import type { D1Database } from '@cloudflare/workers-types';
import type { FairnessMember, FairnessReport } from '../../shared/reports';

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Σ_i Σ_j |x_i − x_j| / (2 n² μ); 0 when μ = 0. */
export function gini(xs: number[]): number {
  const n = xs.length;
  const sum = xs.reduce((a, b) => a + b, 0);
  if (!n || !sum) return 0;
  let diff = 0;
  for (const a of xs) for (const b of xs) diff += Math.abs(a - b);
  return diff / (2 * n * sum); // 2 n² μ = 2 n Σx
}

/** Share of the total held by the top `pct` of members (at least one member). */
export function topShare(xs: number[], pct: number): number {
  const sum = xs.reduce((a, b) => a + b, 0);
  if (!sum) return 0;
  const k = Math.max(1, Math.round(xs.length * pct));
  return [...xs].sort((a, b) => b - a).slice(0, k).reduce((a, b) => a + b, 0) / sum;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Null when the term doesn't exist. */
export async function fairnessReport(D: D1Database, termId: number): Promise<FairnessReport | null> {
  const [termRes, membersRes, outcomesRes] = await D.batch([
    D.prepare(`SELECT id, name, start_date AS startDate, end_date AS endDate, is_active AS isActive FROM terms WHERE id = ?1`).bind(termId),
    // Schema §8.2, plus name and college for the table and CSV.
    D.prepare(
      `SELECT m.id AS memberId, COALESCE(NULLIF(TRIM(COALESCE(m.first_name, '') || ' ' || COALESCE(m.last_name, '')), ''), m.email) AS name,
              c.code AS college, COUNT(t.id) AS shifts,
              COALESCE(SUM((julianday(t.end_at) - julianday(t.start_at)) * 24), 0) AS hours,
              COALESCE(SUM(t.status = 'attended'), 0) AS attended,
              COALESCE(SUM(t.status = 'no_show'), 0) AS noShow,
              COALESCE(SUM(t.source = 'ai'), 0) AS fromAi
       FROM members m
       LEFT JOIN colleges c ON c.id = m.college_id
       LEFT JOIN (
         SELECT a.id, a.member_id, a.status, a.source, s.start_at, s.end_at
         FROM assignments a JOIN shifts s ON s.id = a.shift_id JOIN events e ON e.id = a.event_id
         WHERE e.term_id = ?1 AND a.status IN ('assigned','attended','no_show')
       ) t ON t.member_id = m.id
       WHERE m.role = 'member' AND m.status = 'active' AND m.onboarded_at IS NOT NULL
       GROUP BY m.id ORDER BY hours DESC, name`,
    ).bind(termId),
    D.prepare(
      `SELECT s.outcome_json AS outcome FROM ai_sessions s JOIN events e ON e.id = s.event_id
       WHERE e.term_id = ?1 AND s.status = 'approved' AND s.outcome_json IS NOT NULL`,
    ).bind(termId),
  ]);
  const t = termRes.results[0] as { id: number; name: string; startDate: string; endDate: string; isActive: number } | undefined;
  if (!t) return null;

  const members = (membersRes.results as FairnessMember[]).map((m) => ({ ...m, hours: round2(m.hours) }));
  const hours = members.map((m) => m.hours);
  const sum = (f: (m: FairnessMember) => number) => members.reduce((a, m) => a + f(m), 0);
  const [totalHours, shifts, attended, noShow, fromAi] = [sum((m) => m.hours), sum((m) => m.shifts), sum((m) => m.attended), sum((m) => m.noShow), sum((m) => m.fromAi)];

  let recommended = 0;
  let overridden = 0;
  for (const { outcome } of outcomesRes.results as { outcome: string }[]) {
    const o = JSON.parse(outcome) as { recommended: unknown[]; removed: unknown[]; added: unknown[] };
    recommended += o.recommended.length;
    overridden += o.removed.length + o.added.length;
  }

  return {
    term: { id: t.id, name: t.name, startDate: t.startDate, endDate: t.endDate, isActive: t.isActive === 1 },
    kpis: {
      members: members.length,
      totalHours: round2(totalHours),
      avgHours: members.length ? round2(totalHours / members.length) : 0,
      medianHours: median(hours),
      maxHours: hours.length ? Math.max(...hours) : 0,
      gini: gini(hours),
      top10Share: topShare(hours, 0.1),
      neverAssigned: members.filter((m) => m.shifts === 0).length,
      noShowRate: attended + noShow ? noShow / (attended + noShow) : null,
      aiShare: shifts ? fromAi / shifts : null,
      overrideRate: recommended ? overridden / recommended : null,
    },
    members,
  };
}

const CSV_COLUMNS = ['member_id', 'name', 'college', 'hours', 'shifts', 'attended', 'no_show', 'from_ai'];
const cell = (v: unknown) => {
  // Numbers stay numbers; member-entered text starting with = + - @ tab or CR gets a ' so spreadsheets show it, not run it.
  const s = v == null ? '' : typeof v === 'number' ? String(v) : String(v).replace(/^[=+\-@\t\r]/, "'$&");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC 4180 CSV of the per-member rows. */
export function fairnessCsv(r: FairnessReport): string {
  const rows = r.members.map((m) => [m.memberId, m.name, m.college, m.hours, m.shifts, m.attended, m.noShow, m.fromAi].map(cell).join(','));
  return [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}
