import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import type { Env } from '../env';
import * as schema from './schema';

export function getDb(env: Env): DrizzleD1Database<typeof schema> {
  return drizzle(env.DB, { schema });
}
