import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { signIn } from './helpers/auth';

const NOW = '2026-01-01T00:00:00.000Z';
let termId: number;

beforeAll(async () => {
  termId = (await env.DB.prepare(
    `INSERT INTO terms (name, start_date, end_date, is_active, created_at) VALUES ('T', '2020-01-01', '2099-12-31', 1, ?1) RETURNING id`,
  )
    .bind(NOW)
    .first<{ id: number }>())!.id;
});

const post = (headers: Headers, body: unknown) => {
  const h = new Headers(headers);
  h.set('content-type', 'application/json');
  return SELF.fetch('http://x/api/me/unavailability', { method: 'POST', headers: h, body: JSON.stringify(body) });
};

describe('unavailability', () => {
  it('weekly_requires_day_not_date', async () => {
    const u = await signIn(env);
    expect((await post(u.headers, { kind: 'weekly', startTime: '08:00', endTime: '12:00' })).status).toBe(400);
    expect((await post(u.headers, { kind: 'weekly', dayOfWeek: 6, date: '2026-11-21', startTime: '08:00', endTime: '12:00' })).status).toBe(400);
    const ok = await post(u.headers, { kind: 'weekly', dayOfWeek: 6, startTime: '08:00', endTime: '12:00', reason: 'family' });
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({ kind: 'weekly', dayOfWeek: 6, date: null, termId });
  });

  it('date_requires_date_not_day', async () => {
    const u = await signIn(env);
    expect((await post(u.headers, { kind: 'date', startTime: '08:00', endTime: '12:00' })).status).toBe(400);
    expect((await post(u.headers, { kind: 'date', date: '2026-11-21', dayOfWeek: 6, startTime: '08:00', endTime: '12:00' })).status).toBe(400);
    expect((await post(u.headers, { kind: 'date', date: '2026-11-21', startTime: '08:00', endTime: '12:00' })).status).toBe(201);
  });

  it('whole_day_block_is_0000_2400', async () => {
    const u = await signIn(env);
    const res = await post(u.headers, { kind: 'date', date: '2026-12-24', wholeDay: true });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ startTime: '00:00', endTime: '24:00' });
  });

  it('end_time_2400_allowed_only_as_end', async () => {
    const u = await signIn(env);
    expect((await post(u.headers, { kind: 'weekly', dayOfWeek: 1, startTime: '24:00', endTime: '24:00' })).status).toBe(400);
    expect((await post(u.headers, { kind: 'weekly', dayOfWeek: 1, startTime: '20:00', endTime: '24:00' })).status).toBe(201);
  });

  it('member_cannot_delete_others_block_404', async () => {
    const owner = await signIn(env);
    const other = await signIn(env);
    const { id } = (await (await post(owner.headers, { kind: 'weekly', dayOfWeek: 2, startTime: '08:00', endTime: '09:00' })).json()) as { id: number };
    expect((await SELF.fetch(`http://x/api/me/unavailability/${id}`, { method: 'DELETE', headers: other.headers })).status).toBe(404);
    expect((await SELF.fetch(`http://x/api/me/unavailability/${id}`, { method: 'DELETE', headers: owner.headers })).status).toBe(200);
    const list = (await (await SELF.fetch('http://x/api/me/unavailability', { headers: owner.headers })).json()) as unknown[];
    expect(list).toEqual([]);
  });
});

describe('GET /api/me/assignments', () => {
  it('returns_upcoming_past_and_term_stats_in_hours', async () => {
    const adviser = await signIn(env, { role: 'adviser' });
    const u = await signIn(env);
    const D = env.DB;
    const ev = (await D.prepare(
      `INSERT INTO events (term_id, title, start_at, end_at, status, created_by, created_at, updated_at)
       VALUES (?1, 'Summit', '2026-01-10T08:00', '2099-01-01T17:00', 'published', ?2, ?3, ?3) RETURNING id`,
    )
      .bind(termId, adviser.memberId, NOW)
      .first<{ id: number }>())!.id;
    const shift = async (label: string, s: string, e: string) =>
      (await D.prepare(
        `INSERT INTO shifts (event_id, label, start_at, end_at, required_volunteers, position, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 5, 1, ?5, ?5) RETURNING id`,
      )
        .bind(ev, label, s, e, NOW)
        .first<{ id: number }>())!.id;
    const assign = (shiftId: number, status: string) =>
      D.prepare(
        `INSERT INTO assignments (event_id, shift_id, member_id, status, source, assigned_by, assigned_at, cancelled_at, cancel_reason)
         VALUES (?1, ?2, ?3, ?4, 'manual', ?5, ?6, ?7, ?8)`,
      )
        .bind(ev, shiftId, u.memberId, status, adviser.memberId, NOW, status === 'cancelled' ? NOW : null, status === 'cancelled' ? 'x' : null)
        .run();

    await assign(await shift('Day 1', '2026-01-10T08:00', '2026-01-10T17:00'), 'attended'); // 9 h
    await assign(await shift('Day 2', '2026-01-11T22:00', '2026-01-12T02:00'), 'no_show'); // 4 h, crosses midnight
    await assign(await shift('Day 3', '2026-01-12T08:00', '2026-01-12T10:00'), 'excused'); // not counted
    await assign(await shift('Day 4', '2026-01-13T08:00', '2026-01-13T10:00'), 'cancelled'); // not counted, not listed
    await assign(await shift('Later', '2099-01-01T08:00', '2099-01-01T17:00'), 'assigned'); // 9 h, upcoming

    const body = (await (await SELF.fetch('http://x/api/me/assignments', { headers: u.headers })).json()) as {
      upcoming: { shiftLabel: string; eventTitle: string; hours: number }[];
      past: { shiftLabel: string; status: string }[];
      termStats: { hours: number; shifts: number; attended: number; noShow: number };
    };
    expect(body.upcoming.map((a) => a.shiftLabel)).toEqual(['Later']);
    expect(body.upcoming[0]).toMatchObject({ eventTitle: 'Summit', hours: 9 });
    expect(body.past.map((a) => a.shiftLabel)).toEqual(['Day 3', 'Day 2', 'Day 1']);
    expect(body.termStats).toEqual({ hours: 22, shifts: 3, attended: 1, noShow: 1 });
  });
});
