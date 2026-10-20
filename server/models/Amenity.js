import { executor } from '../config/database.js';
import { slugify } from '../utils/slugify.js';

export const Amenity = {
  async findAll(conn) {
    const [rows] = await executor(conn).query(
      `SELECT a.id, a.name, a.slug, COUNT(pa.property_id) AS usage_count
       FROM amenities a LEFT JOIN property_amenities pa ON pa.amenity_id = a.id
       GROUP BY a.id ORDER BY a.name`,
    );
    return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, usageCount: Number(r.usage_count) }));
  },

  /** Ensure amenities exist for the given names and return their ids (deduplicated by slug). */
  async findOrCreateByNames(names, conn) {
    const db = executor(conn);
    const unique = new Map();
    for (const raw of names) {
      const name = String(raw).trim().replace(/\s+/g, ' ');
      const slug = slugify(name, 90);
      if (name && slug && !unique.has(slug)) unique.set(slug, name);
    }
    if (!unique.size) return [];
    await db.query('INSERT IGNORE INTO amenities (name, slug) VALUES ?', [
      [...unique.entries()].map(([slug, name]) => [name.slice(0, 80), slug]),
    ]);
    const [rows] = await db.query('SELECT id FROM amenities WHERE slug IN (?)', [[...unique.keys()]]);
    return rows.map((r) => r.id);
  },

  async setForProperty(propertyId, amenityIds, conn) {
    const db = executor(conn);
    await db.query('DELETE FROM property_amenities WHERE property_id = ?', [propertyId]);
    if (amenityIds.length) {
      await db.query('INSERT IGNORE INTO property_amenities (property_id, amenity_id) VALUES ?', [
        amenityIds.map((id) => [propertyId, id]),
      ]);
    }
  },

  async namesForProperty(propertyId, conn) {
    const [rows] = await executor(conn).query(
      `SELECT a.name FROM property_amenities pa JOIN amenities a ON a.id = pa.amenity_id
       WHERE pa.property_id = ? ORDER BY a.name`,
      [propertyId],
    );
    return rows.map((r) => r.name);
  },
};

export default Amenity;
