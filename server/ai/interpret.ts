// AssignAI interpreter (TRD §7.4–7.5): provider fallback, one validation retry, then deterministic clean-up.
import type { ModelMessage } from 'ai';
import { emptyGroup, InterpreterOutput, type Constraints } from '../../shared/constraints';
import { buildMessages } from './prompt';

export type BuildMessagesInput = Parameters<typeof buildMessages>[0];

/** Returns the raw object; `interpret` validates it so real and fake providers share one path. */
export type Provider = {
  name: 'gemini' | 'groq';
  model: string;
  generate(args: { system: string; messages: ModelMessage[]; signal: AbortSignal }): Promise<unknown>;
};

export type InterpretResult = { output: InterpreterOutput; provider: 'gemini' | 'groq' | 'none'; model?: string; latencyMs: number; error?: string };

export const PROVIDER_TIMEOUT_MS = 8_000;
/** Global budget: at most 2 LLM calls per AI turn (free tiers). Retries and fallbacks share it. */
export const MAX_LLM_CALLS = 2;
export const UNAVAILABLE_REPLY = 'AI is unavailable; edit the constraints card directly.';
const MAX_ASSUMPTIONS = 5;

/** Thrown by a provider when its output didn't match the schema (worth one retry). */
export class SchemaMismatch extends Error {}

/** Fill fields the model may omit with their documented defaults (rules 6–7) before validating. */
function withDefaults(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const o = raw as Record<string, unknown>;
  const c = (o.constraints && typeof o.constraints === 'object' ? o.constraints : {}) as Record<string, unknown>;
  return {
    reply: '',
    assumptions: [],
    ...o,
    constraints: { groups: [], allowClassConflicts: false, priorities: [], teamMode: 'per_shift', ...c },
  };
}

async function callWithTimeout(p: Provider, system: string, messages: ModelMessage[]): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`${p.name} timed out after ${PROVIDER_TIMEOUT_MS / 1000}s`));
    }, PROVIDER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([p.generate({ system, messages, signal: controller.signal }), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function interpret(
  providers: Provider[],
  input: BuildMessagesInput,
  ctx: { vocabCodes: Set<string>; remainingByShift: { label: string; remaining: number }[] },
): Promise<InterpretResult> {
  const started = Date.now();
  const { system, messages } = buildMessages(input);
  let lastError: string | undefined;
  let calls = 0;

  for (const p of providers) {
    let msgs = messages;
    // A retry (attempt 1) and a fallback provider both spend from the same per-turn budget.
    for (let attempt = 0; attempt < 2 && calls < MAX_LLM_CALLS; attempt++) {
      let problem: string;
      try {
        calls++;
        const parsed = InterpreterOutput.safeParse(withDefaults(await callWithTimeout(p, system, msgs)));
        if (parsed.success) {
          const output = normalize(sanitize(parsed.data, ctx.vocabCodes), ctx.remainingByShift);
          return { output, provider: p.name, model: p.model, latencyMs: Date.now() - started };
        }
        problem = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      } catch (e) {
        if (!(e instanceof SchemaMismatch)) {
          lastError = `${p.name}: ${(e as Error).message}`;
          break; // provider error or timeout → next provider
        }
        problem = e.message;
      }
      lastError = `${p.name}: invalid output (${problem})`;
      // One retry with the validation error attached (TRD §7.4.1).
      msgs = [...messages, { role: 'user', content: `Your previous answer did not match the schema: ${problem}. Return the full JSON again.` }];
    }
  }

  return {
    output: { kind: 'answer', constraints: input.constraints, reply: UNAVAILABLE_REPLY, assumptions: [] },
    provider: 'none',
    latencyMs: Date.now() - started,
    error: lastError,
  };
}

const clampHeight = (h: number | null) => (h === null ? null : Math.min(230, Math.max(100, h)));

/** TRD §7.4.2: drop unknown colleges (with a note), clamp and order heights, dedupe priorities. */
export function sanitize(o: InterpreterOutput, vocabCodes: Set<string>): InterpreterOutput {
  const dropped = new Set<string>();
  const groups = o.constraints.groups.map((g) => {
    const colleges = [...new Set(g.colleges.map((c) => c.trim().toUpperCase()))].filter((c) => vocabCodes.has(c) || (dropped.add(c), false));
    let [min, max] = [clampHeight(g.heightMinCm), clampHeight(g.heightMaxCm)];
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    return { ...g, colleges, heightMinCm: min, heightMaxCm: max };
  });
  const notes = dropped.size ? [`Ignored unknown college code(s): ${[...dropped].join(', ')}`] : [];
  return {
    ...o,
    constraints: { ...o.constraints, groups, priorities: [...new Set(o.constraints.priorities)] },
    assumptions: [...o.assumptions, ...notes].slice(0, MAX_ASSUMPTIONS),
  };
}

/** TRD §7.4.3–4: one unconstrained group by default; several "fill remaining" groups need a count; warn per short shift. */
export function normalize(o: InterpreterOutput, remainingByShift: { label: string; remaining: number }[]): InterpreterOutput {
  const constraints: Constraints = { ...o.constraints, groups: o.constraints.groups.length ? o.constraints.groups : [emptyGroup()] };
  if (constraints.groups.filter((g) => g.count === null).length > 1) {
    return { ...o, constraints, kind: 'clarify', reply: 'How many volunteers do you need for each group?' };
  }
  const requested = constraints.groups.reduce((sum, g) => sum + (g.count ?? 0), 0);
  const short = remainingByShift.filter((s) => requested > s.remaining);
  const warning = short.length
    ? ` Note: you asked for ${requested}, but ${short.map((s) => `${s.label} has only ${s.remaining} open`).join(', ')}.`
    : '';
  return { ...o, constraints, reply: `${o.reply}${warning}`.trim() };
}
