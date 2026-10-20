import { z } from 'zod';
import {
  dateValue,
  money,
  optionalDate,
  optionalId,
  optionalText,
  paginationQuery,
  queryDate,
  queryEnum,
  queryNumber,
  queryText,
  refineDateRange,
  safeUrl,
  text,
  uploadPath,
} from './common.js';

export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'active', 'paused', 'expired', 'archived'];
export const DEAL_STATUSES = ['draft', 'scheduled', 'active', 'paused', 'ended', 'expired'];
export const CAMPAIGN_TYPES = ['general', 'featured', 'hot_deals', 'category', 'seasonal'];
export const PROMOTION_PLACEMENTS = ['homepage', 'promotions_page', 'listing_page', 'details_page'];
export const DISCOUNT_TYPES = ['percentage', 'amount', 'fixed_price'];

// ---------------------------------------------------------------- Featured
const featuredFields = {
  propertyId: z.coerce.number().int().positive(),
  label: optionalText(80),
  displayOrder: z.coerce.number().int().min(0).max(10000).optional(),
  startAt: dateValue,
  endAt: optionalDate,
  isActive: z.boolean().optional(),
  priorityInSearch: z.boolean().optional(),
};
export const featuredCreateSchema = refineDateRange(z.object(featuredFields));
export const featuredUpdateSchema = refineDateRange(z.object(featuredFields).partial());
export const featuredListQuery = z.object({
  state: queryEnum(['live', 'scheduled', 'inactive', 'expired']),
  ...paginationQuery,
});

// --------------------------------------------------------------- Hot deals
const dealFields = {
  propertyId: z.coerce.number().int().positive(),
  title: text(150, 3),
  description: optionalText(5000),
  originalPrice: z.preprocess((v) => (v === '' ? null : v), money.nullable()).optional(),
  originalPriceVerified: z.boolean().optional(),
  discountType: z.enum(DISCOUNT_TYPES),
  discountValue: money,
  startAt: dateValue,
  endAt: dateValue,
  displayOrder: z.coerce.number().int().min(0).max(10000).optional(),
};
export const dealCreateSchema = refineDateRange(z.object(dealFields));
export const dealUpdateSchema = refineDateRange(z.object(dealFields).partial());
export const dealCalculateSchema = z.object({
  propertyId: z.coerce.number().int().positive(),
  originalPrice: z.preprocess((v) => (v === '' ? null : v), money.nullable()).optional(),
  discountType: z.enum(DISCOUNT_TYPES),
  discountValue: money,
});
export const dealListQuery = z.object({
  status: queryEnum([...DEAL_STATUSES, 'live']),
  search: queryText(),
  propertyId: queryNumber(z.coerce.number().int().positive()),
  ...paginationQuery,
});

// ---------------------------------------------------------- Advertisements
const adFields = {
  internalName: text(150, 2),
  headline: text(150, 2),
  description: optionalText(500),
  desktopImage: uploadPath,
  mobileImage: uploadPath,
  destinationUrl: safeUrl,
  propertyId: optionalId,
  placementId: z.coerce.number().int().positive(),
  startAt: dateValue,
  endAt: optionalDate,
  displayOrder: z.coerce.number().int().min(0).max(10000).optional(),
};
export const adCreateSchema = refineDateRange(z.object(adFields));
export const adUpdateSchema = refineDateRange(z.object(adFields).partial());
export const adListQuery = z.object({
  status: queryEnum(CAMPAIGN_STATUSES),
  placementId: queryNumber(z.coerce.number().int().positive()),
  search: queryText(),
  ...paginationQuery,
});

// --------------------------------------------------------------- Promotions
const promoFields = {
  name: text(150, 3),
  description: optionalText(10000),
  bannerImage: uploadPath,
  campaignType: z.enum(CAMPAIGN_TYPES),
  categoryId: optionalId,
  placement: z.enum(PROMOTION_PLACEMENTS),
  destinationUrl: safeUrl,
  startAt: dateValue,
  endAt: optionalDate,
  displayOrder: z.coerce.number().int().min(0).max(10000).optional(),
  propertyIds: z.array(z.coerce.number().int().positive()).max(100).optional(),
};
export const promoCreateSchema = refineDateRange(z.object(promoFields)).refine(
  (v) => v.campaignType !== 'category' || v.categoryId,
  { message: 'Choose the category for a property category campaign', path: ['categoryId'] },
);
export const promoUpdateSchema = refineDateRange(z.object(promoFields).partial());
export const promoListQuery = z.object({
  status: queryEnum(CAMPAIGN_STATUSES),
  campaignType: queryEnum(CAMPAIGN_TYPES),
  search: queryText(),
  ...paginationQuery,
});

// ---------------------------------------------------------------- Analytics
export const adEventSchema = z.object({
  advertisementId: z.coerce.number().int().positive(),
  eventType: z.enum(['impression', 'click']),
});
export const campaignEventSchema = z.object({
  entityType: z.enum(['promotion', 'hot_deal', 'featured']),
  entityId: z.coerce.number().int().positive(),
  eventType: z.enum(['view', 'click']),
});
export const analyticsQuery = z.object({ from: queryDate, to: queryDate });
