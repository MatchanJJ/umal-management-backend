// AssignAI sessions (TRD §6, §7, App Flow §7). A chat turn never writes assignments — only POST /events/:id/assignments does.
// Turn budget (CLAUDE.md): 1 reserve-and-read statement + 9 loader statements + 2 writes = 12 D1 statements; ≤ 2 LLM calls.
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { ConstraintsInput, TurnInput, type ResultDTO, type SessionResponse, type TurnDTO, type TurnResponse } from '../../shared/ai';
import { Constraints, defaultConstraints, type Pins } from '../../shared/constraints';
import { DAY_NAMES } from '../../shared/schedule';
import { AI_TURNS_PER_DAY, AI_TURNS_PER_DAY_ALL, SETTINGS_DEFAULTS } from '../../shared/settings';
import { interpret } from '../ai/interpret';
import { providersFromEnv } from '../ai/providers';
import { buildVocabulary } from '../ai/vocabulary';
import { getDb } from '../db/client';
import { allocateShifts, daysBetween, segments, type ShiftsAllocation } from '../engine';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { requireAdviser } from '../middleware/auth';
import { loadCandidates, type Loaded } from '../services/candidate-loader';
import { validate } from '../validate';

/** `error` of a turn reserved before its LLM call; cleared when the turn completes, so one left behind was cut off. */
const UNFINISHED = 'Turn did not finish';

const IdParam = z.object({ id: z.coerce.number().int().positive() });
type SessionRow = { id: number; event_id: number; created_by: number; status: 'open' | 'approved' | 'abandoned'; constraints_json: string; pins_json: string; scope_json: string };
type Ok<T> = { ok: true } & T;
type Fail = { ok: false; res: Response };

const parseSession = (s: SessionRow) => ({
  constraints: Constraints.parse(JSON.parse(s.constraints_json)),
  pins: JSON.parse(s.pins_json) as Pins,
  scope: JSON.parse(s.scope_json) as { shiftIds: number[] },
});

/** Owner-only, open sessions (other advisers get 403; a closed session is read-only). */
function guardSession(c: Context<AppEnv>, s: SessionRow | null | undefined, needOpen: boolean): Response | null {
  if (!s) return apiError(c, 404, 'NOT_FOUND', 'Session not found');
  if (s.created_by !== c.get('member')!.id) return apiError(c, 403, 'FORBIDDEN', 'This AssignAI session belongs to another adviser');
  if (needOpen && s.status !== 'open') return apiError(c, 409, 'CONFLICT', 'This session is closed. Start a new one.');
  return null;
}

/** Scope must be active, not-ended shifts of this event (the LLM never chooses scope — rule 8). */
function checkScope(c: Context<AppEnv>, loaded: Loaded, shiftIds: number[]): Fail | null {
  const missing = shiftIds.find((id) => !loaded.shifts.some((s) => s.shiftId === id));
  if (missing) return { ok: false, res: apiError(c, 422, 'VALIDATION', `Shift ${missing} is not an active shift of this event`, { shiftId: missing }) };
  const ended = loaded.shifts.find((s) => s.endAt <= s.now);
  if (ended) return { ok: false, res: apiError(c, 422, 'VALIDATION', 'That shift has already ended', { shiftId: ended.shiftId }) };
  return null;
}

function toResult(loaded: Loaded, alloc: ShiftsAllocation): ResultDTO {
  const facts = new Map(loaded.facts.map((f) => [f.memberId, f]));
  const avg = loaded.facts.length ? loaded.facts.reduce((s, f) => s + f.termHours, 0) / loaded.facts.length : 0;
  return {
    teamMode: alloc.teamMode,
    avgTermHours: avg,
    perShift: alloc.perShift.map(({ shiftId, result }) => {
      const s = loaded.shifts.find((x) => x.shiftId === shiftId)!;
      return {
        shiftId,
        label: loaded.labels.get(shiftId) ?? '',
        startAt: s.startAt,
        endAt: s.endAt,
        requiredVolunteers: s.requiredVolunteers,
        remainingSlots: s.remainingSlots,
        result: {
          ...result,
          excluded: result.excluded as Record<string, number>,
          picks: result.picks.map((p) => {
            const f = facts.get(p.memberId)!;
            return {
              ...p,
              softFlags: [...p.softFlags],
              member: {
                name: loaded.names.get(p.memberId) ?? `Member ${p.memberId}`,
                collegeCode: f.collegeCode,
                yearLevel: f.yearLevel,
                termHours: f.termHours,
                daysSinceLast: f.lastPastAssignmentDate ? daysBetween(f.lastPastAssignmentDate, s.today) : null,
                attended: f.attended,
                noShow: f.noShow,
              },
            };
          }),
        },
      };
    }),
  };
}

/** Picks only (shiftId, memberId, groupIndex, score) — the shape the assignment writer reads for outcome_json. */
const lastResultJson = (alloc: ShiftsAllocation) =>
  JSON.stringify({
    picks: alloc.perShift.flatMap(({ shiftId, result }) => result.picks.map((p) => ({ shiftId, memberId: p.memberId, groupIndex: p.groupIndex, score: p.score.total }))),
  });

/** Loads facts for the scope (9 statements) and runs the engine. */
async function rank(c: Context<AppEnv>, eventId: number, constraints: Constraints, pins: Pins, shiftIds: number[]): Promise<Ok<{ loaded: Loaded; alloc: ShiftsAllocation }> | Fail> {
  const loaded = await loadCandidates(getDb(c.env), eventId, { shiftIds });
  if (!loaded) return { ok: false, res: apiError(c, 404, 'NOT_FOUND', 'Event not found') };
  const bad = checkScope(c, loaded, shiftIds);
  if (bad) return bad;
  return { ok: true, loaded, alloc: allocateShifts(loaded.facts, constraints, pins, loaded.shifts) };
}

async function readTurns(c: Context<AppEnv>, sessionId: number): Promise<TurnDTO[]> {
  const rows = (
    await c.env.DB.prepare(
      `SELECT id, kind, user_message AS userMessage, reply, assumptions_json, provider, created_at AS createdAt FROM ai_turns WHERE session_id = ?1 ORDER BY id`,
    )
      .bind(sessionId)
      .all<Omit<TurnDTO, 'assumptions'> & { assumptions_json: string }>()
  ).results;
  return rows.map(({ assumptions_json, ...t }) => ({ ...t, assumptions: JSON.parse(assumptions_json) as string[] }));
}

async function sessionResponse(c: Context<AppEnv>, s: SessionRow): Promise<Response> {
  const { constraints, pins, scope } = parseSession(s);
  const loaded = await loadCandidates(getDb(c.env), s.event_id, { shiftIds: scope.shiftIds });
  if (!loaded) return apiError(c, 404, 'NOT_FOUND', 'Event not found');
  // Ended shifts drop out of a resumed session's scope rather than failing it.
  const live = loaded.shifts.filter((x) => x.endAt > x.now);
  const alloc = allocateShifts(loaded.facts, constraints, pins, live);
  const body: SessionResponse = {
    session: { id: s.id, eventId: s.event_id, status: s.status, constraints, pins, scope: { shiftIds: live.map((x) => x.shiftId) } },
    turns: await readTurns(c, s.id),
    result: toResult(loaded, alloc),
    eventVersion: loaded.event.version,
  };
  return c.json(body);
}

// POST /api/events/:id/ai-sessions — start or resume this adviser's open session (mounted on the events router).
export async function startSession(c: Context<AppEnv>, eventId: number): Promise<Response> {
  const D = c.env.DB;
  const actor = c.get('member')!.id;
  const loaded = await loadCandidates(getDb(c.env), eventId);
  if (!loaded) return apiError(c, 404, 'NOT_FOUND', 'Event not found');
  if (loaded.event.status !== 'draft' && loaded.event.status !== 'published') {
    return apiError(c, 409, 'CONFLICT', `AssignAI isn't available for a ${loaded.event.status} event`);
  }
  // App Flow §7.1: default scope = shifts that haven't ended and still have open slots.
  const scope = { shiftIds: loaded.shifts.filter((s) => s.endAt > s.now && s.remainingSlots > 0).map((s) => s.shiftId) };
  const now = new Date().toISOString();
  await D.prepare(
    `INSERT INTO ai_sessions (event_id, created_by, constraints_json, scope_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
     ON CONFLICT (event_id, created_by) WHERE status = 'open' DO NOTHING`,
  )
    .bind(eventId, actor, JSON.stringify(defaultConstraints()), JSON.stringify(scope), now)
    .run();
  const s = await D.prepare(`SELECT * FROM ai_sessions WHERE event_id = ?1 AND created_by = ?2 AND status = 'open'`).bind(eventId, actor).first<SessionRow>();
  return sessionResponse(c, s!);
}

export const aiSessions = new Hono<AppEnv>()
  .use(...requireAdviser)

  .get('/:id', validate('param', IdParam), async (c) => {
    const s = await c.env.DB.prepare(`SELECT * FROM ai_sessions WHERE id = ?1`).bind(c.req.valid('param').id).first<SessionRow>();
    const blocked = guardSession(c, s, false);
    return blocked ?? sessionResponse(c, s!);
  })

  .post('/:id/turns', validate('param', IdParam), validate('json', TurnInput), async (c) => {
    const { id } = c.req.valid('param');
    const { message, pins, scope } = c.req.valid('json');
    const actor = c.get('member')!.id;
    const D = c.env.DB;

    // 1 statement: reserve this turn under the hourly, daily and app-wide caps (only on the adviser's own open session),
    // returning the session, vocabulary and last 3 finished turns. One INSERT…SELECT is atomic in D1, so parallel requests
    // can't all slip under a cap, and a turn cut off mid-LLM-call still counts.
    const now = Date.now();
    const since = (ms: number) => new Date(now - ms).toISOString();
    const reserved = await D.prepare(
      `INSERT INTO ai_turns (session_id, created_by, kind, user_message, constraints_json, provider, error, created_at)
       SELECT s.id, ?2, 'clarify', ?3, '{}', 'none', '${UNFINISHED}', ?4 FROM ai_sessions s
       WHERE s.id = ?1 AND s.created_by = ?2 AND s.status = 'open'
         AND (SELECT COUNT(*) FROM ai_turns WHERE created_by = ?2 AND kind <> 'manual_edit' AND created_at > ?5)
             < COALESCE((SELECT CAST(value_json AS INTEGER) FROM settings WHERE key = 'ai.turnsPerHour'), ?6)
         AND (SELECT COUNT(*) FROM ai_turns WHERE created_by = ?2 AND kind <> 'manual_edit' AND created_at > ?7) < ?8
         AND (SELECT COUNT(*) FROM ai_turns WHERE kind <> 'manual_edit' AND created_at > ?7) < ?9
       RETURNING id,
         (SELECT json_object('id', id, 'event_id', event_id, 'created_by', created_by, 'status', status, 'constraints_json', constraints_json,
            'pins_json', pins_json, 'scope_json', scope_json) FROM ai_sessions WHERE id = ?1) AS session,
         (SELECT json_group_array(json_object('code', code, 'name', name)) FROM colleges WHERE active = 1) AS colleges,
         (SELECT json_group_array(json_object('u', user_message, 'r', reply)) FROM
            (SELECT user_message, reply FROM ai_turns WHERE session_id = ?1 AND user_message IS NOT NULL AND error IS NOT '${UNFINISHED}' ORDER BY id DESC LIMIT 3)) AS history`,
    )
      .bind(id, actor, message, since(0), since(3_600_000), SETTINGS_DEFAULTS['ai.turnsPerHour'], since(86_400_000), AI_TURNS_PER_DAY, AI_TURNS_PER_DAY_ALL)
      .first<{ id: number; session: string; colleges: string; history: string }>();
    if (!reserved) {
      // Error path only: say why (missing / not yours / closed), else it was a cap.
      const blocked = guardSession(c, await D.prepare(`SELECT * FROM ai_sessions WHERE id = ?1`).bind(id).first<SessionRow>(), true);
      return blocked ?? apiError(c, 429, 'AI_RATE_LIMITED', `You've reached the AssignAI limit (per hour, ${AI_TURNS_PER_DAY} a day, or the app-wide daily cap). Try again later.`);
    }
    const s = { ...(JSON.parse(reserved.session) as SessionRow), colleges: reserved.colleges, history: reserved.history };
    const session = parseSession(s);
    const unreserve = () => D.prepare(`DELETE FROM ai_turns WHERE id = ?1`).bind(reserved.id).run();

    // 9 statements: facts for the scope.
    const loaded = await loadCandidates(getDb(c.env), s.event_id, { shiftIds: scope.shiftIds });
    if (!loaded) {
      await unreserve();
      return apiError(c, 404, 'NOT_FOUND', 'Event not found');
    }
    const bad = checkScope(c, loaded, scope.shiftIds);
    if (bad) {
      await unreserve();
      return bad.res;
    }

    const colleges = JSON.parse(s!.colleges) as { code: string; name: string }[];
    const history = (JSON.parse(s!.history) as { u: string; r: string | null }[]).reverse().flatMap((t) => [
      { role: 'user' as const, content: t.u },
      ...(t.r ? [{ role: 'assistant' as const, content: t.r }] : []),
    ]);
    const ai = await interpret(
      c.get('aiProviders') ?? providersFromEnv(c.env),
      {
        vocab: buildVocabulary(colleges),
        shifts: loaded.shifts.map((x) => ({
          label: loaded.labels.get(x.shiftId) ?? `Shift ${x.shiftId}`,
          startAt: x.startAt,
          endAt: x.endAt,
          weekdays: [...new Set(segments(x.startAt, x.endAt).map((d) => DAY_NAMES[d.weekday - 1].slice(0, 3)))],
          required: x.requiredVolunteers,
          remaining: x.remainingSlots,
        })),
        totalShifts: loaded.totalShifts,
        constraints: session.constraints,
        history,
        message,
      },
      { vocabCodes: new Set(colleges.map((x) => x.code)), remainingByShift: loaded.shifts.map((x) => ({ label: loaded.labels.get(x.shiftId) ?? `Shift ${x.shiftId}`, remaining: x.remainingSlots })) },
    );
    // Only an `update` changes the card; clarify/answer/confirm keep the current constraints (rules 4–5).
    const constraints = ai.output.kind === 'update' ? ai.output.constraints : session.constraints;
    const alloc = allocateShifts(loaded.facts, constraints, pins, loaded.shifts);

    // 2 statements: complete the reserved turn, update the session. No assignment is written here.
    await D.batch([
      D.prepare(
        `UPDATE ai_turns SET kind = ?2, reply = ?3, assumptions_json = ?4, constraints_json = ?5, provider = ?6, model = ?7, latency_ms = ?8, error = ?9 WHERE id = ?1`,
      ).bind(reserved.id, ai.output.kind, ai.output.reply, JSON.stringify(ai.output.assumptions), JSON.stringify(constraints), ai.provider, ai.model ?? null, ai.latencyMs, ai.error ?? null),
      D.prepare(`UPDATE ai_sessions SET constraints_json = ?2, pins_json = ?3, scope_json = ?4, last_result_json = ?5, updated_at = ?6 WHERE id = ?1`).bind(
        id,
        JSON.stringify(constraints),
        JSON.stringify(pins),
        JSON.stringify(scope),
        lastResultJson(alloc),
        new Date().toISOString(),
      ),
    ]);
    const body: TurnResponse = {
      turn: { id: reserved.id, reply: ai.output.reply, kind: ai.output.kind, assumptions: ai.output.assumptions, provider: ai.provider },
      constraints,
      result: toResult(loaded, alloc),
      scope,
      eventVersion: loaded.event.version,
    };
    return c.json(body);
  })

  // Manual edit of the constraints card or scope → re-rank without the LLM (logged as a manual_edit turn).
  .put('/:id/constraints', validate('param', IdParam), validate('json', ConstraintsInput), async (c) => {
    const { id } = c.req.valid('param');
    const { constraints, pins, scope } = c.req.valid('json');
    const D = c.env.DB;
    const s = await D.prepare(`SELECT * FROM ai_sessions WHERE id = ?1`).bind(id).first<SessionRow>();
    const blocked = guardSession(c, s, true);
    if (blocked) return blocked;
    const ranked = await rank(c, s!.event_id, constraints, pins, scope.shiftIds);
    if (!ranked.ok) return ranked.res;
    const now = new Date().toISOString();
    const [inserted] = await D.batch([
      D.prepare(
        `INSERT INTO ai_turns (session_id, created_by, kind, constraints_json, provider, created_at) VALUES (?1, ?2, 'manual_edit', ?3, 'none', ?4) RETURNING id`,
      ).bind(id, c.get('member')!.id, JSON.stringify(constraints), now),
      D.prepare(`UPDATE ai_sessions SET constraints_json = ?2, pins_json = ?3, scope_json = ?4, last_result_json = ?5, updated_at = ?6 WHERE id = ?1`).bind(
        id,
        JSON.stringify(constraints),
        JSON.stringify(pins),
        JSON.stringify(scope),
        lastResultJson(ranked.alloc),
        now,
      ),
    ]);
    const body: TurnResponse = {
      turn: { id: (inserted.results as { id: number }[])[0].id, reply: '', kind: 'manual_edit', assumptions: [], provider: 'none' },
      constraints,
      result: toResult(ranked.loaded, ranked.alloc),
      scope,
      eventVersion: ranked.loaded.event.version,
    };
    return c.json(body);
  });
