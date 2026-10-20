import { executor } from '../config/database.js';

/**
 * Promotion / hot deal / featured placement events.
 * - view: the campaign (or deal card) was displayed to a visitor.
 * - click: the visitor opened the campaign or the linked property.
 * Each (entity, event type, anonymous visitor, day) is counted at most once.
 */
export const CampaignEvent = {
  async record({ entityType, entityId, eventType, visitorHash, eventDate }, conn) {
    const [result] = await executor(conn).query(
      `INSERT IGNORE INTO campaign_events (entity_type, entity_id, event_type, visitor_hash, event_date)
       VALUES (?, ?, ?, ?, ?)`,
      [entityType, entityId, eventType, visitorHash, eventDate],
    );
    return result.affectedRows === 1;
  },

  async summaryForPromotions({ from, to }, conn) {
    const [rows] = await executor(conn).query(
      `SELECT pr.id, pr.name, pr.status, pr.campaign_type,
         COALESCE(SUM(e.event_type = 'view'), 0) AS views,
         COALESCE(SUM(e.event_type = 'click'), 0) AS clicks
       FROM promotions pr
       LEFT JOIN campaign_events e ON e.entity_type = 'promotion' AND e.entity_id = pr.id AND e.event_date BETWEEN ? AND ?
       WHERE pr.status <> 'draft'
       GROUP BY pr.id ORDER BY views DESC, pr.id DESC`,
      [from, to],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      campaignType: r.campaign_type,
      views: Number(r.views),
      clicks: Number(r.clicks),
    }));
  },

  async summaryForHotDeals({ from, to }, conn) {
    const [rows] = await executor(conn).query(
      `SELECT d.id, d.title, d.status,
         COALESCE(SUM(e.event_type = 'view'), 0) AS views,
         COALESCE(SUM(e.event_type = 'click'), 0) AS clicks
       FROM hot_deals d
       LEFT JOIN campaign_events e ON e.entity_type = 'hot_deal' AND e.entity_id = d.id AND e.event_date BETWEEN ? AND ?
       WHERE d.status <> 'draft'
       GROUP BY d.id ORDER BY views DESC, d.id DESC`,
      [from, to],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.title,
      status: r.status,
      views: Number(r.views),
      clicks: Number(r.clicks),
    }));
  },

  async summaryForFeatured({ from, to }, conn) {
    const [rows] = await executor(conn).query(
      `SELECT f.id, p.title, f.is_active,
         COALESCE(SUM(e.event_type = 'view'), 0) AS views,
         COALESCE(SUM(e.event_type = 'click'), 0) AS clicks
       FROM featured_property_campaigns f JOIN properties p ON p.id = f.property_id
       LEFT JOIN campaign_events e ON e.entity_type = 'featured' AND e.entity_id = f.id AND e.event_date BETWEEN ? AND ?
       GROUP BY f.id ORDER BY views DESC, f.id DESC`,
      [from, to],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.title,
      isActive: Boolean(r.is_active),
      views: Number(r.views),
      clicks: Number(r.clicks),
    }));
  },
};

export default CampaignEvent;
