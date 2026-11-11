// AssignAI constraint state (TRD §7.2). The LLM only fills this object; the engine decides who is picked.
import { z } from 'zod';
import { GENDERS, PRIORITIES } from './enums';

export const Gender = z.enum(GENDERS);
export const Tenure = z.enum(['new', 'returning']);
export const Priority = z.enum(PRIORITIES);

export const GroupSpec = z.object({
  count: z.number().int().min(1).max(100).nullable(), // null = "fill remaining"
  colleges: z.array(z.string()).max(14), // catalog codes; [] = any
  gender: Gender.nullable(),
  tenure: Tenure.nullable(),
  yearLevels: z.array(z.number().int().min(1).max(5)), // [] = any
  heightMinCm: z.number().int().min(100).max(230).nullable(),
  heightMaxCm: z.number().int().min(100).max(230).nullable(),
});

export const Constraints = z.object({
  groups: z.array(GroupSpec).max(10), // [] = one unconstrained group; counts are PER SHIFT
  allowClassConflicts: z.boolean(),
  priorities: z.array(Priority).max(4), // ordered
  teamMode: z.enum(['per_shift', 'same_team']), // only matters with > 1 shift in scope
});

export const InterpreterOutput = z.object({
  kind: z.enum(['update', 'answer', 'clarify', 'confirm_request']),
  constraints: Constraints, // FULL merged state, not a diff
  reply: z.string().max(600), // same language as the adviser
  assumptions: z.array(z.string()).max(5),
});

export type Gender = z.infer<typeof Gender>;
export type Tenure = z.infer<typeof Tenure>;
export type Priority = z.infer<typeof Priority>;
export type GroupSpec = z.infer<typeof GroupSpec>;
export type Constraints = z.infer<typeof Constraints>;
export type InterpreterOutput = z.infer<typeof InterpreterOutput>;
export type Pins = { include: number[]; exclude: number[] };

export function emptyGroup(): GroupSpec {
  return { count: null, colleges: [], gender: null, tenure: null, yearLevels: [], heightMinCm: null, heightMaxCm: null };
}

export function defaultConstraints(): Constraints {
  return { groups: [], allowClassConflicts: false, priorities: [], teamMode: 'per_shift' };
}
