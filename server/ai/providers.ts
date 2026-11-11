// LLM providers (TRD §7.5): Gemini first, then Groq; a provider without a key is skipped.
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from 'ai';
import { InterpreterOutput } from '../../shared/constraints';
import type { Env } from '../env';
import { SchemaMismatch, type Provider } from './interpret';

// `gemini-flash-latest` tracks Google's current free-tier Flash model; override with GEMINI_MODEL.
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
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
