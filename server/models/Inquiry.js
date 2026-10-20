import { executor } from '../config/database.js';
import { buildSet, likeTerm } from './helpers.js';

export const INQUIRY_STATUSES = ['new', 'contacted', 'in_progress', 'converted', 'closed'];

const map = (r) => ({
  id: r.id,
  customerName: r.customer_name,
  phone: r.phone,
  email: r.email,
  message: r.message,
  preferredContact: r.preferred_contact,
  status: r.status,
  source: r.source,
  propertyReference: r.property_reference,
  property: r.property_id
    ? { id: r.property_id, title: r.property_title, slug: r.property_slug, reference: r.property_reference }
    : null,
  attribution: {
    advertisementId: r.advertisement_id,
    advertisementName: r.advertisement_name ?? null,
    promotionId: r.promotion_id,
    promotionName: r.promotion_name ?? null,
    hotDealId: r.hot_deal_id,
    hotDealTitle: r.hot_deal_title ?? null,
  },
  assignedTo: r.assigned_to ? { id: r.assigned_to, fullName: r.assigned_name } : null,
  followUpAt: r.follow_up_at,
  contactedAt: r.contacted_at,
  closedAt: r.closed_at,
  consent: Boolean(r.consent),
  noteCount: r.note_count !== undefined ? Number(r.note_count) : undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const SELECT = `
  SELECT i.*, p.title AS property_title, p.slug AS property_slug, u.full_name AS assigned_name,
    a.internal_name AS advertisement_name, pr.name AS promotion_name, hd.title AS hot_deal_title,
    (SELECT COUNT(*) FROM inquiry_notes n WHERE n.inquiry_id = i.id) AS note_count
  FROM inquiries i
  LEFT JOIN properties p ON p.id = i.property_id
  LEFT JOIN users u ON u.id = i.assigned_to
  LEFT JOIN advertisements a ON a.id = i.advertisement_id
  LEFT JOIN promotions pr ON pr.id = i.promotion_id
  LEFT JOIN hot_deals hd ON hd.id = i.hot_deal_id`;

function buildWhere(f) {
  const where = [];
  const params = [];
  if (f.status) { where.push('i.status = ?'); params.push(f.status); }
  if (f.propertyId) { where.push('i.property_id = ?'); params.push(f.propertyId); }
  if (f.assignedTo) { where.push('i.assigned_to = ?'); params.push(f.assignedTo); }
  if (f.preferredContact) { where.push('i.preferred_contact = ?'); params.push(f.preferredContact); }
  if (f.from) { where.push('i.created_at >= ?'); params.push(f.from); }
  if (f.to) { where.push('i.created_at < ?'); params.push(f.to); }
  if (f.followUpDue) { where.push("i.follow_up_at IS NOT NULL AND i.follow_up_at <= NOW() AND i.status NOT IN ('converted','closed')"); }
  if (f.search) {
    const t = likeTerm(f.search);
    where.push('(i.customer_name LIKE ? OR i.phone LIKE ? OR i.email LIKE ? OR i.property_reference LIKE ? OR i.message LIKE ?)');
    params.push(t, t, t, t, t);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export const Inquiry = {
  async create(data, conn) {
    const [result] = await executor(conn).query(
      `INSERT INTO inquiries (property_id, property_reference, customer_name, phone, email, message, preferred_contact,
         source, advertisement_id, promotion_id, hot_deal_id, consent, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.propertyId ?? null,
        data.propertyReference ?? null,
        data.customerName,
        data.phone,
        data.email ?? null,
        data.message,
        data.preferredContact,
        data.source ?? 'website',
        data.advertisementId ?? null,
        data.promotionId ?? null,
        data.hotDealId ?? null,
        data.consent ? 1 : 0,
        data.ipHash ?? null,
      ],
    );
    return result.insertId;
  },

  async list(filters, { limit, offset }, conn) {
    const db = executor(conn);
    const { whereSql, params } = buildWhere(filters);
    const [rows] = await db.query(`${SELECT} ${whereSql} ORDER BY i.created_at DESC, i.id DESC LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset,
    ]);
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM inquiries i ${whereSql}`, params);
    return { rows: rows.map(map), total: Number(total) };
  },

  async exportRows(filters, conn) {
    const { whereSql, params } = buildWhere(filters);
    const [rows] = await executor(conn).query(`${SELECT} ${whereSql} ORDER BY i.created_at DESC LIMIT 10000`, params);
    return rows.map(map);
  },

  async findById(id, conn) {
    const [rows] = await executor(conn).query(`${SELECT} WHERE i.id = ?`, [id]);
    return rows[0] ? map(rows[0]) : null;
  },

  async update(id, data, conn) {
    const set = buildSet(
      {
        status: 'status',
        assignedTo: 'assigned_to',
        followUpAt: 'follow_up_at',
        contactedAt: 'contacted_at',
        closedAt: 'closed_at',
      },
      data,
    );
    if (!set) return;
    await executor(conn).query(`UPDATE inquiries SET ${set.sql} WHERE id = ?`, [...set.params, id]);
  },

  /** Number of inquiries from the same (hashed) IP in the last `minutes`. */
  async countRecentByIp(ipHash, minutes, conn) {
    const [[row]] = await executor(conn).query(
      'SELECT COUNT(*) AS n FROM inquiries WHERE ip_hash = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)',
      [ipHash, minutes],
    );
    return Number(row.n);
  },

  /** Exact duplicate submitted recently (double-click / resubmission guard). */
  async findRecentDuplicate({ phone, message, propertyId }, minutes, conn) {
    const [rows] = await executor(conn).query(
      `SELECT id FROM inquiries WHERE phone = ? AND message = ? AND (property_id <=> ?)
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE) LIMIT 1`,
      [phone, message, propertyId ?? null, minutes],
    );
    return rows[0]?.id ?? null;
  },

  async statusCounts(conn) {
    const [rows] = await executor(conn).query('SELECT status, COUNT(*) AS n FROM inquiries GROUP BY status');
    const counts = Object.fromEntries(INQUIRY_STATUSES.map((s) => [s, 0]));
    for (const r of rows) counts[r.status] = Number(r.n);
    return counts;
  },

  async countFollowUpsDue(conn) {
    const [[row]] = await executor(conn).query(
      `SELECT COUNT(*) AS n FROM inquiries
       WHERE follow_up_at IS NOT NULL AND follow_up_at <= NOW() AND status NOT IN ('converted','closed')`,
    );
    return Number(row.n);
  },

  async recent(limit = 5, conn) {
    const [rows] = await executor(conn).query(`${SELECT} ORDER BY i.created_at DESC LIMIT ?`, [limit]);
    return rows.map(map);
  },

  /** Inquiries attributed (by explicit click-through tracking) to campaigns in a date range. */
  async attributedCounts({ from, to }, conn) {
    const db = executor(conn);
    const range = 'created_at >= ? AND created_at < ?';
    const [ads] = await db.query(
      `SELECT advertisement_id AS id, COUNT(*) AS n FROM inquiries WHERE advertisement_id IS NOT NULL AND ${range} GROUP BY advertisement_id`,
      [from, to],
    );
    const [promos] = await db.query(
      `SELECT promotion_id AS id, COUNT(*) AS n FROM inquiries WHERE promotion_id IS NOT NULL AND ${range} GROUP BY promotion_id`,
      [from, to],
    );
    const [deals] = await db.query(
      `SELECT hot_deal_id AS id, COUNT(*) AS n FROM inquiries WHERE hot_deal_id IS NOT NULL AND ${range} GROUP BY hot_deal_id`,
      [from, to],
    );
    const toMap = (rows) => Object.fromEntries(rows.map((r) => [r.id, Number(r.n)]));
    return { advertisements: toMap(ads), promotions: toMap(promos), hotDeals: toMap(deals) };
  },
};

export default Inquiry;
