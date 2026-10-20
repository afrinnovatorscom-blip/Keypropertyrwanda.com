import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';

/**
 * Record an administrative action. Failures to write the audit log are
 * logged but do not break the main operation when outside a transaction.
 */
export async function audit(actor, action, entityType, entityId, details, conn) {
  const entry = {
    userId: actor?.id ?? null,
    action,
    entityType,
    entityId,
    details,
    ipAddress: actor?.ip ?? null,
    userAgent: actor?.userAgent ?? null,
  };
  if (conn) return AuditLog.create(entry, conn);
  try {
    await AuditLog.create(entry);
  } catch (error) {
    logger.error(`Failed to write audit log for ${action}`, error.message);
  }
}

/** Shallow diff of changed fields, for audit details. */
export function diff(before, after, keys) {
  const changes = {};
  for (const key of keys) {
    if (after[key] === undefined) continue;
    const a = before?.[key] instanceof Date ? before[key].toISOString() : before?.[key];
    const b = after[key] instanceof Date ? after[key].toISOString() : after[key];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) changes[key] = { from: a ?? null, to: b ?? null };
  }
  return changes;
}

export const listAuditLogs = (filters, page) => AuditLog.list({ ...filters, ...page });
export const auditFilterOptions = () => AuditLog.distinctValues();
