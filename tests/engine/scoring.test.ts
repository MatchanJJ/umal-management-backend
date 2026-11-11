import { describe, expect, it } from 'vitest';
import { averageHours, scoreCandidate } from '../../server/engine/scoring';
import { facts } from './fixtures';

const ctx = { avgTermHours: 8, loadUnitHours: 4, today: '2026-11-10', weights: { load: 3, recency: 1, reliability: 1 } };

describe('scoreCandidate (TRD §8.3)', () => {
  it('new_member_with_no_history', () => {
    expect(scoreCandidate(facts({ termHours: 0, lastPastAssignmentDate: null, attended: 0, noShow: 0 }), ctx)).toEqual({
      loadGap: 2,
      recency: 2,
      reliability: 0.5,
      total: 3 * 2 + 2 + 0.5,
    });
  });

  it('load_gap_negative_above_average', () => {
    expect(scoreCandidate(facts({ termHours: 14 }), ctx).loadGap).toBe(-1.5); // 6 h above average
  });

  it('recency_in_days_over_30', () => {
    expect(scoreCandidate(facts({ lastPastAssignmentDate: '2026-10-27' }), ctx).recency).toBeCloseTo(14 / 30);
  });

  it('recency_capped_at_60_days', () => {
    expect(scoreCandidate(facts({ lastPastAssignmentDate: '2026-06-01' }), ctx).recency).toBe(2);
  });

  it('reliability_laplace_smoothed', () => {
    expect(scoreCandidate(facts({ attended: 3, noShow: 1 }), ctx).reliability).toBeCloseTo(4 / 6);
  });

  it('weights_scale_components', () => {
    const s = scoreCandidate(facts({ termHours: 4, lastPastAssignmentDate: '2026-10-11', attended: 1, noShow: 1 }), {
      ...ctx,
      weights: { load: 0, recency: 2, reliability: 0.5 },
    });
    expect(s.total).toBeCloseTo(2 * 1 + 0.5 * 0.5); // loadGap ignored (weight 0); recency 30/30; reliability 2/4
  });
});

describe('averageHours', () => {
  it('is_zero_for_empty', () => {
    expect(averageHours([])).toBe(0);
  });

  it('is_the_mean_of_term_hours', () => {
    expect(averageHours([facts({ termHours: 2 }), facts({ termHours: 9 }), facts({ termHours: 4 })])).toBe(5);
  });
});
