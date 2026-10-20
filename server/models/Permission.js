import { executor } from '../config/database.js';

const map = (r) => ({ id: r.id, slug: r.slug, name: r.name, module: r.module, description: r.description });

export const Permission = {
  async findAll(conn) {
    const [rows] = await executor(conn).query('SELECT * FROM permissions ORDER BY module, id');
    return rows.map(map);
  },

  async findBySlugs(slugs, conn) {
    if (!slugs.length) return [];
    const [rows] = await executor(conn).query('SELECT * FROM permissions WHERE slug IN (?)', [slugs]);
    return rows.map(map);
  },

  /** Insert or refresh catalog entries. */
  async upsertMany(permissions, conn) {
    for (const p of permissions) {
      await executor(conn).query(
        `INSERT INTO permissions (slug, name, module, description) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), module = VALUES(module), description = VALUES(description)`,
        [p.slug, p.name, p.module, p.description ?? null],
      );
    }
  },
};

export default Permission;
