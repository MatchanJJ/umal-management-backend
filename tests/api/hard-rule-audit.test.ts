import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '../../server/db/client';
import { hardRuleAudit } from '../../server/services/hard-rule-audit';
import type { TurnResponse } from '../../shared/ai';
import { emptyGroup } from '../../shared/constraints';
import { signIn } from './helpers/auth';

let adviser: Headers;
let termId: number;

beforeAll(async () => {
  adviser = (await signIn(env, { role: 'adviser' })).headers;
  termId = (await env.DB.prepare(`INSERT INTO terms (name, start_date, end_date, is_active, created_at) VALUES ('2027 A', '2027-01-04', '2027-06-30', 1, ?1) RETURNING id`)
    .bind(new Date().toISOString())
    .first<{ id: number }>())!.id;
});

async function call<T = unknown>(method: string, path: string, body?: unknown, headers = adviser, expectStatus?: number): Promise<T> {
  const h = new Headers(headers);
  if (body !== undefined) h.set('content-type', 'application/json');
  const res = await SELF.fetch(`http://x/api${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  if (expectStatus) expect(res.status, text).toBe(expectStatus);
  else expect(res.ok, `${method} ${path} → ${res.status} ${text}`).toBe(true);
  return (text ? JSON.parse(text) : null) as T;
}

/** A member who submits a schedule (and optional unavailability) through the member API. */
async function member(classes: { dayOfWeek: number; startTime: string; endTime: string }[] = [], unavailable: object[] = []) {
  const m = await signIn(env);
  await call('PUT', '/me/schedule', { termId, entries: classes }, m.headers);
  for (const u of unavailable) await call('POST', '/me/unavailability', u, m.headers, 201);
  return m.memberId!;
}

type Ev = { id: number; version: number; shifts: { id: number; label: string }[] };
type Candidates = { items: { member: { id: number }; eligibility: { hard: string[]; soft: string[] } }[] };

/** Approve whatever the engine picks for these shifts (constraint card edit → no LLM). */
async function approveAi(e: Ev, shiftIds: number[], count: number, teamMode: 'per_shift' | 'same_team') {
  const s = await call<{ session: { id: number } }>('POST', `/events/${e.id}/ai-sessions`);
  const r = await call<TurnResponse>('PUT', `/ai-sessions/${s.session.id}/constraints`, {
    constraints: { groups: [{ ...emptyGroup(), count }], allowClassConflicts: false, priorities: [], teamMode },
    pins: { include: [], exclude: [] },
    scope: { shiftIds },
  });
  const items = r.result.perShift.map((p) => ({ shiftId: p.shiftId, memberIds: p.result.picks.map((x) => x.memberId) })).filter((i) => i.memberIds.length);
  expect(items.length).toBe(shiftIds.length);
  await call('POST', `/events/${e.id}/assignments`, { items, source: 'ai', aiSessionId: s.session.id, expectedVersion: r.eventVersion }, adviser, 201);
}

describe('hard-rule audit', () => {
  it('hard_rule_audit_returns_zero_after_full_flow', async () => {
    // Pool with traps the engine must avoid: Thursday classes, a Saturday 01:00 class (inside the cross-midnight
    // shift), a weekly Monday-morning block and a date block over the small hours of Sat 6 Mar.
    for (let i = 0; i < 4; i++) await member();
    const thursdayClass = await member([{ dayOfWeek: 4, startTime: '09:00', endTime: '10:30' }]);
    await member([{ dayOfWeek: 6, startTime: '01:00', endTime: '02:30' }]);
    await member([], [{ kind: 'weekly', dayOfWeek: 1, termId, startTime: '08:00', endTime: '12:00' }]);
    await member([], [{ kind: 'date', date: '2027-03-06', startTime: '00:00', endTime: '03:00' }]);

    // Single-day (Thu), cross-midnight (Fri 22:00 → Sat 02:00) and a 3-day daily block (Mon–Wed).
    const single = await call<Ev>('POST', '/events', { title: 'Open House', shifts: [{ label: 'Main', startAt: '2027-03-04T08:00', endAt: '2027-03-04T12:00', requiredVolunteers: 3 }] });
    const night = await call<Ev>('POST', '/events', { title: 'Night Run', shifts: [{ label: 'Main', startAt: '2027-03-05T22:00', endAt: '2027-03-06T02:00', requiredVolunteers: 2 }] });
    const summit0 = await call<Ev>('POST', '/events', { title: 'Summit', shifts: [{ label: 'Main', startAt: '2027-03-08T08:00', endAt: '2027-03-08T17:00', requiredVolunteers: 2 }] });
    const summit = await call<Ev>('POST', `/events/${summit0.id}/shifts/daily`, { fromDate: '2027-03-08', toDate: '2027-03-10', startTime: '08:00', endTime: '17:00', requiredVolunteers: 2, expectedVersion: summit0.version });
    expect(summit.shifts).toHaveLength(3);

    // Manual: two clean candidates plus one explicit class-conflict override (soft, allowed).
    const cands = await call<Candidates>('GET', `/events/${single.id}/candidates?shiftId=${single.shifts[0].id}`);
    const clean = cands.items.filter((c) => !c.eligibility.hard.length && !c.eligibility.soft.length).map((c) => c.member.id);
    expect(cands.items.find((c) => c.member.id === thursdayClass)?.eligibility.soft).toContain('CLASS_CONFLICT');
    await call('POST', `/events/${single.id}/assignments`, {
      items: [{ shiftId: single.shifts[0].id, memberIds: [clean[0], clean[1], thursdayClass], overrideConflictIds: [thursdayClass] }],
      source: 'manual',
      expectedVersion: single.version,
    }, adviser, 201);

    // AssignAI: the night shift per shift, the summit as the same team on all three days.
    await approveAi(night, [night.shifts[0].id], 2, 'per_shift');
    await approveAi(summit, summit.shifts.map((s) => s.id), 1, 'same_team');

    const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM assignments WHERE status <> 'cancelled' AND event_id IN (?1, ?2, ?3)`).bind(single.id, night.id, summit.id).first<{ n: number }>();
    expect(n!.n).toBe(3 + 2 + 3);
    expect(await hardRuleAudit(getDb(env))).toEqual([]);
  });

  it('hard_rule_audit_flags_injected_violations', async () => {
    // Written behind the API's back: a double booking and a shift over a date block.
    const [m1, m2] = [await member(), await member([], [{ kind: 'date', date: '2027-04-01', startTime: '00:00', endTime: '24:00' }])];
    const a = await call<Ev>('POST', '/events', { title: 'A', shifts: [{ label: 'Main', startAt: '2027-04-01T08:00', endAt: '2027-04-01T12:00', requiredVolunteers: 3 }] });
    const b = await call<Ev>('POST', '/events', { title: 'B', shifts: [{ label: 'Main', startAt: '2027-04-01T10:00', endAt: '2027-04-01T14:00', requiredVolunteers: 3 }] });
    const insert = (e: Ev, memberId: number) =>
      env.DB.prepare(`INSERT INTO assignments (event_id, shift_id, member_id, status, source, assigned_by, assigned_at) VALUES (?1, ?2, ?3, 'assigned', 'manual', ?3, ?4) RETURNING id`)
        .bind(e.id, e.shifts[0].id, memberId, new Date().toISOString())
        .first<{ id: number }>();
    const [x, y, z] = [(await insert(a, m1))!.id, (await insert(b, m1))!.id, (await insert(a, m2))!.id];

    const all = await hardRuleAudit(getDb(env));
    const found = new Map(all.map((v) => [v.assignmentId, v.reasons]));
    expect(found.get(x)).toContain('DOUBLE_BOOKED');
    expect(found.get(y)).toContain('DOUBLE_BOOKED');
    expect(found.get(z)).toEqual(['UNAVAILABLE']);
  });
});
