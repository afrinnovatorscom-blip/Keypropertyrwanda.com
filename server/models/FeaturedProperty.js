import { executor } from '../config/database.js';
import { bool, buildSet, LIVE_WINDOW, PROMOTABLE_PROPERTY } from './helpers.js';

const map = (r) => ({
  id: r.id,
  propertyId: r.property_id,
  property: {
    id: r.property_id,
    title: r.property_title,
    reference: r.property_reference,
    slug: r.property_slug,
    publicationStatus: r.publication_status,
    availabilityStatus: r.availability_status,
  },
  label: r.label,
  displayOrder: r.display_order,
  startAt: r.start_at,
  endAt: r.end_at,
  isActive: bool(r.is_active),
  priorityInSearch: bool(r.priority_in_search),
  /** Effective state: is it actually being shown right now? */
  isLive: bool(r.is_live),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const LIVE_EXPR = `(f.is_active = 1 AND ${LIVE_WINDOW('f')} AND ${PROMOTABLE_PROPERTY('p')})`;

const SELECT = `
  SELECT f.*, p.title AS property_title, p.reference AS property_reference, p.slug AS property_slug,
    p.publication_status, p.availability_status, ${LIVE_EXPR} AS is_live
  FROM featured_property_campaigns f JOIN properties p ON p.id = f.property_id`;

export const FeaturedProperty = {
  async list({ state, limit, offset }, conn) {
    const where = [];
    if (state === 'live') where.push(LIVE_EXPR);
    if (state === 'inactive') where.push('f.is_active = 0');
    if (state === 'expired') where.push('f.end_at IS NOT NULL AND f.end_at <= NOW()');
    if (state === 'scheduled') where.push('f.is_active = 1 AND f.start_at > NOW()');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const db = executor(conn);
    const [rows] = await db.query(
      `${SELECT} ${whereSql} ORDER BY is_live DESC, f.display_order, f.id DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM featured_property_campaigns f JOIN properties p ON p.id = f.property_id ${whereSql}`,
    );
    return { rows: rows.map(map), total: Number(total) };
  },

  async findById(id, conn) {
    const [rows] = await executor(conn).query(`${SELECT} WHERE f.id = ?`, [id]);
    return rows[0] ? map(rows[0]) : null;
  },

  /** Properties currently featured, in display order (one entry per property). */
  async liveEntries(limit, conn) {
    const [rows] = await executor(conn).query(
      `SELECT f.property_id, MIN(f.display_order) AS ord, MIN(f.id) AS fid, MAX(f.label) AS label
       FROM featured_property_campaigns f JOIN properties p ON p.id = f.property_id
       WHERE ${LIVE_EXPR} GROUP BY f.property_id ORDER BY ord, fid LIMIT ?`,
      [limit],
    );
    return rows.map((r) => ({ propertyId: r.property_id, featuredId: r.fid, label: r.label }));
  },

  async create(data, conn) {
    const [result] = await executor(conn).query(
      `INSERT INTO featured_property_campaigns (property_id, label, display_order, start_at, end_at, is_active,
         priority_in_search, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.propertyId,
        data.label ?? null,
        data.displayOrder ?? 0,
        data.startAt,
        data.endAt ?? null,
        data.isActive === false ? 0 : 1,
        data.priorityInSearch ? 1 : 0,
        data.userId ?? null,
        data.userId ?? null,
      ],
    );
    return result.insertId;
  },

  async update(id, data, conn) {
    const payload = { ...data };
    if (payload.isActive !== undefined) payload.isActive = payload.isActive ? 1 : 0;
    if (payload.priorityInSearch !== undefined) payload.priorityInSearch = payload.priorityInSearch ? 1 : 0;
    const set = buildSet(
      {
        propertyId: 'property_id',
        label: 'label',
        displayOrder: 'display_order',
        startAt: 'start_at',
        endAt: 'end_at',
        isActive: 'is_active',
        priorityInSearch: 'priority_in_search',
        updatedBy: 'updated_by',
      },
      payload,
    );
    if (!set) return;
    await executor(conn).query(`UPDATE featured_property_campaigns SET ${set.sql} WHERE id = ?`, [...set.params, id]);
  },

  async delete(id, conn) {
    await executor(conn).query('DELETE FROM featured_property_campaigns WHERE id = ?', [id]);
  },

  async deactivateForProperty(propertyId, userId, conn) {
    const [result] = await executor(conn).query(
      'UPDATE featured_property_campaigns SET is_active = 0, updated_by = ? WHERE property_id = ? AND is_active = 1',
      [userId ?? null, propertyId],
    );
    return result.affectedRows;
  },

  async countLive(conn) {
    const [[row]] = await executor(conn).query(
      `SELECT COUNT(DISTINCT f.property_id) AS n FROM featured_property_campaigns f
       JOIN properties p ON p.id = f.property_id WHERE ${LIVE_EXPR}`,
    );
    return Number(row.n);
  },

  async expiringSoon(days, conn) {
    const [rows] = await executor(conn).query(
      `SELECT f.id, p.title AS name, f.end_at FROM featured_property_campaigns f JOIN properties p ON p.id = f.property_id
       WHERE f.is_active = 1 AND f.end_at IS NOT NULL AND f.end_at > NOW() AND f.end_at <= DATE_ADD(NOW(), INTERVAL ? DAY)
       ORDER BY f.end_at`,
      [days],
    );
    return rows.map((r) => ({ id: r.id, name: r.name, endAt: r.end_at, type: 'featured' }));
  },
};

export default FeaturedProperty;
