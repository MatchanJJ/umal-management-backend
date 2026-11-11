import { describe, expect, it } from 'vitest';
import { defaultConstraints, emptyGroup, type Constraints } from '../../shared/constraints';
import { allocate, allocateShifts, type AllocateCtx } from '../../server/engine';
import { facts, noPins, shift } from './fixtures';

const base = { weights: { load: 3, recency: 1, reliability: 1 }, loadUnitHours: 4, remainingSlots: 2 };
const ctx = (shiftId: number, startAt: string, endAt: string, over: Partial<AllocateCtx> = {}): AllocateCtx => ({
  ...shift({ shiftId, startAt, endAt }),
  ...base,
  ...over,
});
// Two non-overlapping 8-hour days (Thu, Fri) and an overlapping pair.
const DAY1 = ctx(1, '2026-11-12T08:00', '2026-11-12T16:00');
const DAY2 = ctx(2, '2026-11-13T08:00', '2026-11-13T16:00');
const count = (n: number): Constraints => ({ ...defaultConstraints(), groups: [{ ...emptyGroup(), count: n }] });
const members = (n: number) => Array.from({ length: n }, (_, i) => facts({ memberId: i + 1 }));

describe('allocateShifts', () => {
  it('single_shift_equals_allocate', () => {
    const cands = members(5);
    expect(allocateShifts(cands, count(2), noPins, [DAY1]).perShift).toEqual([{ shiftId: 1, result: allocate(cands, count(2), noPins, DAY1) }]);
  });

  it('per_shift_rotates', () => {
    const r = allocateShifts(members(4), count(2), noPins, [DAY1, DAY2]);
    const [first, second] = r.perShift.map((s) => s.result.picks.map((p) => p.memberId));
    expect(first).toHaveLength(2);
    expect(second.filter((id) => first.includes(id))).toEqual([]);
  });

  it('per_shift_repeats_when_only_option', () => {
    const r = allocateShifts(members(1), count(1), noPins, [DAY1, DAY2]);
    expect(r.perShift.map((s) => s.result.picks.map((p) => p.memberId))).toEqual([[1], [1]]);
  });

  it('per_shift_never_double_books_overlapping_shifts', () => {
    const early = ctx(1, '2026-11-12T08:00', '2026-11-12T12:00');
    const overlap = ctx(2, '2026-11-12T11:00', '2026-11-12T15:00');
    const r = allocateShifts(members(1), count(1), noPins, [overlap, early]); // input order doesn't matter
    expect(r.perShift.map((s) => [s.shiftId, s.result.picks.length, s.result.groups[0].shortfall])).toEqual([
      [1, 1, 0],
      [2, 0, 1],
    ]);
    expect(r.perShift[1].result.excluded).toEqual({ DOUBLE_BOOKED: 1 });
  });

  it('same_team_requires_eligibility_for_all_shifts', () => {
    const classOnDay2 = facts({ memberId: 9, termHours: 0, classesByWeekday: { 5: [{ start: '09:00', end: '10:00' }] } });
    const cands = [classOnDay2, ...members(3).map((f) => ({ ...f, termHours: 8 }))];
    const r = allocateShifts(cands, { ...count(2), teamMode: 'same_team' }, noPins, [DAY1, DAY2]);
    for (const s of r.perShift) {
      expect(s.result.picks.map((p) => p.memberId)).not.toContain(9);
      expect(s.result.excluded).toEqual({ CLASS_CONFLICT: 1 });
    }
  });

  it('same_team_assigns_identical_picks', () => {
    const r = allocateShifts(members(5), { ...count(2), teamMode: 'same_team' }, noPins, [DAY1, DAY2]);
    expect(r.teamMode).toBe('same_team');
    const [a, b] = r.perShift.map((s) => s.result.picks.map((p) => p.memberId));
    expect(a).toEqual(b);
  });

  it('same_team_uses_min_remaining_slots', () => {
    const shifts = [{ ...DAY1, remainingSlots: 3 }, { ...DAY2, remainingSlots: 5 }];
    const r = allocateShifts(members(6), { ...defaultConstraints(), teamMode: 'same_team' }, noPins, shifts);
    expect(r.perShift.map((s) => s.result.picks.length)).toEqual([3, 3]);
  });

  it('same_team_with_one_shift_behaves_like_per_shift', () => {
    const cands = members(3);
    expect(allocateShifts(cands, { ...count(1), teamMode: 'same_team' }, noPins, [DAY1]).perShift[0].result).toEqual(
      allocate(cands, { ...count(1), teamMode: 'same_team' }, noPins, DAY1),
    );
  });

  it('input_facts_not_mutated', () => {
    const cands = members(2);
    const before = structuredClone(cands);
    allocateShifts(cands, count(1), noPins, [DAY1, DAY2]);
    expect(cands).toEqual(before);
  });

  it('empty_shift_list_returns_no_results', () => {
    expect(allocateShifts(members(2), count(1), noPins, [])).toEqual({ teamMode: 'per_shift', perShift: [] });
  });
});
