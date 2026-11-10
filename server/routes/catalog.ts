import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { CatalogResponse } from '../../shared/profile';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import type { AppEnv } from '../env';
import { requireApproved, requireSession } from '../middleware/auth';

// Read is open to approved-but-not-onboarded users: the onboarding form needs it. Task 2.1 adds adviser CRUD.
export const catalog = new Hono<AppEnv>().get('/', requireSession, requireApproved, async (c) => {
  const db = getDb(c.env);
  const [colleges, courses] = await db.batch([
    db.select().from(schema.colleges).where(eq(schema.colleges.active, true)).orderBy(asc(schema.colleges.code)),
    db.select().from(schema.courses).where(eq(schema.courses.active, true)).orderBy(asc(schema.courses.code)),
  ]);
  const body: CatalogResponse = {
    colleges: colleges.map((col) => ({
      id: col.id,
      code: col.code,
      name: col.name,
      courses: courses.filter((k) => k.collegeId === col.id).map(({ id, code, name }) => ({ id, code, name })),
    })),
  };
  return c.json(body);
});
