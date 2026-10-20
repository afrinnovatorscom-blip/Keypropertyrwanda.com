export const TIMEZONE = 'Africa/Kigali';

const PERIOD_SUFFIX = { month: '/ month', year: '/ year', night: '/ night', total: '' };

export function formatMoney(amount, currency = 'RWF') {
  if (amount === null || amount === undefined) return '—';
  const digits = currency === 'RWF' ? 0 : Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat('en-RW', { style: 'currency', currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
}

export function formatPrice(property) {
  const suffix = PERIOD_SUFFIX[property.pricePeriod] ?? '';
  return `${formatMoney(property.price, property.currency)}${suffix ? ` ${suffix}` : ''}`;
}

export const periodSuffix = (period) => PERIOD_SUFFIX[period] ?? '';

export function formatDate(value, opts = {}) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIMEZONE, ...opts }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE }).format(new Date(value));
}

export function formatArea(m2) {
  if (!m2) return null;
  return `${Number(m2).toLocaleString('en-US', { maximumFractionDigits: 0 })} m²`;
}

/** "Ends in 3 days" style countdown text. */
export function timeLeft(endAt) {
  if (!endAt) return null;
  const ms = new Date(endAt).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return 'Ends in less than an hour';
  if (hours < 48) return `Ends in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `Ends in ${days} days`;
}

/** Value for <input type="datetime-local"> from an ISO date (browser local time). */
export function toDateTimeInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** ISO string from a datetime-local input value (or null). */
export function fromDateTimeInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const LABELS = {
  purpose: { sale: 'For Sale', rent: 'For Rent' },
  availability: { available: 'Available', under_offer: 'Under offer', sold: 'Sold', rented: 'Rented', unavailable: 'Unavailable' },
  publication: { draft: 'Draft', published: 'Published', unpublished: 'Unpublished', archived: 'Archived' },
  campaign: { draft: 'Draft', scheduled: 'Scheduled', active: 'Active', paused: 'Paused', expired: 'Expired', archived: 'Archived', ended: 'Ended' },
  inquiry: { new: 'New', contacted: 'Contacted', in_progress: 'In progress', converted: 'Converted', closed: 'Closed' },
  contact: { phone: 'Phone call', email: 'Email', whatsapp: 'WhatsApp' },
  campaignType: { general: 'General promotion', featured: 'Featured Property campaign', hot_deals: 'Hot Deals campaign', category: 'Property category campaign', seasonal: 'Seasonal promotion' },
  placement: { homepage: 'Homepage', promotions_page: 'Promotions page', listing_page: 'Property listing page', details_page: 'Property details page' },
  group: { residential: 'Residential', land: 'Land', commercial: 'Commercial', other: 'Other' },
  discount: { percentage: 'Percentage off', amount: 'Amount off', fixed_price: 'Fixed promotional price' },
  period: { total: 'Total price', month: 'Per month', year: 'Per year', night: 'Per night' },
};

export const label = (group, value) => LABELS[group]?.[value] ?? value ?? '—';
