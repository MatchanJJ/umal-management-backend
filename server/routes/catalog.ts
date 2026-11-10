import { asc, eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { CatalogResponse } from '../../shared/profile';
import { CollegeInput, CollegePatch, CourseInput, CoursePatch } from '../../shared/settings';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { requireAdviser, requireApproved, requireSession } from '../middleware/auth';
import { auditInsert } from '../services/audit';
import { validate } from '../validate';

const IdParam = z.object({ id: z.coerce.number().int().positive() });
const ListQuery = z.object({ all: z.literal('1').optional() });

function isUnique(e: unknown) {
  return String((e as Error)?.cause ?? e).includes('UNIQUE');
}

function conflict(c: Context<AppEnv>) {
  return apiError(c, 409, 'CONFLICT', 'That code is already used', { field: 'code' });
}

// Read is open to approved-but-not-onboarded users: the onboarding form needs it.
// `?all=1` (advisers only) includes inactive rows so they can be re-activated.
export const catalog = new Hono<AppEnv>()
  .get('/', requireSession, requireApproved, validate('query', ListQuery), async (c) => {
    const all = c.req.valid('query').all === '1';
    if (all && c.get('member')!.role !== 'adviser') return apiError(c, 403, 'FORBIDDEN', 'Advisers only');
    const db = getDb(c.env);
    const [colleges, courses] = await db.batch([
      db.select().from(schema.colleges).where(all ? undefined : eq(schema.colleges.active, true)).orderBy(asc(schema.colleges.code)),
      db.select().from(schema.courses).where(all ? undefined : eq(schema.courses.active, true)).orderBy(asc(schema.courses.code)),
    ]);
    const body: CatalogResponse = {
      colleges: colleges.map((col) => ({
        id: col.id,
        code: col.code,
        name: col.name,
        active: col.active,
        courses: courses
          .filter((k) => k.collegeId === col.id)
          .map(({ id, code, name, active }) => ({ id, code, name, active })),
      })),
    };
    return c.json(body);
  })

  .post('/colleges', ...requireAdviser, validate('json', CollegeInput), async (c) => {
    const input = c.req.valid('json');
    const db = getDb(c.env);
    try {
      const [row] = await db.insert(schema.colleges).values({ ...input, createdAt: new Date().toISOString() }).returning();
      await auditInsert(db, c.get('member')!.id, 'catalog.update', 'catalog', row.id, { college: input });
      return c.json(row, 201);
    } catch (e) {
      if (isUnique(e)) return conflict(c);
      throw e;
    }
  })

  .patch('/colleges/:id', ...requireAdviser, validate('param', IdParam), validate('json', CollegePatch), async (c) => {
    const { id } = c.req.valid('param');
    const patch = c.req.valid('json');
    const db = getDb(c.env);
    try {
      const [rows] = await db.batch([
        db.update(schema.colleges).set(patch).where(eq(schema.colleges.id, id)).returning(),
        auditInsert(db, c.get('member')!.id, 'catalog.update', 'catalog', id, { college: patch }),
      ]);
      if (!rows[0]) return apiError(c, 404, 'NOT_FOUND', 'College not found');
      return c.json(rows[0]);
    } catch (e) {
      if (isUnique(e)) return conflict(c);
      throw e;
    }
  })

  .post('/courses', ...requireAdviser, validate('json', CourseInput), async (c) => {
    const input = c.req.valid('json');
    const db = getDb(c.env);
    if (!(await db.select({ id: schema.colleges.id }).from(schema.colleges).where(eq(schema.colleges.id, input.collegeId)).get())) {
      return apiError(c, 422, 'VALIDATION', 'College not found', { field: 'collegeId' });
    }
    try {
      const [row] = await db.insert(schema.courses).values({ ...input, createdAt: new Date().toISOString() }).returning();
      await auditInsert(db, c.get('member')!.id, 'catalog.update', 'catalog', row.id, { course: input });
      return c.json(row, 201);
    } catch (e) {
      if (isUnique(e)) return conflict(c);
      throw e;
    }
  })

  .patch('/courses/:id', ...requireAdviser, validate('param', IdParam), validate('json', CoursePatch), async (c) => {
    const { id } = c.req.valid('param');
    const patch = c.req.valid('json');
    const db = getDb(c.env);
    try {
      const [rows] = await db.batch([
        db.update(schema.courses).set(patch).where(eq(schema.courses.id, id)).returning(),
        auditInsert(db, c.get('member')!.id, 'catalog.update', 'catalog', id, { course: patch }),
      ]);
      if (!rows[0]) return apiError(c, 404, 'NOT_FOUND', 'Course not found');
      return c.json(rows[0]);
    } catch (e) {
      if (isUnique(e)) return conflict(c);
      throw e;
    }
  });
