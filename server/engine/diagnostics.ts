// Shortfall diagnostics (TRD §8.4 step 5, FR-21). Pure.
import type { Constraints, GroupSpec } from '../../shared/constraints';
import { checkEligibility, isSelectable } from './eligibility';
import { matchesGroup } from './groups';
import type { CandidateFacts, Pins, ShiftCtx } from './types';

export const RELAX_KEYS = ['colleges', 'gender', 'tenure', 'yearLevels', 'height', 'allowClassConflicts'] as const;
export type RelaxKey = (typeof RELAX_KEYS)[number];

/** The group with one filter dropped (allowClassConflicts relaxes the constraints instead). */
function relaxed(g: GroupSpec, key: RelaxKey): GroupSpec {
  switch (key) {
    case 'colleges':
      return { ...g, colleges: [] };
    case 'gender':
      return { ...g, gender: null };
    case 'tenure':
      return { ...g, tenure: null };
    case 'yearLevels':
      return { ...g, yearLevels: [] };
    case 'height':
      return { ...g, heightMinCm: null, heightMaxCm: null };
    case 'allowClassConflicts':
      return g;
  }
}

/** The single relaxation that adds the most untaken selectable candidates; ties go in RELAX_KEYS order. */
export function suggestRelaxation(
  cands: CandidateFacts[],
  group: GroupSpec,
  c: Constraints,
  pins: Pins,
  ctx: ShiftCtx,
  taken: Set<number>,
): { relax: RelaxKey; wouldAdd: number } | undefined {
  const free = cands.filter((f) => !taken.has(f.memberId)).map((f) => ({ f, e: checkEligibility(f, ctx, pins) }));
  const poolSize = (g: GroupSpec, allowConflicts: boolean) => free.filter(({ f, e }) => isSelectable(e, allowConflicts) && matchesGroup(f, g)).length;

  const base = poolSize(group, c.allowClassConflicts);
  let best: { relax: RelaxKey; wouldAdd: number } | undefined;
  for (const key of RELAX_KEYS) {
    const wouldAdd = poolSize(relaxed(group, key), c.allowClassConflicts || key === 'allowClassConflicts') - base;
    if (wouldAdd > (best?.wouldAdd ?? 0)) best = { relax: key, wouldAdd };
  }
  return best;
}
