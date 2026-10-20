import { executor } from '../config/database.js';

const map = (r) => ({
  id: r.id,
  key: r.content_key,
  title: r.title,
  body: r.body,
  description: r.description,
  updatedBy: r.updated_by ? { id: r.updated_by, fullName: r.full_name } : null,
  updatedAt: r.updated_at,
});

export const WebsiteContent = {
  async findAll(conn) {
    const [rows] = await executor(conn).query(
      `SELECT w.*, u.full_name FROM website_content w LEFT JOIN users u ON u.id = w.updated_by ORDER BY w.content_key`,
    );
    return rows.map(map);
  },

  async findByKey(key, conn) {
    const [rows] = await executor(conn).query(
      'SELECT w.*, u.full_name FROM website_content w LEFT JOIN users u ON u.id = w.updated_by WHERE w.content_key = ?',
      [key],
    );
    return rows[0] ? map(rows[0]) : null;
  },

  async findByKeys(keys, conn) {
    if (!keys.length) return [];
    const [rows] = await executor(conn).query(
      'SELECT w.*, NULL AS full_name FROM website_content w WHERE w.content_key IN (?)',
      [keys],
    );
    return rows.map(map);
  },

  async upsert({ key, title, body, description, userId }, conn) {
    await executor(conn).query(
      `INSERT INTO website_content (content_key, title, body, description, updated_by) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body),
         description = COALESCE(VALUES(description), description), updated_by = VALUES(updated_by)`,
      [key, title ?? null, body ?? null, description ?? null, userId ?? null],
    );
  },

  /** Insert only if missing (used by the seeder so edits are never overwritten). */
  async insertIfMissing({ key, title, body, description }, conn) {
    await executor(conn).query(
      'INSERT IGNORE INTO website_content (content_key, title, body, description) VALUES (?, ?, ?, ?)',
      [key, title ?? null, body ?? null, description ?? null],
    );
  },
};

export default WebsiteContent;
