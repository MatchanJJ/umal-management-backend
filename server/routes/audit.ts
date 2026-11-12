import { Hono } from 'hono';
import { AuditQuery, type AuditItem } from '../../shared/api';
import type { AppEnv } from '../env';
import { requireAdviser } from '../middleware/auth';
import { validate } from '../validate';

/** Start of a Manila calendar day as the UTC ISO string audit rows are stored in. */
const manilaDayStart = (day: string, plusDays = 0) => new Date(Date.parse(`${day}T00:00:00+08:00`) + plusDays * 86_400_000).toISOString();

// FR-30 audit log (App Flow §9), newest first. `eventId` covers the event's own rows and its assignments' (Activity tab).
export const audit = new Hono<AppEnv>().get('/', ...requireAdviser, validate('query', AuditQuery), async (c) => {
  const D = c.env.DB;
  const q = c.req.valid('query');
  const binds: unknown[] = [];
  const p = (v: unknown) => (binds.push(v), `?${binds.length}`);
  const where: string[] = [];
  if (q.actor) where.push(`a.actor_id = ${p(q.actor)}`);
  if (q.action) where.push(`a.action = ${p(q.action)}`);
  if (q.entityType) where.push(`a.entity_type = ${p(q.entityType)}`);
  if (q.from) where.push(`a.created_at >= ${p(manilaDayStart(q.from))}`);
  if (q.to) where.push(`a.created_at < ${p(manilaDayStart(q.to, 1))}`);
  if (q.eventId) {
    const e = p(q.eventId);
    where.push(`((a.entity_type = 'event' AND a.entity_id = ${e}) OR json_extract(a.data_json, '$.eventId') = ${e})`);
  }
  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows, count] = await D.batch([
    D.prepare(
      `SELECT a.id, a.created_at AS createdAt, a.actor_id AS actorId,
              COALESCE(NULLIF(TRIM(COALESCE(m.first_name, '') || ' ' || COALESCE(m.last_name, '')), ''), m.email) AS actorName,
              a.action, a.entity_type AS entityType, a.entity_id AS entityId, a.data_json AS data
       FROM audit_log a LEFT JOIN members m ON m.id = a.actor_id ${filter}
       ORDER BY a.created_at DESC, a.id DESC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`, // validated integers
    ).bind(...binds),
    D.prepare(`SELECT COUNT(*) AS n FROM audit_log a ${filter}`).bind(...binds),
  ]);
  const items: AuditItem[] = (rows.results as (Omit<AuditItem, 'actor' | 'data'> & { actorId: number | null; actorName: string | null; data: string })[]).map(
    ({ actorId, actorName, data, ...r }) => ({ ...r, actor: actorId ? { id: actorId, name: actorName ?? `Member ${actorId}` } : null, data: JSON.parse(data) }),
  );
  return c.json({ items, total: (count.results[0] as { n: number }).n });
});
