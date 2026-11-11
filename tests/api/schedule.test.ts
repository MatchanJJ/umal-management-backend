import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { signIn } from './helpers/auth';

let prevTermId: number;
let termId: number;

beforeAll(async () => {
  const add = (name: string, s: string, e: string, active: number) =>
    env.DB.prepare(`INSERT INTO terms (name, start_date, end_date, is_active, created_at) VALUES (?1, ?2, ?3, ?4, '2026-01-01T00:00:00.000Z') RETURNING id`)
      .bind(name, s, e, active)
      .first<{ id: number }>()
      .then((r) => r!.id);
  prevTermId = await add('2nd Sem AY 2025–2026', '2026-01-05', '2026-05-25', 0);
  termId = await add('1st Sem AY 2026–2027', '2026-08-01', '2026-12-20', 1);
});

const put = (headers: Headers, body: unknown) => {
  const h = new Headers(headers);
  h.set('content-type', 'application/json');
  return SELF.fetch('http://x/api/me/schedule', { method: 'PUT', headers: h, body: JSON.stringify(body) });
};
const get = async (headers: Headers, q = '') =>
  (await (await SELF.fetch(`http://x/api/me/schedule${q}`, { headers })).json()) as {
    submitted: boolean;
    entries: { dayOfWeek: number; startTime: string; endTime: string; label: string | null }[];
    previousTermAvailable: boolean;
    previousTermId: number | null;
  };

const MON_CS = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', label: 'CS 311 Lec' };

describe('class schedule', () => {
  it('put_replaces_entries_atomically', async () => {
    const u = await signIn(env);
    expect((await get(u.headers)).submitted).toBe(false);

    const first = await put(u.headers, { termId, entries: [MON_CS, { dayOfWeek: 3, startTime: '13:00', endTime: '14:30' }] });
    expect(first.status).toBe(200);
    expect((await get(u.headers)).entries).toHaveLength(2);

    expect((await put(u.headers, { termId, entries: [{ dayOfWeek: 2, startTime: '09:00', endTime: '10:30', label: 'Math' }] })).status).toBe(200);
    const after = await get(u.headers);
    expect(after.submitted).toBe(true);
    expect(after.entries).toEqual([{ dayOfWeek: 2, startTime: '09:00', endTime: '10:30', label: 'Math' }]);

    // an invalid replace leaves the saved schedule untouched
    expect((await put(u.headers, { termId, entries: [MON_CS, { ...MON_CS, startTime: '09:00', endTime: '11:00' }] })).status).toBe(422);
    expect((await get(u.headers)).entries).toHaveLength(1);

    const sched = await env.DB.prepare('SELECT submitted_at FROM class_schedules WHERE member_id = ?1').bind(u.memberId).first<{ submitted_at: string }>();
    expect(sched?.submitted_at).toEqual(expect.any(String));
  });

  it('overlapping_entries_same_day_422', async () => {
    const u = await signIn(env);
    const res = await put(u.headers, { termId, entries: [MON_CS, { dayOfWeek: 1, startTime: '09:30', endTime: '11:00' }] });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION' } });
    // same times on different days are fine
    expect((await put(u.headers, { termId, entries: [MON_CS, { ...MON_CS, dayOfWeek: 2 }] })).status).toBe(200);
  });

  it('touching_entries_allowed', async () => {
    const u = await signIn(env);
    const res = await put(u.headers, { termId, entries: [MON_CS, { dayOfWeek: 1, startTime: '10:00', endTime: '11:30' }] });
    expect(res.status).toBe(200);
  });

  it('time_format_validated', async () => {
    const u = await signIn(env);
    for (const bad of [
      { dayOfWeek: 1, startTime: '8:00', endTime: '10:00' },
      { dayOfWeek: 1, startTime: '08:00', endTime: '25:00' },
      { dayOfWeek: 1, startTime: '24:00', endTime: '24:00' },
      { dayOfWeek: 8, startTime: '08:00', endTime: '09:00' },
      { dayOfWeek: 1, startTime: '10:00', endTime: '09:00' },
    ]) {
      expect((await put(u.headers, { termId, entries: [bad] })).status, JSON.stringify(bad)).toBe(400);
    }
    // '24:00' is allowed as an end time
    expect((await put(u.headers, { termId, entries: [{ dayOfWeek: 6, startTime: '20:00', endTime: '24:00' }] })).status).toBe(200);
  });

  it('unknown_term_422', async () => {
    const u = await signIn(env);
    expect((await put(u.headers, { termId: 99999, entries: [] })).status).toBe(422);
  });

  it('defaults_to_active_term_and_reports_previous', async () => {
    const u = await signIn(env);
    expect((await get(u.headers)).previousTermAvailable).toBe(false);
    expect((await put(u.headers, { termId: prevTermId, entries: [MON_CS] })).status).toBe(200);
    const cur = await get(u.headers);
    expect(cur).toMatchObject({ submitted: false, previousTermAvailable: true, previousTermId: prevTermId });
    expect((await get(u.headers, `?termId=${prevTermId}`)).entries).toEqual([MON_CS]);
  });

  it('empty_schedule_still_counts_as_submitted', async () => {
    const u = await signIn(env);
    expect((await put(u.headers, { termId, entries: [] })).status).toBe(200);
    expect((await get(u.headers)).submitted).toBe(true);
    const me = (await (await SELF.fetch('http://x/api/me', { headers: u.headers })).json()) as { scheduleSubmitted: boolean };
    expect(me.scheduleSubmitted).toBe(true);
  });
});
