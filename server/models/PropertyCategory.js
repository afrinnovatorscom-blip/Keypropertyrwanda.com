import { executor } from '../config/database.js';
import { bool, buildSet } from './helpers.js';

const map = (r) => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  typeGroup: r.type_group,
  description: r.description,
  isActive: bool(r.is_active),
  sortOrder: r.sort_order,
  propertyCount: r.property_count !== undefined ? Number(r.property_count) : undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const PropertyCategory = {
  /** All categories with total property counts (admin). */
  async findAll(conn) {
    const [rows] = await executor(conn).query(
      `SELECT c.*, (SELECT COUNT(*) FROM properties p WHERE p.category_id = c.id) AS property_count
       FROM property_categories c ORDER BY c.sort_order, c.name`,
    );
    return rows.map(map);
  },

  /** Active categories with counts of currently published listings (public). */
  async findActiveWithPublicCounts(conn) {
    const [rows] = await executor(conn).query(
      `SELECT c.*, (
         SELECT COUNT(*) FROM properties p
         WHERE p.category_id = c.id AND p.publication_status = 'published' AND p.availability_status <> 'unavailable'
       ) AS property_count
       FROM property_categories c WHERE c.is_active = 1 ORDER BY c.sort_order, c.name`,
    );
    return rows.map(map);
  },

  async findById(id, conn) {
    const [rows] = await executor(conn).query('SELECT * FROM property_categories WHERE id = ?', [id]);
    return rows[0] ? map(rows[0]) : null;
  },

  async findBySlug(slug, conn) {
    const [rows] = await executor(conn).query('SELECT * FROM property_categories WHERE slug = ?', [slug]);
    return rows[0] ? map(rows[0]) : null;
  },

  async slugExists(slug, excludeId = 0, conn) {
    const [rows] = await executor(conn).query('SELECT id FROM property_categories WHERE slug = ? AND id <> ?', [
      slug,
      excludeId,
    ]);
    return rows.length > 0;
  },

  async nameExists(name, excludeId = 0, conn) {
    const [rows] = await executor(conn).query('SELECT id FROM property_categories WHERE name = ? AND id <> ?', [
      name,
      excludeId,
    ]);
    return rows.length > 0;
  },

  async create({ name, slug, typeGroup, description, isActive = true, sortOrder = 0 }, conn) {
    const [result] = await executor(conn).query(
      `INSERT INTO property_categories (name, slug, type_group, description, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, slug, typeGroup, description ?? null, isActive ? 1 : 0, sortOrder],
    );
    return result.insertId;
  },

  async update(id, data, conn) {
    const payload = { ...data };
    if (payload.isActive !== undefined) payload.isActive = payload.isActive ? 1 : 0;
    const set = buildSet(
      {
        name: 'name',
        slug: 'slug',
        typeGroup: 'type_group',
        description: 'description',
        isActive: 'is_active',
        sortOrder: 'sort_order',
      },
      payload,
    );
    if (!set) return;
    await executor(conn).query(`UPDATE property_categories SET ${set.sql} WHERE id = ?`, [...set.params, id]);
  },

  async countProperties(id, conn) {
    const [[row]] = await executor(conn).query('SELECT COUNT(*) AS n FROM properties WHERE category_id = ?', [id]);
    return Number(row.n);
  },

  async delete(id, conn) {
    await executor(conn).query('DELETE FROM property_categories WHERE id = ?', [id]);
  },
};

export default PropertyCategory;
