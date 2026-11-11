import { describe, expect, it } from 'vitest';
import { defaultConstraints, emptyGroup, type GroupSpec } from '../../shared/constraints';
import { allocate, suggestRelaxation, type AllocateCtx } from '../../server/engine';
import { facts, noPins, shift } from './fixtures';

const ctx: AllocateCtx = { ...shift(), weights: { load: 3, recency: 1, reliability: 1 }, loadUnitHours: 4, remainingSlots: 4 };
const group = (g: Partial<GroupSpec>): GroupSpec => ({ ...emptyGroup(), ...g });
const CLASS = { classesByWeekday: { 4: [{ start: '14:00', end: '15:00' }] } };
const BLOCK = { weeklyUnavailable: { 4: [{ start: '13:00', end: '14:00' }] } };
const ids = (from: number, n: number, over = {}) => Array.from({ length: n }, (_, i) => facts({ memberId: from + i, ...over }));

describe('suggestRelaxation (FR-21)', () => {
  it('suggests_any_college_when_college_is_bottleneck', () => {
    const cands = [...ids(1, 1, { collegeCode: 'CCE' }), ...ids(10, 5, { collegeCode: 'CAE' })];
    const g = group({ count: 3, colleges: ['CCE'] });
    expect(suggestRelaxation(cands, g, defaultConstraints(), noPins, ctx, new Set())).toEqual({ relax: 'colleges', wouldAdd: 5 });
  });

  it('suggests_allow_conflicts_when_conflicts_are_bottleneck', () => {
    const cands = [...ids(1, 1), ...ids(10, 4, CLASS)];
    expect(suggestRelaxation(cands, group({ count: 3 }), defaultConstraints(), noPins, ctx, new Set())).toEqual({
      relax: 'allowClassConflicts',
      wouldAdd: 4,
    });
  });

  it('undefined_when_nothing_helps', () => {
    expect(suggestRelaxation(ids(1, 4, BLOCK), group({ count: 3, gender: 'F' }), defaultConstraints(), noPins, ctx, new Set())).toBeUndefined();
  });

  it('ignores_members_taken_by_other_groups', () => {
    const cands = ids(10, 3, { collegeCode: 'CAE' });
    expect(suggestRelaxation(cands, group({ count: 2, colleges: ['CCE'] }), defaultConstraints(), noPins, ctx, new Set([10, 11, 12]))).toBeUndefined();
  });

  it('ties_go_to_relax_key_order', () => {
    // 2 more if any college, 2 more if any gender → 'colleges' wins (earlier key).
    const cands = [...ids(1, 2, { collegeCode: 'CAE', gender: 'F' }), ...ids(10, 2, { collegeCode: 'CCE', gender: 'M' })];
    expect(suggestRelaxation(cands, group({ count: 3, colleges: ['CCE'], gender: 'F' }), defaultConstraints(), noPins, ctx, new Set())).toEqual({
      relax: 'colleges',
      wouldAdd: 2,
    });
  });

  it.each([
    ['tenure', { tenure: 'new' as const }, { isNew: false }],
    ['yearLevels', { yearLevels: [1] }, { yearLevel: 4 }],
    ['height', { heightMinCm: 180 }, { heightCm: 160 }],
  ])('relaxing %s', (key, g, member) => {
    expect(suggestRelaxation(ids(1, 2, member), group({ count: 1, ...g }), defaultConstraints(), noPins, ctx, new Set())).toEqual({ relax: key, wouldAdd: 2 });
  });
});

describe('allocate reports suggestions for short groups', () => {
  it('attaches_suggestion_only_when_short', () => {
    const cands = [...ids(1, 1, { collegeCode: 'CCE' }), ...ids(10, 3, { collegeCode: 'CAE' })];
    const r = allocate(cands, { ...defaultConstraints(), groups: [group({ count: 2, colleges: ['CCE'] }), group({ count: 1 })] }, noPins, ctx);
    expect(r.groups[0]).toMatchObject({ shortfall: 1, suggestion: { relax: 'colleges', wouldAdd: 2 } });
    expect(r.groups[1].suggestion).toBeUndefined();
  });
});
