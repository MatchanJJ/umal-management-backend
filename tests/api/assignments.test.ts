import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { signIn } from './helpers/auth';

const NOW = '2026-01-01T00:00:00.000Z';
let adviser: Headers;
let adviserId: number;
let termId: number;

beforeAll(async () => {
  const a = await signIn(env, { role: 'adviser' });
  adviser = a.headers;
  adviserId = a.memberId!;
  termId = (await env.DB.prepare(`INSERT INTO terms (name, start_date, end_date, is_active, created_at) VALUES ('2027 A', '2027-01-04', '2027-06-30', 1, ?1) RETURNING id`)
    .bind(NOW)
    .first<{ id: number }>())!.id;
});

function call(method: string, path: string, body: unknown, headers = adviser) {
  const h = new Headers(headers);
  h.set('content-type', 'application/json');
  return SELF.fetch(`http://x/api${path}`, { method, headers: h, body: JSON.stringify(body) });
}

/** An assignable member with a submitted schedule for the term; optional Thursday class. */
async function volunteer(thursdayClass?: [string, string]) {
  const m = await signIn(env);
  const s = (await env.DB.prepare(`INSERT INTO class_schedules (member_id, term_id, submitted_at, updated_at) VALUES (?1, ?2, ?3, ?3) RETURNING id`)
    .bind(m.memberId, termId, NOW)
    .first<{ id: number }>())!.id;
  if (thursdayClass) {
    await env.DB.prepare(`INSERT INTO class_entries (schedule_id, day_of_week, start_time, end_time) VALUES (?1, 4, ?2, ?3)`).bind(s, ...thursdayClass).run();
  }
  return m.memberId!;
}

type Ev = { id: number; version: number; shifts: { id: number; label: string }[] };
/** Thu 2027-03-04: S1 08–12 (req 2), S2 11–14 overlapping S1 (req 2), S3 13–17 (req 2). */
async function event(): Promise<Ev> {
  const res = await call('POST', '/events', {
    title: 'Open House',
    shifts: [
      { label: 'S1', startAt: '2027-03-04T08:00', endAt: '2027-03-04T12:00', requiredVolunteers: 2 },
      { label: 'S2', startAt: '2027-03-04T11:00', endAt: '2027-03-04T14:00', requiredVolunteers: 2 },
      { label: 'S3', startAt: '2027-03-04T13:00', endAt: '2027-03-04T17:00', requiredVolunteers: 2 },
    ],
  });
  expect(res.status).toBe(201);
  return (await res.json()) as Ev;
}
const post = (e: Ev, body: object) => call('POST', `/events/${e.id}/assignments`, { source: 'manual', expectedVersion: e.version, ...body });
const roster = async (eventId: number) =>
  (await env.DB.prepare(`SELECT shift_id, member_id, status, conflict_override FROM assignments WHERE event_id = ?1 ORDER BY id`).bind(eventId).all()).results;

describe('POST /api/events/:id/assignments', () => {
  it('manual_create_happy_path_201_bumps_version', async () => {
    const e = await event();
    const [a, b] = [await volunteer(), await volunteer()];
    const res = await post(e, { items: [{ shiftId: e.shifts[0].id, memberIds: [a, b] }] });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { created: { memberId: number }[]; version: number };
    expect([body.created.map((c) => c.memberId), body.version]).toEqual([[a, b], 1]);
    expect(await roster(e.id)).toEqual([
      { shift_id: e.shifts[0].id, member_id: a, status: 'assigned', conflict_override: 0 },
      { shift_id: e.shifts[0].id, member_id: b, status: 'assigned', conflict_override: 0 },
    ]);
  });

  it('ineligible_422_lists_reasons_and_writes_nothing', async () => {
    const e = await event();
    const ok = await volunteer();
    const noSchedule = (await signIn(env)).memberId!; // SCHEDULE_MISSING is hard by default
    const res = await post(e, { items: [{ shiftId: e.shifts[0].id, memberIds: [ok, noSchedule] }] });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      error: { code: 'INELIGIBLE', details: [{ shiftId: e.shifts[0].id, memberId: noSchedule, reasons: ['SCHEDULE_MISSING'] }] },
    });
    expect(await roster(e.id)).toEqual([]);
  });

  it('non_assignable_member_reported', async () => {
    const e = await event();
    const res = await post(e, { items: [{ shiftId: e.shifts[0].id, memberIds: [adviserId] }] });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: { code: 'INELIGIBLE', details: [{ memberId: adviserId, reasons: ['NOT_ASSIGNABLE'] }] } });
  });

  it('conflict_requires_override_for_manual', async () => {
    const e = await event();
    const m = await volunteer(['09:00', '10:00']); // Thursday class during S1
    const without = await post(e, { items: [{ shiftId: e.shifts[0].id, memberIds: [m] }] });
    expect(without.status).toBe(422);
    expect(await without.json()).toMatchObject({ error: { details: [{ memberId: m, reasons: ['CLASS_CONFLICT'] }] } });
    const withOverride = await post(e, { items: [{ shiftId: e.shifts[0].id, memberIds: [m], overrideConflictIds: [m] }] });
    expect(withOverride.status).toBe(201);
    expect(await roster(e.id)).toEqual([{ shift_id: e.shifts[0].id, member_id: m, status: 'assigned', conflict_override: 1 }]);
  });

  it('over_capacity_409', async () => {
    const e = await event();
    const [a, b, c] = [await volunteer(), await volunteer(), await volunteer()];
    const res = await post(e, { items: [{ shiftId: e.shifts[0].id, memberIds: [a, b, c] }] });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'OVER_CAPACITY', details: [{ shiftId: e.shifts[0].id, remaining: 2 }] } });
    // S3 is a separate shift with its own capacity
    expect((await post(e, { items: [{ shiftId: e.shifts[0].id, memberIds: [a, b] }, { shiftId: e.shifts[2].id, memberIds: [c] }] })).status).toBe(201);
  });

  it('same_member_two_overlapping_shifts_in_one_request_422', async () => {
    const e = await event();
    const m = await volunteer();
    const res = await post(e, { items: [{ shiftId: e.shifts[1].id, memberIds: [m] }, { shiftId: e.shifts[0].id, memberIds: [m] }] });
    expect(res.status).toBe(422);
    // S1 is earlier, so it is checked first; S2 then sees the S1 booking.
    expect(await res.json()).toMatchObject({ error: { details: [{ shiftId: e.shifts[1].id, memberId: m, reasons: ['DOUBLE_BOOKED'] }] } });
    expect(await roster(e.id)).toEqual([]);
  });

  it('same_member_two_non_overlapping_shifts_ok', async () => {
    const e = await event();
    const m = await volunteer();
    const res = await post(e, { items: [{ shiftId: e.shifts[0].id, memberIds: [m] }, { shiftId: e.shifts[2].id, memberIds: [m] }] });
    expect(res.status).toBe(201);
  });

  it('shift_of_other_event_404', async () => {
    const [e1, e2] = [await event(), await event()];
    const m = await volunteer();
    expect((await post(e1, { items: [{ shiftId: e2.shifts[0].id, memberIds: [m] }] })).status).toBe(404);
  });

  it('stale_version_409_VERSION_CONFLICT_writes_nothing', async () => {
    const e = await event();
    const m = await volunteer();
    const res = await post({ ...e, version: 3 }, { items: [{ shiftId: e.shifts[0].id, memberIds: [m] }] });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'VERSION_CONFLICT' } });
    expect(await roster(e.id)).toEqual([]);
  });

  it('concurrent_approvals', async () => {
    const e = await event();
    const [a, b] = [await volunteer(), await volunteer()];
    const results = await Promise.all([
      post(e, { items: [{ shiftId: e.shifts[0].id, memberIds: [a] }] }),
      post(e, { items: [{ shiftId: e.shifts[2].id, memberIds: [b] }] }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await roster(e.id)).toHaveLength(1);
  });

  it('duplicate_member_ids_400', async () => {
    const e = await event();
    const m = await volunteer();
    expect((await post(e, { items: [{ shiftId: e.shifts[0].id, memberIds: [m, m] }] })).status).toBe(400);
  });

  it('audit_rows_written', async () => {
    const e = await event();
    const plain = await volunteer();
    const conflicted = await volunteer(['09:00', '10:00']);
    await post(e, { items: [{ shiftId: e.shifts[0].id, memberIds: [plain, conflicted], overrideConflictIds: [conflicted] }] });
    const rows = (await env.DB.prepare(`SELECT action, data_json FROM audit_log WHERE action LIKE 'assignment.%' AND entity_id IN (SELECT id FROM assignments WHERE event_id = ?1) ORDER BY id`)
      .bind(e.id)
      .all<{ action: string; data_json: string }>()).results;
    expect(rows.map((r) => r.action)).toEqual(['assignment.create', 'assignment.create', 'assignment.override_conflict']);
  });
});

describe('AI approvals', () => {
  async function session(eventId: number, constraints: object, lastPicks: [number, number][]) {
    return (await env.DB.prepare(
      `INSERT INTO ai_sessions (event_id, created_by, constraints_json, scope_json, last_result_json, created_at, updated_at) VALUES (?1, ?2, ?3, '{"shiftIds":[]}', ?4, ?5, ?5) RETURNING id`,
    )
      .bind(
        eventId,
        adviserId,
        JSON.stringify({ groups: [], priorities: [], teamMode: 'per_shift', allowClassConflicts: false, ...constraints }),
        JSON.stringify({ picks: lastPicks.map(([shiftId, memberId]) => ({ shiftId, memberId, groupIndex: 0, score: 1 })) }),
        NOW,
      )
      .first<{ id: number }>())!.id;
  }

  it('ai_source_uses_session_allowClassConflicts', async () => {
    const e = await event();
    const m = await volunteer(['09:00', '10:00']);
    const strict = await session(e.id, {}, []);
    expect((await post(e, { source: 'ai', aiSessionId: strict, items: [{ shiftId: e.shifts[0].id, memberIds: [m] }] })).status).toBe(422);
    await env.DB.prepare(`UPDATE ai_sessions SET status = 'abandoned' WHERE id = ?1`).bind(strict).run();
    const lenient = await session(e.id, { allowClassConflicts: true }, []);
    expect((await post(e, { source: 'ai', aiSessionId: lenient, items: [{ shiftId: e.shifts[0].id, memberIds: [m] }] })).status).toBe(201);
  });

  it('ai_requires_an_open_session_of_this_event', async () => {
    const e = await event();
    const m = await volunteer();
    expect((await post(e, { source: 'ai', items: [{ shiftId: e.shifts[0].id, memberIds: [m] }] })).status).toBe(422);
    expect((await post(e, { source: 'ai', aiSessionId: 999999, items: [{ shiftId: e.shifts[0].id, memberIds: [m] }] })).status).toBe(404);
  });

  it('ai_approve_stores_outcome_json', async () => {
    const e = await event();
    const [a, b, c] = [await volunteer(), await volunteer(), await volunteer()];
    const s1 = e.shifts[0].id;
    const sid = await session(e.id, {}, [
      [s1, a],
      [s1, b],
    ]);
    // Adviser kept a, dropped b, added c.
    expect((await post(e, { source: 'ai', aiSessionId: sid, items: [{ shiftId: s1, memberIds: [a, c] }] })).status).toBe(201);
    const row = await env.DB.prepare(`SELECT status, outcome_json FROM ai_sessions WHERE id = ?1`).bind(sid).first<{ status: string; outcome_json: string }>();
    expect(row!.status).toBe('approved');
    expect(JSON.parse(row!.outcome_json)).toEqual({
      recommended: [
        [s1, a],
        [s1, b],
      ],
      approved: [
        [s1, a],
        [s1, c],
      ],
      accepted: [[s1, a]],
      removed: [[s1, b]],
      added: [[s1, c]],
    });
    const src = await env.DB.prepare(`SELECT DISTINCT source, ai_session_id FROM assignments WHERE event_id = ?1`).bind(e.id).all();
    expect(src.results).toEqual([{ source: 'ai', ai_session_id: sid }]);
  });
});

describe('POST /api/assignments/:id/cancel', () => {
  it('cancel_requires_reason_and_soft_deletes', async () => {
    const e = await event();
    const m = await volunteer();
    const created = (await (await post(e, { items: [{ shiftId: e.shifts[0].id, memberIds: [m] }] })).json()) as { created: { id: number }[] };
    const id = created.created[0].id;
    expect((await call('POST', `/assignments/${id}/cancel`, { reason: 'x' })).status).toBe(400);
    const res = await call('POST', `/assignments/${id}/cancel`, { reason: 'Family emergency' });
    expect(res.status).toBe(200);
    expect(await env.DB.prepare('SELECT status, cancel_reason, cancelled_by FROM assignments WHERE id = ?1').bind(id).first()).toEqual({
      status: 'cancelled',
      cancel_reason: 'Family emergency',
      cancelled_by: adviserId,
    });
    expect(await env.DB.prepare('SELECT version FROM events WHERE id = ?1').bind(e.id).first()).toEqual({ version: 2 });
    expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'assignment.cancel' AND entity_id = ?1`).bind(id).first()).toEqual({ n: 1 });
    // cancelling twice → 409; the member can be re-added afterwards
    expect((await call('POST', `/assignments/${id}/cancel`, { reason: 'Again please' })).status).toBe(409);
    expect((await post({ ...e, version: 2 }, { items: [{ shiftId: e.shifts[0].id, memberIds: [m] }] })).status).toBe(201);
  });

  it('member_cannot_cancel_403', async () => {
    const member = await signIn(env);
    expect((await call('POST', `/assignments/1/cancel`, { reason: 'Not me' }, member.headers)).status).toBe(403);
  });
});
