import { transaction } from '../config/database.js';
import { Property } from '../models/Property.js';
import { PropertyCategory } from '../models/PropertyCategory.js';
import { Promotion } from '../models/Promotion.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta, paginate } from '../utils/pagination.js';
import { uniqueSlug } from '../utils/slugify.js';
import { audit, diff } from './auditService.js';
import { assertTransition, effectiveStatus, resolveLaunchStatus } from './campaignSchedule.js';

const withEffective = (p) => (p ? { ...p, effectiveStatus: effectiveStatus(p) } : p);

async function requirePromotion(id, conn) {
  const promotion = await Promotion.findById(id, conn);
  if (!promotion) throw AppError.notFound('Promotion not found');
  return withEffective(promotion);
}

async function validatePropertyIds(propertyIds, conn) {
  const unique = [...new Set(propertyIds)];
  const found = await Property.findBasicByIds(unique, conn);
  const foundIds = new Set(found.map((p) => p.id));
  const missing = unique.filter((id) => !foundIds.has(id));
  if (missing.length) throw AppError.validation([{ path: 'propertyIds', message: `Unknown property id(s): ${missing.join(', ')}` }]);
  const archived = found.filter((p) => p.publicationStatus === 'archived');
  if (archived.length) {
    throw AppError.validation([{ path: 'propertyIds', message: `Archived properties cannot be added: ${archived.map((p) => p.reference).join(', ')}` }]);
  }
  return unique;
}

async function validateCategory(categoryId, conn) {
  if (!categoryId) return;
  if (!(await PropertyCategory.findById(categoryId, conn))) {
    throw AppError.validation([{ path: 'categoryId', message: 'Category does not exist' }]);
  }
}

export async function listPromotions(filters) {
  const page = paginate(filters);
  const { rows, total } = await Promotion.list({ ...filters, ...page });
  return { rows: rows.map(withEffective), meta: pageMeta(page, total) };
}

export async function getPromotion(id) {
  const promotion = await requirePromotion(id);
  const propertyIds = await Promotion.propertyIds(id);
  const properties = await Property.findBasicByIds(propertyIds);
  const byId = new Map(properties.map((p) => [p.id, p]));
  return { ...promotion, propertyIds, properties: propertyIds.map((pid) => byId.get(pid)).filter(Boolean) };
}

export async function createPromotion(input, actor) {
  const id = await transaction(async (conn) => {
    await validateCategory(input.categoryId, conn);
    const propertyIds = await validatePropertyIds(input.propertyIds ?? [], conn);
    const slug = await uniqueSlug(input.name, (s) => Promotion.slugExists(s, 0, conn), 160);
    const newId = await Promotion.create({ ...input, slug, userId: actor.id }, conn);
    await Promotion.setProperties(newId, propertyIds, conn);
    await audit(actor, 'promotion.created', 'promotion', newId, { name: input.name, properties: propertyIds.length }, conn);
    return newId;
  });
  return getPromotion(id);
}

export async function updatePromotion(id, input, actor) {
  await transaction(async (conn) => {
    const existing = await requirePromotion(id, conn);
    if (existing.status === 'archived') throw AppError.conflict('Archived promotions cannot be edited. Restore it first.');
    await validateCategory(input.categoryId, conn);
    const campaignType = input.campaignType ?? existing.campaignType;
    const categoryId = input.categoryId === undefined ? existing.category?.id : input.categoryId;
    if (campaignType === 'category' && !categoryId) {
      throw AppError.validation([{ path: 'categoryId', message: 'Choose the category for a property category campaign' }]);
    }
    const startAt = input.startAt ?? existing.startAt;
    const endAt = input.endAt === undefined ? existing.endAt : input.endAt;
    if (endAt && new Date(endAt) <= new Date(startAt)) {
      throw AppError.validation([{ path: 'endAt', message: 'End date must be after the start date' }]);
    }
    await Promotion.update(id, { ...input, updatedBy: actor.id }, conn);
    if (input.propertyIds !== undefined) {
      await Promotion.setProperties(id, await validatePropertyIds(input.propertyIds, conn), conn);
    }
    if (['scheduled', 'active'].includes(existing.status)) {
      await Promotion.setStatus(id, resolveLaunchStatus({ startAt, endAt }), actor.id, conn);
    }
    await audit(actor, 'promotion.updated', 'promotion', id, diff(existing, input, [
      'name', 'campaignType', 'placement', 'destinationUrl', 'startAt', 'endAt', 'propertyIds',
    ]), conn);
  });
  return getPromotion(id);
}

const AUDIT_VERBS = { pause: 'paused', archive: 'archived', restore: 'restored' };

async function transition(id, action, actor, resolveStatus) {
  const promotion = await requirePromotion(id);
  assertTransition(action, promotion.status);
  const status = resolveStatus(promotion);
  await Promotion.setStatus(id, status, actor.id);
  const verb = action === 'publish' ? (status === 'scheduled' ? 'scheduled' : 'published') : AUDIT_VERBS[action];
  await audit(actor, `promotion.${verb}`, 'promotion', id, { from: promotion.status });
  return getPromotion(id);
}

export const publishPromotion = (id, actor) => transition(id, 'publish', actor, (p) => resolveLaunchStatus(p));
export const pausePromotion = (id, actor) => transition(id, 'pause', actor, () => 'paused');
export const archivePromotion = (id, actor) => transition(id, 'archive', actor, () => 'archived');
export const restorePromotion = (id, actor) => transition(id, 'restore', actor, () => 'draft');

const publicPromotion = (p) => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  description: p.description,
  bannerImage: p.bannerImage,
  campaignType: p.campaignType,
  category: p.category,
  placement: p.placement,
  destinationUrl: p.destinationUrl,
  startAt: p.startAt,
  endAt: p.endAt,
});

export async function listLivePromotions({ placement, limit } = {}) {
  const rows = await Promotion.findLive({ placement, limit: limit ?? 20 });
  return rows.map(publicPromotion);
}

/** Live promotion with its currently visible properties (published listings only). */
export async function getLivePromotion(slug) {
  const promotion = await Promotion.findLiveBySlug(slug);
  if (!promotion) throw AppError.notFound('This promotion is not running');
  let properties = [];
  const ids = await Promotion.propertyIds(promotion.id);
  if (ids.length) {
    const { rows } = await Property.search({ ids }, { limit: 100, offset: 0, publicOnly: true });
    const order = new Map(ids.map((id, i) => [id, i]));
    properties = rows.sort((a, b) => order.get(a.id) - order.get(b.id));
  } else if (promotion.campaignType === 'category' && promotion.category) {
    ({ rows: properties } = await Property.search({ category: promotion.category.slug, sort: 'recommended' }, { limit: 24, offset: 0, publicOnly: true }));
  }
  return { ...publicPromotion(promotion), properties };
}
