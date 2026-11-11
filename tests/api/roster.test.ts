import { env, SELF } from 'cloudflare:test';
import { beforeAll, expect, it } from 'vitest';
import { signIn } from './helpers/auth';

const NOW = '2026-01-01T00:00:00.000Z';
let adviser: Headers;
let adviserId: number;

beforeAll(async () => {
  const a = await signIn(env, { role: 'adviser' });
  [adviser, adviserId] = [a.headers, a.memberId!];
  await env.DB.prepare(`INSERT INTO terms (name, start_date, end_date, is_active, created_at) VALUES ('R', '2027-01-04', '2027-06-30', 1, ?1)`).bind(NOW).run();
});

const json = (method: string, path: string, body: unknown, h = adviser) => {
  const headers = new Headers(h);
  headers.set('content-type', 'application/json');
  return SELF.fetch(`http://x/api${path}`, { method, headers, body: JSON.stringify(body) });
};

type Roster = {
  version: number;
  shifts: { shiftId: number; label: string; requiredVolunteers: number; assignments: { id: number; memberId: number; name: string; status: string }[] }[];
};

it('roster_groups_active_assignments_by_shift_with_names', async () => {
  const e = (await (
    await json('POST', '/events', {
      title: 'Fair',
      shifts: [
        { label: 'AM', startAt: '2027-03-04T08:00', endAt: '2027-03-04T12:00', requiredVolunteers: 3 },
        { label: 'PM', startAt: '2027-03-04T13:00', endAt: '2027-03-04T17:00', requiredVolunteers: 2 },
      ],
    })
  ).json()) as { id: number; shifts: { id: number }[] };
  const m = await signIn(env);
  await env.DB.prepare(`UPDATE members SET first_name = 'Ana', last_name = 'Cruz' WHERE id = ?1`).bind(m.memberId).run();
  const insert = (shiftId: number, status: string) =>
    env.DB.prepare(
      `INSERT INTO assignments (event_id, shift_id, member_id, status, source, assigned_by, assigned_at, cancelled_at, cancel_reason) VALUES (?1, ?2, ?3, ?4, 'manual', ?5, ?6, ?7, ?8)`,
    )
      .bind(e.id, shiftId, m.memberId, status, adviserId, NOW, status === 'cancelled' ? NOW : null, status === 'cancelled' ? 'x' : null)
      .run();
  await insert(e.shifts[1].id, 'cancelled');
  await insert(e.shifts[0].id, 'assigned');

  const r = (await (await SELF.fetch(`http://x/api/events/${e.id}/roster`, { headers: adviser })).json()) as Roster;
  expect(r.version).toBe(0);
  expect(r.shifts.map((s) => [s.label, s.requiredVolunteers, s.assignments.map((a) => [a.memberId, a.name, a.status])])).toEqual([
    ['AM', 3, [[m.memberId, 'Ana Cruz', 'assigned']]],
    ['PM', 2, []],
  ]);

  // Members: draft events are hidden; published ones show names only.
  const viewer = await signIn(env);
  expect((await SELF.fetch(`http://x/api/events/${e.id}/roster`, { headers: viewer.headers })).status).toBe(404);
  await json('PATCH', `/events/${e.id}`, { status: 'published', expectedVersion: 0 });
  const pub = (await (await SELF.fetch(`http://x/api/events/${e.id}/roster`, { headers: viewer.headers })).json()) as Roster;
  expect(pub.shifts[0].assignments).toEqual([{ name: 'Ana Cruz' }]);
});
