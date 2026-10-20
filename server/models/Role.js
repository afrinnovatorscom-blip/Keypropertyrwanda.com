import { executor } from '../config/database.js';
import { bool } from './helpers.js';

const map = (r) => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  isSystem: bool(r.is_system),
  userCount: r.user_count !== undefined ? Number(r.user_count) : undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const Role = {
  async findAll(conn) {
    const db = executor(conn);
    const [rows] = await db.query(
      `SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
       FROM roles r ORDER BY r.is_system DESC, r.id`,
    );
    const [links] = await db.query(
      'SELECT rp.role_id, p.slug FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id',
    );
    return rows.map((r) => ({
      ...map(r),
      permissions: links.filter((l) => l.role_id === r.id).map((l) => l.slug),
    }));
  },

  async findById(id, conn) {
    const [rows] = await executor(conn).query(
      'SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count FROM roles r WHERE r.id = ?',
      [id],
    );
    if (!rows[0]) return null;
    return { ...map(rows[0]), permissions: await Role.getPermissionSlugs(id, conn) };
  },

  async findBySlug(slug, conn) {
    const [rows] = await executor(conn).query('SELECT * FROM roles WHERE slug = ?', [slug]);
    return rows[0] ? map(rows[0]) : null;
  },

  async getPermissionSlugs(roleId, conn) {
    const [rows] = await executor(conn).query(
      `SELECT p.slug FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ? ORDER BY p.slug`,
      [roleId],
    );
    return rows.map((r) => r.slug);
  },

  async create({ name, slug, description, isSystem = false }, conn) {
    const [result] = await executor(conn).query(
      'INSERT INTO roles (name, slug, description, is_system) VALUES (?, ?, ?, ?)',
      [name, slug, description ?? null, isSystem ? 1 : 0],
    );
    return result.insertId;
  },

  async update(id, { name, description }, conn) {
    await executor(conn).query('UPDATE roles SET name = COALESCE(?, name), description = ? WHERE id = ?', [
      name ?? null,
      description ?? null,
      id,
    ]);
  },

  async delete(id, conn) {
    await executor(conn).query('DELETE FROM roles WHERE id = ? AND is_system = 0', [id]);
  },

  async nameOrSlugExists(name, slug, excludeId = 0, conn) {
    const [rows] = await executor(conn).query('SELECT id FROM roles WHERE (name = ? OR slug = ?) AND id <> ?', [
      name,
      slug,
      excludeId,
    ]);
    return rows.length > 0;
  },

  /** Replace the permission set of a role. Call inside a transaction. */
  async setPermissions(roleId, permissionIds, conn) {
    const db = executor(conn);
    await db.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    if (permissionIds.length) {
      await db.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [
        permissionIds.map((pid) => [roleId, pid]),
      ]);
    }
  },

  async addPermissions(roleId, permissionIds, conn) {
    if (!permissionIds.length) return;
    await executor(conn).query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES ?', [
      permissionIds.map((pid) => [roleId, pid]),
    ]);
  },
};

export default Role;
