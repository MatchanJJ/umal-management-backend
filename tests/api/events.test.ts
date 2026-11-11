import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { signIn } from './helpers/auth';

const NOW = '2026-01-01T00:00:00.000Z';
let adviser: Headers;
let adviserId: number;
let member: Headers;
let termId: number;

type ShiftOut = { id: number; label: string; startAt: string; endAt: string; requiredVolunteers: number; activeCount: number };
type EventOut = { id: number; termId: number; status: string; version: number; startAt: string; endAt: string; shifts: ShiftOut[] };

beforeAll(async () => {
  const a = await signIn(env, { role: 'adviser' });
  adviser = a.headers;
  adviserId = a.memberId!;
  member = (await signIn(env)).headers;
  termId = (await env.DB.prepare(`INSERT INTO terms (name, start_date, end_date, is_active, created_at) VALUES ('1st Sem', '2026-08-10', '2026-12-18', 1, ?1) RETURNING id`)
    .bind(NOW)
    .first<{ id: number }>())!.id;
});

function call(method: string, path: string, body: unknown, headers: Headers) {
  const h = new Headers(headers);
  if (body !== undefined) h.set('content-type', 'application/json');
  return SELF.fetch(`http://x/api${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}
const single = (startAt: string, endAt: string, extra: object = {}) => ({ title: 'Campus Tour', startAt, endAt, requiredVolunteers: 4, ...extra });
async function create(body: object): Promise<EventOut> {
  const res = await call('POST', '/events', body, adviser);
  expect(res.status, await res.clone().text()).toBe(201);
  return (await res.json()) as EventOut;
}
/** A shift as the client sends it back (no read-only fields). */
const keep = (s: ShiftOut) => ({ id: s.id, label: s.label, startAt: s.startAt, endAt: s.endAt, requiredVolunteers: s.requiredVolunteers });
const get = async (id: number, h = adviser) => (await (await call('GET', `/events/${id}`, undefined, h)).json()) as EventOut;
async function assignRaw(eventId: number, shiftId: number) {
  const m = await signIn(env);
  await env.DB.prepare(
    `INSERT INTO assignments (event_id, shift_id, member_id, status, source, assigned_by, assigned_at) VALUES (?1, ?2, ?3, 'assigned', 'manual', ?4, ?5)`,
  )
    .bind(eventId, shiftId, m.memberId, adviserId, NOW)
    .run();
  return m.memberId!;
}

describe('create', () => {
  it('create_assigns_term_by_start_date', async () => {
    const e = await create(single('2026-11-20T08:00', '2026-11-20T12:00'));
    expect(e).toMatchObject({ termId, status: 'draft', version: 0, startAt: '2026-11-20T08:00', endAt: '2026-11-20T12:00' });
  });

  it('event_without_shifts_gets_default_main_shift', async () => {
    const e = await create(single('2026-11-21T08:00', '2026-11-21T12:00'));
    expect(e.shifts.map((s) => [s.label, s.startAt, s.endAt, s.requiredVolunteers])).toEqual([['Main', '2026-11-21T08:00', '2026-11-21T12:00', 4]]);
  });

  it('create_without_term_422_NO_TERM_FOR_DATE', async () => {
    const res = await call('POST', '/events', single('2027-02-01T08:00', '2027-02-01T12:00'), adviser);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: { code: 'NO_TERM_FOR_DATE' } });
  });

  it('end_before_start_422', async () => {
    const res = await call('POST', '/events', single('2026-11-20T12:00', '2026-11-20T08:00'), adviser);
    expect(res.status).toBe(422);
  });

  it('span_over_14_days_422', async () => {
    const res = await call(
      'POST',
      '/events',
      {
        title: 'Long',
        shifts: [
          { label: 'Start', startAt: '2026-11-01T08:00', endAt: '2026-11-01T12:00', requiredVolunteers: 2 },
          { label: 'End', startAt: '2026-11-15T08:00', endAt: '2026-11-15T12:00', requiredVolunteers: 2 },
        ],
      },
      adviser,
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  });

  it('shift_over_24h_422', async () => {
    expect((await call('POST', '/events', single('2026-11-20T08:00', '2026-11-21T08:30'), adviser)).status).toBe(422);
  });

  it('cross_midnight_event_created', async () => {
    const e = await create(single('2026-11-13T22:00', '2026-11-14T02:00'));
    expect([e.startAt, e.endAt]).toEqual(['2026-11-13T22:00', '2026-11-14T02:00']);
  });

  it('duplicate_shift_labels_422', async () => {
    const s = { label: 'A', startAt: '2026-11-20T08:00', endAt: '2026-11-20T10:00', requiredVolunteers: 2 };
    expect((await call('POST', '/events', { title: 'Dup', shifts: [s, { ...s, startAt: '2026-11-20T11:00', endAt: '2026-11-20T12:00' }] }, adviser)).status).toBe(422);
  });

  it('member_cannot_create_403', async () => {
    expect((await call('POST', '/events', single('2026-11-20T08:00', '2026-11-20T12:00'), member)).status).toBe(403);
  });
});

describe('shifts', () => {
  it('daily_helper_creates_one_shift_per_day', async () => {
    const e = await create(single('2026-11-13T08:00', '2026-11-13T17:00'));
    const res = await call(
      'POST',
      `/events/${e.id}/shifts/daily`,
      { fromDate: '2026-11-13', toDate: '2026-11-15', startTime: '08:00', endTime: '17:00', requiredVolunteers: 6, expectedVersion: e.version },
      adviser,
    );
    expect(res.status).toBe(200);
    const after = await get(e.id);
    expect(after.shifts.map((s) => [s.label, s.startAt, s.endAt, s.requiredVolunteers])).toEqual([
      ['Day 1', '2026-11-13T08:00', '2026-11-13T17:00', 6],
      ['Day 2', '2026-11-14T08:00', '2026-11-14T17:00', 6],
      ['Day 3', '2026-11-15T08:00', '2026-11-15T17:00', 6],
    ]);
    expect([after.startAt, after.endAt, after.version]).toEqual(['2026-11-13T08:00', '2026-11-15T17:00', 1]);
  });

  it('remove_or_move_shift_with_assignments_409_SHIFT_HAS_ASSIGNMENTS', async () => {
    const e = await create({
      title: 'Two',
      shifts: [
        { label: 'AM', startAt: '2026-11-24T08:00', endAt: '2026-11-24T12:00', requiredVolunteers: 3 },
        { label: 'PM', startAt: '2026-11-24T13:00', endAt: '2026-11-24T17:00', requiredVolunteers: 3 },
      ],
    });
    const [am, pm] = e.shifts;
    await assignRaw(e.id, am.id);

    const removed = await call('PATCH', `/events/${e.id}`, { shifts: [keep(pm)], expectedVersion: 0 }, adviser);
    expect(removed.status).toBe(409);
    expect(await removed.json()).toMatchObject({ error: { code: 'SHIFT_HAS_ASSIGNMENTS' } });

    const moved = await call('PATCH', `/events/${e.id}`, { shifts: [{ ...keep(am), startAt: '2026-11-24T07:00' }, keep(pm)], expectedVersion: 0 }, adviser);
    expect(moved.status).toBe(409);

    // renaming the staffed shift and removing the empty one are fine
    const ok = await call('PATCH', `/events/${e.id}`, { shifts: [{ ...keep(am), label: 'Morning' }], expectedVersion: 0 }, adviser);
    expect(ok.status).toBe(200);
    expect((await get(e.id)).shifts.map((s) => s.label)).toEqual(['Morning']);
  });

  it('lower_required_below_active_count_422', async () => {
    const e = await create(single('2026-11-25T08:00', '2026-11-25T12:00'));
    const s = e.shifts[0];
    await assignRaw(e.id, s.id);
    await assignRaw(e.id, s.id);
    const res = await call('PATCH', `/events/${e.id}`, { shifts: [{ ...keep(s), requiredVolunteers: 1 }], expectedVersion: 0 }, adviser);
    expect(res.status).toBe(422);
  });

  it('event_span_recomputed_after_shift_change', async () => {
    const e = await create(single('2026-11-26T08:00', '2026-11-26T12:00'));
    const s = e.shifts[0];
    const res = await call(
      'PATCH',
      `/events/${e.id}`,
      { shifts: [keep(s), { label: 'Wrap-up', startAt: '2026-11-27T18:00', endAt: '2026-11-27T21:00', requiredVolunteers: 2 }], expectedVersion: 0 },
      adviser,
    );
    expect(res.status).toBe(200);
    const after = await get(e.id);
    expect([after.startAt, after.endAt, after.version, after.shifts.length]).toEqual(['2026-11-26T08:00', '2026-11-27T21:00', 1, 2]);
    const audits = await env.DB.prepare(`SELECT action FROM audit_log WHERE action LIKE 'event.%' AND entity_id = ?1 ORDER BY id`).bind(e.id).all<{ action: string }>();
    expect(audits.results.map((a) => a.action)).toEqual(['event.create', 'event.update']);
  });

  it('stale_version_409_VERSION_CONFLICT_and_no_changes', async () => {
    const e = await create(single('2026-11-28T08:00', '2026-11-28T12:00'));
    const res = await call('PATCH', `/events/${e.id}`, { title: 'Renamed', expectedVersion: 5 }, adviser);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'VERSION_CONFLICT' } });
    expect((await get(e.id)).version).toBe(0);
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM write_guards').first()).toEqual({ n: 0 });
  });
});

describe('status and visibility', () => {
  it('members_see_only_published_and_completed', async () => {
    const draft = await create(single('2026-12-01T08:00', '2026-12-01T12:00', { title: 'Draft one' }));
    const pub = await create(single('2026-12-02T08:00', '2026-12-02T12:00', { title: 'Public one' }));
    expect((await call('PATCH', `/events/${pub.id}`, { status: 'published', expectedVersion: 0 }, adviser)).status).toBe(200);

    const list = (await (await call('GET', '/events', undefined, member)).json()) as { items: EventOut[] };
    const ids = list.items.map((e) => e.id);
    expect(ids).toContain(pub.id);
    expect(ids).not.toContain(draft.id);
    expect(list.items.every((e) => ['published', 'completed'].includes(e.status))).toBe(true);
    expect((await call('GET', `/events/${draft.id}`, undefined, member)).status).toBe(404);
    expect((await call('GET', `/events/${pub.id}`, undefined, member)).status).toBe(200);
  });

  it('unpublish_blocked_with_assignments_409', async () => {
    const e = await create(single('2026-12-03T08:00', '2026-12-03T12:00'));
    await call('PATCH', `/events/${e.id}`, { status: 'published', expectedVersion: 0 }, adviser);
    await assignRaw(e.id, e.shifts[0].id);
    const res = await call('PATCH', `/events/${e.id}`, { status: 'draft', expectedVersion: 1 }, adviser);
    expect(res.status).toBe(409);
  });

  it('cancel_cascades_assignments_to_cancelled_with_reason', async () => {
    const e = await create(single('2026-12-04T08:00', '2026-12-04T12:00'));
    await call('PATCH', `/events/${e.id}`, { status: 'published', expectedVersion: 0 }, adviser);
    await assignRaw(e.id, e.shifts[0].id);
    const res = await call('POST', `/events/${e.id}/cancel`, { reason: 'Typhoon signal no. 2', expectedVersion: 1 }, adviser);
    expect(res.status).toBe(200);
    const ev = await env.DB.prepare('SELECT status, cancel_reason, version FROM events WHERE id = ?1').bind(e.id).first();
    expect(ev).toEqual({ status: 'cancelled', cancel_reason: 'Typhoon signal no. 2', version: 2 });
    const a = await env.DB.prepare('SELECT status, cancel_reason, cancelled_by FROM assignments WHERE event_id = ?1').bind(e.id).all();
    expect(a.results).toEqual([{ status: 'cancelled', cancel_reason: 'Event cancelled: Typhoon signal no. 2', cancelled_by: adviserId }]);
    // cancelled events are read-only
    expect((await call('PATCH', `/events/${e.id}`, { title: 'x', expectedVersion: 2 }, adviser)).status).toBe(409);
  });
});

describe('GET /api/events/:id/candidates', () => {
  it('candidates_endpoint_returns_reasons', async () => {
    const e = await create(single('2026-11-19T13:00', '2026-11-19T17:00')); // Thursday
    const withClass = await signIn(env);
    const free = await signIn(env);
    for (const [m, entries] of [
      [withClass.memberId, [[4, '14:00', '15:00']]],
      [free.memberId, []],
    ] as const) {
      const s = (await env.DB.prepare(`INSERT INTO class_schedules (member_id, term_id, submitted_at, updated_at) VALUES (?1, ?2, ?3, ?3) RETURNING id`)
        .bind(m, termId, NOW)
        .first<{ id: number }>())!.id;
      for (const [d, st, en] of entries) {
        await env.DB.prepare(`INSERT INTO class_entries (schedule_id, day_of_week, start_time, end_time) VALUES (?1, ?2, ?3, ?4)`).bind(s, d, st, en).run();
      }
    }
    const res = await call('GET', `/events/${e.id}/candidates?shiftId=${e.shifts[0].id}`, undefined, adviser);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { member: { id: number }; eligibility: { hard: string[]; soft: string[] }; score: { total: number } }[] };
    const byId = new Map(body.items.map((i) => [i.member.id, i]));
    expect(byId.get(withClass.memberId!)!.eligibility).toEqual({ hard: [], soft: ['CLASS_CONFLICT'] });
    expect(byId.get(free.memberId!)!.eligibility).toEqual({ hard: [], soft: [] });
    expect(typeof byId.get(free.memberId!)!.score.total).toBe('number');
    // every other loaded member has no schedule for this term → SCHEDULE_MISSING (hard by default)
    expect(body.items.filter((i) => i.eligibility.hard.includes('SCHEDULE_MISSING')).length).toBeGreaterThan(0);
  });

  it('candidates_requires_a_shift_of_this_event_404', async () => {
    const e = await create(single('2026-11-19T08:00', '2026-11-19T10:00'));
    expect((await call('GET', `/events/${e.id}/candidates?shiftId=999999`, undefined, adviser)).status).toBe(404);
  });
});
