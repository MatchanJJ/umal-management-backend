// Deterministic stand-in LLM for local e2e runs (AI_PROVIDER=fake, ENV local/test only — see providersFromEnv).
// It understands just enough English/Tagalog for the Playwright scenarios; real interpretation is Gemini/Groq.
import { emptyGroup, type InterpreterOutput } from '../../shared/constraints';
import type { Provider } from './interpret';

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, isa: 1, dalawa: 2, dalawang: 2, tatlo: 3, tatlong: 3 };

export function parseFake(text: string): InterpreterOutput {
  const t = text.toLowerCase();
  const base = { groups: [] as InterpreterOutput['constraints']['groups'], allowClassConflicts: false, priorities: [], teamMode: 'per_shift' as const };
  if (/^(yes|sige|go|ok|okay)\b|assign (them|mo na)|i-assign/.test(t)) {
    return { kind: 'confirm_request', constraints: base, reply: 'Review the picks and press Approve to assign.', assumptions: [] };
  }
  if (t.trim().endsWith('?')) return { kind: 'answer', constraints: base, reply: 'Picks follow your constraints, then fewest hours served.', assumptions: [] };

  const digit = /\b(\d{1,3})\b/.exec(t)?.[1];
  // "same 2 people all 3 days": the first number is the count.
  const count = digit ? Number(digit) : (Object.entries(WORD_NUMBERS).find(([w]) => new RegExp(`\\b${w}\\b`).test(t))?.[1] ?? null);
  const gender = /\b(girls?|females?|babae|women)\b/.test(t) ? 'F' : /\b(boys?|males?|lalaki|men)\b/.test(t) ? 'M' : null;
  const colleges = [...text.matchAll(/\b([A-Z]{2,5})\b/g)].map((m) => m[1]);
  const teamMode = /\bsame\b.*\b(people|team)\b|\biisang team\b/.test(t) ? 'same_team' : 'per_shift';
  return {
    kind: 'update',
    constraints: { ...base, teamMode, groups: [{ ...emptyGroup(), count, gender, colleges }] },
    reply: 'Updated.',
    assumptions: [],
  };
}

export const fakeProvider: Provider = {
  name: 'gemini',
  model: 'fake',
  async generate({ messages }) {
    const last = String(messages[messages.length - 1]?.content ?? '');
    return parseFake(last.slice(last.lastIndexOf('Adviser: ') + 'Adviser: '.length));
  },
};
