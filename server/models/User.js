import { executor } from '../config/database.js';
import { buildSet, likeTerm } from './helpers.js';

const PUBLIC_COLUMNS = `u.id, u.role_id, u.full_name, u.email, u.phone, u.status, u.failed_login_attempts,
  u.locked_until, u.last_login_at, u.password_changed_at, u.created_at, u.updated_at,
  r.name AS role_name, r.slug AS role_slug`;

const map = (r) => ({
  id: r.id,
  fullName: r.full_name,
  email: r.email,
  phone: r.phone,
  status: r.status,
  role: { id: r.role_id, name: r.role_name, slug: r.role_slug },
  lockedUntil: r.locked_until,
  lastLoginAt: r.last_login_at,
  passwordChangedAt: r.password_changed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const User = {
  async findById(id, conn) {
    const [rows] = await executor(conn).query(
      `SELECT ${PUBLIC_COLUMNS} FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
      [id],
    );
    return rows[0] ? map(rows[0]) : null;
  },

  /** Includes the password hash — only for authentication flows. */
  async findAuthByEmail(email, conn) {
    const [rows] = await executor(conn).query(
      `SELECT ${PUBLIC_COLUMNS}, u.password_hash FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ?`,
      [email],
    );
    if (!rows[0]) return null;
    return { ...map(rows[0]), passwordHash: rows[0].password_hash };
  },

  async findPasswordHash(id, conn) {
    const [rows] = await executor(conn).query('SELECT password_hash FROM users WHERE id = ?', [id]);
    return rows[0]?.password_hash ?? null;
  },

  async list({ search, roleId, status, limit, offset }, conn) {
    const where = [];
    const params = [];
    if (search) {
      where.push('(u.full_name LIKE ? OR u.email LIKE ?)');
      params.push(likeTerm(search), likeTerm(search));
    }
    if (roleId) {
      where.push('u.role_id = ?');
      params.push(roleId);
    }
    if (status) {
      where.push('u.status = ?');
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const db = executor(conn);
    const [rows] = await db.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users u JOIN roles r ON r.id = u.role_id ${whereSql}
       ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM users u ${whereSql}`, params);
    return { rows: rows.map(map), total: Number(total) };
  },

  /** Minimal list of active staff (for inquiry assignment pickers). */
  async listActiveStaff(conn) {
    const [rows] = await executor(conn).query(
      "SELECT id, full_name FROM users WHERE status = 'active' ORDER BY full_name",
    );
    return rows.map((r) => ({ id: r.id, fullName: r.full_name }));
  },

  async create({ roleId, fullName, email, phone, passwordHash, status = 'active' }, conn) {
    const [result] = await executor(conn).query(
      `INSERT INTO users (role_id, full_name, email, phone, password_hash, status, password_changed_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [roleId, fullName, email, phone ?? null, passwordHash, status],
    );
    return result.insertId;
  },

  async update(id, data, conn) {
    const set = buildSet(
      { roleId: 'role_id', fullName: 'full_name', email: 'email', phone: 'phone', status: 'status' },
      data,
    );
    if (!set) return;
    await executor(conn).query(`UPDATE users SET ${set.sql} WHERE id = ?`, [...set.params, id]);
  },

  async updatePassword(id, passwordHash, conn) {
    await executor(conn).query(
      `UPDATE users SET password_hash = ?, password_changed_at = NOW(), failed_login_attempts = 0, locked_until = NULL
       WHERE id = ?`,
      [passwordHash, id],
    );
  },

  async recordLoginSuccess(id, conn) {
    await executor(conn).query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?',
      [id],
    );
  },

  /** Increment failures and lock the account for `lockMinutes` once `maxAttempts` is reached. */
  async recordLoginFailure(id, maxAttempts, lockMinutes, conn) {
    await executor(conn).query(
      `UPDATE users SET
         locked_until = IF(failed_login_attempts + 1 >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), locked_until),
         failed_login_attempts = IF(failed_login_attempts + 1 >= ?, 0, failed_login_attempts + 1)
       WHERE id = ?`,
      [maxAttempts, lockMinutes, maxAttempts, id],
    );
  },

  async countActiveWithRole(roleSlug, conn) {
    const [[row]] = await executor(conn).query(
      "SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.role_id WHERE r.slug = ? AND u.status = 'active'",
      [roleSlug],
    );
    return Number(row.n);
  },

  async emailExists(email, excludeId = 0, conn) {
    const [rows] = await executor(conn).query('SELECT id FROM users WHERE email = ? AND id <> ?', [email, excludeId]);
    return rows.length > 0;
  },
};

export default User;
