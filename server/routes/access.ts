import { count, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  AccessListQuery,
  ApproveInput,
  BulkAccessInput,
  RejectInput,
  type AccessRequestDTO,
  type BulkAccessResult,
} from '../../shared/api';
import { normalizeEmails } from '../../shared/emails';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { requireAdviser } from '../middleware/auth';
import { ensureMember } from '../services/access';
import { auditInsert } from '../services/audit';
import { validate } from '../validate';

const ar = schema.accessRequests;
const IdParam = z.object({ id: z.coerce.number().int().positive() });

function toDTO(r: typeof ar.$inferSelect): AccessRequestDTO {
  return {
    id: r.id,
    email: r.email,
    status: r.status,
    role: r.role,
    source: r.source,
    decidedBy: r.decidedBy,
    decidedAt: r.decidedAt,
    note: r.note,
    createdAt: r.createdAt,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const accessRequests = new Hono<AppEnv>()
  .use(...requireAdviser)

  .get('/', validate('query', AccessListQuery), async (c) => {
    const { status, page, pageSize } = c.req.valid('query');
    const db = getDb(c.env);
    const where = status ? eq(ar.status, status) : undefined;
    const [rows, totals] = await db.batch([
      db
        .select()
        .from(ar)
        .where(where)
        .orderBy(desc(ar.createdAt), desc(ar.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ n: count() }).from(ar).where(where),
    ]);
    return c.json({ items: rows.map(toDTO), total: totals[0]?.n ?? 0 });
  })

  .post('/bulk', validate('json', BulkAccessInput), async (c) => {
    const { emails, role } = c.req.valid('json');
    const actor = c.get('member')!;
    const db = getDb(c.env);
    const { valid, invalid } = normalizeEmails(emails);

    // D1 allows 100 bound parameters per statement, so look emails up in chunks.
    const lookups = chunk(valid, 90).map((part) =>
      db.select({ email: ar.email, status: ar.status }).from(ar).where(inArray(ar.email, part)),
    );
    const existing = lookups.length ? (await db.batch(lookups as [(typeof lookups)[0], ...typeof lookups])).flat() : [];
    const byEmail = new Map(existing.map((r) => [r.email.toLowerCase(), r.status]));
    const toApprove = valid.filter((e) => byEmail.get(e) !== 'approved');
    const result: BulkAccessResult = {
      created: toApprove.length,
      alreadyApproved: valid.length - toApprove.length,
      invalid,
    };

    if (toApprove.length) {
      const now = new Date().toISOString();
      const writes = toApprove.map((email) =>
        db
          .insert(ar)
          .values({ email, status: 'approved', role, source: 'bulk', decidedBy: actor.id, decidedAt: now, createdAt: now })
          .onConflictDoUpdate({
            target: ar.email,
            set: { status: 'approved', role, decidedBy: actor.id, decidedAt: now, note: null },
          }),
      );
      await db.batch([auditInsert(db, actor.id, 'access.bulk_approve', 'access_request', null, { role, ...result }), ...writes]);
      // Users who already signed in (were pending) get their member row now.
      for (const email of toApprove.filter((e) => byEmail.has(e))) await ensureMember(db, email, role);
    }
    return c.json(result);
  })

  .post('/:id/approve', validate('param', IdParam), validate('json', ApproveInput), async (c) => {
    const { id } = c.req.valid('param');
    const { role } = c.req.valid('json');
    const actor = c.get('member')!;
    const db = getDb(c.env);
    const req = await db.select().from(ar).where(eq(ar.id, id)).get();
    if (!req) return apiError(c, 404, 'NOT_FOUND', 'Access request not found');

    const now = new Date().toISOString();
    await db.batch([
      db.update(ar).set({ status: 'approved', role, decidedBy: actor.id, decidedAt: now }).where(eq(ar.id, id)),
      auditInsert(db, actor.id, 'access.approve', 'access_request', id, { email: req.email, role, from: req.status }),
    ]);
    await ensureMember(db, req.email, role);
    return c.json(toDTO({ ...req, status: 'approved', role, decidedBy: actor.id, decidedAt: now }));
  })

  .post('/:id/reject', validate('param', IdParam), validate('json', RejectInput), async (c) => {
    const { id } = c.req.valid('param');
    const { note } = c.req.valid('json');
    const actor = c.get('member')!;
    const db = getDb(c.env);
    const req = await db.select().from(ar).where(eq(ar.id, id)).get();
    if (!req) return apiError(c, 404, 'NOT_FOUND', 'Access request not found');

    const now = new Date().toISOString();
    await db.batch([
      db.update(ar).set({ status: 'rejected', decidedBy: actor.id, decidedAt: now, note: note ?? null }).where(eq(ar.id, id)),
      auditInsert(db, actor.id, 'access.reject', 'access_request', id, { email: req.email, from: req.status }),
    ]);
    return c.json(toDTO({ ...req, status: 'rejected', decidedBy: actor.id, decidedAt: now, note: note ?? null }));
  });
