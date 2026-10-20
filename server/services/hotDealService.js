import { transaction } from '../config/database.js';
import { BusinessSetting } from '../models/BusinessSetting.js';
import { HotDeal } from '../models/HotDeal.js';
import { Property } from '../models/Property.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta, paginate } from '../utils/pagination.js';
import { buildWhatsAppLink } from '../utils/whatsapp.js';
import { audit, diff } from './auditService.js';
import { resolveLaunchStatus } from './campaignSchedule.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Calculate a deal's promotional price on the server.
 * - percentage: 0 < value < 100 → base × (100 − value) / 100
 * - amount: 0 < value < base → base − value
 * - fixed_price: 0 < value < base → value
 * The result is always strictly positive and strictly below the base price.
 */
export function calculateDeal({ basePrice, discountType, discountValue }) {
  const base = Number(basePrice);
  const value = Number(discountValue);
  if (!Number.isFinite(base) || base <= 0) {
    throw AppError.validation([{ path: 'originalPrice', message: 'The base price must be greater than zero' }]);
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw AppError.validation([{ path: 'discountValue', message: 'The discount must be greater than zero' }]);
  }

  let promotionalPrice;
  if (discountType === 'percentage') {
    if (value >= 100) throw AppError.validation([{ path: 'discountValue', message: 'A percentage discount must be below 100%' }]);
    promotionalPrice = round2((base * (100 - value)) / 100);
  } else if (discountType === 'amount') {
    if (value >= base) throw AppError.validation([{ path: 'discountValue', message: 'The discount amount must be smaller than the price' }]);
    promotionalPrice = round2(base - value);
  } else if (discountType === 'fixed_price') {
    if (value >= base) throw AppError.validation([{ path: 'discountValue', message: 'The promotional price must be lower than the base price' }]);
    promotionalPrice = round2(value);
  } else {
    throw AppError.validation([{ path: 'discountType', message: 'Unknown discount type' }]);
  }

  if (!(promotionalPrice > 0)) {
    throw AppError.validation([{ path: 'discountValue', message: 'The promotional price must be greater than zero' }]);
  }
  const discountAmount = round2(base - promotionalPrice);
  const discountPercentage = round2((discountAmount / base) * 100);
  return { basePrice: round2(base), promotionalPrice, discountAmount, discountPercentage };
}

/**
 * Public representation: the original price (and therefore the discount
 * claim) is only exposed when an authorised staff member verified it.
 */
export function publicDeal(deal, whatsappNumber) {
  const verified = deal.originalPriceVerified && deal.originalPrice !== null;
  const message = `Hello Key Property Rwanda, I am interested in the Hot Deal "${deal.title}" for ${deal.property.title} (Ref: ${deal.property.reference}).`;
  return {
    id: deal.id,
    title: deal.title,
    description: deal.description,
    promotionalPrice: deal.promotionalPrice,
    currency: deal.currency,
    originalPrice: verified ? deal.originalPrice : null,
    discountAmount: verified ? deal.discountAmount : null,
    discountPercentage: verified ? deal.discountPercentage : null,
    startAt: deal.startAt,
    endAt: deal.endAt,
    property: {
      id: deal.property.id,
      reference: deal.property.reference,
      title: deal.property.title,
      slug: deal.property.slug,
      purpose: deal.property.purpose,
      pricePeriod: deal.property.pricePeriod,
      district: deal.property.district,
      city: deal.property.city,
      neighborhood: deal.property.neighborhood,
      bedrooms: deal.property.bedrooms,
      bathrooms: deal.property.bathrooms,
      mainImage: deal.property.mainImage,
    },
    whatsappUrl: whatsappNumber ? buildWhatsAppLink(whatsappNumber, message) : undefined,
  };
}

async function requireDeal(id, conn) {
  const deal = await HotDeal.findById(id, conn);
  if (!deal) throw AppError.notFound('Hot deal not found');
  return deal;
}

async function requireProperty(propertyId, conn) {
  const [property] = await Property.findBasicByIds([propertyId], conn);
  if (!property) throw AppError.validation([{ path: 'propertyId', message: 'Property does not exist' }]);
  if (property.publicationStatus === 'archived') {
    throw AppError.validation([{ path: 'propertyId', message: 'Archived properties cannot have deals' }]);
  }
  return property;
}

/** Work out pricing fields and verification metadata for create/update. */
function priceFields(input, existing, property, actor) {
  const originalPrice = input.originalPrice !== undefined ? input.originalPrice : (existing?.originalPrice ?? null);
  const discountType = input.discountType ?? existing.discountType;
  const discountValue = input.discountValue ?? existing.discountValue;
  const basePrice = originalPrice ?? property.price;
  const calc = calculateDeal({ basePrice, discountType, discountValue });

  // Verification of the displayed original price.
  let verified = existing?.originalPriceVerified ?? false;
  const originalChanged = existing ? originalPrice !== existing.originalPrice : originalPrice !== null;
  if (originalChanged) verified = false;
  if (input.originalPriceVerified !== undefined) {
    if (input.originalPriceVerified && !actor.can('hot_deals.verify_price')) {
      throw AppError.forbidden('You are not allowed to verify original prices.');
    }
    verified = input.originalPriceVerified;
  }
  if (originalPrice === null) verified = false;
  const verification =
    verified && (!existing?.originalPriceVerified || originalChanged)
      ? { originalPriceVerifiedBy: actor.id, originalPriceVerifiedAt: new Date() }
      : !verified
        ? { originalPriceVerifiedBy: null, originalPriceVerifiedAt: null }
        : {};

  return {
    originalPrice,
    originalPriceVerified: verified,
    ...verification,
    discountType,
    discountValue,
    currency: property.currency,
    ...calc,
  };
}

export async function previewCalculation(input) {
  const property = await requireProperty(input.propertyId);
  const basePrice = input.originalPrice ?? property.price;
  return { ...calculateDeal({ basePrice, discountType: input.discountType, discountValue: input.discountValue }), currency: property.currency, propertyPrice: property.price };
}

export async function listDeals(filters) {
  const page = paginate(filters);
  const { rows, total } = await HotDeal.list({ ...filters, ...page });
  return { rows, meta: pageMeta(page, total) };
}

export const getDeal = (id) => requireDeal(id);

export async function createDeal(input, actor) {
  const id = await transaction(async (conn) => {
    const property = await requireProperty(input.propertyId, conn);
    const pricing = priceFields(input, null, property, actor);
    const newId = await HotDeal.create({ ...input, ...pricing, userId: actor.id }, conn);
    await audit(actor, 'hot_deal.created', 'hot_deal', newId, {
      propertyId: property.id,
      promotionalPrice: pricing.promotionalPrice,
      discountPercentage: pricing.discountPercentage,
    }, conn);
    return newId;
  });
  return requireDeal(id);
}

export async function updateDeal(id, input, actor) {
  await transaction(async (conn) => {
    const existing = await requireDeal(id, conn);
    if (['ended', 'expired'].includes(existing.status)) {
      throw AppError.conflict('Ended or expired deals are kept for history and cannot be edited. Create a new deal instead.');
    }
    const property = await requireProperty(input.propertyId ?? existing.property.id, conn);
    const pricing = priceFields(input, existing, property, actor);
    const startAt = input.startAt ?? existing.startAt;
    const endAt = input.endAt ?? existing.endAt;
    if (new Date(endAt) <= new Date(startAt)) {
      throw AppError.validation([{ path: 'endAt', message: 'End date must be after the start date' }]);
    }
    const changes = { ...input, ...pricing, updatedBy: actor.id };
    await HotDeal.update(id, changes, conn);

    // A running deal whose new schedule is in the future/past gets its status realigned.
    if (['scheduled', 'active'].includes(existing.status)) {
      await HotDeal.setStatus(id, resolveLaunchStatus({ startAt, endAt }), actor.id, conn);
    }
    await audit(actor, 'hot_deal.updated', 'hot_deal', id, diff(existing, changes, [
      'title', 'originalPrice', 'originalPriceVerified', 'discountType', 'discountValue', 'promotionalPrice', 'startAt', 'endAt',
    ]), conn);
  });
  return requireDeal(id);
}

/** Schedule or activate a deal. The property must be published and available. */
export async function activateDeal(id, actor) {
  await transaction(async (conn) => {
    const deal = await requireDeal(id, conn);
    if (!['draft', 'paused', 'scheduled', 'active'].includes(deal.status)) {
      throw AppError.conflict(`A deal that is ${deal.status} cannot be activated.`);
    }
    if (deal.property.publicationStatus !== 'published' || deal.property.availabilityStatus !== 'available') {
      throw AppError.conflict('Deals can only run on published properties that are available.');
    }
    // Recalculate against the current property price when no original price is set.
    const property = await requireProperty(deal.property.id, conn);
    const pricing = priceFields({}, deal, property, actor);
    await HotDeal.update(id, { ...pricing, updatedBy: actor.id }, conn);
    const status = resolveLaunchStatus(deal);
    await HotDeal.setStatus(id, status, actor.id, conn);
    await audit(actor, status === 'scheduled' ? 'hot_deal.scheduled' : 'hot_deal.activated', 'hot_deal', id, { from: deal.status }, conn);
  });
  return requireDeal(id);
}

export async function pauseDeal(id, actor) {
  const deal = await requireDeal(id);
  if (!['scheduled', 'active'].includes(deal.status)) throw AppError.conflict('Only scheduled or active deals can be paused.');
  await HotDeal.setStatus(id, 'paused', actor.id);
  await audit(actor, 'hot_deal.paused', 'hot_deal', id, { from: deal.status });
  return requireDeal(id);
}

export async function endDeal(id, actor) {
  const deal = await requireDeal(id);
  if (['ended', 'expired'].includes(deal.status)) throw AppError.conflict('This deal has already finished.');
  await HotDeal.setStatus(id, 'ended', actor.id);
  await audit(actor, 'hot_deal.ended', 'hot_deal', id, { from: deal.status });
  return requireDeal(id);
}

export async function listPublicDeals(query) {
  const page = paginate({ page: query.page, limit: query.limit ?? 24 });
  const [{ rows, total }, settings] = await Promise.all([HotDeal.findLive(page), BusinessSetting.findPublicMap()]);
  return { rows: rows.map((d) => publicDeal(d, settings.whatsapp_number)), meta: pageMeta(page, total) };
}

export async function getPublicDeal(id) {
  const deal = await HotDeal.findLiveById(id);
  if (!deal) throw AppError.notFound('This deal is not available');
  const settings = await BusinessSetting.findPublicMap();
  return publicDeal(deal, settings.whatsapp_number);
}
