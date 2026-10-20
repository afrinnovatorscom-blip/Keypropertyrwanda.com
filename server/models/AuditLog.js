import { executor } from '../config/database.js';
import { likeTerm } from './helpers.js';

const map = (r) => {
  let details = null;
  if (r.details) {
    try {
      details = JSON.parse(r.details);
    } catch {
      details = r.details;
    }
  }
  return {
    id: Number(r.id),
    user: r.user_id ? { id: r.user_id, fullName: r.full_name, email: r.email } : null,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    details,
    ipAddress: r.ip_address,
    userAgent: r.user_agent,
    createdAt: r.created_at,
  };
};

export const AuditLog = {
  async create({ userId, action, entityType, entityId, details, ipAddress, userAgent }, conn) {
    await executor(conn).query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId ?? null,
        action,
        entityType ?? null,
        entityId !== undefined && entityId !== null ? String(entityId) : null,
        details === undefined ? null : JSON.stringify(details),
        ipAddress ?? null,
        userAgent ? String(userAgent).slice(0, 255) : null,
      ],
    );
  },

  async list({ userId, action, entityType, entityId, search, from, to, limit, offset }, conn) {
    const where = [];
    const params = [];
    if (userId) { where.push('a.user_id = ?'); params.push(userId); }
    if (action) { where.push('a.action = ?'); params.push(action); }
    if (entityType) { where.push('a.entity_type = ?'); params.push(entityType); }
    if (entityId) { where.push('a.entity_id = ?'); params.push(String(entityId)); }
    if (from) { where.push('a.created_at >= ?'); params.push(from); }
    if (to) { where.push('a.created_at < ?'); params.push(to); }
    if (search) {
      where.push('(a.action LIKE ? OR a.details LIKE ? OR u.email LIKE ?)');
      params.push(likeTerm(search), likeTerm(search), likeTerm(search));
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const db = executor(conn);
    const [rows] = await db.query(
      `SELECT a.*, u.full_name, u.email FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
       ${whereSql} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ${whereSql}`,
      params,
    );
    return { rows: rows.map(map), total: Number(total) };
  },

  async distinctValues(conn) {
    const db = executor(conn);
    const [actions] = await db.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
    const [entities] = await db.query(
      'SELECT DISTINCT entity_type FROM audit_logs WHERE entity_type IS NOT NULL ORDER BY entity_type',
    );
    return { actions: actions.map((r) => r.action), entityTypes: entities.map((r) => r.entity_type) };
  },
};

export default AuditLog;
