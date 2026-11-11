import { z } from 'zod';
import { Constraints } from './constraints';

const ids = z.array(z.number().int().positive()).max(500);
export const PinsInput = z.object({ include: ids, exclude: ids }).strict();
export const ScopeInput = z.object({ shiftIds: z.array(z.number().int().positive()).min(1).max(30) }).strict();

export const TurnInput = z.object({ message: z.string().trim().min(1).max(1000), pins: PinsInput, scope: ScopeInput }).strict();
export const ConstraintsInput = z.object({ constraints: Constraints, pins: PinsInput, scope: ScopeInput }).strict();

export type Score = { total: number; loadGap: number; recency: number; reliability: number };
export type PickDTO = {
  memberId: number;
  groupIndex: number;
  rank: number;
  score: Score;
  softFlags: string[];
  member: { name: string; collegeCode: string | null; yearLevel: number | null; termHours: number; daysSinceLast: number | null; attended: number; noShow: number };
};
export type GroupResultDTO = { index: number; requested: number; filled: number; poolSize: number; shortfall: number; suggestion?: { relax: string; wouldAdd: number } };
export type ShiftResultDTO = {
  shiftId: number;
  label: string;
  startAt: string;
  endAt: string;
  requiredVolunteers: number;
  remainingSlots: number;
  result: { picks: PickDTO[]; groups: GroupResultDTO[]; excluded: Record<string, number>; totalEligible: number };
};
/** TRD §6 `ShiftsAllocation` with display fields joined server-side (names never go to the LLM). */
export type ResultDTO = { teamMode: 'per_shift' | 'same_team'; perShift: ShiftResultDTO[]; avgTermHours: number };

export type TurnKind = 'update' | 'answer' | 'clarify' | 'confirm_request' | 'manual_edit';
export type TurnDTO = {
  id: number;
  kind: TurnKind;
  userMessage: string | null;
  reply: string | null;
  assumptions: string[];
  provider: 'gemini' | 'groq' | 'none';
  createdAt: string;
};

/** TRD §6 TurnResponse. */
export type TurnResponse = {
  turn: { id: number; reply: string; kind: TurnKind; assumptions: string[]; provider: 'gemini' | 'groq' | 'none' };
  constraints: Constraints;
  result: ResultDTO;
  scope: { shiftIds: number[] };
  eventVersion: number;
};

export type SessionResponse = {
  session: { id: number; eventId: number; status: 'open' | 'approved' | 'abandoned'; constraints: Constraints; pins: { include: number[]; exclude: number[] }; scope: { shiftIds: number[] } };
  turns: TurnDTO[];
  result: ResultDTO;
  eventVersion: number;
};
