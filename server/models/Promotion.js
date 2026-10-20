import { executor } from '../config/database.js';
import { buildSet, likeTerm, LIVE_WINDOW, uploadUrl } from './helpers.js';

const map = (r) => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  bannerImage: uploadUrl(r.banner_image),
  bannerImagePath: r.banner_image,
  campaignType: r.campaign_type,
  category: r.category_id ? { id: r.category_id, name: r.category_name, slug: r.category_slug } : null,
  placement: r.placement,
  destinationUrl: r.destination_url,
  startAt: r.start_at,
  endAt: r.end_at,
  status: r.status,
  displayOrder: r.display_order,
  propertyCount: r.property_count !== undefined ? Number(r.property_count) : undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const SELECT = `
  SELECT pr.*, c.name AS category_name, c.slug AS category_slug,
    (SELECT COUNT(*) FROM promotion_properties pp WHERE pp.promotion_id = pr.id) AS property_count
  FROM promotions pr LEFT JOIN property_categories c ON c.id = pr.category_id`;

const PUBLIC_WHERE = `pr.status IN ('scheduled','active') AND ${LIVE_WINDOW('pr')}`;

export const Promotion = {
  async list({ status, campaignType, search, limit, offset }, conn) {
    const where = [];
    const params = [];
    if (status) { where.push('pr.status = ?'); params.push(status); }
    if (campaignType) { where.push('pr.campaign_type = ?'); params.push(campaignType); }
    if (search) { where.push('pr.name LIKE ?'); params.push(likeTerm(search)); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const db = executor(conn);
    const [rows] = await db.query(`${SELECT} ${whereSql} ORDER BY pr.updated_at DESC, pr.id DESC LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset,
    ]);
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM promotions pr ${whereSql}`, params);
    return { rows: rows.map(map), total: Number(total) };
  },

  async findById(id, conn) {
    const [rows] = await executor(conn).query(`${SELECT} WHERE pr.id = ?`, [id]);
    return rows[0] ? map(rows[0]) : null;
  },

  async findLiveBySlug(slug, conn) {
    const [rows] = await executor(conn).query(`${SELECT} WHERE pr.slug = ? AND ${PUBLIC_WHERE}`, [slug]);
    return rows[0] ? map(rows[0]) : null;
  },

  async findLiveById(id, conn) {
    const [rows] = await executor(conn).query(`${SELECT} WHERE pr.id = ? AND ${PUBLIC_WHERE}`, [id]);
    return rows[0] ? map(rows[0]) : null;
  },

  /** Currently running campaigns, optionally limited to a placement. */
  async findLive({ placement, limit = 20 } = {}, conn) {
    const params = [];
    let extra = '';
    if (placement) {
      extra = 'AND pr.placement = ?';
      params.push(placement);
    }
    const [rows] = await executor(conn).query(
      `${SELECT} WHERE ${PUBLIC_WHERE} ${extra} ORDER BY pr.display_order, pr.start_at DESC LIMIT ?`,
      [...params, limit],
    );
    return rows.map(map);
  },

  async slugExists(slug, excludeId = 0, conn) {
    const [rows] = await executor(conn).query('SELECT id FROM promotions WHERE slug = ? AND id <> ?', [slug, excludeId]);
    return rows.length > 0;
  },

  async create(data, conn) {
    const [result] = await executor(conn).query(
      `INSERT INTO promotions (name, slug, description, banner_image, campaign_type, category_id, placement,
         destination_url, start_at, end_at, display_order, status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [
        data.name,
        data.slug,
        data.description ?? null,
        data.bannerImage ?? null,
        data.campaignType,
        data.categoryId ?? null,
        data.placement,
        data.destinationUrl ?? null,
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
        name: 'name',
        slug: 'slug',
        description: 'description',
        bannerImage: 'banner_image',
        campaignType: 'campaign_type',
        categoryId: 'category_id',
        placement: 'placement',
        destinationUrl: 'destination_url',
        startAt: 'start_at',
        endAt: 'end_at',
        displayOrder: 'display_order',
        updatedBy: 'updated_by',
      },
      data,
    );
    if (!set) return;
    await executor(conn).query(`UPDATE promotions SET ${set.sql} WHERE id = ?`, [...set.params, id]);
  },

  async setStatus(id, status, userId, conn) {
    await executor(conn).query('UPDATE promotions SET status = ?, updated_by = ? WHERE id = ?', [
      status,
      userId ?? null,
      id,
    ]);
  },

  /** Replace the properties linked to a campaign (the property records themselves are reused, never copied). */
  async setProperties(promotionId, propertyIds, conn) {
    const db = executor(conn);
    await db.query('DELETE FROM promotion_properties WHERE promotion_id = ?', [promotionId]);
    if (propertyIds.length) {
      await db.query('INSERT INTO promotion_properties (promotion_id, property_id, sort_order) VALUES ?', [
        propertyIds.map((pid, i) => [promotionId, pid, i]),
      ]);
    }
  },

  async propertyIds(promotionId, conn) {
    const [rows] = await executor(conn).query(
      'SELECT property_id FROM promotion_properties WHERE promotion_id = ? ORDER BY sort_order',
      [promotionId],
    );
    return rows.map((r) => r.property_id);
  },

  async syncStatuses(conn) {
    const db = executor(conn);
    const [activated] = await db.query(
      "UPDATE promotions SET status = 'active' WHERE status = 'scheduled' AND start_at <= NOW() AND (end_at IS NULL OR end_at > NOW())",
    );
    const [expired] = await db.query(
      "UPDATE promotions SET status = 'expired' WHERE status IN ('scheduled','active','paused') AND end_at IS NOT NULL AND end_at <= NOW()",
    );
    return { activated: activated.affectedRows, expired: expired.affectedRows };
  },

  async countLive(conn) {
    const [[row]] = await executor(conn).query(`SELECT COUNT(*) AS n FROM promotions pr WHERE ${PUBLIC_WHERE}`);
    return Number(row.n);
  },

  async expiringSoon(days, conn) {
    const [rows] = await executor(conn).query(
      `SELECT pr.id, pr.name, pr.end_at FROM promotions pr
       WHERE pr.status IN ('scheduled','active') AND pr.end_at IS NOT NULL
         AND pr.end_at > NOW() AND pr.end_at <= DATE_ADD(NOW(), INTERVAL ? DAY)
       ORDER BY pr.end_at`,
      [days],
    );
    return rows.map((r) => ({ id: r.id, name: r.name, endAt: r.end_at, type: 'promotion' }));
  },
};

export default Promotion;
