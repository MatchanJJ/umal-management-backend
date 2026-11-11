import { env } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { guardedBatch } from '../../server/services/write-guard';
import { signIn } from './helpers/auth';

it('guarded_batch_rolls_back_everything_on_version_mismatch', async () => {
  const a = await signIn(env, { role: 'adviser' });
  const now = '2026-01-01T00:00:00.000Z';
  const termId = (await env.DB.prepare(`INSERT INTO terms (name, start_date, end_date, created_at) VALUES ('G', '2026-08-01', '2026-12-31', ?1) RETURNING id`)
    .bind(now)
    .first<{ id: number }>())!.id;
  const eventId = (await env.DB.prepare(
    `INSERT INTO events (term_id, title, start_at, end_at, created_by, created_at, updated_at) VALUES (?1, 'Old', '2026-11-01T08:00', '2026-11-01T10:00', ?2, ?3, ?3) RETURNING id`,
  )
    .bind(termId, a.memberId, now)
    .first<{ id: number }>())!.id;
  const rename = (t: string) => env.DB.prepare(`UPDATE events SET title = ?2 WHERE id = ?1`).bind(eventId, t);

  // Simulates the race: the version moved between the route's check and its write.
  expect(await guardedBatch(env.DB, eventId, 7, [rename('Stale')])).toBe(false);
  expect(await env.DB.prepare('SELECT title, version FROM events WHERE id = ?1').bind(eventId).first()).toEqual({ title: 'Old', version: 0 });

  expect(await guardedBatch(env.DB, eventId, 0, [rename('Fresh')])).toBe(true);
  expect(await env.DB.prepare('SELECT title, version FROM events WHERE id = ?1').bind(eventId).first()).toEqual({ title: 'Fresh', version: 1 });
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM write_guards').first()).toEqual({ n: 0 });
});
