import { z } from 'zod';
import {
  email,
  optionalDate,
  optionalEmail,
  optionalId,
  optionalText,
  paginationQuery,
  phone,
  queryBool,
  queryDate,
  queryEnum,
  queryNumber,
  queryText,
  safeUrl,
  text,
  uploadPath,
} from './common.js';

// ------------------------------------------------------------------- Auth
export const loginSchema = z.object({
  email: email,
  password: z.string().min(1, 'Password is required').max(200),
});

export const passwordRule = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), 'Include upper- and lower-case letters and a number');

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(200), newPassword: passwordRule })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'The new password must be different',
    path: ['newPassword'],
  });

// ------------------------------------------------------------------ Users
export const userCreateSchema = z.object({
  fullName: text(120, 2),
  email,
  phone: z.preprocess((v) => (v === '' ? null : v), phone.nullable()).optional(),
  roleId: z.coerce.number().int().positive(),
  password: passwordRule,
  status: z.enum(['active', 'suspended']).default('active'),
});

export const userUpdateSchema = z.object({
  fullName: text(120, 2).optional(),
  email: email.optional(),
  phone: z.preprocess((v) => (v === '' ? null : v), phone.nullable()).optional(),
  roleId: z.coerce.number().int().positive().optional(),
  status: z.enum(['active', 'suspended']).optional(),
  password: z.preprocess((v) => (v === '' ? undefined : v), passwordRule.optional()),
});

export const userListQuery = z.object({
  search: queryText(),
  roleId: queryNumber(z.coerce.number().int().positive()),
  status: queryEnum(['active', 'suspended']),
  ...paginationQuery,
});

// ------------------------------------------------------------------ Roles
export const roleSchema = z.object({
  name: text(80, 2),
  description: optionalText(255),
  permissions: z.array(z.string().max(80)).max(200),
});
export const roleUpdateSchema = roleSchema.partial();

// -------------------------------------------------------------- Inquiries
export const INQUIRY_STATUSES = ['new', 'contacted', 'in_progress', 'converted', 'closed'];

export const inquirySubmitSchema = z.object({
  customerName: text(120, 2),
  phone,
  email: optionalEmail,
  message: text(3000, 10),
  preferredContact: z.enum(['phone', 'email', 'whatsapp']).default('phone'),
  propertySlug: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(230).optional()),
  propertyReference: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(20).optional()),
  source: z.enum(['property_page', 'contact_page', 'hot_deal', 'promotion', 'website']).default('website'),
  advertisementId: optionalId,
  promotionId: optionalId,
  hotDealId: optionalId,
  consent: z.literal(true, { error: 'Please agree to be contacted about your inquiry' }),
  // Spam protection: hidden honeypot field and form timing.
  website: z.string().max(200).optional(),
  elapsedMs: z.coerce.number().int().min(0).optional(),
}).refine((v) => v.preferredContact !== 'email' || v.email, {
  message: 'Provide an email address to be contacted by email',
  path: ['email'],
});

export const inquiryUpdateSchema = z.object({
  status: z.enum(INQUIRY_STATUSES).optional(),
  assignedTo: optionalId,
  followUpAt: optionalDate,
});

export const inquiryNoteSchema = z.object({ note: text(5000, 1) });

export const inquiryListQuery = z.object({
  status: queryEnum(INQUIRY_STATUSES),
  search: queryText(),
  propertyId: queryNumber(z.coerce.number().int().positive()),
  assignedTo: queryNumber(z.coerce.number().int().positive()),
  preferredContact: queryEnum(['phone', 'email', 'whatsapp']),
  followUpDue: queryBool,
  from: queryDate,
  to: queryDate,
  ...paginationQuery,
});

// ------------------------------------------------------- Content/settings
export const contentKeyParam = z.object({ key: z.string().regex(/^[a-z0-9_]{2,80}$/) });

export const contentUpdateSchema = z.object({
  title: optionalText(200),
  body: optionalText(100000),
});

export const settingsUpdateSchema = z.object({
  values: z.record(z.string().regex(/^[a-z0-9_]{2,80}$/), z.string().max(2000).nullable()),
});

export const auditListQuery = z.object({
  userId: queryNumber(z.coerce.number().int().positive()),
  action: queryText(100),
  entityType: queryText(50),
  entityId: queryText(50),
  search: queryText(),
  from: queryDate,
  to: queryDate,
  ...paginationQuery,
});

export const uploadQuery = z.object({
  folder: z.enum(['advertisements', 'promotions', 'hero']),
});

// --------------------------------------------------------------- Home hero
const heroSlideFields = {
  title: text(200, 3),
  subtitle: optionalText(500),
  backgroundImage: uploadPath,
  buttonLabel: optionalText(60),
  buttonUrl: safeUrl,
  overlayOpacity: z.coerce.number().int().min(0).max(90).optional(),
  textAlign: z.enum(['left', 'center']).optional(),
  isActive: z.boolean().optional(),
};
export const heroSlideCreateSchema = z.object(heroSlideFields);
export const heroSlideUpdateSchema = z.object(heroSlideFields).partial();
export const heroOrderSchema = z.object({ slideIds: z.array(z.coerce.number().int().positive()).min(1).max(50) });
export const heroSettingsSchema = z.object({
  animation: z.enum(['slide', 'fade', 'flip']).optional(),
  intervalSeconds: z.coerce.number().int().min(3, 'At least 3 seconds').max(30, 'At most 30 seconds').optional(),
});
