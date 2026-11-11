import { describe, expect, it } from 'vitest';
import { daysBetween, fnv1a32, hoursBetween, isoWeekday, overlaps, schoolYearStart, segments } from '../../server/engine/time';

describe('engine time utilities', () => {
  it('overlaps: touching is not overlapping; HH:MM and full timestamps', () => {
    expect(overlaps('08:00', '10:00', '10:00', '12:00')).toBe(false);
    expect(overlaps('09:30', '10:30', '10:00', '11:00')).toBe(true);
    expect(overlaps('08:00', '12:00', '09:00', '10:00')).toBe(true);
    expect(overlaps('2026-11-13T22:00', '2026-11-14T02:00', '2026-11-14T01:00', '2026-11-14T05:00')).toBe(true);
    expect(overlaps('20:00', '24:00', '23:00', '23:30')).toBe(true); // '24:00' end sorts after every HH:MM
  });

  it('isoWeekday / daysBetween are host-timezone independent', () => {
    expect(isoWeekday('2026-11-10')).toBe(2); // Tuesday
    expect(isoWeekday('2026-11-15')).toBe(7); // Sunday
    expect(isoWeekday('2026-11-16')).toBe(1); // Monday
    expect(daysBetween('2026-10-31', '2026-11-10')).toBe(10);
  });

  it('hoursBetween', () => {
    expect(hoursBetween('2026-11-13T22:00', '2026-11-14T02:00')).toBe(4);
    expect(hoursBetween('2026-11-13T08:00', '2026-11-13T17:30')).toBe(9.5);
  });

  it('schoolYearStart', () => {
    expect(schoolYearStart('2026-07-31', 8)).toBe(2025);
    expect(schoolYearStart('2026-08-01', 8)).toBe(2026);
  });

  it('fnv1a32 is deterministic and spreads', () => {
    expect(fnv1a32('1:2')).toBe(fnv1a32('1:2'));
    expect(fnv1a32('1:2')).not.toBe(fnv1a32('1:3'));
    expect(fnv1a32('')).toBe(0x811c9dc5);
  });

  it('segments split by local day', () => {
    expect(segments('2026-11-12T13:00', '2026-11-12T17:00')).toEqual([{ date: '2026-11-12', weekday: 4, start: '13:00', end: '17:00' }]);
    expect(segments('2026-11-13T22:00', '2026-11-14T02:00')).toEqual([
      { date: '2026-11-13', weekday: 5, start: '22:00', end: '24:00' },
      { date: '2026-11-14', weekday: 6, start: '00:00', end: '02:00' },
    ]);
    expect(segments('2026-11-13T08:00', '2026-11-15T17:00').map((s) => [s.start, s.end])).toEqual([
      ['08:00', '24:00'],
      ['00:00', '24:00'],
      ['00:00', '17:00'],
    ]);
    // ends exactly at midnight → no empty Saturday segment
    expect(segments('2026-11-13T08:00', '2026-11-14T00:00')).toHaveLength(1);
    expect(segments('2026-11-13T08:00', '2026-11-14T00:00')[0]).toMatchObject({ start: '08:00', end: '24:00' });
    // month and year boundaries
    expect(segments('2026-12-31T23:00', '2027-01-01T01:00').map((s) => s.date)).toEqual(['2026-12-31', '2027-01-01']);
  });
});
