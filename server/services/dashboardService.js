import { Advertisement } from '../models/Advertisement.js';
import { FeaturedProperty } from '../models/FeaturedProperty.js';
import { HotDeal } from '../models/HotDeal.js';
import { Inquiry } from '../models/Inquiry.js';
import { Promotion } from '../models/Promotion.js';
import { Property } from '../models/Property.js';

const EXPIRY_WINDOW_DAYS = 7;

/** Dashboard metrics — every figure is computed from the database at request time. */
export async function getDashboard() {
  const [properties, inquiries, followUpsDue, featured, deals, ads, promotions, recentInquiries, ...expiring] =
    await Promise.all([
      Property.stats(),
      Inquiry.statusCounts(),
      Inquiry.countFollowUpsDue(),
      FeaturedProperty.countLive(),
      HotDeal.countLive(),
      Advertisement.countLive(),
      Promotion.countLive(),
      Inquiry.recent(6),
      FeaturedProperty.expiringSoon(EXPIRY_WINDOW_DAYS),
      HotDeal.expiringSoon(EXPIRY_WINDOW_DAYS),
      Advertisement.expiringSoon(EXPIRY_WINDOW_DAYS),
      Promotion.expiringSoon(EXPIRY_WINDOW_DAYS),
    ]);

  const expiringSoon = expiring.flat().sort((a, b) => new Date(a.endAt) - new Date(b.endAt));

  return {
    properties: {
      total: properties.total,
      published: properties.published,
      drafts: properties.drafts,
      unpublished: properties.unpublished,
      archived: properties.archived,
      forSale: properties.for_sale,
      forRent: properties.for_rent,
      liveForSale: properties.live_for_sale,
      liveForRent: properties.live_for_rent,
      sold: properties.sold,
      rented: properties.rented,
    },
    campaigns: {
      activeFeatured: featured,
      activeHotDeals: deals,
      activeAdvertisements: ads,
      activePromotions: promotions,
      expiringSoonCount: expiringSoon.length,
      expiryWindowDays: EXPIRY_WINDOW_DAYS,
    },
    inquiries: { ...inquiries, followUpsDue },
    expiringSoon,
    recentInquiries,
  };
}
