import { describe, expect, it } from 'vitest';
import { defaultConstraints, emptyGroup, type Constraints, type GroupSpec } from '../../shared/constraints';
import { allocate, comparePriority, matchesGroup, type AllocateCtx } from '../../server/engine';
import { fnv1a32 } from '../../server/engine/time';
import type { CandidateFacts } from '../../server/engine/types';
import { facts, noPins, shift } from './fixtures';

const ctx = (over: Partial<AllocateCtx> = {}): AllocateCtx => ({
  ...shift(),
  weights: { load: 3, recency: 1, reliability: 1 },
  loadUnitHours: 4,
  remainingSlots: 4,
  ...over,
});
const group = (g: Partial<GroupSpec>): GroupSpec => ({ ...emptyGroup(), ...g });
const constraints = (c: Partial<Constraints>): Constraints => ({ ...defaultConstraints(), ...c });
/** Members whose score falls as termHours rises (higher id → more hours → lower score). */
const ranked = (ids: number[], extra: Partial<CandidateFacts> = {}) => ids.map((id) => facts({ memberId: id, termHours: id, ...extra }));
const CLASS = { classesByWeekday: { 4: [{ start: '14:00', end: '15:00' }] } };
const BLOCK = { weeklyUnavailable: { 4: [{ start: '13:00', end: '14:00' }] } };

describe('allocate (TRD §8.4 steps 1–4)', () => {
  it('filters_ineligible_and_counts_reasons', () => {
    const cands = [
      ...ranked([1, 2, 3, 4, 5]),
      facts({ memberId: 6, ...CLASS }),
      facts({ memberId: 7, ...CLASS }),
      facts({ memberId: 8, ...BLOCK }),
    ];
    const r = allocate(cands, defaultConstraints(), noPins, ctx());
    expect([r.excluded, r.totalEligible]).toEqual([{ CLASS_CONFLICT: 2, UNAVAILABLE: 1 }, 5]);
  });

  it('allow_class_conflicts_includes_soft', () => {
    const cands = [facts({ memberId: 6, termHours: 0, ...CLASS }), ...ranked([1, 2])];
    const r = allocate(cands, constraints({ allowClassConflicts: true }), noPins, ctx({ remainingSlots: 1 }));
    expect(r.picks.map((p) => [p.memberId, p.softFlags])).toEqual([[6, ['CLASS_CONFLICT']]]);
  });

  it('conflicts_allowed_still_excludes_hard_and_does_not_count_class_conflict', () => {
    const cands = [facts({ memberId: 8, ...BLOCK, ...CLASS }), ...ranked([1])];
    const r = allocate(cands, constraints({ allowClassConflicts: true }), noPins, ctx());
    expect([r.excluded, r.totalEligible]).toEqual([{ UNAVAILABLE: 1 }, 1]);
  });

  it('two_fill_remaining_groups_share_the_leftover', () => {
    const r = allocate(ranked([1, 2, 3, 4, 5]), constraints({ groups: [group({ count: null }), group({ count: null, gender: 'F' })] }), noPins, ctx({ remainingSlots: 3 }));
    expect(r.groups.map((g) => [g.requested, g.filled])).toEqual([
      [3, 3],
      [0, 0],
    ]);
  });

  it('priority_applies_before_cut', () => {
    // v1 bug #3: the only new member has the lowest score but new_first must still pick them.
    const cands = [...ranked([1, 2]), facts({ memberId: 3, termHours: 40, isNew: true })];
    const r = allocate(cands, constraints({ groups: [group({ count: 1 })], priorities: ['new_first'] }), noPins, ctx());
    expect(r.picks.map((p) => p.memberId)).toEqual([3]);
  });

  it('scarce_group_filled_first', () => {
    const cands = [facts({ memberId: 9, termHours: 0, collegeCode: 'CCE', gender: 'F' }), ...ranked([1, 2, 3], { collegeCode: 'CAE', gender: 'M' })];
    const r = allocate(cands, constraints({ groups: [group({ count: 2 }), group({ count: 1, colleges: ['CCE'], gender: 'F' })] }), noPins, ctx());
    expect(r.picks.map((p) => [p.memberId, p.groupIndex])).toEqual([
      [9, 1],
      [1, 0],
      [2, 0],
    ]);
  });

  it('no_member_picked_twice', () => {
    const r = allocate(ranked([1, 2, 3]), constraints({ groups: [group({ count: 2 }), group({ count: 2 })] }), noPins, ctx());
    const ids = r.picks.map((p) => p.memberId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pinned_include_first_if_matching', () => {
    const r = allocate(ranked([1, 2, 3, 4]), constraints({ groups: [group({ count: 2 })] }), { include: [4], exclude: [] }, ctx());
    expect(r.picks.map((p) => p.memberId)).toEqual([4, 1]);
  });

  it('pinned_include_ignored_if_ineligible', () => {
    const cands = [...ranked([1, 2]), facts({ memberId: 8, ...BLOCK })];
    const r = allocate(cands, constraints({ groups: [group({ count: 2 })] }), { include: [8], exclude: [] }, ctx());
    expect(r.picks.map((p) => p.memberId)).toEqual([1, 2]);
  });

  it('null_height_fails_height_filter', () => {
    expect(matchesGroup(facts({ heightCm: null }), group({ heightMinCm: 160 }))).toBe(false);
  });

  it('null_college_fails_college_filter', () => {
    expect(matchesGroup(facts({ collegeCode: null }), group({ colleges: ['CCE'] }))).toBe(false);
  });

  it('deterministic_tiebreak', () => {
    const cands = [1, 2, 3, 4, 5, 6].map((id) => facts({ memberId: id }));
    const run = () => allocate(cands, constraints({ groups: [group({ count: 6 })] }), noPins, ctx({ remainingSlots: 6 })).picks.map((p) => p.memberId);
    const byHash = [...cands.map((c) => c.memberId)].sort((a, b) => fnv1a32(`1:${a}`) - fnv1a32(`1:${b}`));
    expect([run(), run()]).toEqual([byHash, byHash]);
  });

  it('single_null_count_uses_remaining_slots', () => {
    expect(allocate(ranked([1]), defaultConstraints(), noPins, ctx({ remainingSlots: 4 })).groups[0].requested).toBe(4);
  });

  it('shortfall_reported', () => {
    const r = allocate(ranked([1]), constraints({ groups: [group({ count: 3 })] }), noPins, ctx());
    expect(r.groups[0]).toMatchObject({ requested: 3, filled: 1, poolSize: 1, shortfall: 2 });
  });

  it('fill_remaining_group_takes_what_fixed_groups_leave', () => {
    const r = allocate(ranked([1, 2, 3, 4, 5]), constraints({ groups: [group({ count: null }), group({ count: 1 })] }), noPins, ctx({ remainingSlots: 4 }));
    expect(r.groups.map((g) => [g.index, g.requested, g.filled])).toEqual([
      [0, 3, 3],
      [1, 1, 1],
    ]);
  });

  it('ranks_within_group_and_scores_attached', () => {
    const r = allocate(ranked([1, 2]), defaultConstraints(), noPins, ctx({ remainingSlots: 2 }));
    expect(r.picks.map((p) => [p.memberId, p.rank])).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(r.picks[0].score.total).toBeGreaterThan(r.picks[1].score.total);
  });
});

describe('matchesGroup filters', () => {
  const m = facts({ gender: 'M', collegeCode: 'CCE', isNew: true, yearLevel: 2, heightCm: 175 });
  it.each<[string, Partial<GroupSpec>, boolean]>([
    ['empty group', {}, true],
    ['college match', { colleges: ['CAE', 'CCE'] }, true],
    ['college miss', { colleges: ['CAE'] }, false],
    ['gender miss', { gender: 'F' }, false],
    ['tenure new', { tenure: 'new' }, true],
    ['tenure returning', { tenure: 'returning' }, false],
    ['year miss', { yearLevels: [3, 4] }, false],
    ['year match', { yearLevels: [2] }, true],
    ['height window', { heightMinCm: 170, heightMaxCm: 180 }, true],
    ['too short', { heightMinCm: 176 }, false],
    ['too tall', { heightMaxCm: 174 }, false],
  ])('%s', (_label, g, expected) => {
    expect(matchesGroup(m, group(g))).toBe(expected);
  });

  it('null_year_and_height_fail_bounds', () => {
    expect([matchesGroup(facts({ yearLevel: null }), group({ yearLevels: [1] })), matchesGroup(facts({ heightCm: null }), group({ heightMaxCm: 200 }))]).toEqual([
      false,
      false,
    ]);
  });
});

describe('comparePriority (negative = a first)', () => {
  const a = facts({ memberId: 1, termHours: 2, attended: 4, noShow: 0, isNew: true, heightCm: 180, gender: 'M' });
  const b = facts({ memberId: 2, termHours: 6, attended: 0, noShow: 2, isNew: false, heightCm: 160, gender: 'F' });
  it.each([
    ['least_assigned_first', -1],
    ['reliable_first', -1],
    ['new_first', -1],
    ['returning_first', 1],
    ['tallest_first', -1],
    ['shortest_first', 1],
    ['male_first', -1],
    ['female_first', 1],
  ] as const)('%s', (p, sign) => {
    expect(Math.sign(comparePriority(p, a, b))).toBe(sign);
    expect(Math.sign(comparePriority(p, b, a))).toBe(-sign);
  });

  it('null_height_sorts_last_both_ways', () => {
    const none = facts({ heightCm: null });
    expect([comparePriority('tallest_first', none, b) > 0, comparePriority('shortest_first', none, b) > 0]).toEqual([true, true]);
    expect([comparePriority('tallest_first', b, none) < 0, comparePriority('tallest_first', none, facts({ heightCm: null }))]).toEqual([true, 0]);
  });

  it('equal_members_compare_zero', () => {
    expect(comparePriority('male_first', a, a)).toBe(0);
  });
});
