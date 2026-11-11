// Pure local-time helpers (NFR-8: Asia/Manila strings, no timezone conversion). No I/O imports in server/engine/.
export { hoursBetween } from '../../shared/time';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Segment = { date: string; weekday: Weekday; start: string; end: string };

const DAY_MS = 86_400_000;
const utcMidnight = (date: string) => Date.parse(`${date}T00:00:00Z`);
const addDays = (date: string, n: number) => new Date(utcMidnight(date) + n * DAY_MS).toISOString().slice(0, 10);

/**
 * Half-open interval overlap: touching (a ends when b starts) is NOT an overlap.
 * Works for 'HH:MM' (with '24:00' as an end) and 'YYYY-MM-DDTHH:MM' because both compare lexicographically.
 */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** ISO weekday, 1 = Monday … 7 = Sunday; parsed at UTC midnight so the host timezone can't shift the day. */
export function isoWeekday(date: string): Weekday {
  return ((new Date(utcMidnight(date)).getUTCDay() + 6) % 7 + 1) as Weekday;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / DAY_MS);
}

/** School-year start year: the year when month ≥ startMonth, else the previous year (Backend Schema §6). */
export function schoolYearStart(today: string, startMonth: number): number {
  const year = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) >= startMonth ? year : year - 1;
}

/**
 * Splits a local interval into per-day pieces; middle days are 00:00–24:00 and a day ending exactly at
 * midnight yields no empty segment. Each piece is checked against that day's classes and blocks.
 */
export function segments(startAt: string, endAt: string): Segment[] {
  const [startDate, startTime] = [startAt.slice(0, 10), startAt.slice(11)];
  const [endDate, endTime] = [endAt.slice(0, 10), endAt.slice(11)];
  const out: Segment[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const start = date === startDate ? startTime : '00:00';
    const end = date === endDate ? endTime : '24:00';
    if (start < end) out.push({ date, weekday: isoWeekday(date), start, end });
  }
  return out;
}

/** 32-bit FNV-1a: a deterministic tie-breaker hash (same input → same order on every run). */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
