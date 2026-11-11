// Single-shift allocation (TRD §8.4 steps 1–5). Pure and deterministic.
export { matchesGroup } from './groups';
export type { RelaxKey } from './diagnostics';
import { emptyGroup, type Constraints } from '../../shared/constraints';
import { suggestRelaxation, type RelaxKey } from './diagnostics';
import { checkEligibility, isSelectable } from './eligibility';
import { matchesGroup } from './groups';
import { comparePriority } from './priorities';
import { averageHours, scoreCandidate, type Score, type Weights } from './scoring';
import { fnv1a32 } from './time';
import type { CandidateFacts, Eligibility, Pins, Reason, ShiftCtx } from './types';

export type AllocateCtx = ShiftCtx & { weights: Weights; loadUnitHours: number; remainingSlots: number };
export type Pick = { memberId: number; groupIndex: number; rank: number; score: Score; softFlags: Reason[] };
export type GroupResult = {
  index: number;
  requested: number;
  filled: number;
  poolSize: number;
  shortfall: number;
  suggestion?: { relax: RelaxKey; wouldAdd: number };
};
export type AllocationResult = { picks: Pick[]; groups: GroupResult[]; excluded: Partial<Record<Reason, number>>; totalEligible: number };

type Scored = { f: CandidateFacts; score: Score; softFlags: Reason[]; tie: number };

/**
 * `eligibilityOf` defaults to this shift's check; same-team allocation passes the union over all shifts in scope.
 */
export function allocate(
  cands: CandidateFacts[],
  c: Constraints,
  pins: Pins,
  ctx: AllocateCtx,
  eligibilityOf: (f: CandidateFacts) => Eligibility = (f) => checkEligibility(f, ctx, pins),
): AllocationResult {
  // 1. Partition and tally why the rest are excluded.
  const excluded: Partial<Record<Reason, number>> = {};
  const scoreCtx = { avgTermHours: averageHours(cands), loadUnitHours: ctx.loadUnitHours, today: ctx.today, weights: ctx.weights };
  const eligible: Scored[] = [];
  for (const f of cands) {
    const e = eligibilityOf(f);
    if (isSelectable(e, c.allowClassConflicts)) {
      eligible.push({ f, score: scoreCandidate(f, scoreCtx), softFlags: e.soft, tie: fnv1a32(`${ctx.shiftId}:${f.memberId}`) });
      continue;
    }
    const reasons = c.allowClassConflicts ? e.hard : [...e.hard, ...e.soft.filter((r) => r === 'CLASS_CONFLICT')];
    for (const r of reasons) excluded[r] = (excluded[r] ?? 0) + 1;
  }

  // 2. Pools per group ([] → one unconstrained "fill remaining" group).
  const groups = (c.groups.length ? c.groups : [emptyGroup()]).map((g, index) => ({
    g,
    index,
    pool: eligible.filter((s) => matchesGroup(s.f, g)),
  }));

  // 3. Scarcest first: pool / count ascending; fill-remaining groups (count null) go last. Stable sort keeps index order on ties.
  const ratio = (x: (typeof groups)[number]) => (x.g.count === null ? Infinity : x.pool.length / x.g.count);
  const order = [...groups].sort((a, b) => ratio(a) - ratio(b));

  // 4. Sort each pool (pins, priorities, score, tie-break) BEFORE cutting to count.
  // Fill-remaining groups share whatever the fixed counts leave of the shift's open slots.
  let leftForFill = ctx.remainingSlots - groups.reduce((sum, x) => sum + (x.g.count ?? 0), 0);
  const taken = new Set<number>();
  const picks: Pick[] = [];
  const results: GroupResult[] = [];
  for (const x of order) {
    const requested = x.g.count ?? Math.max(0, leftForFill);
    const sorted = [...x.pool].sort((a, b) => {
      const pin = Number(pins.include.includes(b.f.memberId)) - Number(pins.include.includes(a.f.memberId));
      if (pin) return pin;
      for (const p of c.priorities) {
        const d = comparePriority(p, a.f, b.f);
        if (d) return d;
      }
      return b.score.total - a.score.total || a.tie - b.tie;
    });
    let filled = 0;
    for (const s of sorted) {
      if (filled === requested) break;
      if (taken.has(s.f.memberId)) continue;
      taken.add(s.f.memberId);
      picks.push({ memberId: s.f.memberId, groupIndex: x.index, rank: ++filled, score: s.score, softFlags: s.softFlags });
    }
    if (x.g.count === null) leftForFill -= filled;
    results.push({ index: x.index, requested, filled, poolSize: x.pool.length, shortfall: requested - filled });
  }

  // 5. For each short group, the single relaxation that would help most (after all groups took their picks).
  for (const r of results) {
    if (r.shortfall > 0) r.suggestion = suggestRelaxation(cands, groups[r.index].g, c, pins, ctx, taken);
  }

  return { picks, groups: results.sort((a, b) => a.index - b.index), excluded, totalEligible: eligible.length };
}
