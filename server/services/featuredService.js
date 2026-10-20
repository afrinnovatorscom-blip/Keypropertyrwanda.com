import { FeaturedProperty } from '../models/FeaturedProperty.js';
import { Property } from '../models/Property.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta, paginate } from '../utils/pagination.js';
import { audit, diff } from './auditService.js';

async function requireFeatured(id) {
  const featured = await FeaturedProperty.findById(id);
  if (!featured) throw AppError.notFound('Featured placement not found');
  return featured;
}

/** Only published, available properties may be (re)activated as featured. */
async function assertPromotable(propertyId) {
  const [property] = await Property.findBasicByIds([propertyId]);
  if (!property) throw AppError.validation([{ path: 'propertyId', message: 'Property does not exist' }]);
  if (property.publicationStatus !== 'published' || property.availabilityStatus !== 'available') {
    throw AppError.validation([
      { path: 'propertyId', message: 'Only published and available properties can be featured' },
    ]);
  }
  return property;
}

export async function listFeatured(filters) {
  const page = paginate(filters);
  const { rows, total } = await FeaturedProperty.list({ ...filters, ...page });
  return { rows, meta: pageMeta(page, total) };
}

export async function createFeatured(input, actor) {
  await assertPromotable(input.propertyId);
  const id = await FeaturedProperty.create({ ...input, userId: actor.id });
  await audit(actor, 'featured.created', 'featured', id, { propertyId: input.propertyId, startAt: input.startAt, endAt: input.endAt });
  return requireFeatured(id);
}

export async function updateFeatured(id, input, actor) {
  const existing = await requireFeatured(id);
  const propertyId = input.propertyId ?? existing.propertyId;
  const willBeActive = input.isActive ?? existing.isActive;
  if (willBeActive && (input.propertyId !== undefined || input.isActive === true)) await assertPromotable(propertyId);
  const startAt = input.startAt ?? existing.startAt;
  const endAt = input.endAt === undefined ? existing.endAt : input.endAt;
  if (endAt && new Date(endAt) <= new Date(startAt)) {
    throw AppError.validation([{ path: 'endAt', message: 'End date must be after the start date' }]);
  }
  await FeaturedProperty.update(id, { ...input, updatedBy: actor.id });
  await audit(actor, 'featured.updated', 'featured', id, diff(existing, input, ['propertyId', 'label', 'displayOrder', 'startAt', 'endAt', 'isActive', 'priorityInSearch']));
  return requireFeatured(id);
}

export async function setFeaturedActive(id, isActive, actor) {
  const existing = await requireFeatured(id);
  if (isActive) await assertPromotable(existing.propertyId);
  await FeaturedProperty.update(id, { isActive, updatedBy: actor.id });
  await audit(actor, isActive ? 'featured.activated' : 'featured.deactivated', 'featured', id);
  return requireFeatured(id);
}

export async function deleteFeatured(id, actor) {
  const existing = await requireFeatured(id);
  await FeaturedProperty.delete(id);
  await audit(actor, 'featured.deleted', 'featured', id, { propertyId: existing.propertyId });
}

/** Public featured listings in display order (property price untouched). */
export async function listPublicFeatured(limit = 12) {
  const entries = await FeaturedProperty.liveEntries(limit);
  if (!entries.length) return [];
  const byProperty = new Map(entries.map((e, i) => [e.propertyId, { ...e, order: i }]));
  const { rows } = await Property.search({ ids: [...byProperty.keys()] }, { limit, offset: 0, publicOnly: true });
  return rows
    .filter((p) => p.isFeatured)
    .map((p) => ({ ...p, featuredId: byProperty.get(p.id).featuredId, featuredLabel: byProperty.get(p.id).label }))
    .sort((a, b) => byProperty.get(a.id).order - byProperty.get(b.id).order);
}
