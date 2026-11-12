import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../server/app';
import type { Provider } from '../../server/ai/interpret';
import type { AppEnv, Env } from '../../server/env';
import { emptyGroup } from '../../shared/constraints';
import { AI_TURNS_PER_DAY, AI_TURNS_PER_DAY_ALL } from '../../shared/settings';
import type { SessionResponse, TurnResponse } from '../../shared/ai';
import { signIn } from './helpers/auth';

// Fake LLM injected through c.var.aiProviders (vi.mock doesn't reach the app in the Workers pool).
const llm = { calls: 0 };
const fakeLlm: Provider = {
  name: 'gemini',
  model: 'fake',
  async generate({ messages }) {
    llm.calls++;
    const text = String(messages[messages.length - 1].content);
    const base = { groups: [{ ...emptyGroup(), count: 2 }], allowClassConflicts: false, priorities: [], teamMode: 'per_shift' };
    if (text.includes('sige')) return { kind: 'confirm_request', constraints: base, reply: 'Press Approve.', assumptions: [] };
    if (text.includes('same people')) return { kind: 'update', constraints: { ...base, teamMode: 'same_team' }, reply: 'Same team.', assumptions: [] };
    return { kind: 'update', constraints: base, reply: 'Two volunteers.', assumptions: [] };
  },
};
const testApp = new Hono<AppEnv>()
  .use(async (c, next) => {
    c.set('aiProviders', [fakeLlm]);
    await next();
  })
  .route('/', app);

const NOW = '2026-01-01T00:00:00.000Z';
let adviser: Headers;

let termId: number;

beforeAll(async () => {
  const a = await signIn(env, { role: 'adviser' });
  adviser = a.headers;
  termId = (await env.DB.prepare(`INSERT INTO terms (name, start_date, end_date, is_active, created_at) VALUES ('AI', '2027-01-04', '2027-06-30', 1, ?1) RETURNING id`)
    .bind(NOW)
    .first<{ id: number }>())!.id;
  for (let i = 0; i < 6; i++) {
    const m = await signIn(env);
    await env.DB.prepare(`INSERT INTO class_schedules (member_id, term_id, submitted_at, updated_at) VALUES (?1, ?2, ?3, ?3)`).bind(m.memberId, termId, NOW).run();
  }
});

function call(method: string, path: string, body?: unknown, headers = adviser, e: Env = env) {
  const h = new Headers(headers);
  if (body !== undefined) h.set('content-type', 'application/json');
  return testApp.request(`/api${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }, e);
}

type Ev = { id: number; version: number; shifts: { id: number; requiredVolunteers: number }[] };
async function event(): Promise<Ev> {
  const res = await call('POST', '/events', {
    title: 'Expo',
    shifts: [
      { label: 'Day 1', startAt: '2027-03-04T08:00', endAt: '2027-03-04T12:00', requiredVolunteers: 3 },
      { label: 'Day 2', startAt: '2027-03-05T08:00', endAt: '2027-03-05T12:00', requiredVolunteers: 3 },
    ],
  });
  expect(res.status).toBe(201);
  return (await res.json()) as Ev;
}
const start = async (e: Ev, h = adviser) => (await (await call('POST', `/events/${e.id}/ai-sessions`, undefined, h)).json()) as SessionResponse;
const turn = (sessionId: number, message: string, shiftIds: number[], h = adviser, e: Env = env) =>
  call('POST', `/ai-sessions/${sessionId}/turns`, { message, pins: { include: [], exclude: [] }, scope: { shiftIds } }, h, e);

describe('AI sessions', () => {
  it('create_resumes_open_session', async () => {
    const e = await event();
    const first = await start(e);
    const again = await start(e);
    expect(again.session.id).toBe(first.session.id);
    expect(first.result.perShift.length).toBeGreaterThan(0); // initial unconstrained ranking
  });

  it('default_scope_is_shifts_with_open_slots', async () => {
    const e = await event();
    // Fill Day 1 completely through the real writer.
    const ids = (await env.DB.prepare(`SELECT id FROM members WHERE role = 'member' AND onboarded_at IS NOT NULL LIMIT 3`).all<{ id: number }>()).results.map((r) => r.id);
    expect((await call('POST', `/events/${e.id}/assignments`, { items: [{ shiftId: e.shifts[0].id, memberIds: ids }], source: 'manual', expectedVersion: 0 })).status).toBe(201);
    const s = await start(e);
    expect(s.session.scope.shiftIds).toEqual([e.shifts[1].id]);
  });

  it('scope_with_ended_or_foreign_shift_422', async () => {
    const [e, other] = [await event(), await event()];
    const s = await start(e);
    expect((await turn(s.session.id, 'need 2', [other.shifts[0].id])).status).toBe(422);
    // An ended shift: move Day 1 into the past directly (the API forbids it).
    await env.DB.prepare(`UPDATE shifts SET start_at = '2027-01-05T08:00', end_at = '2027-01-05T09:00' WHERE id = ?1`).bind(e.shifts[0].id).run();
    await env.DB.prepare(`UPDATE terms SET start_date = '2020-01-01' WHERE id = ?1`).bind(termId).run();
    await env.DB.prepare(`UPDATE shifts SET start_at = '2021-01-05T08:00', end_at = '2021-01-05T09:00' WHERE id = ?1`).bind(e.shifts[0].id).run();
    const res = await turn(s.session.id, 'need 2', [e.shifts[0].id]);
    expect(res.status).toBe(422);
    await env.DB.prepare(`UPDATE terms SET start_date = '2027-01-04' WHERE id = ?1`).bind(termId).run();
  });

  it('turn_persists_ai_turn_and_updates_session', async () => {
    const e = await event();
    const s = await start(e);
    const res = await turn(s.session.id, 'need 2 volunteers', [e.shifts[1].id]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as TurnResponse;
    expect(body.turn).toMatchObject({ kind: 'update', provider: 'gemini', reply: 'Two volunteers.' });
    expect(body.constraints.groups[0].count).toBe(2);
    expect(body.result.perShift[0].result.picks).toHaveLength(2);
    expect(body.result.perShift[0].result.picks[0].member.name).toEqual(expect.any(String));

    const t = await env.DB.prepare(`SELECT kind, user_message, provider, model FROM ai_turns WHERE session_id = ?1`).bind(s.session.id).first();
    expect(t).toEqual({ kind: 'update', user_message: 'need 2 volunteers', provider: 'gemini', model: 'fake' });
    const row = await env.DB.prepare(`SELECT constraints_json, scope_json, last_result_json FROM ai_sessions WHERE id = ?1`).bind(s.session.id).first<Record<string, string>>();
    expect(JSON.parse(row!.scope_json)).toEqual({ shiftIds: [e.shifts[1].id] });
    expect(JSON.parse(row!.last_result_json).picks).toEqual(
      body.result.perShift[0].result.picks.map((p) => ({ shiftId: e.shifts[1].id, memberId: p.memberId, groupIndex: p.groupIndex, score: p.score.total })),
    );
  });

  it('same_team_turn_returns_identical_picks_per_shift', async () => {
    const e = await event();
    const s = await start(e);
    const body = (await (await turn(s.session.id, 'same people both days', e.shifts.map((x) => x.id))).json()) as TurnResponse;
    expect(body.result.teamMode).toBe('same_team');
    const [a, b] = body.result.perShift.map((x) => x.result.picks.map((p) => p.memberId));
    expect(a).toHaveLength(2);
    expect(a).toEqual(b);
  });

  it('confirm_request_writes_no_assignments', async () => {
    const e = await event();
    const s = await start(e);
    const count = async () => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM assignments WHERE event_id = ?1`).bind(e.id).first<{ n: number }>())!.n;
    const before = await count();
    const body = (await (await turn(s.session.id, 'sige, i-assign mo na', [e.shifts[0].id])).json()) as TurnResponse;
    expect(body.turn.kind).toBe('confirm_request');
    expect(await count()).toBe(before);
  });

  it('manual_constraints_put_skips_llm', async () => {
    const e = await event();
    const s = await start(e);
    const before = llm.calls;
    const res = await call('PUT', `/ai-sessions/${s.session.id}/constraints`, {
      constraints: { groups: [{ ...emptyGroup(), count: 1 }], allowClassConflicts: false, priorities: [], teamMode: 'per_shift' },
      pins: { include: [], exclude: [] },
      scope: { shiftIds: [e.shifts[0].id] },
    });
    expect(res.status).toBe(200);
    expect(llm.calls).toBe(before);
    const body = (await res.json()) as TurnResponse;
    expect([body.turn.kind, body.turn.provider, body.result.perShift[0].result.picks.length]).toEqual(['manual_edit', 'none', 1]);
  });

  it('rate_limit_41st_turn_429', async () => {
    const busy = await signIn(env, { role: 'adviser' });
    const e = await event();
    const s = await start(e, busy.headers);
    const recent = new Date().toISOString();
    for (let i = 0; i < 40; i++) {
      await env.DB.prepare(
        `INSERT INTO ai_turns (session_id, created_by, kind, constraints_json, provider, created_at) VALUES (?1, ?2, 'update', '{}', 'none', ?3)`,
      )
        .bind(s.session.id, busy.memberId, recent)
        .run();
    }
    const res = await turn(s.session.id, 'need 2', [e.shifts[0].id], busy.headers);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: { code: 'AI_RATE_LIMITED' } });
  });

  const seedTurns = async (sessionId: number, memberId: number, n: number, at: string, kind = 'update') => {
    const stmt = env.DB.prepare(`INSERT INTO ai_turns (session_id, created_by, kind, constraints_json, provider, created_at) VALUES (?1, ?2, ?3, '{}', 'none', ?4)`);
    await env.DB.batch(Array.from({ length: n }, () => stmt.bind(sessionId, memberId, kind, at)));
  };

  // The turn is reserved before the LLM call in one statement, so parallel requests can't all slip under the limit.
  it('parallel_turns_cannot_exceed_the_hourly_limit', async () => {
    const busy = await signIn(env, { role: 'adviser' });
    const e = await event();
    const s = await start(e, busy.headers);
    await seedTurns(s.session.id, busy.memberId!, 39, new Date().toISOString());
    const before = llm.calls;
    const res = await Promise.all(Array.from({ length: 5 }, () => turn(s.session.id, 'need 2', [e.shifts[0].id], busy.headers)));
    expect(res.map((r) => r.status).sort()).toEqual([200, 429, 429, 429, 429]);
    expect(llm.calls - before).toBe(1);
  });

  it('manual_edits_do_not_use_up_ai_turns', async () => {
    const busy = await signIn(env, { role: 'adviser' });
    const e = await event();
    const s = await start(e, busy.headers);
    await seedTurns(s.session.id, busy.memberId!, 40, new Date().toISOString(), 'manual_edit');
    expect((await turn(s.session.id, 'need 2', [e.shifts[0].id], busy.headers)).status).toBe(200);
  });

  it('daily_cap_per_adviser_429', async () => {
    const busy = await signIn(env, { role: 'adviser' });
    const e = await event();
    const s = await start(e, busy.headers);
    await seedTurns(s.session.id, busy.memberId!, AI_TURNS_PER_DAY, new Date(Date.now() - 5 * 3_600_000).toISOString()); // outside the hour
    const res = await turn(s.session.id, 'need 2', [e.shifts[0].id], busy.headers);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: { code: 'AI_RATE_LIMITED' } });
  });

  it('daily_cap_for_everyone_429', async () => {
    const other = await signIn(env, { role: 'adviser' });
    const e = await event();
    const theirs = await start(e, other.headers);
    const at = new Date(Date.now() - 5 * 3_600_000).toISOString();
    await seedTurns(theirs.session.id, other.memberId!, AI_TURNS_PER_DAY_ALL, at);
    try {
      const fresh = await signIn(env, { role: 'adviser' });
      const mine = await start(e, fresh.headers);
      expect((await turn(mine.session.id, 'need 2', [e.shifts[0].id], fresh.headers)).status).toBe(429);
    } finally {
      await env.DB.prepare(`DELETE FROM ai_turns WHERE session_id = ?1`).bind(theirs.session.id).run();
    }
  });

  it('other_adviser_cannot_post_to_session_403', async () => {
    const e = await event();
    const s = await start(e);
    const other = await signIn(env, { role: 'adviser' });
    expect((await turn(s.session.id, 'need 2', [e.shifts[0].id], other.headers)).status).toBe(403);
    expect((await call('GET', `/ai-sessions/${s.session.id}`, undefined, other.headers)).status).toBe(403);
  });

  it('get_session_returns_turns', async () => {
    const e = await event();
    const s = await start(e);
    await turn(s.session.id, 'need 2', [e.shifts[0].id]);
    const body = (await (await call('GET', `/ai-sessions/${s.session.id}`)).json()) as SessionResponse;
    expect(body.turns.map((t) => [t.kind, t.userMessage])).toEqual([['update', 'need 2']]);
  });

  it('turn_query_budget_le_12', async () => {
    const e = await event();
    const s = await start(e);
    let statements = 0;
    const counting = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === 'prepare') return (sql: string) => (statements++, target.prepare(sql));
        const v = Reflect.get(target, prop);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    const countingEnv = { ...env, DB: counting } as Env;
    // Baseline: an adviser-only route that does nothing but the auth chain.
    await call('GET', '/reports/fairness', undefined, adviser, countingEnv);
    const auth = statements;
    statements = 0;
    const res = await turn(s.session.id, 'need 2', [e.shifts[0].id], adviser, countingEnv);
    expect(res.status).toBe(200);
    expect(auth).toBeGreaterThan(0);
    expect(statements - auth).toBeLessThanOrEqual(12);
  });
});

