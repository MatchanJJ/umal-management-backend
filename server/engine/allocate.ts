// Single-shift allocation (TRD §8.4 steps 1–4). Pure and deterministic.
import { emptyGroup, type Constraints, type GroupSpec } from '../../shared/constraints';
import { checkEligibility, isSelectable } from './eligibility';
import { comparePriority } from './priorities';
import { averageHours, scoreCandidate, type Score, type Weights } from './scoring';
import { fnv1a32 } from './time';
import type { CandidateFacts, Pins, Reason, ShiftCtx } from './types';

/** Which single filter a shortfall suggestion would drop (refined in Task 3.6). */
export type RelaxKey = string;
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

/** Group filters; a null attribute never satisfies a filter that constrains it (review focus 5). */
export function matchesGroup(f: CandidateFacts, g: GroupSpec): boolean {
  return (
    (g.colleges.length === 0 || (f.collegeCode !== null && g.colleges.includes(f.collegeCode))) &&
    (g.gender === null || f.gender === g.gender) &&
    (g.tenure === null || f.isNew === (g.tenure === 'new')) &&
    (g.yearLevels.length === 0 || (f.yearLevel !== null && g.yearLevels.includes(f.yearLevel))) &&
    (g.heightMinCm === null || (f.heightCm !== null && f.heightCm >= g.heightMinCm)) &&
    (g.heightMaxCm === null || (f.heightCm !== null && f.heightCm <= g.heightMaxCm))
  );
}

type Scored = { f: CandidateFacts; score: Score; softFlags: Reason[]; tie: number };

export function allocate(cands: CandidateFacts[], c: Constraints, pins: Pins, ctx: AllocateCtx): AllocationResult {
  // 1. Partition and tally why the rest are excluded.
  const excluded: Partial<Record<Reason, number>> = {};
  const scoreCtx = { avgTermHours: averageHours(cands), loadUnitHours: ctx.loadUnitHours, today: ctx.today, weights: ctx.weights };
  const eligible: Scored[] = [];
  for (const f of cands) {
    const e = checkEligibility(f, ctx, pins);
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

  return { picks, groups: results.sort((a, b) => a.index - b.index), excluded, totalEligible: eligible.length };
}
