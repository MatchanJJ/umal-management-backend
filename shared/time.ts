// Local Asia/Manila time strings (NFR-8). The Philippines has no DST, so "now" is UTC+8 with no TZ library.

/** Current Manila time as 'YYYY-MM-DDTHH:MM' (comparable with event/shift start_at/end_at strings). */
export function manilaNow(now = Date.now()): string {
  return new Date(now + 8 * 3_600_000).toISOString().slice(0, 16);
}

/** Hours between two local 'YYYY-MM-DDTHH:MM' strings (may cross midnight). */
export function hoursBetween(start: string, end: string): number {
  return (Date.parse(`${end}Z`) - Date.parse(`${start}Z`)) / 3_600_000;
}
