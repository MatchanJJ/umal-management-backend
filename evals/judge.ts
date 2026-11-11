// Field-wise comparison for eval cases (see evals/README.md). Pure; unit-tested in tests/ai/evals-judge.test.ts.
import type { Constraints, GroupSpec, InterpreterOutput, Priority } from '../shared/constraints';

export type Expectation = {
  kind?: InterpreterOutput['kind'];
  notKind?: InterpreterOutput['kind'];
  /** Exact number of groups; within each, only the listed fields are compared (colleges order-free, heights ±2 cm). */
  groups?: Partial<GroupSpec>[];
  allowClassConflicts?: boolean;
  /** Expected priorities must all be present (any order); [] means none at all. */
  priorities?: Priority[];
  teamMode?: Constraints['teamMode'];
};

export type EvalCase = {
  id: string;
  source: 'v1' | 'audit' | 'new';
  category: string;
  gate?: 'confirm_request' | 'conflicts_default';
  history: { role: 'user' | 'assistant'; content: string }[];
  currentConstraints: Constraints;
  message: string;
  expected?: Expectation;
  /** Any one alternative passing is a pass (ambiguous phrasing). */
  expectedAny?: Expectation[];
  note?: string;
};

const show = (v: unknown) => JSON.stringify(v);

function check(e: Expectation, o: InterpreterOutput): string | null {
  if (e.kind && o.kind !== e.kind) return `kind: expected ${e.kind}, got ${o.kind}`;
  if (e.notKind && o.kind === e.notKind) return `kind: must not be ${e.notKind}`;
  const c = o.constraints;
  if (e.allowClassConflicts !== undefined && c.allowClassConflicts !== e.allowClassConflicts) {
    return `allowClassConflicts: expected ${e.allowClassConflicts}, got ${c.allowClassConflicts}`;
  }
  if (e.teamMode && c.teamMode !== e.teamMode) return `teamMode: expected ${e.teamMode}, got ${c.teamMode}`;
  if (e.priorities) {
    if (!e.priorities.length && c.priorities.length) return `priorities: expected none, got ${show(c.priorities)}`;
    const missing = e.priorities.filter((p) => !c.priorities.includes(p));
    if (missing.length) return `priorities: missing ${show(missing)} (got ${show(c.priorities)})`;
  }
  if (e.groups) {
    if (c.groups.length !== e.groups.length) return `groups: expected ${e.groups.length}, got ${c.groups.length} ${show(c.groups)}`;
    for (const [i, eg] of e.groups.entries()) {
      const g = c.groups[i];
      for (const [k, want] of Object.entries(eg) as [keyof GroupSpec, unknown][]) {
        const got = g[k];
        const ok =
          k === 'colleges' || k === 'yearLevels'
            ? show([...(got as unknown[])].sort()) === show([...(want as unknown[])].sort())
            : (k === 'heightMinCm' || k === 'heightMaxCm') && typeof want === 'number' && typeof got === 'number'
              ? Math.abs(got - want) <= 2
              : got === want;
        if (!ok) return `groups[${i}].${k}: expected ${show(want)}, got ${show(got)}`;
      }
    }
  }
  return null;
}

export function judge(c: EvalCase, o: InterpreterOutput): { pass: boolean; why?: string } {
  const options = c.expectedAny ?? (c.expected ? [c.expected] : []);
  const failures = options.map((e) => check(e, o));
  if (failures.some((f) => f === null)) return { pass: true };
  return { pass: false, why: failures.join(' | or | ') };
}
