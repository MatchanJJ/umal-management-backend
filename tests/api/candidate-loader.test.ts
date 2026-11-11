import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '../../server/db/client';
import type { Env } from '../../server/env';
import { loadCandidates } from '../../server/services/candidate-loader';

const NOW = '2026-01-01T00:00:00.000Z';
const D = () => env.DB;
let seq = 0;

async function one<T>(sql: string, ...args: unknown[]): Promise<T> {
  return (await D().prepare(sql).bind(...args).first<T>())!;
}

async function term(name: string, start: string, end: string, active: 0 | 1) {
  return (await one<{ id: number }>(`INSERT INTO terms (name, start_date, end_date, is_active, created_at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id`, name, start, end, active, NOW)).id;
}

async function member(opts: { role?: string; status?: string; onboarded?: boolean; batchYear?: number; college?: string } = {}) {
  const n = ++seq;
  await D().prepare(`INSERT INTO user (id, name, email, email_verified) VALUES (?1, 'U', ?2, 1)`).bind(`cl-${n}`, `cl${n}@umindanao.edu.ph`).run();
  const collegeId = opts.college ? (await one<{ id: number }>(`SELECT id FROM colleges WHERE code = ?1`, opts.college)).id : null;
  return (
    await one<{ id: number }>(
      `INSERT INTO members (user_id, email, role, status, gender, college_id, year_level, batch_year, height_cm, onboarded_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'F', ?5, 2, ?6, 160, ?7, ?8, ?8) RETURNING id`,
      `cl-${n}`,
      `cl${n}@umindanao.edu.ph`,
      opts.role ?? 'member',
      opts.status ?? 'active',
      collegeId,
      opts.batchYear ?? 2024,
      opts.onboarded === false ? null : NOW,
      NOW,
    )
  ).id;
}

async function schedule(memberId: number, termId: number, entries: [number, string, string][]) {
  const s = (await one<{ id: number }>(`INSERT INTO class_schedules (member_id, term_id, submitted_at, updated_at) VALUES (?1, ?2, ?3, ?3) RETURNING id`, memberId, termId, NOW)).id;
  for (const [day, start, end] of entries) {
    await D().prepare(`INSERT INTO class_entries (schedule_id, day_of_week, start_time, end_time) VALUES (?1, ?2, ?3, ?4)`).bind(s, day, start, end).run();
  }
}

async function event(termId: number, createdBy: number, shifts: [string, string, number?][], status = 'published') {
  const starts = shifts.map((s) => s[0]).sort();
  const ends = shifts.map((s) => s[1]).sort();
  const e = (
    await one<{ id: number }>(
      `INSERT INTO events (term_id, title, start_at, end_at, status, created_by, created_at, updated_at) VALUES (?1, 'E', ?2, ?3, ?4, ?5, ?6, ?6) RETURNING id`,
      termId,
      starts[0],
      ends[ends.length - 1],
      status,
      createdBy,
      NOW,
    )
  ).id;
  const ids: number[] = [];
  for (const [i, [start, end, req]] of shifts.entries()) {
    ids.push(
      (
        await one<{ id: number }>(
          `INSERT INTO shifts (event_id, label, start_at, end_at, required_volunteers, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) RETURNING id`,
          e,
          `S${i + 1}`,
          start,
          end,
          req ?? 4,
          i + 1,
          NOW,
        )
      ).id,
    );
  }
  return { eventId: e, shiftIds: ids };
}

async function assign(eventId: number, shiftId: number, memberId: number, by: number, status = 'assigned') {
  const cancelled = status === 'cancelled';
  await D()
    .prepare(
      `INSERT INTO assignments (event_id, shift_id, member_id, status, source, assigned_by, assigned_at, cancelled_at, cancel_reason) VALUES (?1, ?2, ?3, ?4, 'manual', ?5, ?6, ?7, ?8)`,
    )
    .bind(eventId, shiftId, memberId, status, by, NOW, cancelled ? NOW : null, cancelled ? 'x' : null)
    .run();
}

let adviser: number;
let active: number; // active term containing the far past/future fixtures
let future: number; // inactive future term

beforeAll(async () => {
  adviser = await member({ role: 'adviser' });
  active = await term('Active', '2020-01-01', '2030-12-31', 1);
  future = await term('Future', '2031-01-06', '2031-05-30', 0);
});

const load = (eventId: number, opts?: Parameters<typeof loadCandidates>[2]) => loadCandidates(getDb(env), eventId, opts);
const factsOf = async (eventId: number, memberId: number, opts?: Parameters<typeof loadCandidates>[2]) =>
  (await load(eventId, opts))!.facts.find((f) => f.memberId === memberId)!;

describe('loadCandidates', () => {
  it('uses_event_term_not_active_term', async () => {
    const m = await member();
    await schedule(m, active, [[4, '08:00', '10:00']]);
    await schedule(m, future, [[4, '13:00', '15:00']]);
    // Thursday 2031-01-09, in the future term.
    const ev = await event(future, adviser, [['2031-01-09T12:00', '2031-01-09T16:00']]);
    const r = (await load(ev.eventId))!;
    expect(r.shifts[0]).toMatchObject({ termStart: '2031-01-06', termEnd: '2031-05-30' });
    expect(r.facts.find((f) => f.memberId === m)).toMatchObject({ scheduleSubmitted: true, classesByWeekday: { 4: [{ start: '13:00', end: '15:00' }] } });
  });

  it('termHours_sums_shift_durations', async () => {
    const m = await member();
    const past = await event(active, adviser, [
      ['2026-03-05T08:00', '2026-03-05T12:00'],
      ['2026-03-06T08:00', '2026-03-06T17:30'],
    ]);
    await assign(past.eventId, past.shiftIds[0], m, adviser, 'attended');
    await assign(past.eventId, past.shiftIds[1], m, adviser, 'no_show');
    const target = await event(active, adviser, [['2026-03-20T08:00', '2026-03-20T12:00']]);
    expect(await factsOf(target.eventId, m)).toMatchObject({ termHours: 13.5, attended: 1, noShow: 1, lastPastAssignmentDate: '2026-03-06' });
  });

  it('excused_and_cancelled_not_in_termHours', async () => {
    const m = await member();
    const past = await event(active, adviser, [
      ['2026-04-01T08:00', '2026-04-01T12:00'],
      ['2026-04-02T08:00', '2026-04-02T12:00'],
      ['2026-04-03T08:00', '2026-04-03T10:00'],
    ]);
    await assign(past.eventId, past.shiftIds[0], m, adviser, 'excused');
    await assign(past.eventId, past.shiftIds[1], m, adviser, 'cancelled');
    await assign(past.eventId, past.shiftIds[2], m, adviser, 'attended');
    const target = await event(active, adviser, [['2026-04-20T08:00', '2026-04-20T12:00']]);
    expect((await factsOf(target.eventId, m)).termHours).toBe(2);
  });

  it('future_assignments_not_in_lastPastAssignmentDate', async () => {
    const m = await member();
    // One far-future shift and one that started long ago but ends far in the future.
    const later = await event(active, adviser, [['2030-06-01T08:00', '2030-06-01T12:00']]);
    const running = await event(active, adviser, [['2026-01-01T08:00', '2030-12-31T08:00']]);
    await assign(later.eventId, later.shiftIds[0], m, adviser);
    await assign(running.eventId, running.shiftIds[0], m, adviser);
    const target = await event(active, adviser, [['2030-07-01T08:00', '2030-07-01T12:00']]);
    expect(await factsOf(target.eventId, m)).toMatchObject({ lastPastAssignmentDate: null, termHours: expect.any(Number) });
  });

  it('multi_day_event_loads_classes_for_all_touched_weekdays', async () => {
    const m = await member();
    await schedule(m, active, [
      [5, '08:00', '09:00'],
      [6, '08:00', '09:00'],
      [7, '08:00', '09:00'],
      [2, '08:00', '09:00'],
    ]);
    // Fri 2026-11-13 → Sun 2026-11-15
    const ev = await event(active, adviser, [['2026-11-13T08:00', '2026-11-15T17:00']]);
    const f = await factsOf(ev.eventId, m);
    expect(Object.keys(f.classesByWeekday).sort()).toEqual(['5', '6', '7']);
  });

  it('loads_weekly_and_date_unavailability', async () => {
    const m = await member();
    const ins = (kind: string, day: number | null, date: string | null) =>
      D()
        .prepare(`INSERT INTO unavailability (member_id, term_id, kind, day_of_week, date, start_time, end_time, created_at) VALUES (?1, ?2, ?3, ?4, ?5, '10:00', '12:00', ?6)`)
        .bind(m, active, kind, day, date, NOW)
        .run();
    await ins('weekly', 6, null);
    await ins('weekly', 2, null); // weekday not touched
    await ins('date', null, '2026-11-14');
    await ins('date', null, '2026-11-20'); // outside the span
    const ev = await event(active, adviser, [['2026-11-13T08:00', '2026-11-14T17:00']]);
    const f = await factsOf(ev.eventId, m);
    expect([f.weeklyUnavailable, f.dateUnavailable]).toEqual([{ 6: [{ start: '10:00', end: '12:00' }] }, [{ date: '2026-11-14', start: '10:00', end: '12:00' }]]);
  });

  it('overlapping_booking_on_previous_night_detected', async () => {
    const m = await member();
    const other = await event(active, adviser, [['2026-05-07T22:00', '2026-05-08T03:00']]); // Thu 22:00 → Fri 03:00
    await assign(other.eventId, other.shiftIds[0], m, adviser);
    const target = await event(active, adviser, [['2026-05-08T01:00', '2026-05-08T05:00']]);
    expect((await factsOf(target.eventId, m)).bookings).toEqual([{ shiftId: other.shiftIds[0], start: '2026-05-07T22:00', end: '2026-05-08T03:00' }]);
  });

  it('bookings_ignore_cancelled_events_and_assignments', async () => {
    const m = await member();
    const dead = await event(active, adviser, [['2026-05-15T08:00', '2026-05-15T12:00']], 'cancelled');
    await assign(dead.eventId, dead.shiftIds[0], m, adviser);
    const live = await event(active, adviser, [['2026-05-15T09:00', '2026-05-15T11:00']]);
    await assign(live.eventId, live.shiftIds[0], m, adviser, 'cancelled');
    const target = await event(active, adviser, [['2026-05-15T08:00', '2026-05-15T12:00']]);
    expect((await factsOf(target.eventId, m)).bookings).toEqual([]);
  });

  it('bookings_include_other_shifts_of_same_event', async () => {
    const m = await member();
    const ev = await event(active, adviser, [
      ['2026-06-04T08:00', '2026-06-04T17:00'],
      ['2026-06-04T11:00', '2026-06-04T13:00'],
    ]);
    await assign(ev.eventId, ev.shiftIds[0], m, adviser);
    const f = await factsOf(ev.eventId, m, { shiftIds: [ev.shiftIds[1]] });
    expect(f.bookings.map((b) => b.shiftId)).toEqual([ev.shiftIds[0]]);
  });

  it('remainingSlots_per_shift', async () => {
    const [a, b, c] = [await member(), await member(), await member()];
    const ev = await event(active, adviser, [['2026-07-02T08:00', '2026-07-02T12:00', 6]]);
    await assign(ev.eventId, ev.shiftIds[0], a, adviser);
    await assign(ev.eventId, ev.shiftIds[0], b, adviser);
    await assign(ev.eventId, ev.shiftIds[0], c, adviser, 'cancelled');
    const r = (await load(ev.eventId))!;
    expect(r.shifts[0]).toMatchObject({ requiredVolunteers: 6, activeCount: 2, remainingSlots: 4 });
    expect(r.roster.map((x) => x.memberId).sort()).toEqual([a, b].sort());
  });

  it('only_onboarded_active_members', async () => {
    const ok = await member();
    const inactive = await member({ status: 'inactive' });
    const notOnboarded = await member({ onboarded: false });
    const anotherAdviser = await member({ role: 'adviser' });
    const ev = await event(active, adviser, [['2026-08-06T08:00', '2026-08-06T12:00']]);
    const ids = (await load(ev.eventId))!.facts.map((f) => f.memberId);
    expect(ids).toContain(ok);
    expect(ids.filter((id) => [inactive, notOnboarded, anotherAdviser].includes(id))).toEqual([]);
  });

  it('memberIds_filter_and_tenure_and_college', async () => {
    const m = await member({ batchYear: 2099, college: 'CCE' });
    const ev = await event(active, adviser, [['2026-08-07T08:00', '2026-08-07T12:00']]);
    const r = (await load(ev.eventId, { memberIds: [m] }))!;
    expect(r.facts).toHaveLength(1);
    expect(r.facts[0]).toMatchObject({ memberId: m, collegeCode: 'CCE', isNew: false, scheduleSubmitted: false, gender: 'F', yearLevel: 2, heightCm: 160 });
  });

  it('returns_null_for_unknown_event', async () => {
    expect(await load(999999)).toBeNull();
  });

  it('query_budget', async () => {
    let statements = 0;
    const counting = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === 'prepare') {
          return (sql: string) => {
            statements++;
            return target.prepare(sql);
          };
        }
        const v = Reflect.get(target, prop);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    const ev = await event(active, adviser, [['2026-09-03T08:00', '2026-09-05T12:00']]);
    const r = await loadCandidates(getDb({ ...env, DB: counting } as Env), ev.eventId);
    expect(r!.facts.length).toBeGreaterThan(0);
    // 2 (event + shifts) + 9 in one batch; budget is 12 (CLAUDE.md).
    expect(statements).toBe(11);
  });
});
