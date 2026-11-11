// LLM providers (TRD §7.5): Gemini first, then Groq; a provider without a key is skipped.
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from 'ai';
import { InterpreterOutput } from '../../shared/constraints';
import type { Env } from '../env';
import { SchemaMismatch, type Provider } from './interpret';

// Checked live on 2026-11-12: 2.5 models are retired for new keys (404); gemini-3.8-flash and
// gemini-flash-latest hang or return 503 on the free tier; gemini-3.5-flash-lite answers in ~1.3 s.
// Override with GEMINI_MODEL.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

function provider(name: Provider['name'], modelId: string, model: LanguageModel): Provider {
  return {
    name,
    model: modelId,
    async generate({ system, messages, signal }) {
      try {
        const { output } = await generateText({
          model,
          system,
          messages,
          temperature: 0,
          abortSignal: signal,
          // No SDK-level retries: their backoff eats the 8 s budget and hides 429/503s. interpret() owns retry/fallback.
          maxRetries: 0,
          output: Output.object({ schema: InterpreterOutput }),
        });
        return output;
      } catch (e) {
        // The model answered but not in the schema → worth one retry with the error attached.
        if (NoObjectGeneratedError.isInstance(e)) throw new SchemaMismatch(e.message);
        throw e;
      }
    },
  };
}

/** Configured providers in fallback order. AI_GATEWAY_URL (optional Cloudflare AI Gateway) becomes each base URL. */
export function providersFromEnv(env: Env): Provider[] {
  const gateway = env.AI_GATEWAY_URL?.replace(/\/$/, '');
  const out: Provider[] = [];
  if (env.GEMINI_API_KEY) {
    const id = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY, ...(gateway ? { baseURL: `${gateway}/google-ai-studio/v1beta` } : {}) });
    out.push(provider('gemini', id, google(id)));
  }
  if (env.GROQ_API_KEY) {
    const id = env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
    const groq = createGroq({ apiKey: env.GROQ_API_KEY, ...(gateway ? { baseURL: `${gateway}/groq` } : {}) });
    out.push(provider('groq', id, groq(id)));
  }
  return out;
}
