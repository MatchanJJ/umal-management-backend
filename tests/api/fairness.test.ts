import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { fairnessCsv, gini, topShare } from '../../server/services/fairness';
import type { FairnessReport } from '../../shared/reports';
import { signIn } from './helpers/auth';

const NOW = new Date().toISOString();
let adviser: Headers;
let adviserId: number;
let terms = 0;

beforeAll(async () => {
  const a = await signIn(env, { role: 'adviser' });
  adviser = a.headers;
  adviserId = a.memberId!;
});

/** A fresh term per test so term-scoped numbers are exact whatever else is in the DB. */
async function term() {
  const y = 2040 + ++terms;
  return (await env.DB.prepare(`INSERT INTO terms (name, start_date, end_date, is_active, created_at) VALUES (?1, ?2, ?3, 0, ?4) RETURNING id`)
    .bind(`T${y}`, `${y}-01-01`, `${y}-06-30`, NOW)
    .first<{ id: number }>())!.id;
}

/** One event in `termId` with a shift per [start, end]; returns shift ids. */
async function event(termId: number, shifts: [string, string][]) {
  const eventId = (await env.DB.prepare(
    `INSERT INTO events (term_id, title, start_at, end_at, status, created_by, created_at, updated_at) VALUES (?1, 'E', ?2, ?3, 'published', ?4, ?5, ?5) RETURNING id`,
  )
    .bind(termId, shifts[0][0], shifts.at(-1)![1], adviserId, NOW)
    .first<{ id: number }>())!.id;
  const ids: number[] = [];
  for (const [i, [s, e]] of shifts.entries()) {
    ids.push(
      (await env.DB.prepare(
        `INSERT INTO shifts (event_id, label, start_at, end_at, required_volunteers, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 5, ?5, ?6, ?6) RETURNING id`,
      )
        .bind(eventId, `S${i}`, s, e, i, NOW)
        .first<{ id: number }>())!.id,
    );
  }
  return { eventId, shiftIds: ids };
}

async function assign(ev: { eventId: number }, shiftId: number, memberId: number, status = 'assigned', aiSessionId: number | null = null) {
  const cancelled = status === 'cancelled';
  await env.DB.prepare(
    `INSERT INTO assignments (event_id, shift_id, member_id, status, source, ai_session_id, assigned_by, assigned_at, cancelled_at, cancel_reason) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
  )
    .bind(ev.eventId, shiftId, memberId, status, aiSessionId ? 'ai' : 'manual', aiSessionId, adviserId, NOW, cancelled ? NOW : null, cancelled ? 'x' : null)
    .run();
}

const report = async (termId: number) => {
  const res = await SELF.fetch(`http://x/api/reports/fairness?termId=${termId}`, { headers: adviser });
  expect(res.status).toBe(200);
  return (await res.json()) as FairnessReport;
};
const row = (r: FairnessReport, memberId: number) => r.members.find((m) => m.memberId === memberId)!;

describe('gini / topShare', () => {
  it('gini_of_hours', () => {
    expect(gini([1, 1, 1, 1])).toBe(0);
    expect(gini([0, 0, 0, 4])).toBeCloseTo(0.75);
    expect(gini([0, 0, 0, 0])).toBe(0);
    expect(gini([])).toBe(0);
  });

  it('top_share', () => {
    expect(topShare([10, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0.1)).toBe(1);
    expect(topShare([5, 5], 0.1)).toBe(0.5); // at least one member
    expect(topShare([0, 0], 0.1)).toBe(0);
  });
});

describe('GET /api/reports/fairness', () => {
  it('hours_from_shift_durations', async () => {
    const t = await term();
    const m = (await signIn(env)).memberId!;
    const ev = await event(t, [
      ['2041-02-01T08:00', '2041-02-01T12:00'], // 4 h
      ['2041-02-02T22:00', '2041-02-03T07:30'], // 9.5 h, crosses midnight
      ['2041-02-04T08:00', '2041-02-04T12:00'], // cancelled: not counted
    ]);
    await assign(ev, ev.shiftIds[0], m, 'attended');
    await assign(ev, ev.shiftIds[1], m, 'no_show');
    await assign(ev, ev.shiftIds[2], m, 'cancelled');
    expect(row(await report(t), m)).toMatchObject({ hours: 13.5, shifts: 2, attended: 1, noShow: 1, fromAi: 0 });
  });

  it('never_assigned_includes_members_with_other_term_assignments_only', async () => {
    const [t, other] = [await term(), await term()];
    const busy = (await signIn(env)).memberId!;
    const elsewhere = (await signIn(env)).memberId!;
    const excusedOnly = (await signIn(env)).memberId!;
    const a = await event(t, [['2041-02-01T08:00', '2041-02-01T12:00']]);
    const b = await event(other, [['2042-02-01T08:00', '2042-02-01T12:00']]);
    await assign(a, a.shiftIds[0], busy);
    await assign(a, a.shiftIds[0], excusedOnly, 'excused'); // excused doesn't count as served
    await assign(b, b.shiftIds[0], elsewhere);
    const r = await report(t);
    expect(row(r, busy).shifts).toBe(1);
    expect(row(r, elsewhere)).toMatchObject({ hours: 0, shifts: 0 });
    expect(row(r, excusedOnly)).toMatchObject({ hours: 0, shifts: 0 });
    expect(r.members.some((x) => x.memberId === adviserId)).toBe(false); // advisers aren't in the pool
    expect(r.kpis.neverAssigned).toBe(r.members.filter((x) => x.shifts === 0).length);
  });

  it('term_rates_no_show_ai_share_override', async () => {
    const t = await term();
    const [m1, m2, m3] = [(await signIn(env)).memberId!, (await signIn(env)).memberId!, (await signIn(env)).memberId!];
    const ev = await event(t, [['2041-02-01T08:00', '2041-02-01T12:00']]);
    const s = ev.shiftIds[0];
    // Recommended m1, m2; adviser removed m2 and added m3 → (1 removed + 1 added) / 2 recommended.
    const outcome = { recommended: [[s, m1], [s, m2]], approved: [[s, m1], [s, m3]], accepted: [[s, m1]], removed: [[s, m2]], added: [[s, m3]] };
    const session = (await env.DB.prepare(
      `INSERT INTO ai_sessions (event_id, created_by, status, constraints_json, scope_json, outcome_json, created_at, updated_at) VALUES (?1, ?2, 'approved', '{}', '{}', ?3, ?4, ?4) RETURNING id`,
    )
      .bind(ev.eventId, adviserId, JSON.stringify(outcome), NOW)
      .first<{ id: number }>())!.id;
    await assign(ev, s, m1, 'attended', session);
    await assign(ev, s, m3, 'no_show', session);
    await assign(ev, s, m2, 'attended');
    await assign(ev, s, m2, 'cancelled'); // ignored everywhere
    const { kpis } = await report(t);
    expect(kpis.noShowRate).toBeCloseTo(1 / 3);
    expect(kpis.aiShare).toBeCloseTo(2 / 3);
    expect(kpis.overrideRate).toBe(1);
    expect(kpis.totalHours).toBe(12);
  });

  it('csv_export_has_the_documented_columns', async () => {
    const t = await term();
    const m = await signIn(env, { email: `o.brien.${100000 + terms}@umindanao.edu.ph` });
    await env.DB.prepare(`UPDATE members SET first_name = 'Ana, "Jo"', last_name = 'Cruz' WHERE id = ?1`).bind(m.memberId).run();
    const ev = await event(t, [['2041-02-01T08:00', '2041-02-01T12:00']]);
    await assign(ev, ev.shiftIds[0], m.memberId!, 'attended');
    const res = await SELF.fetch(`http://x/api/reports/fairness.csv?termId=${t}`, { headers: adviser });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    const lines = (await res.text()).trim().split('\r\n');
    expect(lines[0]).toBe('member_id,name,college,hours,shifts,attended,no_show,from_ai');
    expect(lines).toContain(`${m.memberId},"Ana, ""Jo"" Cruz",,4,1,1,0,0`);
  });

  // Names are member-entered: a leading = + - @ tab or CR would run as a formula when an adviser opens the file in Excel/Sheets.
  it('csv_cells_that_look_like_formulas_are_neutralised', () => {
    const row = (name: string) => ({ memberId: 1, name, college: '@CCE', hours: -2, shifts: 1, attended: 1, noShow: 0, fromAi: 0 });
    const names = ['=HYPERLINK("https://x.example","go")', '+1+1', '-2', '@SUM(A1)', '\tTab', 'Ana Cruz'];
    const lines = fairnessCsv({ members: names.map(row) } as unknown as FairnessReport).trim().split('\r\n').slice(1);
    expect(lines).toEqual([
      `1,"'=HYPERLINK(""https://x.example"",""go"")",'@CCE,-2,1,1,0,0`,
      `1,'+1+1,'@CCE,-2,1,1,0,0`,
      `1,'-2,'@CCE,-2,1,1,0,0`,
      `1,'@SUM(A1),'@CCE,-2,1,1,0,0`,
      `1,'\tTab,'@CCE,-2,1,1,0,0`,
      `1,Ana Cruz,'@CCE,-2,1,1,0,0`,
    ]);
  });

  it('unknown_term_404_and_term_required', async () => {
    expect((await SELF.fetch('http://x/api/reports/fairness?termId=999999', { headers: adviser })).status).toBe(404);
    expect((await SELF.fetch('http://x/api/reports/fairness', { headers: adviser })).status).toBe(400);
  });
});
