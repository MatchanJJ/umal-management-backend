import { describe, expect, it } from 'vitest';
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

  it('model ids come from env when set', () => {
    const [g] = providersFromEnv(env({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-x' }));
    expect(g.model).toBe('gemini-x');
  });
});
