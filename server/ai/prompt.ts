// AssignAI prompt (TRD §7.1, §7.3). Only catalog codes, shift times and the adviser's own words reach the LLM:
// every field is copied explicitly so member data on caller objects can never leak (NFR-4).
import type { ModelMessage } from 'ai';
import type { Constraints } from '../../shared/constraints';
import type { Vocabulary } from './vocabulary';

/** TRD §7.3 rules 1–8, verbatim. Each one is an eval case. */
export const RULES = [
  'Return the **full** merged state. Short modifiers ("also males", "lalaki lang", "experienced only") patch the most recent relevant group. They never reset counts.',
  'Never invent a count. If no count is stated, keep the existing one, or use `null`.',
  'Only use college codes from the vocabulary. If the adviser names an unknown college, choose `clarify`.',
  'A confirmation ("yes", "sige", "go", "assign them") → `kind: \'confirm_request\'`, constraints unchanged, and a reply that points to the Approve button.',
  'A question about the system → `answer`, constraints unchanged.',
  'Default `allowClassConflicts=false`. It becomes true only on an explicit statement.',
  'Default `teamMode=\'per_shift\'` (different people per shift allowed, rotation preferred). "Same people every day", "iisang team lang", "they cover the whole event" → `same_team`. "Iba-iba bawat araw", "rotate" → `per_shift`. Counts always mean volunteers **per shift**.',
  'The LLM never chooses which shifts are in scope; the adviser picks them in the UI.',
] as const;

/** Phrasing hints found by the eval suite (evals/). They refine the rules above, never override them. */
export const GUIDANCE = [
  'Priorities: "attendance", "best attendance", "reliable", "dependable" → `reliable_first`. "Fewest hours", "least assigned", "spread the load" → `least_assigned_first`. "Freshies", "new members" → `new_first`. "Veterans", "experienced", "old members" → `returning_first`.',
  '"Preferably X", "X preferred", "if possible X" is a soft preference → add the matching priority; it is not a filter.',
  '"Also <gender>" when the current group has the other gender → keep that group and add a new group with that gender and `count: null` (never change the existing group\'s gender).',
  'Gender-only messages ("males only", "no females", "lalaki lang") are clear: `update` the gender, not `clarify`. With no groups yet, create one group with `count: null`.',
  'Engineering words ("CompE", "computer engineering", "civil", "electrical", "ECE", "engineer") → CEE. "Computing", "IT", "CS", "computer science" → CCE.',
  'A number in the message is a count, even inside a team phrase: "same 2 people all 3 days" → one group with `count: 2` and `teamMode: \'same_team\'`. The number of days is not a count.',
] as const;

export type PromptShift = { label: string; startAt: string; endAt: string; weekdays: string[]; required: number; remaining: number };
export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export const HISTORY_LIMIT = 6;

export function buildSystem(vocab: Vocabulary): string {
  return [
    'You are AssignAI, the volunteer-assignment assistant for UMAL (University of Mindanao Ambassadors League) advisers.',
    'You turn the adviser’s request (English, Filipino or Taglish) into a constraint object. You never pick people: a deterministic engine does that.',
    'Reply in the adviser’s language, briefly. Output must match the given JSON schema.',
    '',
    'Rules:',
    ...RULES.map((r, i) => `${i + 1}. ${r}`),
    '',
    'Phrasing guide:',
    ...GUIDANCE.map((g) => `- ${g}`),
    '',
    'Vocabulary:',
    `- Colleges (code: name): ${vocab.colleges.map((c) => `${c.code}: ${c.name}`).join('; ')}`,
    `- Year levels: ${vocab.yearLevels.join(', ')}`,
    `- Genders: ${vocab.genders.join(', ')}`,
    `- Tenure: ${vocab.tenure.join(', ')}`,
    `- Priorities (ordered list, max 4): ${vocab.priorities.join(', ')}`,
  ].join('\n');
}

export function buildMessages(input: {
  vocab: Vocabulary;
  shifts: PromptShift[];
  totalShifts: number;
  constraints: Constraints;
  history: ChatMessage[];
  message: string;
}): { system: string; messages: ModelMessage[] } {
  const shiftLines = input.shifts.map(
    (s) => `- ${s.label} · ${s.startAt} → ${s.endAt} (${s.weekdays.join(', ')}) · required ${s.required} · remaining ${s.remaining}`,
  );
  const context = [
    'Shifts in scope:',
    ...shiftLines,
    `Total shifts in event: ${input.totalShifts}`,
    `Current constraints: ${JSON.stringify(input.constraints)}`,
    '',
    `Adviser: ${input.message}`,
  ].join('\n');
  return {
    system: buildSystem(input.vocab),
    messages: [
      ...input.history.slice(-HISTORY_LIMIT).map(({ role, content }): ModelMessage => ({ role, content })),
      { role: 'user', content: context },
    ],
  };
}
