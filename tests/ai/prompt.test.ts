import { describe, expect, it } from 'vitest';
import { buildMessages, RULES } from '../../server/ai/prompt';
import { buildVocabulary } from '../../server/ai/vocabulary';
import { defaultConstraints } from '../../shared/constraints';

const COLLEGES = [
  { code: 'CCE', name: 'College of Computing Education' },
  { code: 'CAE', name: 'College of Accounting Education' },
  { code: 'CAFAE', name: 'College of Architecture and Fine Arts Education' },
];

// A shift object as a careless caller might pass it: carrying member data it should never forward.
const leakyShift = {
  label: 'Day 1',
  startAt: '2026-11-13T08:00',
  endAt: '2026-11-13T17:00',
  weekdays: ['Fri'],
  required: 6,
  remaining: 4,
  memberId: 4242,
  roster: [{ memberId: 77, name: 'Maria Palma', email: 'm.palma.546616@umindanao.edu.ph', studentNumber: '546616' }],
} as unknown as Parameters<typeof buildMessages>[0]['shifts'][number];

const build = (over: Partial<Parameters<typeof buildMessages>[0]> = {}) =>
  buildMessages({
    vocab: buildVocabulary(COLLEGES),
    shifts: [leakyShift],
    totalShifts: 3,
    constraints: defaultConstraints(),
    history: [],
    message: 'kailangan ko ng 6 ushers, 3 lalaki 3 babae',
    ...over,
  });

describe('buildMessages (TRD §7.1)', () => {
  it('no_pii_in_prompt', () => {
    const serialized = JSON.stringify(build());
    for (const pii of ['Maria', 'Palma', 'm.palma.546616@umindanao.edu.ph', '546616', '4242', 'memberId']) {
      expect(serialized, pii).not.toContain(pii);
    }
  });

  it('includes_all_college_codes', () => {
    const { system } = build();
    for (const c of COLLEGES) {
      expect(system).toContain(c.code);
      expect(system).toContain(c.name);
    }
  });

  it('history_trimmed_to_6', () => {
    const history = Array.from({ length: 9 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `turn ${i}` }));
    const { messages } = build({ history });
    // 6 history messages + the new adviser message (with shift context).
    expect(messages).toHaveLength(7);
    // turns 3…8 survive (odd turns are the assistant's)
    expect(messages[0]).toEqual({ role: 'assistant', content: 'turn 3' });
    expect(messages[5]).toEqual({ role: 'user', content: 'turn 8' });
  });

  it('system_prompt_has_rules_1_to_8_verbatim', () => {
    const { system } = build();
    expect(RULES).toHaveLength(8);
    for (const rule of RULES) expect(system).toContain(rule);
    expect(system).toContain('Never invent a count.');
    expect(system).toContain('The LLM never chooses which shifts are in scope');
  });

  it('last_message_carries_shift_context_constraints_and_message', () => {
    const { messages } = build();
    const last = messages[messages.length - 1];
    expect(last.role).toBe('user');
    expect(last.content).toContain('Day 1 · 2026-11-13T08:00 → 2026-11-13T17:00 (Fri) · required 6 · remaining 4');
    expect(last.content).toContain('Total shifts in event: 3');
    expect(last.content).toContain(JSON.stringify(defaultConstraints()));
    expect(last.content).toContain('kailangan ko ng 6 ushers, 3 lalaki 3 babae');
  });

  it('vocabulary_lists_enums', () => {
    const v = buildVocabulary(COLLEGES);
    expect(v).toMatchObject({ yearLevels: [1, 2, 3, 4, 5], genders: ['M', 'F'], tenure: ['new', 'returning'] });
    expect(v.priorities).toContain('least_assigned_first');
  });
});
