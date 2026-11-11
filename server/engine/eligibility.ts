// Per-shift eligibility (TRD §8.2). Pure.
import { overlaps, segments } from './time';
import type { CandidateFacts, Eligibility, Interval, Pins, Reason, ShiftCtx } from './types';

const hits = (blocks: Interval[] | undefined, start: string, end: string) => (blocks ?? []).some((b) => overlaps(b.start, b.end, start, end));

/** Hard and soft reasons, each at most once, in TRD §8.2 table order. */
export function checkEligibility(f: CandidateFacts, shift: ShiftCtx, pins: Pins): Eligibility {
  const hard: Reason[] = [];
  const soft: Reason[] = [];

  if (f.bookings.some((b) => b.shiftId === shift.shiftId)) hard.push('ALREADY_ON_SHIFT');
  // Any other non-cancelled shift (any event, incl. this one) whose interval overlaps this shift's.
  if (f.bookings.some((b) => b.shiftId !== shift.shiftId && overlaps(b.start, b.end, shift.startAt, shift.endAt))) {
    hard.push('DOUBLE_BOOKED');
  }

  // Weekly rules apply per local day: a Fri 22:00 → Sat 02:00 shift is checked against Saturday too.
  const days = segments(shift.startAt, shift.endAt);
  const unavailable = days.some(
    (s) =>
      hits(f.weeklyUnavailable[s.weekday], s.start, s.end) ||
      f.dateUnavailable.some((d) => d.date === s.date && overlaps(d.start, d.end, s.start, s.end)),
  );
  if (unavailable) hard.push('UNAVAILABLE');

  if (!f.scheduleSubmitted) (shift.requireSchedule ? hard : soft).push('SCHEDULE_MISSING');

  if (pins.exclude.includes(f.memberId)) hard.push('PINNED_EXCLUDE');

  // Classes only exist on days inside the event's term.
  const inTerm = days.filter((s) => s.date >= shift.termStart && s.date <= shift.termEnd);
  if (inTerm.some((s) => hits(f.classesByWeekday[s.weekday], s.start, s.end))) soft.push('CLASS_CONFLICT');

  return { hard, soft };
}

export function isSelectable(e: Eligibility, allowClassConflicts: boolean): boolean {
  return e.hard.length === 0 && (allowClassConflicts || !e.soft.includes('CLASS_CONFLICT'));
}
