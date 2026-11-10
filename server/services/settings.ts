import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

type Db = DrizzleD1Database<typeof schema>;

/** Settings keys and their value types (Backend Schema §6). */
export type SettingsMap = {
  'auth.allowedEmailDomain': string | null;
  'assignment.requireSchedule': boolean;
  'scoring.weights': { load: number; recency: number; reliability: number };
  'scoring.loadUnitHours': number;
  'ai.turnsPerHour': number;
  'schoolYear.startMonth': number;
};

export const SETTINGS_DEFAULTS: SettingsMap = {
  'auth.allowedEmailDomain': 'umindanao.edu.ph',
  'assignment.requireSchedule': true,
  'scoring.weights': { load: 3, recency: 1, reliability: 1 },
  'scoring.loadUnitHours': 4,
  'ai.turnsPerHour': 40,
  'schoolYear.startMonth': 8,
};

/** Reads one setting; falls back to the documented default when the row is missing. */
export async function getSetting<K extends keyof SettingsMap>(db: Db, key: K): Promise<SettingsMap[K]> {
  const row = await db
    .select({ valueJson: schema.settings.valueJson })
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .get();
  return row ? (JSON.parse(row.valueJson) as SettingsMap[K]) : SETTINGS_DEFAULTS[key];
}
