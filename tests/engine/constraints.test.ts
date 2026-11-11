import { describe, expect, it } from 'vitest';
import { Constraints, defaultConstraints, emptyGroup, GroupSpec, InterpreterOutput } from '../../shared/constraints';

describe('constraints schemas (TRD §7.2)', () => {
  it('default_is_no_conflicts_and_per_shift', () => {
    expect(defaultConstraints()).toEqual({ groups: [], allowClassConflicts: false, priorities: [], teamMode: 'per_shift' });
    expect(Constraints.parse(defaultConstraints())).toEqual(defaultConstraints());
    // fresh objects: callers may mutate without sharing state
    expect(defaultConstraints().groups).not.toBe(defaultConstraints().groups);
  });

  it('empty_group_is_unconstrained_fill_remaining', () => {
    expect(GroupSpec.parse(emptyGroup())).toEqual({
      count: null,
      colleges: [],
      gender: null,
      tenure: null,
      yearLevels: [],
      heightMinCm: null,
      heightMaxCm: null,
    });
  });

  it('rejects_count_zero', () => {
    expect(GroupSpec.safeParse({ ...emptyGroup(), count: 0 }).success).toBe(false);
    expect(GroupSpec.safeParse({ ...emptyGroup(), count: 1 }).success).toBe(true);
  });

  it('rejects_more_than_10_groups', () => {
    const g = { ...emptyGroup(), count: 1 };
    expect(Constraints.safeParse({ ...defaultConstraints(), groups: Array(10).fill(g) }).success).toBe(true);
    expect(Constraints.safeParse({ ...defaultConstraints(), groups: Array(11).fill(g) }).success).toBe(false);
  });

  it('rejects_unknown_priority', () => {
    expect(Constraints.safeParse({ ...defaultConstraints(), priorities: ['tallest_first'] }).success).toBe(true);
    expect(Constraints.safeParse({ ...defaultConstraints(), priorities: ['prettiest_first'] }).success).toBe(false);
  });

  it('interpreter_output_caps_reply_and_assumptions', () => {
    const ok = { kind: 'update', constraints: defaultConstraints(), reply: 'ok', assumptions: [] };
    expect(InterpreterOutput.safeParse(ok).success).toBe(true);
    expect(InterpreterOutput.safeParse({ ...ok, reply: 'x'.repeat(601) }).success).toBe(false);
    expect(InterpreterOutput.safeParse({ ...ok, assumptions: Array(6).fill('a') }).success).toBe(false);
  });
});
