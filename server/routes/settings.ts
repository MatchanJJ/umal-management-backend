import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { SettingsPatch } from '../../shared/settings';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import type { AppEnv } from '../env';
import { requireAdviser } from '../middleware/auth';
import { auditInsert } from '../services/audit';
import { getSettings } from '../services/settings';
import { validate } from '../validate';

export const settings = new Hono<AppEnv>()
  .get('/', ...requireAdviser, async (c) => c.json(await getSettings(getDb(c.env))))

  .put('/', ...requireAdviser, validate('json', SettingsPatch), async (c) => {
    const patch = c.req.valid('json');
    const actor = c.get('member')!;
    const db = getDb(c.env);
    const now = new Date().toISOString();
    const writes = Object.entries(patch).map(([key, value]) =>
      db
        .insert(schema.settings)
        .values({ key, valueJson: JSON.stringify(value), updatedBy: actor.id, updatedAt: now })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { valueJson: sql`excluded.value_json`, updatedBy: actor.id, updatedAt: now },
        }),
    );
    await db.batch([auditInsert(db, actor.id, 'settings.update', 'settings', null, patch), ...writes]);
    return c.json(await getSettings(db));
  });
