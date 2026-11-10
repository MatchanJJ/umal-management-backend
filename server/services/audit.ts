import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { AuditAction } from '../../shared/enums';
import * as schema from '../db/schema';

type Db = DrizzleD1Database<typeof schema>;

export type EntityType = 'event' | 'assignment' | 'member' | 'access_request' | 'term' | 'settings' | 'catalog';

/** Builds an audit_log insert so callers can put it in the same db.batch as the change it records. */
export function auditInsert(
  db: Db,
  actorId: number | null,
  action: AuditAction,
  entityType: EntityType,
  entityId: number | null,
  data: Record<string, unknown> = {},
) {
  return db.insert(schema.auditLog).values({
    actorId,
    action,
    entityType,
    entityId,
    dataJson: JSON.stringify(data),
    createdAt: new Date().toISOString(),
  });
}
