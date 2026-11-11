// Candidate loader (TRD §8.1, Schema §8.1): two round trips — (event + shifts), then one D1 batch of 9 statements.
// Raw D1 statements, not drizzle's db.batch: a batched drizzle join silently returned [] in Task 2.3.
import { SETTINGS_DEFAULTS, type Settings } from '../../shared/settings';
import { manilaNow } from '../../shared/time';
import type { Db } from '../db/client';
import { hoursBetween, schoolYearStart, segments, type AllocateCtx, type CandidateFacts, type Interval, type Weekday } from '../engine';

export type EventRow = { id: number; termId: number; title: string; startAt: string; endAt: string; status: string; version: number };
export type AssignmentRow = { id: number; shiftId: number; memberId: number; status: string; source: string; conflictOverride: number };
export type Loaded = { event: EventRow; shifts: AllocateCtx[]; facts: CandidateFacts[]; roster: AssignmentRow[] };

type ShiftRow = { id: number; start_at: string; end_at: string; required_volunteers: number };

export async function loadCandidates(db: Db, eventId: number, opts: { memberIds?: number[]; shiftIds?: number[] } = {}): Promise<Loaded | null> {
  const D = db.$client;

  // Round trip 1: the event and its active shifts (gives the term and the span to load facts for).
  const [ev, sh] = await D.batch([
    D.prepare(`SELECT id, term_id AS termId, title, start_at AS startAt, end_at AS endAt, status, version FROM events WHERE id = ?1`).bind(eventId),
    D.prepare(`SELECT id, start_at, end_at, required_volunteers FROM shifts WHERE event_id = ?1 AND active = 1 ORDER BY start_at, position`).bind(eventId),
  ]);
  const event = (ev.results as EventRow[])[0];
  if (!event) return null;
  const targets = (sh.results as ShiftRow[]).filter((s) => !opts.shiftIds || opts.shiftIds.includes(s.id));

  const spanStart = targets.reduce((m, s) => (s.start_at < m ? s.start_at : m), targets[0]?.start_at ?? event.startAt);
  const spanEnd = targets.reduce((m, s) => (s.end_at > m ? s.end_at : m), targets[0]?.end_at ?? event.endAt);
  const days = targets.flatMap((s) => segments(s.start_at, s.end_at));
  const weekdays = JSON.stringify([...new Set(days.map((d) => d.weekday))]);
  const dates = days.map((d) => d.date).sort();
  const [firstDate, lastDate] = [dates[0] ?? spanStart.slice(0, 10), dates[dates.length - 1] ?? spanEnd.slice(0, 10)];
  const memberFilter = opts.memberIds ? JSON.stringify(opts.memberIds) : null;
  const t = event.termId;

  // Round trip 2: one batch (9 statements → 11 total, budget 12).
  const [term, settings, members, scheds, classes, unav, history, bookings, roster] = await D.batch([
    D.prepare(`SELECT start_date, end_date FROM terms WHERE id = ?1`).bind(t),
    D.prepare(`SELECT key, value_json FROM settings`),
    D.prepare(
      `SELECT m.id, m.gender, m.year_level, m.batch_year, m.height_cm, c.code AS college_code
       FROM members m LEFT JOIN colleges c ON c.id = m.college_id
       WHERE m.role = 'member' AND m.status = 'active' AND m.onboarded_at IS NOT NULL
         AND (?1 IS NULL OR m.id IN (SELECT value FROM json_each(?1)))`,
    ).bind(memberFilter),
    D.prepare(`SELECT member_id FROM class_schedules WHERE term_id = ?1`).bind(t),
    D.prepare(
      `SELECT cs.member_id, ce.day_of_week, ce.start_time, ce.end_time
       FROM class_entries ce JOIN class_schedules cs ON cs.id = ce.schedule_id
       WHERE cs.term_id = ?1 AND ce.day_of_week IN (SELECT value FROM json_each(?2))`,
    ).bind(t, weekdays),
    D.prepare(
      `SELECT member_id, kind, day_of_week, date, start_time, end_time FROM unavailability
       WHERE (kind = 'weekly' AND term_id = ?1 AND day_of_week IN (SELECT value FROM json_each(?2)))
          OR (kind = 'date' AND date BETWEEN ?3 AND ?4)`,
    ).bind(t, weekdays, firstDate, lastDate),
    D.prepare(
      `SELECT a.member_id, a.status, s.start_at, s.end_at
       FROM assignments a JOIN shifts s ON s.id = a.shift_id JOIN events e ON e.id = a.event_id
       WHERE e.term_id = ?1 AND a.status IN ('assigned', 'attended', 'no_show')`,
    ).bind(t),
    D.prepare(
      `SELECT a.member_id, a.shift_id, s.start_at, s.end_at
       FROM assignments a JOIN shifts s ON s.id = a.shift_id JOIN events e ON e.id = a.event_id
       WHERE s.start_at < ?2 AND s.end_at > ?1 AND a.status <> 'cancelled' AND e.status <> 'cancelled'`,
    ).bind(spanStart, spanEnd),
    D.prepare(
      `SELECT id, shift_id AS shiftId, member_id AS memberId, status, source, conflict_override AS conflictOverride
       FROM assignments WHERE event_id = ?1 AND status <> 'cancelled'`,
    ).bind(eventId),
  ]);

  const termRow = (term.results as { start_date: string; end_date: string }[])[0];
  const stored = Object.fromEntries((settings.results as { key: string; value_json: string }[]).map((r) => [r.key, JSON.parse(r.value_json)]));
  const s: Settings = { ...SETTINGS_DEFAULTS, ...stored };
  const now = manilaNow();
  const today = now.slice(0, 10);
  const rosterRows = roster.results as AssignmentRow[];

  const shifts: AllocateCtx[] = targets.map((x) => {
    const activeCount = rosterRows.filter((r) => r.shiftId === x.id).length;
    return {
      eventId,
      shiftId: x.id,
      startAt: x.start_at,
      endAt: x.end_at,
      requiredVolunteers: x.required_volunteers,
      activeCount,
      termStart: termRow.start_date,
      termEnd: termRow.end_date,
      today,
      now,
      requireSchedule: s['assignment.requireSchedule'],
      weights: s['scoring.weights'],
      loadUnitHours: s['scoring.loadUnitHours'],
      remainingSlots: Math.max(0, x.required_volunteers - activeCount),
    };
  });

  const submitted = new Set((scheds.results as { member_id: number }[]).map((r) => r.member_id));
  const syStart = schoolYearStart(today, s['schoolYear.startMonth']);
  const byMember = new Map<number, CandidateFacts>();
  for (const m of members.results as { id: number; gender: 'M' | 'F' | null; year_level: number | null; batch_year: number | null; height_cm: number | null; college_code: string | null }[]) {
    byMember.set(m.id, {
      memberId: m.id,
      gender: m.gender,
      collegeCode: m.college_code,
      yearLevel: m.year_level,
      isNew: m.batch_year === syStart,
      heightCm: m.height_cm,
      scheduleSubmitted: submitted.has(m.id),
      classesByWeekday: {},
      weeklyUnavailable: {},
      dateUnavailable: [],
      bookings: [],
      termHours: 0,
      lastPastAssignmentDate: null,
      attended: 0,
      noShow: 0,
    });
  }

  const push = (map: Partial<Record<Weekday, Interval[]>>, day: number, iv: Interval) => (map[day as Weekday] ??= []).push(iv);
  for (const r of classes.results as { member_id: number; day_of_week: number; start_time: string; end_time: string }[]) {
    const f = byMember.get(r.member_id);
    if (f) push(f.classesByWeekday, r.day_of_week, { start: r.start_time, end: r.end_time });
  }
  for (const r of unav.results as { member_id: number; kind: string; day_of_week: number | null; date: string | null; start_time: string; end_time: string }[]) {
    const f = byMember.get(r.member_id);
    if (!f) continue;
    if (r.kind === 'weekly') push(f.weeklyUnavailable, r.day_of_week!, { start: r.start_time, end: r.end_time });
    else f.dateUnavailable.push({ date: r.date!, start: r.start_time, end: r.end_time });
  }
  for (const r of history.results as { member_id: number; status: string; start_at: string; end_at: string }[]) {
    const f = byMember.get(r.member_id);
    if (!f) continue;
    f.termHours += hoursBetween(r.start_at, r.end_at);
    if (r.status === 'attended') f.attended++;
    if (r.status === 'no_show') f.noShow++;
    // Recency counts only shifts that have already ended.
    const endDate = r.end_at.slice(0, 10);
    if (r.end_at < now && (f.lastPastAssignmentDate === null || endDate > f.lastPastAssignmentDate)) f.lastPastAssignmentDate = endDate;
  }
  for (const r of bookings.results as { member_id: number; shift_id: number; start_at: string; end_at: string }[]) {
    byMember.get(r.member_id)?.bookings.push({ shiftId: r.shift_id, start: r.start_at, end: r.end_at });
  }

  return { event, shifts, facts: [...byMember.values()], roster: rosterRows };
}
