import { transaction } from '../config/database.js';
import { Advertisement } from '../models/Advertisement.js';
import { BusinessSetting } from '../models/BusinessSetting.js';
import { HotDeal } from '../models/HotDeal.js';
import { Inquiry } from '../models/Inquiry.js';
import { InquiryNote } from '../models/InquiryNote.js';
import { Promotion } from '../models/Promotion.js';
import { Property } from '../models/Property.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta, paginate } from '../utils/pagination.js';
import { ipHash } from '../utils/privacy.js';
import { audit } from './auditService.js';

/** Submissions faster than this after the form rendered are treated as bots. */
export const MIN_FILL_TIME_MS = 2500;
const DUPLICATE_WINDOW_MINUTES = 10;

async function resolveProperty({ propertySlug, propertyReference }) {
  if (propertySlug) {
    const property = await Property.findBySlug(propertySlug, { publicOnly: true });
    if (!property) throw AppError.validation([{ path: 'propertySlug', message: 'This property is no longer available' }]);
    return property;
  }
  if (propertyReference) {
    const row = await Property.findByReference(propertyReference.toUpperCase());
    if (!row || row.publication_status !== 'published') {
      throw AppError.validation([{ path: 'propertyReference', message: 'No published property has this reference' }]);
    }
    return { id: row.id, reference: row.reference };
  }
  return null;
}

/** Attribution ids are kept only if they point at campaigns that are actually running. */
async function resolveAttribution({ advertisementId, promotionId, hotDealId }) {
  const [ad, promotion, deal] = await Promise.all([
    advertisementId ? Advertisement.findLiveById(advertisementId) : null,
    promotionId ? Promotion.findLiveById(promotionId) : null,
    hotDealId ? HotDeal.findLiveById(hotDealId) : null,
  ]);
  return { advertisementId: ad?.id ?? null, promotionId: promotion?.id ?? null, hotDealId: deal?.id ?? null };
}

/**
 * Public inquiry submission with spam protection:
 * honeypot field, minimum fill time, per-visitor hourly cap and duplicate suppression.
 */
export async function submitInquiry(input, { ip }) {
  // Honeypot filled or submitted implausibly fast: pretend success, store nothing.
  if (input.website || (input.elapsedMs !== undefined && input.elapsedMs < MIN_FILL_TIME_MS)) {
    return { id: null, accepted: true };
  }

  const hashedIp = ipHash(ip);
  const limit = Number.parseInt(await BusinessSetting.get('inquiry_rate_limit_per_hour', '5'), 10) || 5;
  if ((await Inquiry.countRecentByIp(hashedIp, 60)) >= limit) {
    throw new AppError(429, 'You have sent several inquiries recently. Please call or WhatsApp us instead.', 'RATE_LIMITED');
  }

  const property = await resolveProperty(input);
  const duplicateId = await Inquiry.findRecentDuplicate(
    { phone: input.phone, message: input.message, propertyId: property?.id },
    DUPLICATE_WINDOW_MINUTES,
  );
  if (duplicateId) return { id: duplicateId, accepted: true, duplicate: true };

  const attribution = await resolveAttribution(input);
  const id = await Inquiry.create({
    ...input,
    ...attribution,
    propertyId: property?.id ?? null,
    propertyReference: property?.reference ?? null,
    ipHash: hashedIp,
  });
  return { id, accepted: true };
}

export async function listInquiries(filters) {
  const page = paginate(filters);
  const { rows, total } = await Inquiry.list(filters, page);
  return { rows, meta: pageMeta(page, total) };
}

export async function getInquiry(id) {
  const inquiry = await Inquiry.findById(id);
  if (!inquiry) throw AppError.notFound('Inquiry not found');
  const notes = await InquiryNote.listForInquiry(id);
  return { ...inquiry, notes };
}

export async function updateInquiry(id, input, actor) {
  await transaction(async (conn) => {
    const existing = await Inquiry.findById(id, conn);
    if (!existing) throw AppError.notFound('Inquiry not found');
    if (input.assignedTo) {
      const assignee = await User.findById(input.assignedTo, conn);
      if (!assignee || assignee.status !== 'active') throw AppError.validation([{ path: 'assignedTo', message: 'Choose an active staff member' }]);
    }
    const changes = { ...input };
    if (input.status && input.status !== existing.status) {
      if (input.status === 'contacted' && !existing.contactedAt) changes.contactedAt = new Date();
      if (['converted', 'closed'].includes(input.status)) changes.closedAt = new Date();
      else changes.closedAt = null;
    }
    await Inquiry.update(id, changes, conn);
    const details = {};
    if (input.status && input.status !== existing.status) details.status = { from: existing.status, to: input.status };
    if (input.assignedTo !== undefined) details.assignedTo = input.assignedTo;
    if (input.followUpAt !== undefined) details.followUpAt = input.followUpAt;
    await audit(actor, 'inquiry.updated', 'inquiry', id, details, conn);
  });
  return getInquiry(id);
}

export async function addNote(id, note, actor) {
  const inquiry = await Inquiry.findById(id);
  if (!inquiry) throw AppError.notFound('Inquiry not found');
  await transaction(async (conn) => {
    await InquiryNote.create({ inquiryId: id, userId: actor.id, note }, conn);
    await audit(actor, 'inquiry.note_added', 'inquiry', id, null, conn);
  });
  return getInquiry(id);
}

export async function exportInquiries(filters, actor) {
  const rows = await Inquiry.exportRows(filters);
  await audit(actor, 'inquiry.exported', 'inquiry', null, { count: rows.length, filters });
  return rows;
}

export const staffOptions = () => User.listActiveStaff();
