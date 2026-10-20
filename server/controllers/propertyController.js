import { actorFrom } from '../middleware/auth.js';
import { audit } from '../services/auditService.js';
import * as categoryService from '../services/categoryService.js';
import * as propertyService from '../services/propertyService.js';
import { toCsv } from '../utils/csv.js';
import { created, noContent, ok } from '../utils/response.js';

const id = (req) => req.valid.params.id;

export async function list(req, res) {
  const { rows, meta } = await propertyService.searchAdmin(req.valid.query);
  ok(res, rows, meta);
}

export async function get(req, res) {
  ok(res, await propertyService.getPropertyForAdmin(id(req)));
}

export async function create(req, res) {
  created(res, await propertyService.createProperty(req.valid.body, actorFrom(req)));
}

export async function update(req, res) {
  ok(res, await propertyService.updateProperty(id(req), req.valid.body, actorFrom(req)));
}

export async function publish(req, res) {
  ok(res, await propertyService.publishProperty(id(req), actorFrom(req)));
}

export async function unpublish(req, res) {
  ok(res, await propertyService.unpublishProperty(id(req), actorFrom(req)));
}

export async function availability(req, res) {
  ok(res, await propertyService.setAvailability(id(req), req.valid.body.status, actorFrom(req)));
}

export async function archive(req, res) {
  ok(res, await propertyService.archiveProperty(id(req), actorFrom(req)));
}

export async function restore(req, res) {
  ok(res, await propertyService.restoreProperty(id(req), actorFrom(req)));
}

export async function addImages(req, res) {
  created(res, await propertyService.addImages(id(req), req.files, actorFrom(req)));
}

export async function reorderImages(req, res) {
  ok(res, await propertyService.reorderImages(id(req), req.valid.body.imageIds, actorFrom(req)));
}

export async function updateImage(req, res) {
  const { id: propertyId, imageId } = req.valid.params;
  ok(res, await propertyService.updateImageAlt(propertyId, imageId, req.valid.body.altText, actorFrom(req)));
}

export async function deleteImage(req, res) {
  const { id: propertyId, imageId } = req.valid.params;
  ok(res, await propertyService.deleteImage(propertyId, imageId, actorFrom(req)));
}

export async function options(req, res) {
  ok(res, await propertyService.propertyOptions(req.valid.query));
}

export async function amenities(_req, res) {
  ok(res, await propertyService.listAmenities());
}

export async function exportCsv(req, res) {
  const rows = await propertyService.exportProperties(req.valid.query);
  await audit(actorFrom(req), 'property.exported', 'property', null, { count: rows.length });
  const csv = toCsv(rows, [
    { label: 'Reference', key: 'reference' },
    { label: 'Title', key: 'title' },
    { label: 'Category', value: (r) => r.category.name },
    { label: 'Purpose', key: 'purpose' },
    { label: 'Price', key: 'price' },
    { label: 'Currency', key: 'currency' },
    { label: 'Price period', key: 'pricePeriod' },
    { label: 'District', key: 'district' },
    { label: 'City', key: 'city' },
    { label: 'Neighborhood', key: 'neighborhood' },
    { label: 'Bedrooms', key: 'bedrooms' },
    { label: 'Bathrooms', key: 'bathrooms' },
    { label: 'Property size (m²)', key: 'propertySize' },
    { label: 'Land size (m²)', key: 'landSize' },
    { label: 'Availability', key: 'availabilityStatus' },
    { label: 'Publication', key: 'publicationStatus' },
    { label: 'Published at', key: 'publishedAt' },
    { label: 'Updated at', key: 'updatedAt' },
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="properties-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}

// ------------------------------------------------------------- Categories

export async function listCategories(_req, res) {
  ok(res, await categoryService.listCategories());
}

export async function createCategory(req, res) {
  created(res, await categoryService.createCategory(req.valid.body, actorFrom(req)));
}

export async function updateCategory(req, res) {
  ok(res, await categoryService.updateCategory(id(req), req.valid.body, actorFrom(req)));
}

export async function deleteCategory(req, res) {
  await categoryService.deleteCategory(id(req), actorFrom(req));
  noContent(res);
}
