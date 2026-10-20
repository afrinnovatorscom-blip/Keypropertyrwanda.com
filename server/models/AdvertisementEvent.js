import { executor } from '../config/database.js';

/**
 * Advertisement analytics events.
 * - impression: the advert was rendered in the viewport of a page.
 * - click: the visitor followed the advert's link.
 * Each (advert, event type, anonymous visitor, day) is counted at most once.
 */
export const AdvertisementEvent = {
  /** Returns true when a new event was stored, false when it was a duplicate. */
  async record({ advertisementId, placementId, eventType, visitorHash, eventDate }, conn) {
    const [result] = await executor(conn).query(
      `INSERT IGNORE INTO advertisement_events (advertisement_id, placement_id, event_type, visitor_hash, event_date)
       VALUES (?, ?, ?, ?, ?)`,
      [advertisementId, placementId, eventType, visitorHash, eventDate],
    );
    return result.affectedRows === 1;
  },

  async summaryByAdvertisement({ from, to }, conn) {
    const [rows] = await executor(conn).query(
      `SELECT a.id, a.internal_name, a.headline, a.status, pl.name AS placement_name,
         COALESCE(SUM(e.event_type = 'impression'), 0) AS impressions,
         COALESCE(SUM(e.event_type = 'click'), 0) AS clicks
       FROM advertisements a
       JOIN advertisement_placements pl ON pl.id = a.placement_id
       LEFT JOIN advertisement_events e ON e.advertisement_id = a.id AND e.event_date BETWEEN ? AND ?
       WHERE a.status <> 'draft'
       GROUP BY a.id ORDER BY impressions DESC, a.id DESC`,
      [from, to],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.internal_name,
      headline: r.headline,
      status: r.status,
      placement: r.placement_name,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
    }));
  },

  async summaryByPlacement({ from, to }, conn) {
    const [rows] = await executor(conn).query(
      `SELECT pl.id, pl.name, pl.slug,
         COALESCE(SUM(e.event_type = 'impression'), 0) AS impressions,
         COALESCE(SUM(e.event_type = 'click'), 0) AS clicks
       FROM advertisement_placements pl
       LEFT JOIN advertisement_events e ON e.placement_id = pl.id AND e.event_date BETWEEN ? AND ?
       GROUP BY pl.id ORDER BY pl.id`,
      [from, to],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
    }));
  },

  async dailySeries({ from, to }, conn) {
    const [rows] = await executor(conn).query(
      `SELECT DATE_FORMAT(event_date, '%Y-%m-%d') AS day,
         SUM(event_type = 'impression') AS impressions, SUM(event_type = 'click') AS clicks
       FROM advertisement_events WHERE event_date BETWEEN ? AND ?
       GROUP BY event_date ORDER BY event_date`,
      [from, to],
    );
    return rows.map((r) => ({ day: r.day, impressions: Number(r.impressions), clicks: Number(r.clicks) }));
  },
};

export default AdvertisementEvent;
