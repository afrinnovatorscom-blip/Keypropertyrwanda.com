import { executor } from '../config/database.js';
import { bool, buildSet, uploadUrl } from './helpers.js';

const map = (r) => ({
  id: r.id,
  title: r.title,
  subtitle: r.subtitle,
  backgroundImage: uploadUrl(r.background_image),
  backgroundImagePath: r.background_image,
  buttonLabel: r.button_label,
  buttonUrl: r.button_url,
  overlayOpacity: r.overlay_opacity,
  textAlign: r.text_align,
  displayOrder: r.display_order,
  isActive: bool(r.is_active),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const COLUMNS = {
  title: 'title',
  subtitle: 'subtitle',
  backgroundImage: 'background_image',
  buttonLabel: 'button_label',
  buttonUrl: 'button_url',
  overlayOpacity: 'overlay_opacity',
  textAlign: 'text_align',
  displayOrder: 'display_order',
  isActive: 'is_active',
  updatedBy: 'updated_by',
};

export const HeroSlide = {
  async findAll(conn) {
    const [rows] = await executor(conn).query('SELECT * FROM hero_slides ORDER BY display_order, id');
    return rows.map(map);
  },

  async findActive(conn) {
    const [rows] = await executor(conn).query('SELECT * FROM hero_slides WHERE is_active = 1 ORDER BY display_order, id');
    return rows.map(map);
  },

  async findById(id, conn) {
    const [rows] = await executor(conn).query('SELECT * FROM hero_slides WHERE id = ?', [id]);
    return rows[0] ? map(rows[0]) : null;
  },

  async count(conn) {
    const [[row]] = await executor(conn).query('SELECT COUNT(*) AS n FROM hero_slides');
    return Number(row.n);
  },

  async nextOrder(conn) {
    const [[row]] = await executor(conn).query('SELECT COALESCE(MAX(display_order), -1) + 1 AS n FROM hero_slides');
    return Number(row.n);
  },

  async create(data, conn) {
    const [result] = await executor(conn).query(
      `INSERT INTO hero_slides (title, subtitle, background_image, button_label, button_url, overlay_opacity, text_align,
         display_order, is_active, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.subtitle ?? null,
        data.backgroundImage ?? null,
        data.buttonLabel ?? null,
        data.buttonUrl ?? null,
        data.overlayOpacity ?? 55,
        data.textAlign ?? 'left',
        data.displayOrder ?? 0,
        data.isActive === false ? 0 : 1,
        data.userId ?? null,
        data.userId ?? null,
      ],
    );
    return result.insertId;
  },

  async update(id, data, conn) {
    const payload = { ...data };
    if (payload.isActive !== undefined) payload.isActive = payload.isActive ? 1 : 0;
    const set = buildSet(COLUMNS, payload);
    if (!set) return;
    await executor(conn).query(`UPDATE hero_slides SET ${set.sql} WHERE id = ?`, [...set.params, id]);
  },

  async reorder(orderedIds, conn) {
    const db = executor(conn);
    for (let i = 0; i < orderedIds.length; i += 1) {
      await db.query('UPDATE hero_slides SET display_order = ? WHERE id = ?', [i, orderedIds[i]]);
    }
  },

  async delete(id, conn) {
    await executor(conn).query('DELETE FROM hero_slides WHERE id = ?', [id]);
  },
};

export default HeroSlide;
