// Formats local 'YYYY-MM-DDTHH:MM' strings without timezone conversion (NFR-8): parse as UTC, format as UTC.
const day = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** 'Sat, Nov 21 · 08:00–17:00' (end date shown when the shift crosses midnight). */
export function shiftWhen(startAt: string, endAt: string): string {
  const d = (s: string) => day.format(new Date(`${s.slice(0, 10)}T00:00:00Z`));
  const sameDay = startAt.slice(0, 10) === endAt.slice(0, 10);
  return `${d(startAt)} · ${startAt.slice(11)}–${sameDay ? '' : `${d(endAt)} `}${endAt.slice(11)}`;
}

export function hoursLabel(h: number): string {
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

const stamp = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Manila' });
/** A stored UTC instant (audit rows) shown in Manila time: 'Nov 21, 2026, 14:05'. */
export function stampManila(iso: string): string {
  return stamp.format(new Date(iso));
}
