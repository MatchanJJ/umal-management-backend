import { afterEach, describe, expect, it, vi } from 'vitest';
import { interpret, normalize, sanitize, type Provider } from '../../server/ai/interpret';
import { buildVocabulary } from '../../server/ai/vocabulary';
import { defaultConstraints, emptyGroup, type GroupSpec, type InterpreterOutput } from '../../shared/constraints';

const vocab = buildVocabulary([
  { code: 'CCE', name: 'College of Computing Education' },
  { code: 'CAE', name: 'College of Accounting Education' },
]);
const input = { vocab, shifts: [], totalShifts: 1, constraints: defaultConstraints(), history: [], message: '6 ushers' };
const ctx = { vocabCodes: new Set(['CCE', 'CAE']), remainingByShift: [{ label: 'Day 1', remaining: 6 }] };
const group = (g: Partial<GroupSpec>): GroupSpec => ({ ...emptyGroup(), ...g });
const out = (over: Partial<InterpreterOutput> = {}): InterpreterOutput => ({
  kind: 'update',
  constraints: { ...defaultConstraints(), groups: [group({ count: 6 })] },
  reply: 'Got it.',
  assumptions: [],
  ...over,
});

function fake(name: 'gemini' | 'groq', impl: Provider['generate']): Provider & { calls: number } {
  const p = { name, model: `${name}-test`, calls: 0, generate: async (args: Parameters<Provider['generate']>[0]) => (p.calls++, impl(args)) };
  return p;
}

afterEach(() => vi.useRealTimers());

describe('interpret (TRD §7.4–7.5)', () => {
  it('falls_back_to_groq_when_gemini_throws', async () => {
    const gemini = fake('gemini', async () => {
      throw new Error('quota exceeded');
    });
    const groq = fake('groq', async () => out());
    const r = await interpret([gemini, groq], input, ctx);
    expect(r).toMatchObject({ provider: 'groq', model: 'groq-test', output: { kind: 'update' } });
    expect([gemini.calls, groq.calls]).toEqual([1, 1]);
  });

  // Global budget: at most 2 LLM calls per turn (Mark's ruling: the cap wins over "retry then fall back").
  it('retries_once_on_validation_error_within_the_2_call_budget', async () => {
    const seen: string[] = [];
    const gemini = fake('gemini', async (args) => {
      seen.push(String(args.messages[args.messages.length - 1].content));
      return { kind: 'update', constraints: { groups: [{ count: 0 }] } }; // invalid every time
    });
    const groq = fake('groq', async () => out());
    const r = await interpret([gemini, groq], input, ctx);
    expect([gemini.calls, groq.calls, r.provider]).toEqual([2, 0, 'none']);
    expect(seen[1]).toMatch(/did not match the schema/i);
  });

  it('retry_succeeds_on_second_call', async () => {
    let n = 0;
    const gemini = fake('gemini', async () => (n++ === 0 ? { kind: 'update', constraints: { groups: [{ count: 0 }] } } : out()));
    expect((await interpret([gemini], input, ctx)).provider).toBe('gemini');
  });

  it('fallback_provider_gets_only_the_remaining_call', async () => {
    const gemini = fake('gemini', async () => Promise.reject(new Error('down')));
    const groq = fake('groq', async () => ({ kind: 'update', constraints: { groups: [{ count: 0 }] } }));
    const r = await interpret([gemini, groq], input, ctx);
    expect([gemini.calls, groq.calls, r.provider]).toEqual([1, 1, 'none']);
  });

  it('none_provider_returns_unchanged_constraints_and_notice', async () => {
    const current = { ...defaultConstraints(), groups: [group({ count: 4, gender: 'F' })] };
    const broken = fake('gemini', async () => {
      throw new Error('down');
    });
    for (const providers of [[], [broken]]) {
      const r = await interpret(providers, { ...input, constraints: current }, ctx);
      expect(r.provider).toBe('none');
      expect(r.output).toEqual({ kind: 'answer', constraints: current, reply: 'AI is unavailable; edit the constraints card directly.', assumptions: [] });
    }
  });

  it('missing_teamMode_defaults_to_per_shift', async () => {
    const r = await interpret(
      [fake('gemini', async () => ({ kind: 'update', constraints: { groups: [{ ...emptyGroup(), count: 3 }], priorities: [] }, reply: 'ok', assumptions: [] }))],
      input,
      ctx,
    );
    expect(r.provider).toBe('gemini');
    expect(r.output.constraints).toMatchObject({ teamMode: 'per_shift', allowClassConflicts: false });
  });

  it('timeout_8s_per_provider', async () => {
    vi.useFakeTimers();
    const hang = fake('gemini', (args) => new Promise((_, reject) => args.signal.addEventListener('abort', () => reject(new Error('aborted')))));
    const groq = fake('groq', async () => out());
    const pending = interpret([hang, groq], input, ctx);
    await vi.advanceTimersByTimeAsync(7_999);
    expect(groq.calls).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    const r = await pending;
    expect([r.provider, groq.calls]).toEqual(['groq', 1]);
  });

  it('keeps_the_failed_providers_error_when_the_fallback_succeeds', async () => {
    const gemini = fake('gemini', async () => Promise.reject(new Error('model overloaded (503)')));
    const r = await interpret([gemini, fake('groq', async () => out())], input, ctx);
    expect(r).toMatchObject({ provider: 'groq', error: expect.stringContaining('gemini: model overloaded (503)') });
  });

  it('no_error_when_first_provider_succeeds', async () => {
    expect((await interpret([fake('gemini', async () => out())], input, ctx)).error).toBeUndefined();
  });

  it('records_latency_and_last_error_on_fallback', async () => {
    const r = await interpret([fake('gemini', async () => Promise.reject(new Error('boom')))], input, ctx);
    expect(r).toMatchObject({ provider: 'none', error: expect.stringContaining('boom'), latencyMs: expect.any(Number) });
  });
});

describe('sanitize', () => {
  it('unknown_college_dropped_with_assumption', () => {
    const o = sanitize(out({ constraints: { ...defaultConstraints(), groups: [group({ count: 2, colleges: ['CCE', 'XYZ', 'cae'] })] } }), ctx.vocabCodes);
    expect(o.constraints.groups[0].colleges).toEqual(['CCE', 'CAE']);
    expect(o.assumptions.join(' ')).toContain('XYZ');
  });

  it('height_min_max_swapped', () => {
    const o = sanitize(out({ constraints: { ...defaultConstraints(), groups: [group({ count: 2, heightMinCm: 180, heightMaxCm: 160 })] } }), ctx.vocabCodes);
    expect([o.constraints.groups[0].heightMinCm, o.constraints.groups[0].heightMaxCm]).toEqual([160, 180]);
  });

  it('dedupes_priorities_and_caps_assumptions', () => {
    const o = sanitize(
      out({
        constraints: { ...defaultConstraints(), groups: [group({ count: 1, colleges: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'] })], priorities: ['new_first', 'tallest_first', 'new_first'] },
        assumptions: ['one', 'two', 'three', 'four', 'five'],
      }),
      ctx.vocabCodes,
    );
    expect(o.constraints.priorities).toEqual(['new_first', 'tallest_first']);
    expect(o.assumptions).toHaveLength(5);
  });
});

describe('normalize', () => {
  const only = (groups: GroupSpec[]) => out({ constraints: { ...defaultConstraints(), groups } });

  it('empty_groups_become_one_unconstrained_group', () => {
    expect(normalize(only([]), ctx.remainingByShift).constraints.groups).toEqual([emptyGroup()]);
  });

  it('single_null_count_left_null_for_engine', () => {
    const o = normalize(only([group({ count: null, gender: 'F' })]), ctx.remainingByShift);
    expect([o.kind, o.constraints.groups[0].count]).toEqual(['update', null]);
  });

  it('two_null_counts_become_clarify', () => {
    const o = normalize(only([group({ gender: 'M' }), group({ gender: 'F' })]), ctx.remainingByShift);
    expect(o.kind).toBe('clarify');
    expect(o.reply).toMatch(/how many/i);
  });

  it('over_remaining_adds_warning_naming_shift', () => {
    const o = normalize(only([group({ count: 3 }), group({ count: 2 })]), [
      { label: 'Day 1', remaining: 6 },
      { label: 'Day 2', remaining: 3 },
    ]);
    expect(o.reply).toContain('Day 2');
    expect(o.reply).not.toContain('Day 1');
    expect(o.kind).toBe('update'); // a warning, not a block
  });
});
