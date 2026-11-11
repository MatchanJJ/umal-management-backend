import { describe, expect, it } from 'vitest';
import { judge, type EvalCase } from '../../evals/judge';
import { defaultConstraints, emptyGroup, type InterpreterOutput } from '../../shared/constraints';

const out = (o: Partial<InterpreterOutput> & { groups?: Partial<InterpreterOutput['constraints']['groups'][number]>[]; extra?: object }): InterpreterOutput => ({
  kind: o.kind ?? 'update',
  constraints: { ...defaultConstraints(), ...o.extra, groups: (o.groups ?? []).map((g) => ({ ...emptyGroup(), ...g })) },
  reply: '',
  assumptions: [],
});
const base: Omit<EvalCase, 'expected'> = { id: 't', source: 'new', category: 'x', history: [], currentConstraints: defaultConstraints(), message: 'm' };

describe('judge', () => {
  it('matches_partial_groups_with_colleges_order_free', () => {
    const c = { ...base, expected: { kind: 'update' as const, groups: [{ count: 2, colleges: ['CEE', 'CCE'] }] } };
    expect(judge(c, out({ groups: [{ count: 2, colleges: ['CCE', 'CEE'], gender: 'F' }] })).pass).toBe(true);
    expect(judge(c, out({ groups: [{ count: 3, colleges: ['CCE', 'CEE'] }] })).pass).toBe(false);
  });

  it('group_count_must_match', () => {
    const c = { ...base, expected: { groups: [{ count: 2 }] } };
    expect(judge(c, out({ groups: [{ count: 2 }, { count: 1 }] })).pass).toBe(false);
  });

  it('explicit_null_and_empty_mean_not_invented', () => {
    const c = { ...base, expected: { groups: [{ count: null, colleges: [] }] } };
    expect(judge(c, out({ groups: [{ count: null }] })).pass).toBe(true);
    expect(judge(c, out({ groups: [{ count: 3 }] })).pass).toBe(false);
    expect(judge(c, out({ groups: [{ count: null, colleges: ['CCE'] }] })).pass).toBe(false);
  });

  it('heights_within_2cm', () => {
    const c = { ...base, expected: { groups: [{ heightMinCm: 168 }] } };
    expect(judge(c, out({ groups: [{ heightMinCm: 167 }] })).pass).toBe(true);
    expect(judge(c, out({ groups: [{ heightMinCm: 160 }] })).pass).toBe(false);
  });

  it('priorities_must_include_expected_and_empty_means_none', () => {
    expect(judge({ ...base, expected: { priorities: ['reliable_first'] } }, out({ extra: { priorities: ['male_first', 'reliable_first'] } })).pass).toBe(true);
    expect(judge({ ...base, expected: { priorities: [] } }, out({ extra: { priorities: ['male_first'] } })).pass).toBe(false);
  });

  it('notKind_and_expectedAny', () => {
    expect(judge({ ...base, expected: { notKind: 'confirm_request' } }, out({ kind: 'clarify' })).pass).toBe(true);
    expect(judge({ ...base, expected: { notKind: 'confirm_request' } }, out({ kind: 'confirm_request' })).pass).toBe(false);
    const any = { ...base, expectedAny: [{ kind: 'clarify' as const }, { kind: 'update' as const, groups: [{ gender: 'M' as const }] }] };
    expect(judge(any, out({ kind: 'update', groups: [{ gender: 'M' }] })).pass).toBe(true);
    expect(judge(any, out({ kind: 'answer' })).pass).toBe(false);
  });

  it('reports_what_differed', () => {
    const r = judge({ ...base, expected: { kind: 'update', allowClassConflicts: false } }, out({ kind: 'update', extra: { allowClassConflicts: true } }));
    expect(r).toEqual({ pass: false, why: 'allowClassConflicts: expected false, got true' });
  });
});
