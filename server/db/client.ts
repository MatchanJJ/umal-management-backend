import type { D1Database } from '@cloudflare/workers-types';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import type { Env } from '../env';
import * as schema from './schema';

/** Drizzle over D1; `$client` is the raw D1 binding for hand-written batches. */
export type Db = DrizzleD1Database<typeof schema> & { $client: D1Database };

export function getDb(env: Env): Db {
  return drizzle(env.DB, { schema });
}
