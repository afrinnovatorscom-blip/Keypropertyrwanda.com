import { Advertisement } from '../models/Advertisement.js';
import { AdvertisementEvent } from '../models/AdvertisementEvent.js';
import { CampaignEvent } from '../models/CampaignEvent.js';
import { FeaturedProperty } from '../models/FeaturedProperty.js';
import { HotDeal } from '../models/HotDeal.js';
import { Inquiry } from '../models/Inquiry.js';
import { Promotion } from '../models/Promotion.js';
import { AppError } from '../utils/AppError.js';
import { utcDateString, visitorHash } from '../utils/privacy.js';

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|curl|wget|python-requests/i;

export const isBot = (userAgent) => !userAgent || BOT_PATTERN.test(userAgent);

export const ctr = (clicks, impressions) => (impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0);

/**
 * Record an advertisement impression or click.
 * Only live adverts are counted, bots are ignored, and each anonymous visitor
 * is counted at most once per advert, event type and day.
 */
export async function recordAdEvent({ advertisementId, eventType }, { ip, userAgent }) {
  if (isBot(userAgent)) return { recorded: false, reason: 'bot' };
  const ad = await Advertisement.findLiveById(advertisementId);
  if (!ad) return { recorded: false, reason: 'not_live' };
  const now = new Date();
  const recorded = await AdvertisementEvent.record({
    advertisementId,
    placementId: ad.placement.id,
    eventType,
    visitorHash: visitorHash(ip, userAgent, now),
    eventDate: utcDateString(now),
  });
  return { recorded, reason: recorded ? undefined : 'duplicate' };
}

async function isEntityLive(entityType, entityId) {
  if (entityType === 'promotion') return Boolean(await Promotion.findLiveById(entityId));
  if (entityType === 'hot_deal') return Boolean(await HotDeal.findLiveById(entityId));
  if (entityType === 'featured') {
    const featured = await FeaturedProperty.findById(entityId);
    return Boolean(featured?.isLive);
  }
  return false;
}

export async function recordCampaignEvent({ entityType, entityId, eventType }, { ip, userAgent }) {
  if (isBot(userAgent)) return { recorded: false, reason: 'bot' };
  if (!(await isEntityLive(entityType, entityId))) return { recorded: false, reason: 'not_live' };
  const now = new Date();
  const recorded = await CampaignEvent.record({
    entityType,
    entityId,
    eventType,
    visitorHash: visitorHash(ip, userAgent, now),
    eventDate: utcDateString(now),
  });
  return { recorded, reason: recorded ? undefined : 'duplicate' };
}

/** Analytics summary for a date range (defaults to the last 30 days, inclusive). */
export async function getAnalytics({ from, to } = {}) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
  if (start > end) throw AppError.validation([{ path: 'from', message: 'Start date must be before the end date' }]);
  const range = { from: utcDateString(start), to: utcDateString(end) };
  // Inquiry timestamps are compared as [from 00:00, to + 1 day).
  const inquiryRange = {
    from: new Date(`${range.from}T00:00:00Z`),
    to: new Date(new Date(`${range.to}T00:00:00Z`).getTime() + 86400000),
  };

  const [ads, placements, daily, promotions, hotDeals, featured, attributed] = await Promise.all([
    AdvertisementEvent.summaryByAdvertisement(range),
    AdvertisementEvent.summaryByPlacement(range),
    AdvertisementEvent.dailySeries(range),
    CampaignEvent.summaryForPromotions(range),
    CampaignEvent.summaryForHotDeals(range),
    CampaignEvent.summaryForFeatured(range),
    Inquiry.attributedCounts(inquiryRange),
  ]);

  const withCtr = (rows, viewKey) => rows.map((r) => ({ ...r, ctr: ctr(r.clicks, r[viewKey]) }));
  const totals = ads.reduce((acc, r) => ({ impressions: acc.impressions + r.impressions, clicks: acc.clicks + r.clicks }), { impressions: 0, clicks: 0 });

  return {
    range,
    definitions: {
      impression: 'An advertisement was displayed in a visitor’s viewport (counted once per visitor, advert and day).',
      click: 'A visitor followed an advertisement or campaign link (counted once per visitor, item and day).',
      view: 'A promotion or hot deal was displayed to a visitor (counted once per visitor, item and day).',
      attributedInquiry: 'An inquiry submitted after the visitor clicked through that campaign in the same browser session. Attribution does not imply a sale.',
    },
    totals: {
      ...totals,
      ctr: ctr(totals.clicks, totals.impressions),
      attributedInquiries:
        Object.values(attributed.advertisements).reduce((a, b) => a + b, 0) +
        Object.values(attributed.promotions).reduce((a, b) => a + b, 0) +
        Object.values(attributed.hotDeals).reduce((a, b) => a + b, 0),
    },
    daily,
    advertisements: withCtr(ads, 'impressions').map((r) => ({ ...r, attributedInquiries: attributed.advertisements[r.id] ?? 0 })),
    placements: withCtr(placements, 'impressions'),
    promotions: withCtr(promotions, 'views').map((r) => ({ ...r, attributedInquiries: attributed.promotions[r.id] ?? 0 })),
    hotDeals: withCtr(hotDeals, 'views').map((r) => ({ ...r, attributedInquiries: attributed.hotDeals[r.id] ?? 0 })),
    featured: withCtr(featured, 'views'),
  };
}
