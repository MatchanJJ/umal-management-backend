import { describe, expect, it } from 'vitest';
import { parseTermName, termName, TERM_KINDS } from '../../shared/settings';

// Three terms a school year: semesters carry the school-year range, summer only its year (Mark, 2026-11-12).
describe('term names', () => {
  it.each([
    ['1st Semester', 2026, '1st Semester AY 2026-2027'],
    ['2nd Semester', 2026, '2nd Semester AY 2026-2027'],
    ['Summer', 2027, 'Summer 2027'],
  ] as const)('%s %i → %s', (kind, year, name) => {
    expect(termName(kind, year)).toBe(name);
    expect(parseTermName(name)).toEqual({ kind, year });
  });

  it('round-trips every kind', () => {
    for (const kind of TERM_KINDS) expect(parseTermName(termName(kind, 2030))).toEqual({ kind, year: 2030 });
  });

  it.each(['Smoke 2026-11-12', '1st Semester AY 2026-2028', 'Summer 26', '3rd Semester AY 2026-2027', ''])('older or odd name %j → null', (name) => {
    expect(parseTermName(name)).toBeNull();
  });
});
