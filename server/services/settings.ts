import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { SETTINGS_DEFAULTS, type Settings } from '../../shared/settings';
import * as schema from '../db/schema';

type Db = DrizzleD1Database<typeof schema>;

export { SETTINGS_DEFAULTS };
export type SettingsMap = Settings;

/** All settings, typed, with Schema §6 defaults for any missing row. */
export async function getSettings(db: Db): Promise<Settings> {
  const rows = await db.select().from(schema.settings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.valueJson)]));
  return Object.fromEntries(
    Object.entries(SETTINGS_DEFAULTS).map(([k, v]) => [k, k in stored ? stored[k] : v]),
  ) as Settings;
}

/** Reads one setting; falls back to the documented default when the row is missing. */
export async function getSetting<K extends keyof Settings>(db: Db, key: K): Promise<Settings[K]> {
  const row = await db
    .select({ valueJson: schema.settings.valueJson })
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .get();
  return row ? (JSON.parse(row.valueJson) as Settings[K]) : SETTINGS_DEFAULTS[key];
}
