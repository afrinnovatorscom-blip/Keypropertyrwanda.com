import { z } from 'zod';
import {
  money,
  optionalInt,
  optionalNumber,
  optionalText,
  paginationQuery,
  queryBool,
  queryEnum,
  queryNumber,
  queryText,
  safeExternalUrl,
  text,
} from './common.js';

export const PURPOSES = ['sale', 'rent'];
export const AVAILABILITY = ['available', 'under_offer', 'sold', 'rented', 'unavailable'];
export const PUBLICATION = ['draft', 'published', 'unpublished', 'archived'];
export const PRICE_PERIODS = ['total', 'month', 'year', 'night'];
export const CURRENCIES = ['RWF', 'USD', 'EUR'];
export const SORTS = ['recommended', 'newest', 'oldest', 'price_asc', 'price_desc', 'size_desc', 'updated'];
export const GROUPS = ['residential', 'land', 'commercial', 'other'];

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only');

const propertyFields = {
  title: text(200, 5),
  slug: z.preprocess((v) => (v === '' ? undefined : v), slugField.optional()),
  description: text(20000, 20),
  categoryId: z.coerce.number().int().positive(),
  purpose: z.enum(PURPOSES),
  price: money.refine((v) => v > 0, 'Price must be greater than zero'),
  currency: z.enum(CURRENCIES).default('RWF'),
  pricePeriod: z.enum(PRICE_PERIODS).default('total'),
  address: optionalText(255),
  neighborhood: optionalText(120),
  district: text(120, 2),
  city: text(120, 2),
  latitude: optionalNumber(-90, 90),
  longitude: optionalNumber(-180, 180),
  bedrooms: optionalInt(0, 100),
  bathrooms: optionalInt(0, 100),
  propertySize: optionalNumber(0, 10_000_000),
  landSize: optionalNumber(0, 100_000_000),
  videoUrl: safeExternalUrl,
  virtualTourUrl: safeExternalUrl,
  availabilityStatus: z.enum(AVAILABILITY).optional(),
  amenities: z.array(z.string().trim().min(1).max(80)).max(60).optional(),
};

const rentPeriodRule = (v) => !(v.purpose === 'sale' && v.pricePeriod && !['total'].includes(v.pricePeriod));
const rentPeriodMessage = { message: 'Properties for sale must use a total price', path: ['pricePeriod'] };

export const createPropertySchema = z.object(propertyFields).refine(rentPeriodRule, rentPeriodMessage);

export const updatePropertySchema = z
  .object(
    Object.fromEntries(
      Object.entries(propertyFields).map(([k, schema]) => [
        k,
        // On update every field is optional; defaults must not overwrite stored values.
        (schema instanceof z.ZodDefault ? schema.removeDefault() : schema).optional(),
      ]),
    ),
  )
  .refine(rentPeriodRule, rentPeriodMessage);

export const publicSearchQuery = z.object({
  q: queryText(100),
  location: queryText(120),
  district: queryText(120),
  category: queryText(120),
  group: queryEnum(GROUPS),
  purpose: queryEnum(PURPOSES),
  minPrice: queryNumber(),
  maxPrice: queryNumber(),
  bedrooms: queryNumber(z.coerce.number().int().min(0).max(100)),
  bathrooms: queryNumber(z.coerce.number().int().min(0).max(100)),
  minSize: queryNumber(),
  maxSize: queryNumber(),
  availability: queryEnum(['available', 'under_offer', 'sold', 'rented']),
  sort: queryEnum(SORTS),
  ...paginationQuery,
});

export const adminSearchQuery = publicSearchQuery.extend({
  availability: queryEnum(AVAILABILITY),
  publicationStatus: queryEnum(PUBLICATION),
  categoryId: queryNumber(z.coerce.number().int().positive()),
  includeArchived: queryBool,
});

export const availabilitySchema = z.object({ status: z.enum(AVAILABILITY) });

export const reorderImagesSchema = z.object({
  imageIds: z.array(z.coerce.number().int().positive()).min(1).max(100),
});

export const imageAltSchema = z.object({ altText: optionalText(255) });

export const imageParams = z.object({
  id: z.coerce.number().int().positive(),
  imageId: z.coerce.number().int().positive(),
});

export const slugParam = z.object({ slug: slugField });

export const optionsQuery = z.object({
  q: queryText(100),
  promotable: queryBool,
});

export const categorySchema = z.object({
  name: text(100, 2),
  slug: z.preprocess((v) => (v === '' ? undefined : v), slugField.optional()),
  typeGroup: z.enum(GROUPS),
  description: optionalText(500),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

export const categoryUpdateSchema = categorySchema.partial();
