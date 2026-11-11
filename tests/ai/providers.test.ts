import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_GEMINI_MODEL, DEFAULT_GROQ_MODEL, providersFromEnv } from '../../server/ai/providers';
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
    const [gemini] = fresh(env({ GEMINI_API_KEY: 'k' }));
    await gemini.generate({ system: 's', messages: [], signal: new AbortController().signal });
    expect(seen[0]).toMatchObject({ maxRetries: 0, temperature: 0 });
    vi.doUnmock('ai');
  });
});
