import { actorFrom } from '../middleware/auth.js';
import * as advertisementService from '../services/advertisementService.js';
import * as analyticsService from '../services/analyticsService.js';
import * as featuredService from '../services/featuredService.js';
import * as hotDealService from '../services/hotDealService.js';
import * as promotionService from '../services/promotionService.js';
import { saveImage } from '../services/uploadService.js';
import { audit } from '../services/auditService.js';
import { AppError } from '../utils/AppError.js';
import { created, noContent, ok } from '../utils/response.js';

const id = (req) => req.valid.params.id;
const paged = async (res, promise) => {
  const { rows, meta } = await promise;
  ok(res, rows, meta);
};

// ---------------------------------------------------------------- Featured
export const featured = {
  list: (req, res) => paged(res, featuredService.listFeatured(req.valid.query)),
  create: async (req, res) => created(res, await featuredService.createFeatured(req.valid.body, actorFrom(req))),
  update: async (req, res) => ok(res, await featuredService.updateFeatured(id(req), req.valid.body, actorFrom(req))),
  activate: async (req, res) => ok(res, await featuredService.setFeaturedActive(id(req), true, actorFrom(req))),
  deactivate: async (req, res) => ok(res, await featuredService.setFeaturedActive(id(req), false, actorFrom(req))),
  remove: async (req, res) => {
    await featuredService.deleteFeatured(id(req), actorFrom(req));
    noContent(res);
  },
};

// --------------------------------------------------------------- Hot deals
export const hotDeals = {
  list: (req, res) => paged(res, hotDealService.listDeals(req.valid.query)),
  get: async (req, res) => ok(res, await hotDealService.getDeal(id(req))),
  calculate: async (req, res) => ok(res, await hotDealService.previewCalculation(req.valid.body)),
  create: async (req, res) => created(res, await hotDealService.createDeal(req.valid.body, actorFrom(req))),
  update: async (req, res) => ok(res, await hotDealService.updateDeal(id(req), req.valid.body, actorFrom(req))),
  activate: async (req, res) => ok(res, await hotDealService.activateDeal(id(req), actorFrom(req))),
  pause: async (req, res) => ok(res, await hotDealService.pauseDeal(id(req), actorFrom(req))),
  end: async (req, res) => ok(res, await hotDealService.endDeal(id(req), actorFrom(req))),
};

// ---------------------------------------------------------- Advertisements
export const advertisements = {
  placements: async (_req, res) => ok(res, await advertisementService.listPlacements()),
  list: (req, res) => paged(res, advertisementService.listAds(req.valid.query)),
  get: async (req, res) => ok(res, await advertisementService.getAd(id(req))),
  create: async (req, res) => created(res, await advertisementService.createAd(req.valid.body, actorFrom(req))),
  update: async (req, res) => ok(res, await advertisementService.updateAd(id(req), req.valid.body, actorFrom(req))),
  publish: async (req, res) => ok(res, await advertisementService.publishAd(id(req), actorFrom(req))),
  pause: async (req, res) => ok(res, await advertisementService.pauseAd(id(req), actorFrom(req))),
  archive: async (req, res) => ok(res, await advertisementService.archiveAd(id(req), actorFrom(req))),
  restore: async (req, res) => ok(res, await advertisementService.restoreAd(id(req), actorFrom(req))),
};

// --------------------------------------------------------------- Promotions
export const promotions = {
  list: (req, res) => paged(res, promotionService.listPromotions(req.valid.query)),
  get: async (req, res) => ok(res, await promotionService.getPromotion(id(req))),
  create: async (req, res) => created(res, await promotionService.createPromotion(req.valid.body, actorFrom(req))),
  update: async (req, res) => ok(res, await promotionService.updatePromotion(id(req), req.valid.body, actorFrom(req))),
  publish: async (req, res) => ok(res, await promotionService.publishPromotion(id(req), actorFrom(req))),
  pause: async (req, res) => ok(res, await promotionService.pausePromotion(id(req), actorFrom(req))),
  archive: async (req, res) => ok(res, await promotionService.archivePromotion(id(req), actorFrom(req))),
  restore: async (req, res) => ok(res, await promotionService.restorePromotion(id(req), actorFrom(req))),
};

export async function analytics(req, res) {
  ok(res, await analyticsService.getAnalytics(req.valid.query));
}

/** Campaign image upload (advertisement / promotion banners). Returns the stored path. */
export async function uploadCampaignImage(req, res) {
  if (!req.file) throw AppError.badRequest('Choose an image to upload.');
  // Each folder belongs to one module; check the matching permission.
  const required = { advertisements: 'advertisements.create', promotions: 'promotions.create', hero: 'content.manage' }[req.valid.query.folder];
  if (!actorFrom(req).can(required)) throw AppError.forbidden();
  const stored = await saveImage(req.file, req.valid.query.folder);
  await audit(actorFrom(req), 'upload.created', 'upload', null, { folder: req.valid.query.folder, path: stored.filePath });
  created(res, { path: stored.filePath, url: stored.url });
}
