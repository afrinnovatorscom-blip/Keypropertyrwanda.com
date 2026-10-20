import { Router } from 'express';
import * as admin from '../controllers/adminController.js';
import * as campaigns from '../controllers/campaignController.js';
import * as properties from '../controllers/propertyController.js';
import { requireAnyPermission, requireAuth, requirePermission as perm } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';
import { uploadImages, uploadSingleImage } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import {
  auditListQuery,
  contentKeyParam,
  contentUpdateSchema,
  heroOrderSchema,
  heroSettingsSchema,
  heroSlideCreateSchema,
  heroSlideUpdateSchema,
  inquiryListQuery,
  inquiryNoteSchema,
  inquiryUpdateSchema,
  roleSchema,
  roleUpdateSchema,
  settingsUpdateSchema,
  uploadQuery,
  userCreateSchema,
  userListQuery,
  userUpdateSchema,
} from '../validators/adminValidators.js';
import {
  adCreateSchema,
  adListQuery,
  adUpdateSchema,
  analyticsQuery,
  dealCalculateSchema,
  dealCreateSchema,
  dealListQuery,
  dealUpdateSchema,
  featuredCreateSchema,
  featuredListQuery,
  featuredUpdateSchema,
  promoCreateSchema,
  promoListQuery,
  promoUpdateSchema,
} from '../validators/campaignValidators.js';
import { idParam } from '../validators/common.js';
import {
  adminSearchQuery,
  availabilitySchema,
  categorySchema,
  categoryUpdateSchema,
  createPropertySchema,
  imageAltSchema,
  imageParams,
  optionsQuery,
  reorderImagesSchema,
  updatePropertySchema,
} from '../validators/propertyValidators.js';

/** Administration API: every route requires a session; unsafe methods require a CSRF token. */
const router = Router();
router.use(requireAuth, verifyCsrf);

const byId = validate({ params: idParam });

router.get('/dashboard', perm('dashboard.view'), admin.dashboard);

// --------------------------------------------------------------- Properties
router.get('/properties', perm('properties.view'), validate({ query: adminSearchQuery }), properties.list);
router.get('/properties/export', perm('properties.export'), validate({ query: adminSearchQuery }), properties.exportCsv);
router.get(
  '/properties/options',
  requireAnyPermission('properties.view', 'featured.manage', 'hot_deals.create', 'promotions.create', 'advertisements.create'),
  validate({ query: optionsQuery }),
  properties.options,
);
router.get('/amenities', perm('properties.view'), properties.amenities);
router.post('/properties', perm('properties.create'), validate({ body: createPropertySchema }), properties.create);
router.get('/properties/:id', perm('properties.view'), byId, properties.get);
router.put('/properties/:id', perm('properties.edit'), validate({ params: idParam, body: updatePropertySchema }), properties.update);
router.post('/properties/:id/publish', perm('properties.publish'), byId, properties.publish);
router.post('/properties/:id/unpublish', perm('properties.publish'), byId, properties.unpublish);
router.post('/properties/:id/availability', perm('properties.change_availability'), validate({ params: idParam, body: availabilitySchema }), properties.availability);
router.post('/properties/:id/archive', perm('properties.archive'), byId, properties.archive);
router.post('/properties/:id/restore', perm('properties.archive'), byId, properties.restore);
router.post('/properties/:id/images', perm('properties.edit'), byId, uploadImages('images', 20), properties.addImages);
router.put('/properties/:id/images/order', perm('properties.edit'), validate({ params: idParam, body: reorderImagesSchema }), properties.reorderImages);
router.patch('/properties/:id/images/:imageId', perm('properties.edit'), validate({ params: imageParams, body: imageAltSchema }), properties.updateImage);
router.delete('/properties/:id/images/:imageId', perm('properties.edit'), validate({ params: imageParams }), properties.deleteImage);

// --------------------------------------------------------------- Categories
router.get('/categories', perm('categories.view'), properties.listCategories);
router.post('/categories', perm('categories.manage'), validate({ body: categorySchema }), properties.createCategory);
router.put('/categories/:id', perm('categories.manage'), validate({ params: idParam, body: categoryUpdateSchema }), properties.updateCategory);
router.delete('/categories/:id', perm('categories.manage'), byId, properties.deleteCategory);

// ----------------------------------------------------------------- Featured
router.get('/featured', perm('featured.view'), validate({ query: featuredListQuery }), campaigns.featured.list);
router.post('/featured', perm('featured.manage'), validate({ body: featuredCreateSchema }), campaigns.featured.create);
router.put('/featured/:id', perm('featured.manage'), validate({ params: idParam, body: featuredUpdateSchema }), campaigns.featured.update);
router.post('/featured/:id/activate', perm('featured.manage'), byId, campaigns.featured.activate);
router.post('/featured/:id/deactivate', perm('featured.manage'), byId, campaigns.featured.deactivate);
router.delete('/featured/:id', perm('featured.manage'), byId, campaigns.featured.remove);

// ---------------------------------------------------------------- Hot deals
router.get('/hot-deals', perm('hot_deals.view'), validate({ query: dealListQuery }), campaigns.hotDeals.list);
router.post('/hot-deals/calculate', perm('hot_deals.create'), validate({ body: dealCalculateSchema }), campaigns.hotDeals.calculate);
router.post('/hot-deals', perm('hot_deals.create'), validate({ body: dealCreateSchema }), campaigns.hotDeals.create);
router.get('/hot-deals/:id', perm('hot_deals.view'), byId, campaigns.hotDeals.get);
router.put('/hot-deals/:id', perm('hot_deals.create'), validate({ params: idParam, body: dealUpdateSchema }), campaigns.hotDeals.update);
router.post('/hot-deals/:id/activate', perm('hot_deals.publish'), byId, campaigns.hotDeals.activate);
router.post('/hot-deals/:id/pause', perm('hot_deals.publish'), byId, campaigns.hotDeals.pause);
router.post('/hot-deals/:id/end', perm('hot_deals.publish'), byId, campaigns.hotDeals.end);

// ----------------------------------------------------------- Advertisements
router.get('/advertisement-placements', perm('advertisements.view'), campaigns.advertisements.placements);
router.get('/advertisements', perm('advertisements.view'), validate({ query: adListQuery }), campaigns.advertisements.list);
router.post('/advertisements', perm('advertisements.create'), validate({ body: adCreateSchema }), campaigns.advertisements.create);
router.get('/advertisements/:id', perm('advertisements.view'), byId, campaigns.advertisements.get);
router.put('/advertisements/:id', perm('advertisements.create'), validate({ params: idParam, body: adUpdateSchema }), campaigns.advertisements.update);
router.post('/advertisements/:id/publish', perm('advertisements.publish'), byId, campaigns.advertisements.publish);
router.post('/advertisements/:id/pause', perm('advertisements.publish'), byId, campaigns.advertisements.pause);
router.post('/advertisements/:id/archive', perm('advertisements.archive'), byId, campaigns.advertisements.archive);
router.post('/advertisements/:id/restore', perm('advertisements.archive'), byId, campaigns.advertisements.restore);

// ---------------------------------------------------------------- Promotions
router.get('/promotions', perm('promotions.view'), validate({ query: promoListQuery }), campaigns.promotions.list);
router.post('/promotions', perm('promotions.create'), validate({ body: promoCreateSchema }), campaigns.promotions.create);
router.get('/promotions/:id', perm('promotions.view'), byId, campaigns.promotions.get);
router.put('/promotions/:id', perm('promotions.create'), validate({ params: idParam, body: promoUpdateSchema }), campaigns.promotions.update);
router.post('/promotions/:id/publish', perm('promotions.publish'), byId, campaigns.promotions.publish);
router.post('/promotions/:id/pause', perm('promotions.publish'), byId, campaigns.promotions.pause);
router.post('/promotions/:id/archive', perm('promotions.archive'), byId, campaigns.promotions.archive);
router.post('/promotions/:id/restore', perm('promotions.archive'), byId, campaigns.promotions.restore);

router.get('/analytics', perm('analytics.view'), validate({ query: analyticsQuery }), campaigns.analytics);
router.post(
  '/uploads',
  requireAnyPermission('advertisements.create', 'promotions.create', 'content.manage'),
  validate({ query: uploadQuery }),
  uploadSingleImage('image'),
  campaigns.uploadCampaignImage,
);

// ---------------------------------------------------------------- Inquiries
router.get('/inquiries', perm('inquiries.view'), validate({ query: inquiryListQuery }), admin.inquiries.list);
router.get('/inquiries/export', perm('inquiries.export'), validate({ query: inquiryListQuery }), admin.inquiries.exportCsv);
router.get('/inquiries/staff', perm('inquiries.view'), admin.inquiries.staff);
router.get('/inquiries/:id', perm('inquiries.view'), byId, admin.inquiries.get);
router.patch('/inquiries/:id', perm('inquiries.manage'), validate({ params: idParam, body: inquiryUpdateSchema }), admin.inquiries.update);
router.post('/inquiries/:id/notes', perm('inquiries.manage'), validate({ params: idParam, body: inquiryNoteSchema }), admin.inquiries.addNote);

// ------------------------------------------------------- Content & settings
router.get('/content', perm('content.view'), admin.content.list);
router.put('/content/:key', perm('content.manage'), validate({ params: contentKeyParam, body: contentUpdateSchema }), admin.content.update);
router.get('/hero', perm('content.view'), admin.hero.get);
router.post('/hero/slides', perm('content.manage'), validate({ body: heroSlideCreateSchema }), admin.hero.createSlide);
router.put('/hero/slides/order', perm('content.manage'), validate({ body: heroOrderSchema }), admin.hero.reorder);
router.put('/hero/slides/:id', perm('content.manage'), validate({ params: idParam, body: heroSlideUpdateSchema }), admin.hero.updateSlide);
router.delete('/hero/slides/:id', perm('content.manage'), byId, admin.hero.deleteSlide);
router.put('/hero/settings', perm('content.manage'), validate({ body: heroSettingsSchema }), admin.hero.updateSettings);
router.get('/settings', perm('settings.view'), admin.settings.list);
router.put('/settings', perm('settings.manage'), validate({ body: settingsUpdateSchema }), admin.settings.update);

// ------------------------------------------------------------ Users & roles
router.get('/users', perm('users.view'), validate({ query: userListQuery }), admin.users.list);
router.post('/users', perm('users.manage'), validate({ body: userCreateSchema }), admin.users.create);
router.put('/users/:id', perm('users.manage'), validate({ params: idParam, body: userUpdateSchema }), admin.users.update);
router.get('/roles', requireAnyPermission('roles.view', 'users.view'), admin.roles.list);
router.post('/roles', perm('roles.manage'), validate({ body: roleSchema }), admin.roles.create);
router.put('/roles/:id', perm('roles.manage'), validate({ params: idParam, body: roleUpdateSchema }), admin.roles.update);
router.delete('/roles/:id', perm('roles.manage'), byId, admin.roles.remove);

// ---------------------------------------------------------------- Audit log
router.get('/audit-logs', perm('audit_logs.view'), validate({ query: auditListQuery }), admin.auditLogs.list);
router.get('/audit-logs/filters', perm('audit_logs.view'), admin.auditLogs.filters);

export default router;
