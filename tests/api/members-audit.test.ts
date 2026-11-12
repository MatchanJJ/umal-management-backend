import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '../../server/db/client';
import { isoWeekday } from '../../server/engine';
import { updateMember } from '../../server/services/members';
import { signIn } from './helpers/auth';

const NOW = new Date().toISOString();
let adviser: Headers;
let adviserId: number;
let termId: number; // 2027 A, for API-created events
let farTermId: number; // 2099 A, so "future" holds whatever the real date

beforeAll(async () => {
  const a = await signIn(env, { role: 'adviser' });
  adviser = a.headers;
  adviserId = a.memberId!;
  const term = (name: string, start: string, end: string) =>
    env.DB.prepare(`INSERT INTO terms (name, start_date, end_date, is_active, created_at) VALUES (?1, ?2, ?3, 0, ?4) RETURNING id`)
      .bind(name, start, end, NOW)
      .first<{ id: number }>();
  termId = (await term('2027 A', '2027-01-04', '2027-06-30'))!.id;
  farTermId = (await term('2099 A', '2099-01-01', '2099-06-30'))!.id;
});

function call(method: string, path: string, body?: unknown, headers = adviser) {
  const h = new Headers(headers);
  if (body !== undefined) h.set('content-type', 'application/json');
  return SELF.fetch(`http://x/api${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}
const json = async <T>(res: Response | Promise<Response>) => (await (await res).json()) as T;

/** A member with a (submitted, empty) schedule for `term`. */
async function volunteer(term = termId, email?: string) {
  const m = await signIn(env, email ? { email } : {});
  const scheduleId = (await env.DB.prepare(`INSERT INTO class_schedules (member_id, term_id, submitted_at, updated_at) VALUES (?1, ?2, ?3, ?3) RETURNING id`)
    .bind(m.memberId, term, NOW)
    .first<{ id: number }>())!.id;
  return { id: m.memberId!, headers: m.headers, scheduleId };
}

describe('PATCH /api/members/:id', () => {
  it('adviser_cannot_change_own_role_or_status_403', async () => {
    for (const body of [{ role: 'member' }, { status: 'inactive' }]) {
      const res = await call('PATCH', `/members/${adviserId}`, body);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
    }
    expect(await env.DB.prepare(`SELECT role, status FROM members WHERE id = ?1`).bind(adviserId).first()).toEqual({ role: 'adviser', status: 'active' });
  });

  it('last_active_adviser_cannot_be_demoted_409_LAST_ADVISER', async () => {
    // Only reachable in a race (the caller is itself an active adviser), so drive the service directly:
    // the target is the only active adviser left and the caller has just been demoted elsewhere.
    const target = await signIn(env, { role: 'adviser' });
    const caller = await signIn(env, { role: 'adviser' });
    await env.DB.prepare(`UPDATE members SET status = 'inactive' WHERE role = 'adviser' AND id <> ?1`).bind(target.memberId).run();
    try {
      for (const patch of [{ role: 'member' as const }, { status: 'inactive' as const }]) {
        expect(await updateMember(getDb(env), caller.memberId!, target.memberId!, patch)).toMatchObject({ ok: false, status: 409, code: 'LAST_ADVISER' });
      }
      expect(await env.DB.prepare(`SELECT role, status FROM members WHERE id = ?1`).bind(target.memberId).first()).toEqual({ role: 'adviser', status: 'active' });
    } finally {
      await env.DB.prepare(`UPDATE members SET status = 'active' WHERE role = 'adviser'`).run();
    }
  });

  it('role_change_audited', async () => {
    const m = await volunteer();
    const res = await call('PATCH', `/members/${m.id}`, { role: 'adviser' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: m.id, role: 'adviser', status: 'active' });
    // Same value again: no change, no audit row.
    expect((await call('PATCH', `/members/${m.id}`, { role: 'adviser' })).status).toBe(200);

    const log = await json<{ items: { actor: { id: number; name: string } | null; action: string; entityId: number; data: unknown }[]; total: number }>(
      call('GET', `/audit?action=member.role_change&entityType=member`),
    );
    const rows = log.items.filter((i) => i.entityId === m.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor: { id: adviserId }, data: { from: 'member', to: 'adviser' } });
  });

  it('deactivated_member_not_candidate', async () => {
    const m = await volunteer();
    const ev = await json<{ id: number; shifts: { id: number }[] }>(
      call('POST', '/events', { title: 'Fair', shifts: [{ label: 'Main', startAt: '2027-03-04T08:00', endAt: '2027-03-04T12:00', requiredVolunteers: 2 }] }),
    );
    const ids = async () => (await json<{ items: { member: { id: number } }[] }>(call('GET', `/events/${ev.id}/candidates?shiftId=${ev.shifts[0].id}`))).items.map((i) => i.member.id);
    expect(await ids()).toContain(m.id);

    expect((await call('PATCH', `/members/${m.id}`, { status: 'inactive' })).status).toBe(200);
    expect(await ids()).not.toContain(m.id);
    const audit = await env.DB.prepare(`SELECT data_json FROM audit_log WHERE action = 'member.status_change' AND entity_id = ?1`).bind(m.id).first<{ data_json: string }>();
    expect(JSON.parse(audit!.data_json)).toEqual({ from: 'active', to: 'inactive' });
    // Their session stops working too.
    expect((await call('GET', '/me/assignments', undefined, m.headers)).status).toBe(403);
  });
});

describe('GET /api/members', () => {
  it('directory_filters_and_detail', async () => {
    const m = await volunteer(termId, `z.dir.${100000 + Math.floor(Math.random() * 899999)}@umindanao.edu.ph`);
    await env.DB.prepare(`UPDATE members SET first_name = 'Zelda', last_name = 'Directory' WHERE id = ?1`).bind(m.id).run();
    const list = await json<{ items: { id: number; name: string; role: string }[]; total: number }>(call('GET', '/members?search=zelda&role=member&status=active'));
    expect(list.items.map((i) => i.id)).toEqual([m.id]);
    expect(list.total).toBe(1);
    expect((await json<{ items: unknown[] }>(call('GET', '/members?search=zelda&role=adviser'))).items).toHaveLength(0);

    const detail = await json<{ member: { id: number; email: string }; stats: { hours: number; shifts: number }; assignments: unknown[] }>(call('GET', `/members/${m.id}`));
    expect(detail.member.id).toBe(m.id);
    expect(detail.stats).toMatchObject({ hours: 0, shifts: 0 });
    expect(detail.assignments).toEqual([]);
    expect((await call('GET', '/members/999999')).status).toBe(404);
  });
});

describe('dashboard', () => {
  it('new_conflicts_query_finds_future_assignment_after_schedule_change', async () => {
    const day = '2099-02-05';
    const [m, overridden] = [await volunteer(farTermId), await volunteer(farTermId)];
    const eventId = (await env.DB.prepare(
      `INSERT INTO events (term_id, title, start_at, end_at, status, created_by, created_at, updated_at) VALUES (?1, 'Far fair', ?2, ?3, 'published', ?4, ?5, ?5) RETURNING id`,
    )
      .bind(farTermId, `${day}T08:00`, `${day}T12:00`, adviserId, NOW)
      .first<{ id: number }>())!.id;
    const shiftId = (await env.DB.prepare(
      `INSERT INTO shifts (event_id, label, start_at, end_at, required_volunteers, position, created_at, updated_at) VALUES (?1, 'Main', ?2, ?3, 5, 0, ?4, ?4) RETURNING id`,
    )
      .bind(eventId, `${day}T08:00`, `${day}T12:00`, NOW)
      .first<{ id: number }>())!.id;
    const assign = (memberId: number, override: number) =>
      env.DB.prepare(
        `INSERT INTO assignments (event_id, shift_id, member_id, status, source, conflict_override, assigned_by, assigned_at) VALUES (?1, ?2, ?3, 'assigned', 'manual', ?4, ?5, ?6) RETURNING id`,
      )
        .bind(eventId, shiftId, memberId, override, adviserId, NOW)
        .first<{ id: number }>();
    const a = (await assign(m.id, 0))!.id;
    await assign(overridden.id, 1); // the adviser already accepted this conflict

    const conflicts = async () => (await json<{ newConflicts: { assignmentId: number }[] }>(call('GET', '/reports/dashboard'))).newConflicts.map((c) => c.assignmentId);
    expect(await conflicts()).not.toContain(a);

    // Schedule edited after the assignment: a class now overlaps the shift.
    for (const s of [m.scheduleId, overridden.scheduleId]) {
      await env.DB.prepare(`INSERT INTO class_entries (schedule_id, day_of_week, start_time, end_time) VALUES (?1, ?2, '09:00', '10:30')`).bind(s, isoWeekday(day)).run();
    }
    const found = await json<{ newConflicts: { assignmentId: number; eventId: number; memberId: number; shiftLabel: string }[] }>(call('GET', '/reports/dashboard'));
    expect(found.newConflicts.filter((c) => c.eventId === eventId)).toEqual([expect.objectContaining({ assignmentId: a, memberId: m.id, shiftLabel: 'Main' })]);
  });

  it('candidates_accept_draft_weights_and_ai_health', async () => {
    await volunteer();
    const ev = await json<{ id: number; shifts: { id: number }[] }>(
      call('POST', '/events', { title: 'Weights', shifts: [{ label: 'Main', startAt: '2027-03-05T08:00', endAt: '2027-03-05T12:00', requiredVolunteers: 2 }] }),
    );
    const res = await json<{ items: { score: { total: number; reliability: number } }[] }>(call('GET', `/events/${ev.id}/candidates?shiftId=${ev.shifts[0].id}&weights=0,0,10`));
    for (const i of res.items) expect(i.score.total).toBeCloseTo(10 * i.score.reliability);
    expect((await call('GET', `/events/${ev.id}/candidates?shiftId=${ev.shifts[0].id}&weights=0,0,11`)).status).toBe(400);

    const ai = await json<{ turns7d: number; p50LatencyMs: number | null; lastError: unknown }>(call('GET', '/reports/ai-health'));
    expect(ai).toMatchObject({ turns7d: 0, p50LatencyMs: null, lastError: null });
  });
});

describe('GET /api/audit', () => {
  it('audit_filters_by_action_and_date', async () => {
    const add = (action: string, createdAt: string) =>
      env.DB.prepare(`INSERT INTO audit_log (actor_id, action, entity_type, entity_id, data_json, created_at) VALUES (?1, ?2, 'term', 1, '{}', ?3)`).bind(adviserId, action, createdAt).run();
    await add('term.create', '2030-01-04T15:00:00.000Z'); // 4 Jan 23:00 Manila → outside
    await add('term.create', '2030-01-04T16:30:00.000Z'); // 5 Jan 00:30 Manila → inside
    await add('term.activate', '2030-01-05T05:00:00.000Z'); // other action
    await add('term.create', '2030-01-06T05:00:00.000Z'); // 6 Jan → outside

    const r = await json<{ items: { action: string; createdAt: string }[]; total: number }>(call('GET', '/audit?action=term.create&from=2030-01-05&to=2030-01-05'));
    expect(r.total).toBe(1);
    expect(r.items).toEqual([expect.objectContaining({ action: 'term.create', createdAt: '2030-01-04T16:30:00.000Z' })]);
    expect((await call('GET', '/audit?action=nope')).status).toBe(400);
  });
});
