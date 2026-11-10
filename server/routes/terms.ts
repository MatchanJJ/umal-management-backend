import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { TermInput, TermPatch } from '../../shared/settings';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { requireAdviser, requireMember } from '../middleware/auth';
import { auditInsert } from '../services/audit';
import { overlappingTerm } from '../services/terms';
import { validate } from '../validate';
import { toTermDTO } from './me';

const t = schema.terms;
const IdParam = z.object({ id: z.coerce.number().int().positive() });

export const terms = new Hono<AppEnv>()
  .get('/', ...requireMember, async (c) => {
    const rows = await getDb(c.env).select().from(t).orderBy(asc(t.startDate));
    return c.json(rows.map(toTermDTO));
  })

  .post('/', ...requireAdviser, validate('json', TermInput), async (c) => {
    const input = c.req.valid('json');
    const db = getDb(c.env);
    const clash = await overlappingTerm(db, input.startDate, input.endDate);
    if (clash) return apiError(c, 422, 'VALIDATION', `Overlaps ${clash.name}`, { field: 'startDate' });
    if (await db.select({ id: t.id }).from(t).where(eq(t.name, input.name)).get()) {
      return apiError(c, 409, 'CONFLICT', 'A term with this name already exists', { field: 'name' });
    }
    const [row] = await db.insert(t).values({ ...input, createdAt: new Date().toISOString() }).returning();
    await auditInsert(db, c.get('member')!.id, 'term.create', 'term', row.id, input);
    return c.json(toTermDTO(row), 201);
  })

  .patch('/:id', ...requireAdviser, validate('param', IdParam), validate('json', TermPatch), async (c) => {
    const { id } = c.req.valid('param');
    const patch = c.req.valid('json');
    const db = getDb(c.env);
    const current = await db.select().from(t).where(eq(t.id, id)).get();
    if (!current) return apiError(c, 404, 'NOT_FOUND', 'Term not found');
    const next = { ...current, ...patch };
    if (next.startDate >= next.endDate) {
      return apiError(c, 422, 'VALIDATION', 'End date must be after the start date', { field: 'endDate' });
    }
    const clash = await overlappingTerm(db, next.startDate, next.endDate, id);
    if (clash) return apiError(c, 422, 'VALIDATION', `Overlaps ${clash.name}`, { field: 'startDate' });
    // Schema §5 lists no audit action for term edits, so none is written.
    const [row] = await db.update(t).set(patch).where(eq(t.id, id)).returning();
    return c.json(toTermDTO(row));
  })

  .post('/:id/activate', ...requireAdviser, validate('param', IdParam), async (c) => {
    const { id } = c.req.valid('param');
    const db = getDb(c.env);
    if (!(await db.select({ id: t.id }).from(t).where(eq(t.id, id)).get())) {
      return apiError(c, 404, 'NOT_FOUND', 'Term not found');
    }
    // One batch: the partial unique index allows only one active term at a time.
    const [, , [row]] = await db.batch([
      db.update(t).set({ isActive: false }).where(eq(t.isActive, true)),
      auditInsert(db, c.get('member')!.id, 'term.activate', 'term', id),
      db.update(t).set({ isActive: true }).where(eq(t.id, id)).returning(),
    ]);
    return c.json(toTermDTO(row));
  });
