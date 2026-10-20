import { executor } from '../config/database.js';
import { buildSet, likeTerm, LIVE_WINDOW, PROMOTABLE_PROPERTY, uploadUrl } from './helpers.js';

const map = (r) => ({
  id: r.id,
  internalName: r.internal_name,
  headline: r.headline,
  description: r.description,
  desktopImage: uploadUrl(r.desktop_image),
  mobileImage: uploadUrl(r.mobile_image),
  desktopImagePath: r.desktop_image,
  mobileImagePath: r.mobile_image,
  destinationUrl: r.destination_url,
  property: r.property_id ? { id: r.property_id, title: r.property_title, slug: r.property_slug } : null,
  placement: { id: r.placement_id, slug: r.placement_slug, name: r.placement_name },
  startAt: r.start_at,
  endAt: r.end_at,
  displayOrder: r.display_order,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const SELECT = `
  SELECT a.*, pl.slug AS placement_slug, pl.name AS placement_name, p.title AS property_title, p.slug AS property_slug
  FROM advertisements a
  JOIN advertisement_placements pl ON pl.id = a.placement_id
  LEFT JOIN properties p ON p.id = a.property_id`;

/** Public visibility rule shared by listing and event tracking. */
const PUBLIC_WHERE = `a.status IN ('scheduled','active') AND ${LIVE_WINDOW('a')} AND pl.is_active = 1
  AND (a.property_id IS NULL OR (${PROMOTABLE_PROPERTY('p')}))`;

export const Advertisement = {
  async list({ status, placementId, search, limit, offset }, conn) {
    const where = [];
    const params = [];
    if (status) { where.push('a.status = ?'); params.push(status); }
    if (placementId) { where.push('a.placement_id = ?'); params.push(placementId); }
    if (search) {
      where.push('(a.internal_name LIKE ? OR a.headline LIKE ?)');
      params.push(likeTerm(search), likeTerm(search));
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const db = executor(conn);
    const [rows] = await db.query(`${SELECT} ${whereSql} ORDER BY a.updated_at DESC, a.id DESC LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset,
    ]);
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM advertisements a ${whereSql}`, params);
    return { rows: rows.map(map), total: Number(total) };
  },

  async findById(id, conn) {
    const [rows] = await executor(conn).query(`${SELECT} WHERE a.id = ?`, [id]);
    return rows[0] ? map(rows[0]) : null;
  },

  /** Live advertisements for a placement (published, inside schedule, linked property still promotable). */
  async findLiveForPlacement(placementSlug, limit, conn) {
    const [rows] = await executor(conn).query(
      `${SELECT} WHERE pl.slug = ? AND ${PUBLIC_WHERE} ORDER BY a.display_order, a.start_at DESC LIMIT ?`,
      [placementSlug, limit],
    );
    return rows.map(map);
  },

  async findLiveById(id, conn) {
    const [rows] = await executor(conn).query(`${SELECT} WHERE a.id = ? AND ${PUBLIC_WHERE}`, [id]);
    return rows[0] ? map(rows[0]) : null;
  },

  async create(data, conn) {
    const [result] = await executor(conn).query(
      `INSERT INTO advertisements (internal_name, headline, description, desktop_image, mobile_image, destination_url,
         property_id, placement_id, start_at, end_at, display_order, status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [
        data.internalName,
        data.headline,
        data.description ?? null,
        data.desktopImage ?? null,
        data.mobileImage ?? null,
        data.destinationUrl ?? null,
        data.propertyId ?? null,
        data.placementId,
        data.startAt,
        data.endAt ?? null,
        data.displayOrder ?? 0,
        data.userId ?? null,
        data.userId ?? null,
      ],
    );
    return result.insertId;
  },

  async update(id, data, conn) {
    const set = buildSet(
      {
        internalName: 'internal_name',
        headline: 'headline',
        description: 'description',
        desktopImage: 'desktop_image',
        mobileImage: 'mobile_image',
        destinationUrl: 'destination_url',
        propertyId: 'property_id',
        placementId: 'placement_id',
        startAt: 'start_at',
        endAt: 'end_at',
        displayOrder: 'display_order',
        updatedBy: 'updated_by',
      },
      data,
    );
    if (!set) return;
    await executor(conn).query(`UPDATE advertisements SET ${set.sql} WHERE id = ?`, [...set.params, id]);
  },

  async setStatus(id, status, userId, conn) {
    await executor(conn).query('UPDATE advertisements SET status = ?, updated_by = ? WHERE id = ?', [
      status,
      userId ?? null,
      id,
    ]);
  },

  /** Move scheduled → active and expire anything past its end date. Returns affected counts. */
  async syncStatuses(conn) {
    const db = executor(conn);
    const [activated] = await db.query(
      "UPDATE advertisements SET status = 'active' WHERE status = 'scheduled' AND start_at <= NOW() AND (end_at IS NULL OR end_at > NOW())",
    );
    const [expired] = await db.query(
      "UPDATE advertisements SET status = 'expired' WHERE status IN ('scheduled','active','paused') AND end_at IS NOT NULL AND end_at <= NOW()",
    );
    return { activated: activated.affectedRows, expired: expired.affectedRows };
  },

  async countLive(conn) {
    const [[row]] = await executor(conn).query(
      `SELECT COUNT(*) AS n FROM advertisements a
       JOIN advertisement_placements pl ON pl.id = a.placement_id
       LEFT JOIN properties p ON p.id = a.property_id WHERE ${PUBLIC_WHERE}`,
    );
    return Number(row.n);
  },

  async expiringSoon(days, conn) {
    const [rows] = await executor(conn).query(
      `SELECT a.id, a.internal_name AS name, a.end_at FROM advertisements a
       WHERE a.status IN ('scheduled','active') AND a.end_at IS NOT NULL
         AND a.end_at > NOW() AND a.end_at <= DATE_ADD(NOW(), INTERVAL ? DAY)
       ORDER BY a.end_at`,
      [days],
    );
    return rows.map((r) => ({ id: r.id, name: r.name, endAt: r.end_at, type: 'advertisement' }));
  },
};

export default Advertisement;
