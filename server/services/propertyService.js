import { transaction } from '../config/database.js';
import { Amenity } from '../models/Amenity.js';
import { BusinessSetting } from '../models/BusinessSetting.js';
import { FeaturedProperty } from '../models/FeaturedProperty.js';
import { HotDeal } from '../models/HotDeal.js';
import { Property } from '../models/Property.js';
import { PropertyCategory } from '../models/PropertyCategory.js';
import { PropertyImage } from '../models/PropertyImage.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta, paginate } from '../utils/pagination.js';
import { uniqueSlug } from '../utils/slugify.js';
import { buildWhatsAppLink, propertyWhatsAppMessage } from '../utils/whatsapp.js';
import { audit, diff } from './auditService.js';
import { publicDeal } from './hotDealService.js';
import { propertyStructuredData } from './seoService.js';
import { deleteUpload, saveImage } from './uploadService.js';

export const MAX_IMAGES_PER_PROPERTY = 30;
const PRICE_FIELDS = ['price', 'currency', 'pricePeriod'];
const TRACKED_FIELDS = [
  'title', 'slug', 'description', 'categoryId', 'purpose', 'price', 'currency', 'pricePeriod', 'address',
  'neighborhood', 'district', 'city', 'latitude', 'longitude', 'bedrooms', 'bathrooms', 'propertySize', 'landSize',
  'videoUrl', 'virtualTourUrl',
];
const UNAVAILABLE_FOR_DEALS = ['sold', 'rented', 'unavailable'];

async function requireProperty(id, conn) {
  const property = await Property.findById(id, conn);
  if (!property) throw AppError.notFound('Property not found');
  return property;
}

async function requireActiveCategory(categoryId, conn) {
  const category = await PropertyCategory.findById(categoryId, conn);
  if (!category) throw AppError.validation([{ path: 'categoryId', message: 'Category does not exist' }]);
  if (!category.isActive) throw AppError.validation([{ path: 'categoryId', message: 'Category is inactive' }]);
  return category;
}

/** Full admin view: record + images + amenities. */
export async function getPropertyForAdmin(id) {
  const property = await requireProperty(id);
  const [images, amenities] = await Promise.all([
    PropertyImage.listForProperty(id),
    Amenity.namesForProperty(id),
  ]);
  return { ...property, images, amenities };
}

export async function searchAdmin(filters) {
  const page = paginate(filters);
  const { rows, total } = await Property.search(filters, { ...page, publicOnly: false });
  return { rows, meta: pageMeta(page, total) };
}

export async function searchPublic(filters) {
  const page = paginate(filters);
  const { rows, total } = await Property.search(filters, { ...page, publicOnly: true });
  return { rows, meta: pageMeta(page, total) };
}

/** Public detail page payload. Unpublished, draft, archived or unavailable listings are not found. */
export async function getPublicProperty(slug) {
  const property = await Property.findBySlug(slug, { publicOnly: true });
  if (!property) throw AppError.notFound('Property not found');
  const [images, amenities, related, deal, settings] = await Promise.all([
    PropertyImage.listForProperty(property.id),
    Amenity.namesForProperty(property.id),
    Property.related(property, 4),
    HotDeal.findLiveForProperty(property.id),
    BusinessSetting.findPublicMap(),
  ]);
  const whatsappUrl = buildWhatsAppLink(
    settings.whatsapp_number,
    propertyWhatsAppMessage(property, settings.site_url),
  );
  return {
    ...property,
    images: images.map(({ id, url, altText }) => ({ id, url, altText })),
    amenities,
    related,
    hotDeal: deal ? publicDeal(deal) : null,
    whatsappUrl,
    structuredData: propertyStructuredData(property, images),
  };
}

export async function createProperty(input, actor) {
  const id = await transaction(async (conn) => {
    await requireActiveCategory(input.categoryId, conn);
    if (input.availabilityStatus && input.availabilityStatus !== 'available' && !actor.can('properties.change_availability')) {
      throw AppError.forbidden('You are not allowed to set property availability.');
    }
    const slug = input.slug
      ? await ensureSlugAvailable(input.slug, 0, conn)
      : await uniqueSlug(input.title, (s) => Property.slugExists(s, 0, conn), 200);
    const newId = await Property.create({ ...input, slug, userId: actor.id }, conn);
    if (input.amenities?.length) {
      await Amenity.setForProperty(newId, await Amenity.findOrCreateByNames(input.amenities, conn), conn);
    }
    await audit(actor, 'property.created', 'property', newId, { title: input.title, price: input.price }, conn);
    return newId;
  });
  return getPropertyForAdmin(id);
}

async function ensureSlugAvailable(slug, excludeId, conn) {
  if (await Property.slugExists(slug, excludeId, conn)) {
    throw AppError.validation([{ path: 'slug', message: 'This URL slug is already used by another property' }]);
  }
  return slug;
}

export async function updateProperty(id, input, actor) {
  await transaction(async (conn) => {
    const existing = await requireProperty(id, conn);
    if (existing.publicationStatus === 'archived') {
      throw AppError.conflict('Archived properties cannot be edited. Restore the property first.');
    }

    // Price changes require a dedicated permission.
    const priceChanged = PRICE_FIELDS.some((f) => input[f] !== undefined && input[f] !== existing[f]);
    if (priceChanged && !actor.can('properties.change_price')) {
      throw AppError.forbidden('You are not allowed to change property prices.');
    }
    if (
      input.availabilityStatus !== undefined &&
      input.availabilityStatus !== existing.availabilityStatus &&
      !actor.can('properties.change_availability')
    ) {
      throw AppError.forbidden('You are not allowed to change property availability.');
    }
    if (input.categoryId !== undefined && input.categoryId !== existing.category.id) {
      await requireActiveCategory(input.categoryId, conn);
    }
    const purpose = input.purpose ?? existing.purpose;
    const pricePeriod = input.pricePeriod ?? existing.pricePeriod;
    if (purpose === 'sale' && pricePeriod !== 'total') {
      throw AppError.validation([{ path: 'pricePeriod', message: 'Properties for sale must use a total price' }]);
    }

    const changes = { ...input };
    if (input.slug && input.slug !== existing.slug) await ensureSlugAvailable(input.slug, id, conn);
    const before = { ...existing, categoryId: existing.category.id };
    await Property.update(id, { ...changes, updatedBy: actor.id }, conn);

    if (input.amenities !== undefined) {
      await Amenity.setForProperty(id, await Amenity.findOrCreateByNames(input.amenities, conn), conn);
    }
    if (input.availabilityStatus !== undefined && input.availabilityStatus !== existing.availabilityStatus) {
      await applyAvailability(existing, input.availabilityStatus, actor, conn);
    }
    const changed = diff(before, changes, TRACKED_FIELDS);
    await audit(actor, priceChanged ? 'property.price_changed' : 'property.updated', 'property', id, changed, conn);
  });
  return getPropertyForAdmin(id);
}

async function applyAvailability(existing, status, actor, conn) {
  await Property.setAvailability(existing.id, status, actor.id, conn);
  let dealsEnded = 0;
  // Unavailable properties cannot keep running deals.
  if (UNAVAILABLE_FOR_DEALS.includes(status)) dealsEnded = await HotDeal.endForProperty(existing.id, actor.id, conn);
  await audit(actor, 'property.availability_changed', 'property', existing.id, {
    from: existing.availabilityStatus,
    to: status,
    hotDealsEnded: dealsEnded,
  }, conn);
}

export async function setAvailability(id, status, actor) {
  await transaction(async (conn) => {
    const existing = await requireProperty(id, conn);
    if (existing.availabilityStatus === status) return;
    await applyAvailability(existing, status, actor, conn);
  });
  return getPropertyForAdmin(id);
}

/** Publishing rules: not archived, has at least one photo, and complete core details. */
export async function publishProperty(id, actor) {
  await transaction(async (conn) => {
    const property = await requireProperty(id, conn);
    if (property.publicationStatus === 'archived') throw AppError.conflict('Restore the archived property before publishing.');
    const problems = [];
    if (!property.imageCount) problems.push({ path: 'images', message: 'Add at least one photo before publishing' });
    if (!(property.price > 0)) problems.push({ path: 'price', message: 'Set a price greater than zero' });
    if ((property.description ?? '').length < 20) problems.push({ path: 'description', message: 'Description is too short' });
    if (problems.length) throw AppError.validation(problems, 'The listing is not ready to publish');
    await Property.setPublicationStatus(id, 'published', actor.id, conn);
    await audit(actor, 'property.published', 'property', id, { from: property.publicationStatus }, conn);
  });
  return getPropertyForAdmin(id);
}

export async function unpublishProperty(id, actor) {
  await transaction(async (conn) => {
    const property = await requireProperty(id, conn);
    if (property.publicationStatus !== 'published') throw AppError.conflict('Only published properties can be unpublished.');
    await Property.setPublicationStatus(id, 'unpublished', actor.id, conn);
    await audit(actor, 'property.unpublished', 'property', id, null, conn);
  });
  return getPropertyForAdmin(id);
}

/** Archive keeps the record, its inquiries and campaign history; running deals end and featured slots deactivate. */
export async function archiveProperty(id, actor) {
  await transaction(async (conn) => {
    const property = await requireProperty(id, conn);
    if (property.publicationStatus === 'archived') return;
    await Property.setPublicationStatus(id, 'archived', actor.id, conn);
    const dealsEnded = await HotDeal.endForProperty(id, actor.id, conn);
    const featuredDeactivated = await FeaturedProperty.deactivateForProperty(id, actor.id, conn);
    await audit(actor, 'property.archived', 'property', id, { from: property.publicationStatus, dealsEnded, featuredDeactivated }, conn);
  });
  return getPropertyForAdmin(id);
}

export async function restoreProperty(id, actor) {
  await transaction(async (conn) => {
    const property = await requireProperty(id, conn);
    if (property.publicationStatus !== 'archived') throw AppError.conflict('Only archived properties can be restored.');
    await Property.setPublicationStatus(id, 'unpublished', actor.id, conn);
    await audit(actor, 'property.restored', 'property', id, null, conn);
  });
  return getPropertyForAdmin(id);
}

// ------------------------------------------------------------------ Images

export async function addImages(id, files, actor) {
  const property = await requireProperty(id);
  if (property.publicationStatus === 'archived') throw AppError.conflict('Archived properties cannot be edited.');
  if (!files?.length) throw AppError.badRequest('Select at least one image to upload.');
  const existingCount = await PropertyImage.count(id);
  if (existingCount + files.length > MAX_IMAGES_PER_PROPERTY) {
    throw AppError.badRequest(`A property can have at most ${MAX_IMAGES_PER_PROPERTY} images.`);
  }

  // Validate and store every file first; roll back stored files if anything fails.
  const saved = [];
  try {
    for (const file of files) saved.push(await saveImage(file, 'properties'));
    await transaction(async (conn) => {
      let order = await PropertyImage.nextSortOrder(id, conn);
      for (const image of saved) {
        await PropertyImage.create({ propertyId: id, ...image, altText: property.title, sortOrder: order }, conn);
        order += 1;
      }
      await audit(actor, 'property.images_added', 'property', id, { count: saved.length }, conn);
    });
  } catch (error) {
    await Promise.all(saved.map((s) => deleteUpload(s.filePath)));
    throw error;
  }
  return PropertyImage.listForProperty(id);
}

export async function reorderImages(id, imageIds, actor) {
  await requireProperty(id);
  const current = await PropertyImage.listForProperty(id);
  const currentIds = current.map((i) => i.id).sort((a, b) => a - b);
  const requested = [...new Set(imageIds)];
  if (requested.length !== currentIds.length || [...requested].sort((a, b) => a - b).some((v, i) => v !== currentIds[i])) {
    throw AppError.badRequest('The new order must include every image of this property exactly once.');
  }
  await transaction(async (conn) => {
    await PropertyImage.reorder(id, requested, conn);
    await audit(actor, 'property.images_reordered', 'property', id, { order: requested }, conn);
  });
  return PropertyImage.listForProperty(id);
}

export async function updateImageAlt(id, imageId, altText, actor) {
  const image = await PropertyImage.findById(imageId);
  if (!image || image.propertyId !== id) throw AppError.notFound('Image not found');
  await PropertyImage.updateAltText(imageId, altText);
  await audit(actor, 'property.image_updated', 'property', id, { imageId });
  return PropertyImage.findById(imageId);
}

export async function deleteImage(id, imageId, actor) {
  const property = await requireProperty(id);
  const image = await PropertyImage.findById(imageId);
  if (!image || image.propertyId !== id) throw AppError.notFound('Image not found');
  if (property.publicationStatus === 'published' && property.imageCount <= 1) {
    throw AppError.conflict('A published property must keep at least one photo. Upload another image first or unpublish the listing.');
  }
  await PropertyImage.delete(imageId);
  await deleteUpload(image.filePath);
  await audit(actor, 'property.image_deleted', 'property', id, { imageId });
  return PropertyImage.listForProperty(id);
}

export const propertyOptions = (query) =>
  Property.options({ q: query.q, promotableOnly: Boolean(query.promotable), limit: 25 });

export const exportProperties = (filters) => Property.exportRows(filters);

export const publicLocations = () => Property.publicLocations();

export const listAmenities = () => Amenity.findAll();
