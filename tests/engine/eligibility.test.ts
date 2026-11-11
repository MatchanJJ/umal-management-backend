import { describe, expect, it } from 'vitest';
import { checkEligibility, isSelectable } from '../../server/engine/eligibility';
import { facts, noPins, shift } from './fixtures';

const FRI_TO_SAT = { startAt: '2026-11-13T22:00', endAt: '2026-11-14T02:00' };
const FRI_TO_SUN = { startAt: '2026-11-13T08:00', endAt: '2026-11-15T17:00' };

describe('checkEligibility (TRD §8.2)', () => {
  it('eligible_by_default', () => {
    expect(checkEligibility(facts(), shift(), noPins)).toEqual({ hard: [], soft: [] });
  });

  it('class_overlap_is_soft', () => {
    expect(checkEligibility(facts({ classesByWeekday: { 4: [{ start: '14:00', end: '15:00' }] } }), shift(), noPins)).toEqual({
      hard: [],
      soft: ['CLASS_CONFLICT'],
    });
  });

  it('class_touching_is_not_conflict', () => {
    expect(checkEligibility(facts({ classesByWeekday: { 4: [{ start: '11:00', end: '13:00' }] } }), shift(), noPins)).toEqual({ hard: [], soft: [] });
  });

  it('cross_midnight_checks_next_day_class', () => {
    const e = checkEligibility(facts({ classesByWeekday: { 6: [{ start: '01:00', end: '03:00' }] } }), shift(FRI_TO_SAT), noPins);
    expect(e.soft).toEqual(['CLASS_CONFLICT']);
  });

  it('multi_day_checks_middle_day', () => {
    const e = checkEligibility(facts({ weeklyUnavailable: { 6: [{ start: '10:00', end: '12:00' }] } }), shift(FRI_TO_SUN), noPins);
    expect(e.hard).toEqual(['UNAVAILABLE']);
  });

  it('class_outside_term_dates_ignored', () => {
    // 2026-12-19 is a Saturday, the day after termEnd.
    const e = checkEligibility(
      facts({ classesByWeekday: { 6: [{ start: '09:00', end: '12:00' }] } }),
      shift({ startAt: '2026-12-19T08:00', endAt: '2026-12-19T17:00' }),
      noPins,
    );
    expect(e).toEqual({ hard: [], soft: [] });
  });

  it('class_before_term_start_ignored', () => {
    // 2026-08-08 is a Saturday, two days before termStart.
    const e = checkEligibility(
      facts({ classesByWeekday: { 6: [{ start: '09:00', end: '12:00' }] } }),
      shift({ startAt: '2026-08-08T08:00', endAt: '2026-08-08T17:00' }),
      noPins,
    );
    expect(e.soft).toEqual([]);
  });

  it('date_block_on_second_day_is_hard', () => {
    const e = checkEligibility(facts({ dateUnavailable: [{ date: '2026-11-14', start: '00:00', end: '01:00' }] }), shift(FRI_TO_SAT), noPins);
    expect(e.hard).toEqual(['UNAVAILABLE']);
  });

  it('date_block_on_other_date_ignored', () => {
    const e = checkEligibility(facts({ dateUnavailable: [{ date: '2026-11-11', start: '00:00', end: '24:00' }] }), shift(), noPins);
    expect(e.hard).toEqual([]);
  });

  it('unavailable_is_hard', () => {
    const e = checkEligibility(facts({ weeklyUnavailable: { 4: [{ start: '16:00', end: '18:00' }] } }), shift(), noPins);
    expect(e.hard).toEqual(['UNAVAILABLE']);
  });

  it('double_booked_is_hard', () => {
    const e = checkEligibility(facts({ bookings: [{ shiftId: 9, start: '2026-11-12T16:00', end: '2026-11-12T20:00' }] }), shift(), noPins);
    expect(e.hard).toEqual(['DOUBLE_BOOKED']);
  });

  it('back_to_back_booking_ok', () => {
    const e = checkEligibility(facts({ bookings: [{ shiftId: 9, start: '2026-11-12T17:00', end: '2026-11-12T20:00' }] }), shift(), noPins);
    expect(e.hard).toEqual([]);
  });

  it('already_on_shift_is_hard', () => {
    const e = checkEligibility(facts({ bookings: [{ shiftId: 1, start: '2026-11-12T13:00', end: '2026-11-12T17:00' }] }), shift(), noPins);
    expect(e.hard).toEqual(['ALREADY_ON_SHIFT']);
  });

  it('other_shift_same_event_overlapping_is_double_booked', () => {
    // Shift 2 of the same event: an all-day crew overlapping this afternoon shift.
    const e = checkEligibility(facts({ bookings: [{ shiftId: 2, start: '2026-11-12T08:00', end: '2026-11-12T18:00' }] }), shift(), noPins);
    expect(e.hard).toEqual(['DOUBLE_BOOKED']);
  });

  it('other_shift_same_event_next_day_ok', () => {
    const e = checkEligibility(facts({ bookings: [{ shiftId: 2, start: '2026-11-13T13:00', end: '2026-11-13T17:00' }] }), shift(), noPins);
    expect(e.hard).toEqual([]);
  });

  it('pinned_exclude_is_hard', () => {
    expect(checkEligibility(facts(), shift(), { include: [], exclude: [1] }).hard).toEqual(['PINNED_EXCLUDE']);
  });

  it('schedule_missing_hard_when_required', () => {
    expect(checkEligibility(facts({ scheduleSubmitted: false }), shift(), noPins).hard).toEqual(['SCHEDULE_MISSING']);
  });

  it('schedule_missing_soft_when_not_required', () => {
    expect(checkEligibility(facts({ scheduleSubmitted: false }), shift({ requireSchedule: false }), noPins)).toEqual({
      hard: [],
      soft: ['SCHEDULE_MISSING'],
    });
  });

  it('each_reason_reported_once_in_fixed_order', () => {
    const e = checkEligibility(
      facts({
        scheduleSubmitted: false,
        weeklyUnavailable: { 5: [{ start: '23:00', end: '24:00' }], 6: [{ start: '00:00', end: '01:00' }] },
        classesByWeekday: { 5: [{ start: '22:00', end: '23:00' }], 6: [{ start: '01:00', end: '02:00' }] },
        bookings: [
          { shiftId: 1, start: FRI_TO_SAT.startAt, end: FRI_TO_SAT.endAt },
          { shiftId: 7, start: '2026-11-13T21:00', end: '2026-11-13T23:00' },
        ],
      }),
      shift(FRI_TO_SAT),
      { include: [], exclude: [1] },
    );
    expect(e).toEqual({ hard: ['ALREADY_ON_SHIFT', 'DOUBLE_BOOKED', 'UNAVAILABLE', 'SCHEDULE_MISSING', 'PINNED_EXCLUDE'], soft: ['CLASS_CONFLICT'] });
  });
});

describe('isSelectable', () => {
  it('isSelectable_respects_allowClassConflicts', () => {
    const conflict = { hard: [], soft: ['CLASS_CONFLICT' as const] };
    expect([isSelectable(conflict, false), isSelectable(conflict, true)]).toEqual([false, true]);
  });

  it('any_hard_reason_blocks_even_with_conflicts_allowed', () => {
    expect(isSelectable({ hard: ['UNAVAILABLE'], soft: [] }, true)).toBe(false);
  });

  it('soft_schedule_missing_stays_selectable', () => {
    expect(isSelectable({ hard: [], soft: ['SCHEDULE_MISSING'] }, false)).toBe(true);
  });
});
