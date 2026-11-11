// Fairness scoring (TRD §8.3). Pure; full precision (the API rounds for display).
import { daysBetween } from './time';
import type { CandidateFacts } from './types';

export type Weights = { load: number; recency: number; reliability: number };
export type ScoreCtx = { avgTermHours: number; loadUnitHours: number; today: string; weights: Weights };
export type Score = { total: number; loadGap: number; recency: number; reliability: number };

/** Never-assigned members count as this many days since their last shift (the recency cap). */
const RECENCY_CAP_DAYS = 60;

export function scoreCandidate(f: CandidateFacts, ctx: ScoreCtx): Score {
  // Workload in "duty units": 8 h below average with loadUnitHours 4 → loadGap 2.
  const loadGap = (ctx.avgTermHours - f.termHours) / ctx.loadUnitHours;
  const days = f.lastPastAssignmentDate === null ? RECENCY_CAP_DAYS : daysBetween(f.lastPastAssignmentDate, ctx.today);
  const recency = Math.min(days, RECENCY_CAP_DAYS) / 30;
  // Laplace-smoothed attendance rate: a member with no history scores 0.5.
  const reliability = (f.attended + 1) / (f.attended + f.noShow + 2);
  const w = ctx.weights;
  return { total: w.load * loadGap + w.recency * recency + w.reliability * reliability, loadGap, recency, reliability };
}

export function averageHours(all: CandidateFacts[]): number {
  return all.length ? all.reduce((sum, f) => sum + f.termHours, 0) / all.length : 0;
}
