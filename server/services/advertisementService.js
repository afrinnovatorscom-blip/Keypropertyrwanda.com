import { transaction } from '../config/database.js';
import { Advertisement } from '../models/Advertisement.js';
import { AdvertisementPlacement } from '../models/AdvertisementPlacement.js';
import { Property } from '../models/Property.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta, paginate } from '../utils/pagination.js';
import { audit, diff } from './auditService.js';
import { assertTransition, effectiveStatus, resolveLaunchStatus } from './campaignSchedule.js';

const withEffective = (ad) => (ad ? { ...ad, effectiveStatus: effectiveStatus(ad) } : ad);

async function requireAd(id, conn) {
  const ad = await Advertisement.findById(id, conn);
  if (!ad) throw AppError.notFound('Advertisement not found');
  return withEffective(ad);
}

async function validateRefs({ placementId, propertyId }, conn) {
  if (placementId !== undefined) {
    const placement = await AdvertisementPlacement.findById(placementId, conn);
    if (!placement) throw AppError.validation([{ path: 'placementId', message: 'Unknown placement' }]);
  }
  if (propertyId) {
    const [property] = await Property.findBasicByIds([propertyId], conn);
    if (!property) throw AppError.validation([{ path: 'propertyId', message: 'Property does not exist' }]);
  }
}

export const listPlacements = () => AdvertisementPlacement.findAll();

export async function listAds(filters) {
  const page = paginate(filters);
  const { rows, total } = await Advertisement.list({ ...filters, ...page });
  return { rows: rows.map(withEffective), meta: pageMeta(page, total) };
}

export const getAd = (id) => requireAd(id);

export async function createAd(input, actor) {
  await validateRefs(input);
  if (!input.desktopImage && !input.headline) throw AppError.validation([{ path: 'desktopImage', message: 'Add an image or a headline' }]);
  const id = await Advertisement.create({ ...input, userId: actor.id });
  await audit(actor, 'advertisement.created', 'advertisement', id, { name: input.internalName });
  return requireAd(id);
}

export async function updateAd(id, input, actor) {
  const existing = await requireAd(id);
  if (existing.status === 'archived') throw AppError.conflict('Archived advertisements cannot be edited. Restore it first.');
  await validateRefs(input);
  const startAt = input.startAt ?? existing.startAt;
  const endAt = input.endAt === undefined ? existing.endAt : input.endAt;
  await transaction(async (conn) => {
    await Advertisement.update(id, { ...input, updatedBy: actor.id }, conn);
    if (['scheduled', 'active'].includes(existing.status)) {
      await Advertisement.setStatus(id, resolveLaunchStatus({ startAt, endAt }), actor.id, conn);
    }
    await audit(actor, 'advertisement.updated', 'advertisement', id, diff(existing, input, [
      'internalName', 'headline', 'destinationUrl', 'startAt', 'endAt', 'displayOrder',
    ]), conn);
  });
  return requireAd(id);
}

/** Publish: becomes "scheduled" or "active" depending on the start date. Expired schedules are rejected. */
export async function publishAd(id, actor) {
  const ad = await requireAd(id);
  assertTransition('publish', ad.status);
  if (!ad.desktopImage) throw AppError.validation([{ path: 'desktopImage', message: 'Upload a desktop image before publishing' }]);
  const status = resolveLaunchStatus(ad);
  await Advertisement.setStatus(id, status, actor.id);
  await audit(actor, status === 'scheduled' ? 'advertisement.scheduled' : 'advertisement.published', 'advertisement', id, { from: ad.status });
  return requireAd(id);
}

export async function pauseAd(id, actor) {
  const ad = await requireAd(id);
  assertTransition('pause', ad.status);
  await Advertisement.setStatus(id, 'paused', actor.id);
  await audit(actor, 'advertisement.paused', 'advertisement', id, { from: ad.status });
  return requireAd(id);
}

export async function archiveAd(id, actor) {
  const ad = await requireAd(id);
  assertTransition('archive', ad.status);
  await Advertisement.setStatus(id, 'archived', actor.id);
  await audit(actor, 'advertisement.archived', 'advertisement', id, { from: ad.status });
  return requireAd(id);
}

export async function restoreAd(id, actor) {
  const ad = await requireAd(id);
  assertTransition('restore', ad.status);
  await Advertisement.setStatus(id, 'draft', actor.id);
  await audit(actor, 'advertisement.restored', 'advertisement', id);
  return requireAd(id);
}

/** Public payload for a placement — only what the browser needs. */
export async function livePlacementAds(placementSlug) {
  const placement = await AdvertisementPlacement.findBySlug(placementSlug);
  if (!placement || !placement.isActive) return [];
  const ads = await Advertisement.findLiveForPlacement(placementSlug, placement.maxItems);
  return ads.map((ad) => ({
    id: ad.id,
    headline: ad.headline,
    description: ad.description,
    desktopImage: ad.desktopImage,
    mobileImage: ad.mobileImage,
    destinationUrl: ad.destinationUrl ?? (ad.property ? `/property/${ad.property.slug}` : null),
    isExternal: Boolean(ad.destinationUrl && /^https?:\/\//i.test(ad.destinationUrl)),
    placement: placementSlug,
  }));
}
