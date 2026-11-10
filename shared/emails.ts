import { z } from 'zod';

const Email = z.email();

/** Trim, lower-case and dedupe; split into valid and invalid (original text) entries. */
export function normalizeEmails(raw: string[]): { valid: string[]; invalid: string[] } {
  const valid = new Set<string>();
  const invalid: string[] = [];
  for (const entry of raw) {
    const e = entry.trim().toLowerCase();
    if (!e) continue;
    if (Email.safeParse(e).success) valid.add(e);
    else if (!invalid.includes(entry.trim())) invalid.push(entry.trim());
  }
  return { valid: [...valid], invalid };
}

/**
 * Splits pasted text or CSV into raw email entries (App Flow §3): one per line, commas/semicolons allowed;
 * a CSV whose header row has an `email` column contributes only that column.
 */
export function splitEmailInput(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const col = header.indexOf('email');
  if (col >= 0 && header.length > 1) {
    return lines.slice(1).map((l) => (l.split(',')[col] ?? '').trim().replace(/^"|"$/g, ''));
  }
  return lines.flatMap((l) => l.split(/[,;\s]+/)).filter((s) => s && s.toLowerCase() !== 'email');
}
