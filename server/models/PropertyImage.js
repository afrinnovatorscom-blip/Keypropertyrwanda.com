import { executor } from '../config/database.js';
import { uploadUrl } from './helpers.js';

const map = (r) => ({
  id: r.id,
  propertyId: r.property_id,
  url: uploadUrl(r.file_path),
  filePath: r.file_path,
  altText: r.alt_text,
  sortOrder: r.sort_order,
  originalName: r.original_name,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  createdAt: r.created_at,
});

export const PropertyImage = {
  /** Images in display order; the first one is the main image. */
  async listForProperty(propertyId, conn) {
    const [rows] = await executor(conn).query(
      'SELECT * FROM property_images WHERE property_id = ? ORDER BY sort_order, id',
      [propertyId],
    );
    return rows.map(map);
  },

  async findById(id, conn) {
    const [rows] = await executor(conn).query('SELECT * FROM property_images WHERE id = ?', [id]);
    return rows[0] ? map(rows[0]) : null;
  },

  async count(propertyId, conn) {
    const [[row]] = await executor(conn).query('SELECT COUNT(*) AS n FROM property_images WHERE property_id = ?', [
      propertyId,
    ]);
    return Number(row.n);
  },

  async nextSortOrder(propertyId, conn) {
    const [[row]] = await executor(conn).query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM property_images WHERE property_id = ?',
      [propertyId],
    );
    return Number(row.next);
  },

  async create({ propertyId, filePath, originalName, mimeType, sizeBytes, altText, sortOrder }, conn) {
    const [result] = await executor(conn).query(
      `INSERT INTO property_images (property_id, file_path, original_name, mime_type, size_bytes, alt_text, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [propertyId, filePath, originalName ?? null, mimeType ?? null, sizeBytes ?? null, altText ?? null, sortOrder],
    );
    return result.insertId;
  },

  async updateAltText(id, altText, conn) {
    await executor(conn).query('UPDATE property_images SET alt_text = ? WHERE id = ?', [altText ?? null, id]);
  },

  /** Persist a new order. `orderedIds` must contain exactly the property's image ids. */
  async reorder(propertyId, orderedIds, conn) {
    const db = executor(conn);
    for (let i = 0; i < orderedIds.length; i += 1) {
      await db.query('UPDATE property_images SET sort_order = ? WHERE id = ? AND property_id = ?', [
        i,
        orderedIds[i],
        propertyId,
      ]);
    }
  },

  async delete(id, conn) {
    await executor(conn).query('DELETE FROM property_images WHERE id = ?', [id]);
  },
};

export default PropertyImage;
