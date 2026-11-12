import { describe, expect, it } from 'vitest';
import { DAY_CODES, entriesForDayCode, findOverlap } from '../../shared/schedule';

// UM registrar day codes, as confirmed by Mark: M-Sa = Mon–Sat, M-SA1 = Mon–Wed, M-SA2 = Thu–Sat.
describe('UM day codes', () => {
  it.each([
    ['M-Sa', [1, 2, 3, 4, 5, 6]],
    ['M-SA1', [1, 2, 3]],
    ['M-SA2', [4, 5, 6]],
    ['Mon', [1]],
    ['Tue', [2]],
    ['Wed', [3]],
    ['Thu', [4]],
    ['Fri', [5]],
    ['Sa', [6]],
  ] as const)('%s covers ISO days %j', (code, days) => {
    expect(entriesForDayCode(code, { startTime: '08:00', endTime: '09:30', label: 'CS 311' }).map((e) => e.dayOfWeek)).toEqual(days);
  });

  it('lists every code once and copies time and label to each day', () => {
    expect(new Set(DAY_CODES.map((d) => d.code)).size).toBe(DAY_CODES.length);
    expect(entriesForDayCode('M-SA2', { startTime: '13:00', endTime: '14:30', label: null })).toEqual([
      { dayOfWeek: 4, startTime: '13:00', endTime: '14:30', label: null },
      { dayOfWeek: 5, startTime: '13:00', endTime: '14:30', label: null },
      { dayOfWeek: 6, startTime: '13:00', endTime: '14:30', label: null },
    ]);
  });

  it('a multi-day class clashes with a single-day class it overlaps', () => {
    const existing = entriesForDayCode('Wed', { startTime: '09:00', endTime: '10:00', label: 'PE' });
    const added = entriesForDayCode('M-SA1', { startTime: '08:00', endTime: '09:30', label: 'CS 311' });
    expect(findOverlap([...existing, ...added])?.map((e) => e.label)).toEqual(['CS 311', 'PE']);
  });
});
