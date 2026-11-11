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
