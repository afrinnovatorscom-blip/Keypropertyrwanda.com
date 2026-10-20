import { executor } from '../config/database.js';
import { bool, buildSet, likeTerm, LIVE_WINDOW, num, PROMOTABLE_PROPERTY, uploadUrl } from './helpers.js';

const map = (r) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  property: {
    id: r.property_id,
    reference: r.property_reference,
    title: r.property_title,
    slug: r.property_slug,
    price: num(r.property_price),
    currency: r.property_currency,
    pricePeriod: r.property_price_period,
    purpose: r.property_purpose,
    district: r.district,
    city: r.city,
    neighborhood: r.neighborhood,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    mainImage: uploadUrl(r.main_image),
    publicationStatus: r.publication_status,
    availabilityStatus: r.availability_status,
  },
  basePrice: num(r.base_price),
  originalPrice: num(r.original_price),
  originalPriceVerified: bool(r.original_price_verified),
  originalPriceVerifiedAt: r.original_price_verified_at,
  discountType: r.discount_type,
  discountValue: num(r.discount_value),
  promotionalPrice: num(r.promotional_price),
  discountAmount: num(r.discount_amount),
  discountPercentage: num(r.discount_percentage),
  currency: r.currency,
  startAt: r.start_at,
  endAt: r.end_at,
  status: r.status,
  displayOrder: r.display_order,
  isLive: bool(r.is_live),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const LIVE_EXPR = `(d.status IN ('scheduled','active') AND ${LIVE_WINDOW('d')} AND ${PROMOTABLE_PROPERTY('p')})`;

const SELECT = `
  SELECT d.*, p.reference AS property_reference, p.title AS property_title, p.slug AS property_slug,
    p.price AS property_price, p.currency AS property_currency, p.price_period AS property_price_period,
    p.purpose AS property_purpose, p.district, p.city, p.neighborhood, p.bedrooms, p.bathrooms,
    p.publication_status, p.availability_status,
    (SELECT pi.file_path FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1) AS main_image,
    ${LIVE_EXPR} AS is_live
  FROM hot_deals d JOIN properties p ON p.id = d.property_id`;

export const HotDeal = {
  async list({ status, search, propertyId, limit, offset }, conn) {
    const where = [];
    const params = [];
    if (status === 'live') where.push(LIVE_EXPR);
    else if (status) { where.push('d.status = ?'); params.push(status); }
    if (propertyId) { where.push('d.property_id = ?'); params.push(propertyId); }
    if (search) {
      where.push('(d.title LIKE ? OR p.title LIKE ? OR p.reference LIKE ?)');
      params.push(likeTerm(search), likeTerm(search), likeTerm(search));
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const db = executor(conn);
    const [rows] = await db.query(`${SELECT} ${whereSql} ORDER BY d.updated_at DESC, d.id DESC LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset,
    ]);
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM hot_deals d JOIN properties p ON p.id = d.property_id ${whereSql}`,
      params,
    );
    return { rows: rows.map(map), total: Number(total) };
  },

  async findById(id, conn) {
    const [rows] = await executor(conn).query(`${SELECT} WHERE d.id = ?`, [id]);
    return rows[0] ? map(rows[0]) : null;
  },

  /**
   * Publicly active deals: active/scheduled status, inside the date window,
   * and attached to a published + available property. Expired deals and deals
   * on unavailable or unpublished properties are always excluded.
   */
  async findLive({ limit = 50, offset = 0 } = {}, conn) {
    const db = executor(conn);
    const [rows] = await db.query(
      `${SELECT} WHERE ${LIVE_EXPR} ORDER BY d.display_order, d.end_at, d.id DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM hot_deals d JOIN properties p ON p.id = d.property_id WHERE ${LIVE_EXPR}`,
    );
    return { rows: rows.map(map), total: Number(total) };
  },

  async findLiveById(id, conn) {
    const [rows] = await executor(conn).query(`${SELECT} WHERE d.id = ? AND ${LIVE_EXPR}`, [id]);
    return rows[0] ? map(rows[0]) : null;
  },

  async findLiveForProperty(propertyId, conn) {
    const [rows] = await executor(conn).query(
      `${SELECT} WHERE d.property_id = ? AND ${LIVE_EXPR} ORDER BY d.end_at LIMIT 1`,
      [propertyId],
    );
    return rows[0] ? map(rows[0]) : null;
  },

  async create(data, conn) {
    const [result] = await executor(conn).query(
      `INSERT INTO hot_deals (property_id, title, description, base_price, original_price, original_price_verified,
         original_price_verified_by, original_price_verified_at, discount_type, discount_value, promotional_price,
         discount_amount, discount_percentage, currency, start_at, end_at, display_order, status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [
        data.propertyId,
        data.title,
        data.description ?? null,
        data.basePrice,
        data.originalPrice ?? null,
        data.originalPriceVerified ? 1 : 0,
        data.originalPriceVerifiedBy ?? null,
        data.originalPriceVerifiedAt ?? null,
        data.discountType,
        data.discountValue,
        data.promotionalPrice,
        data.discountAmount,
        data.discountPercentage,
        data.currency,
        data.startAt,
        data.endAt,
        data.displayOrder ?? 0,
        data.userId ?? null,
        data.userId ?? null,
      ],
    );
    return result.insertId;
  },

  async update(id, data, conn) {
    const payload = { ...data };
    if (payload.originalPriceVerified !== undefined) payload.originalPriceVerified = payload.originalPriceVerified ? 1 : 0;
    const set = buildSet(
      {
        propertyId: 'property_id',
        title: 'title',
        description: 'description',
        basePrice: 'base_price',
        originalPrice: 'original_price',
        originalPriceVerified: 'original_price_verified',
        originalPriceVerifiedBy: 'original_price_verified_by',
        originalPriceVerifiedAt: 'original_price_verified_at',
        discountType: 'discount_type',
        discountValue: 'discount_value',
        promotionalPrice: 'promotional_price',
        discountAmount: 'discount_amount',
        discountPercentage: 'discount_percentage',
        currency: 'currency',
        startAt: 'start_at',
        endAt: 'end_at',
        displayOrder: 'display_order',
        updatedBy: 'updated_by',
      },
      payload,
    );
    if (!set) return;
    await executor(conn).query(`UPDATE hot_deals SET ${set.sql} WHERE id = ?`, [...set.params, id]);
  },

  async setStatus(id, status, userId, conn) {
    await executor(conn).query('UPDATE hot_deals SET status = ?, updated_by = ? WHERE id = ?', [
      status,
      userId ?? null,
      id,
    ]);
  },

  /** End running deals for a property (e.g. when it is archived, sold or rented). History is kept. */
  async endForProperty(propertyId, userId, conn) {
    const [result] = await executor(conn).query(
      "UPDATE hot_deals SET status = 'ended', updated_by = ? WHERE property_id = ? AND status IN ('scheduled','active','paused')",
      [userId ?? null, propertyId],
    );
    return result.affectedRows;
  },

  async syncStatuses(conn) {
    const db = executor(conn);
    const [activated] = await db.query(
      "UPDATE hot_deals SET status = 'active' WHERE status = 'scheduled' AND start_at <= NOW() AND end_at > NOW()",
    );
    const [expired] = await db.query(
      "UPDATE hot_deals SET status = 'expired' WHERE status IN ('scheduled','active','paused') AND end_at <= NOW()",
    );
    return { activated: activated.affectedRows, expired: expired.affectedRows };
  },

  async countLive(conn) {
    const [[row]] = await executor(conn).query(
      `SELECT COUNT(*) AS n FROM hot_deals d JOIN properties p ON p.id = d.property_id WHERE ${LIVE_EXPR}`,
    );
    return Number(row.n);
  },

  async expiringSoon(days, conn) {
    const [rows] = await executor(conn).query(
      `SELECT d.id, d.title AS name, d.end_at FROM hot_deals d
       WHERE d.status IN ('scheduled','active') AND d.end_at > NOW() AND d.end_at <= DATE_ADD(NOW(), INTERVAL ? DAY)
       ORDER BY d.end_at`,
      [days],
    );
    return rows.map((r) => ({ id: r.id, name: r.name, endAt: r.end_at, type: 'hot_deal' }));
  },
};

export default HotDeal;
