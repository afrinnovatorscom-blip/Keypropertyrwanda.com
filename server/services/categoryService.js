import { PropertyCategory } from '../models/PropertyCategory.js';
import { AppError } from '../utils/AppError.js';
import { slugify } from '../utils/slugify.js';
import { audit, diff } from './auditService.js';

export const listCategories = () => PropertyCategory.findAll();
export const listPublicCategories = () => PropertyCategory.findActiveWithPublicCounts();

async function assertUnique({ name, slug }, excludeId = 0) {
  const problems = [];
  if (name && (await PropertyCategory.nameExists(name, excludeId))) problems.push({ path: 'name', message: 'A category with this name already exists' });
  if (slug && (await PropertyCategory.slugExists(slug, excludeId))) problems.push({ path: 'slug', message: 'This slug is already used' });
  if (problems.length) throw AppError.validation(problems);
}

export async function createCategory(input, actor) {
  const slug = input.slug || slugify(input.name, 120);
  if (!slug) throw AppError.validation([{ path: 'slug', message: 'Unable to derive a slug from the name' }]);
  await assertUnique({ name: input.name, slug });
  const id = await PropertyCategory.create({ ...input, slug });
  await audit(actor, 'category.created', 'category', id, { name: input.name });
  return PropertyCategory.findById(id);
}

export async function updateCategory(id, input, actor) {
  const existing = await PropertyCategory.findById(id);
  if (!existing) throw AppError.notFound('Category not found');
  await assertUnique({ name: input.name, slug: input.slug }, id);
  await PropertyCategory.update(id, input);
  await audit(actor, 'category.updated', 'category', id, diff(existing, input, ['name', 'slug', 'typeGroup', 'description', 'isActive', 'sortOrder']));
  return PropertyCategory.findById(id);
}

/** Categories in use cannot be deleted (deactivate them instead) so listings keep their history. */
export async function deleteCategory(id, actor) {
  const existing = await PropertyCategory.findById(id);
  if (!existing) throw AppError.notFound('Category not found');
  const used = await PropertyCategory.countProperties(id);
  if (used > 0) throw AppError.conflict(`This category is used by ${used} propert${used === 1 ? 'y' : 'ies'}. Deactivate it instead.`);
  await PropertyCategory.delete(id);
  await audit(actor, 'category.deleted', 'category', id, { name: existing.name });
}
