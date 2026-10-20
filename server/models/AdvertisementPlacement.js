import { executor } from '../config/database.js';
import { bool } from './helpers.js';

const map = (r) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description,
  isActive: bool(r.is_active),
  maxItems: r.max_items,
});

export const AdvertisementPlacement = {
  async findAll(conn) {
    const [rows] = await executor(conn).query('SELECT * FROM advertisement_placements ORDER BY id');
    return rows.map(map);
  },

  async findById(id, conn) {
    const [rows] = await executor(conn).query('SELECT * FROM advertisement_placements WHERE id = ?', [id]);
    return rows[0] ? map(rows[0]) : null;
  },

  async findBySlug(slug, conn) {
    const [rows] = await executor(conn).query('SELECT * FROM advertisement_placements WHERE slug = ?', [slug]);
    return rows[0] ? map(rows[0]) : null;
  },

  async upsert({ slug, name, description, maxItems = 5 }, conn) {
    await executor(conn).query(
      `INSERT INTO advertisement_placements (slug, name, description, max_items) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
      [slug, name, description ?? null, maxItems],
    );
  },
};

export default AdvertisementPlacement;
