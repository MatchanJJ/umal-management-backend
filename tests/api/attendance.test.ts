import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { signIn } from './helpers/auth';

// Attendance needs ended shifts, which the API refuses to staff, so events are seeded with SQL.
const PAST = ['2026-01-10T08:00', '2026-01-10T12:00'] as const; // ended (real clock)
const PAST2 = ['2026-01-11T08:00', '2026-01-11T12:00'] as const;
const FUTURE = ['2099-01-10T08:00', '2099-01-10T12:00'] as const; // not ended
const NOW = new Date().toISOString();

let adviser: Headers;
let adviserId: number;
let termId: number;

beforeAll(async () => {
  const a = await signIn(env, { role: 'adviser' });
  adviser = a.headers;
  adviserId = a.memberId!;
  termId = (await env.DB.prepare(`INSERT INTO terms (name, start_date, end_date, is_active, created_at) VALUES ('2026 A', '2026-01-04', '2026-06-30', 1, ?1) RETURNING id`)
    .bind(NOW)
    .first<{ id: number }>())!.id;
});

type Seed = { eventId: number; shiftIds: number[]; assignmentIds: number[][] };
/** An event with one shift per `[start, end]`; each shift gets `perShift` assignments with the given statuses. */
async function seed(shifts: (readonly [string, string])[], statuses: string[][], eventStatus = 'published'): Promise<Seed> {
  const eventId = (await env.DB.prepare(
    `INSERT INTO events (term_id, title, start_at, end_at, status, created_by, created_at, updated_at) VALUES (?1, 'Seeded', ?2, ?3, ?4, ?5, ?6, ?6) RETURNING id`,
  )
    .bind(termId, shifts[0][0], shifts.at(-1)![1], eventStatus, adviserId, NOW)
    .first<{ id: number }>())!.id;
  const shiftIds: number[] = [];
  const assignmentIds: number[][] = [];
  for (const [i, [start, end]] of shifts.entries()) {
    const sid = (await env.DB.prepare(
      `INSERT INTO shifts (event_id, label, start_at, end_at, required_volunteers, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 5, ?5, ?6, ?6) RETURNING id`,
    )
      .bind(eventId, `Day ${i + 1}`, start, end, i, NOW)
      .first<{ id: number }>())!.id;
    shiftIds.push(sid);
    const ids: number[] = [];
    for (const status of statuses[i]) {
      const m = await signIn(env);
      const cancelled = status === 'cancelled';
      ids.push(
        (await env.DB.prepare(
          `INSERT INTO assignments (event_id, shift_id, member_id, status, source, assigned_by, assigned_at, cancelled_at, cancel_reason) VALUES (?1, ?2, ?3, ?4, 'manual', ?5, ?6, ?7, ?8) RETURNING id`,
        )
          .bind(eventId, sid, m.memberId, status, adviserId, NOW, cancelled ? NOW : null, cancelled ? 'test' : null)
          .first<{ id: number }>())!.id,
      );
    }
    assignmentIds.push(ids);
  }
  return { eventId, shiftIds, assignmentIds };
}

function mark(eventId: number, entries: { assignmentId: number; status: string }[], headers = adviser) {
  return SELF.fetch(`http://x/api/events/${eventId}/attendance`, {
    method: 'PUT',
    headers: new Headers([...headers, ['content-type', 'application/json']]),
    body: JSON.stringify({ entries }),
  });
}
const event = (id: number) => env.DB.prepare(`SELECT status, version FROM events WHERE id = ?1`).bind(id).first<{ status: string; version: number }>();
const assignment = (id: number) =>
  env.DB.prepare(`SELECT status, attendance_marked_by AS markedBy, attendance_marked_at AS markedAt FROM assignments WHERE id = ?1`)
    .bind(id)
    .first<{ status: string; markedBy: number | null; markedAt: string | null }>();

describe('PUT /api/events/:id/attendance', () => {
  it('before_shift_end_409', async () => {
    const s = await seed([FUTURE], [['assigned']]);
    const res = await mark(s.eventId, [{ assignmentId: s.assignmentIds[0][0], status: 'attended' }]);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'CONFLICT' } });
    expect((await assignment(s.assignmentIds[0][0]))!.status).toBe('assigned');
    expect((await event(s.eventId))!.version).toBe(0);
  });

  it('marking_day1_allowed_while_day2_not_ended', async () => {
    const s = await seed([PAST, FUTURE], [['assigned'], ['assigned']]);
    const res = await mark(s.eventId, [{ assignmentId: s.assignmentIds[0][0], status: 'attended' }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ eventStatus: 'published', version: 1 });
    expect(await assignment(s.assignmentIds[0][0])).toMatchObject({ status: 'attended', markedBy: adviserId });
    expect((await assignment(s.assignmentIds[0][0]))!.markedAt).not.toBeNull();
    expect(await event(s.eventId)).toEqual({ status: 'published', version: 1 });
  });

  it('completes_event_only_when_all_shifts_ended_and_marked', async () => {
    const s = await seed([PAST, PAST2], [['assigned'], ['assigned', 'assigned']]);
    const [a] = s.assignmentIds[0];
    const [b, c] = s.assignmentIds[1];
    let res = await mark(s.eventId, [
      { assignmentId: a, status: 'attended' },
      { assignmentId: b, status: 'no_show' },
    ]);
    expect(await res.json()).toMatchObject({ eventStatus: 'published' });
    res = await mark(s.eventId, [{ assignmentId: c, status: 'excused' }]);
    expect(await res.json()).toMatchObject({ eventStatus: 'completed' });
    expect((await event(s.eventId))!.status).toBe('completed');

    // All marked but a shift still to come: stays published.
    const f = await seed([PAST, FUTURE], [['assigned'], []]);
    res = await mark(f.eventId, [{ assignmentId: f.assignmentIds[0][0], status: 'attended' }]);
    expect(await res.json()).toMatchObject({ eventStatus: 'published' });
  });

  it('cancelled_assignments_ignored', async () => {
    const s = await seed([PAST], [['assigned', 'cancelled']]);
    const [a, cancelled] = s.assignmentIds[0];
    let res = await mark(s.eventId, [{ assignmentId: cancelled, status: 'attended' }]);
    expect(res.status).toBe(409);
    res = await mark(s.eventId, [{ assignmentId: a, status: 'attended' }]);
    expect(await res.json()).toMatchObject({ eventStatus: 'completed' });
    expect((await assignment(cancelled))!.status).toBe('cancelled');
  });

  it('correction_after_completed_allowed_and_audited', async () => {
    const s = await seed([PAST], [['attended']], 'completed');
    const a = s.assignmentIds[0][0];
    const res = await mark(s.eventId, [{ assignmentId: a, status: 'no_show' }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ eventStatus: 'completed' });
    expect((await assignment(a))!.status).toBe('no_show');
    const audit = await env.DB.prepare(`SELECT actor_id AS actorId, data_json AS data FROM audit_log WHERE action = 'attendance.mark' AND entity_id = ?1`)
      .bind(a)
      .all<{ actorId: number; data: string }>();
    expect(audit.results).toHaveLength(1);
    expect(audit.results[0].actorId).toBe(adviserId);
    expect(JSON.parse(audit.results[0].data)).toEqual({ eventId: s.eventId, from: 'attended', to: 'no_show' });
  });

  it('rejects_other_events_assignments_draft_and_cancelled_events', async () => {
    const s = await seed([PAST], [['assigned']]);
    const other = await seed([PAST], [['assigned']]);
    expect((await mark(s.eventId, [{ assignmentId: other.assignmentIds[0][0], status: 'attended' }])).status).toBe(404);
    for (const status of ['draft', 'cancelled']) {
      const e = await seed([PAST], [['assigned']], status);
      expect((await mark(e.eventId, [{ assignmentId: e.assignmentIds[0][0], status: 'attended' }])).status).toBe(409);
    }
  });

  it('validates_body', async () => {
    const s = await seed([PAST], [['assigned']]);
    const a = s.assignmentIds[0][0];
    expect((await mark(s.eventId, [])).status).toBe(400);
    expect((await mark(s.eventId, [{ assignmentId: a, status: 'assigned' }])).status).toBe(400);
    expect(
      (
        await mark(s.eventId, [
          { assignmentId: a, status: 'attended' },
          { assignmentId: a, status: 'no_show' },
        ])
      ).status,
    ).toBe(400);
  });
});
