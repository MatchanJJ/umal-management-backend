import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_GEMINI_MODEL, DEFAULT_GROQ_MODEL, MAX_OUTPUT_TOKENS, providersFromEnv } from '../../server/ai/providers';
import type { Env } from '../../server/env';

const env = (over: Partial<Env>) => ({ ENV: 'test', ...over }) as Env;

describe('providersFromEnv', () => {
  it('skips providers without keys and keeps gemini before groq', () => {
    expect(providersFromEnv(env({})).map((p) => p.name)).toEqual([]);
    expect(providersFromEnv(env({ GROQ_API_KEY: 'g' })).map((p) => p.name)).toEqual(['groq']);
    expect(providersFromEnv(env({ GROQ_API_KEY: 'g', GEMINI_API_KEY: 'k' })).map((p) => [p.name, p.model])).toEqual([
      ['gemini', DEFAULT_GEMINI_MODEL],
      ['groq', DEFAULT_GROQ_MODEL],
    ]);
  });

  it('default_gemini_model_is_one_that_answers_on_the_free_tier', () => {
    // 2.5 models are retired for new keys (404); 3.8-flash / flash-latest hang or 503 on the free tier (2026-11-12).
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-3.5-flash-lite');
  });

  it('model ids come from env when set', () => {
    const [g] = providersFromEnv(env({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-x' }));
    expect(g.model).toBe('gemini-x');
  });
});

describe('provider call options', () => {
  it('disables_sdk_retries_so_429_503_fall_back_within_the_8s_budget', async () => {
    const seen: Record<string, unknown>[] = [];
    vi.doMock('ai', async (orig) => ({
      ...(await orig<typeof import('ai')>()),
      generateText: async (opts: Record<string, unknown>) => (seen.push(opts), { output: {} }),
    }));
    vi.resetModules();
    const { providersFromEnv: fresh } = await import('../../server/ai/providers');
    const [gemini, groq] = fresh(env({ GEMINI_API_KEY: 'k', GROQ_API_KEY: 'g' }));
    const [llama] = fresh(env({ GROQ_API_KEY: 'g', GROQ_MODEL: 'llama-3.3-70b-versatile' }));
    for (const p of [gemini, groq, llama]) await p.generate({ system: 's', messages: [], signal: new AbortController().signal });
    // Every call has a hard output cap; the gpt-oss reasoning model also thinks briefly (its reasoning counts as output).
    expect(seen[0]).toMatchObject({ maxRetries: 0, temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS });
    expect(seen[0].providerOptions).toBeUndefined();
    expect(seen[1]).toMatchObject({ maxOutputTokens: MAX_OUTPUT_TOKENS, providerOptions: { groq: { reasoningEffort: 'low' } } });
    expect(seen[2].providerOptions).toBeUndefined();
    vi.doUnmock('ai');
  });
});

describe('fake provider (e2e only)', () => {
  it('is_used_only_when_AI_PROVIDER_fake_and_ENV_local_or_test', () => {
    expect(providersFromEnv(env({ AI_PROVIDER: 'fake', ENV: 'local', GEMINI_API_KEY: 'k' })).map((p) => p.model)).toEqual(['fake']);
    expect(providersFromEnv(env({ AI_PROVIDER: 'fake', ENV: 'test' })).map((p) => p.model)).toEqual(['fake']);
    for (const ENV of ['production', 'preview'] as const) {
      expect(providersFromEnv(env({ AI_PROVIDER: 'fake', ENV, GEMINI_API_KEY: 'k' })).map((p) => p.model)).toEqual([DEFAULT_GEMINI_MODEL]);
    }
  });

  it('parses_counts_genders_colleges_team_mode_and_confirmations', async () => {
    const [fake] = providersFromEnv(env({ AI_PROVIDER: 'fake', ENV: 'test' }));
    const ask = (text: string) =>
      fake.generate({ system: '', messages: [{ role: 'user', content: `Shifts in scope:\nCurrent constraints: {}\n\nAdviser: ${text}` }], signal: new AbortController().signal }) as Promise<{
        kind: string;
        constraints: { groups: { count: number | null; gender: string | null; colleges: string[] }[]; teamMode: string };
      }>;
    expect(await ask('need 2 girls from CCE')).toMatchObject({ kind: 'update', constraints: { groups: [{ count: 2, gender: 'F', colleges: ['CCE'] }], teamMode: 'per_shift' } });
    expect(await ask('tatlong lalaki')).toMatchObject({ constraints: { groups: [{ count: 3, gender: 'M' }] } });
    expect(await ask('same 2 people all 3 days')).toMatchObject({ constraints: { groups: [{ count: 2 }], teamMode: 'same_team' } });
    expect((await ask('yes assign them')).kind).toBe('confirm_request');
    expect((await ask('sige')).kind).toBe('confirm_request');
  });
});
