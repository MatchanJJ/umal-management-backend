// Multi-shift allocation (TRD §8.4 "Several shifts"). Pure; never mutates its inputs.
import type { Constraints } from '../../shared/constraints';
import { REASONS } from '../../shared/enums';
import { allocate, type AllocateCtx, type AllocationResult } from './allocate';
import { checkEligibility } from './eligibility';
import { hoursBetween } from './time';
import type { CandidateFacts, Eligibility, Pins } from './types';

export type ShiftsAllocation = { teamMode: 'per_shift' | 'same_team'; perShift: { shiftId: number; result: AllocationResult }[] };

export function allocateShifts(cands: CandidateFacts[], c: Constraints, pins: Pins, shifts: AllocateCtx[]): ShiftsAllocation {
  const ordered = [...shifts].sort((a, b) => a.startAt.localeCompare(b.startAt));
  if (c.teamMode === 'same_team' && ordered.length > 1) return sameTeam(cands, c, pins, ordered);

  // per_shift: chronological; each shift's picks become bookings + served hours before the next shift, so overlaps
  // are DOUBLE_BOOKED and the load term naturally rotates people without banning repeats.
  let facts = cands;
  const perShift = ordered.map((ctx) => {
    const result = allocate(facts, c, pins, ctx);
    const picked = new Set(result.picks.map((p) => p.memberId));
    facts = facts.map((f) =>
      picked.has(f.memberId)
        ? {
            ...f,
            bookings: [...f.bookings, { shiftId: ctx.shiftId, start: ctx.startAt, end: ctx.endAt }],
            termHours: f.termHours + hoursBetween(ctx.startAt, ctx.endAt),
          }
        : f,
    );
    return { shiftId: ctx.shiftId, result };
  });
  return { teamMode: 'per_shift', perShift };
}

/** Same people on every shift: eligible only if selectable for all of them (reasons unioned). */
function sameTeam(cands: CandidateFacts[], c: Constraints, pins: Pins, shifts: AllocateCtx[]): ShiftsAllocation {
  const union = (f: CandidateFacts): Eligibility => {
    const each = shifts.map((s) => checkEligibility(f, s, pins));
    const pick = (k: 'hard' | 'soft') => REASONS.filter((r) => each.some((e) => e[k].includes(r)));
    return { hard: pick('hard'), soft: pick('soft') };
  };
  const ctx = { ...shifts[0], remainingSlots: Math.min(...shifts.map((s) => s.remainingSlots)) };
  const result = allocate(cands, c, pins, ctx, union);
  return { teamMode: 'same_team', perShift: shifts.map((s) => ({ shiftId: s.shiftId, result })) };
}
