import * as advertisementService from '../services/advertisementService.js';
import * as analyticsService from '../services/analyticsService.js';
import * as categoryService from '../services/categoryService.js';
import * as contentService from '../services/contentService.js';
import * as featuredService from '../services/featuredService.js';
import * as heroService from '../services/heroService.js';
import * as hotDealService from '../services/hotDealService.js';
import * as inquiryService from '../services/inquiryService.js';
import * as promotionService from '../services/promotionService.js';
import * as propertyService from '../services/propertyService.js';
import { created, ok } from '../utils/response.js';

const visitor = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') ?? '' });

export async function siteConfig(_req, res) {
  ok(res, await contentService.getPublicSiteConfig());
}

export async function hero(_req, res) {
  ok(res, await heroService.getPublicHero());
}

export async function content(req, res) {
  ok(res, await contentService.getPublicContent(req.params.key));
}

export async function categories(_req, res) {
  ok(res, await categoryService.listPublicCategories());
}

export async function locations(_req, res) {
  ok(res, await propertyService.publicLocations());
}

export async function searchProperties(req, res) {
  const { rows, meta } = await propertyService.searchPublic(req.valid.query);
  ok(res, rows, meta);
}

export async function propertyDetails(req, res) {
  ok(res, await propertyService.getPublicProperty(req.valid.params.slug));
}

export async function featured(req, res) {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 12, 48);
  ok(res, await featuredService.listPublicFeatured(limit));
}

export async function hotDeals(req, res) {
  const { rows, meta } = await hotDealService.listPublicDeals(req.query);
  ok(res, rows, meta);
}

export async function hotDeal(req, res) {
  ok(res, await hotDealService.getPublicDeal(req.valid.params.id));
}

export async function promotions(req, res) {
  const placement = typeof req.query.placement === 'string' ? req.query.placement : undefined;
  ok(res, await promotionService.listLivePromotions({ placement }));
}

export async function promotion(req, res) {
  ok(res, await promotionService.getLivePromotion(req.params.slug));
}

export async function advertisements(req, res) {
  const placement = String(req.query.placement ?? '');
  ok(res, /^[a-z_]{2,60}$/.test(placement) ? await advertisementService.livePlacementAds(placement) : []);
}

export async function adEvent(req, res) {
  ok(res, await analyticsService.recordAdEvent(req.valid.body, visitor(req)));
}

export async function campaignEvent(req, res) {
  ok(res, await analyticsService.recordCampaignEvent(req.valid.body, visitor(req)));
}

export async function submitInquiry(req, res) {
  const result = await inquiryService.submitInquiry(req.valid.body, visitor(req));
  created(res, { received: true, reference: result.id ? `INQ-${String(result.id).padStart(6, '0')}` : null });
}
