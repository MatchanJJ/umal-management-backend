// TRD §8.5 optimistic-concurrency pattern: guard row + version bump + writes + guard cleanup in ONE D1 batch.
import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types';

/**
 * Runs `writes` atomically only if `events.version` still equals `expectedVersion`; bumps the version.
 * Returns the results of `writes` (same order), or null on a version mismatch (the CHECK on write_guards.ok rolls
 * the whole batch back).
 */
export async function guardedBatch(
  D: D1Database,
  eventId: number,
  expectedVersion: number,
  writes: D1PreparedStatement[],
): Promise<D1Result[] | null> {
  try {
    const results = await D.batch([
      D.prepare(`INSERT INTO write_guards (ok) SELECT CASE WHEN version = ?2 THEN 1 ELSE 0 END FROM events WHERE id = ?1`).bind(eventId, expectedVersion),
      D.prepare(`UPDATE events SET version = version + 1, updated_at = ?2 WHERE id = ?1`).bind(eventId, new Date().toISOString()),
      ...writes,
      D.prepare(`DELETE FROM write_guards`),
    ]);
    return results.slice(2, 2 + writes.length);
  } catch (e) {
    if (String((e as Error)?.cause ?? e).includes('write_guards_ok')) return null;
    throw e;
  }
}
