import { and, gte, lte, ne } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

type Db = DrizzleD1Database<typeof schema>;
export type TermRow = typeof schema.terms.$inferSelect;

/** The term whose [start_date, end_date] contains `date` (YYYY-MM-DD, both bounds inclusive). */
export async function termForDate(db: Db, date: string): Promise<TermRow | null> {
  const t = schema.terms;
  return (await db.select().from(t).where(and(lte(t.startDate, date), gte(t.endDate, date))).get()) ?? null;
}

/** A term (other than `exceptId`) whose dates overlap [startDate, endDate], if any. */
export async function overlappingTerm(db: Db, startDate: string, endDate: string, exceptId?: number) {
  const t = schema.terms;
  return db
    .select({ id: t.id, name: t.name })
    .from(t)
    .where(and(lte(t.startDate, endDate), gte(t.endDate, startDate), exceptId ? ne(t.id, exceptId) : undefined))
    .get();
}
