import { BusinessSetting } from '../models/BusinessSetting.js';
import { WebsiteContent } from '../models/WebsiteContent.js';
import { AppError } from '../utils/AppError.js';
import { isSafeExternalUrl } from '../utils/url.js';
import { audit } from './auditService.js';

export const PUBLIC_CONTENT_KEYS = [
  'home_hero', 'home_intro', 'home_cta', 'about_page', 'contact_page', 'privacy_policy', 'terms_conditions',
];

export const listContent = () => WebsiteContent.findAll();

export async function getPublicContent(key) {
  if (!PUBLIC_CONTENT_KEYS.includes(key)) throw AppError.notFound('Content not found');
  const content = await WebsiteContent.findByKey(key);
  if (!content) throw AppError.notFound('Content not found');
  return { key: content.key, title: content.title, body: content.body, updatedAt: content.updatedAt };
}

export async function updateContent(key, input, actor) {
  const existing = await WebsiteContent.findByKey(key);
  if (!existing) throw AppError.notFound('Content block not found');
  await WebsiteContent.upsert({
    key,
    title: input.title === undefined ? existing.title : input.title,
    body: input.body === undefined ? existing.body : input.body,
    userId: actor.id,
  });
  await audit(actor, 'content.updated', 'content', key, { title: input.title !== undefined, body: input.body !== undefined });
  return WebsiteContent.findByKey(key);
}

/** Public site configuration (only settings flagged public) plus key content blocks. */
export async function getPublicSiteConfig() {
  const [settings, content] = await Promise.all([
    BusinessSetting.findPublicMap(),
    WebsiteContent.findByKeys(['home_hero', 'home_intro', 'home_cta']),
  ]);
  return {
    settings,
    content: Object.fromEntries(content.map((c) => [c.key, { title: c.title, body: c.body }])),
  };
}

export const listSettings = () => BusinessSetting.findAll();

const URL_SETTINGS = ['facebook_url', 'instagram_url', 'x_url', 'linkedin_url', 'site_url'];

export async function updateSettings(values, actor) {
  const keys = Object.keys(values);
  const existing = await BusinessSetting.existingKeys(keys);
  const unknown = keys.filter((k) => !existing.includes(k));
  if (unknown.length) throw AppError.validation(unknown.map((k) => ({ path: k, message: 'Unknown setting' })));

  const problems = [];
  for (const [key, value] of Object.entries(values)) {
    if (URL_SETTINGS.includes(key) && value && !isSafeExternalUrl(value)) problems.push({ path: key, message: 'Enter a valid http(s) URL' });
    if (key === 'whatsapp_number' && value && !/^\+?\d[\d\s]{7,18}$/.test(value)) problems.push({ path: key, message: 'Use international format, e.g. +250788000000' });
    if (key === 'inquiry_rate_limit_per_hour' && value && !/^\d{1,3}$/.test(value)) problems.push({ path: key, message: 'Enter a whole number' });
    if (key === 'default_currency' && value && !['RWF', 'USD', 'EUR'].includes(value)) problems.push({ path: key, message: 'Use RWF, USD or EUR' });
    if (key === 'hero_animation' && !['slide', 'fade', 'flip'].includes(value)) problems.push({ path: key, message: 'Use slide, fade or flip' });
    if (key === 'hero_interval_seconds' && !(/^\d{1,2}$/.test(value ?? '') && Number(value) >= 3 && Number(value) <= 30)) problems.push({ path: key, message: 'Use 3 to 30 seconds' });
  }
  if (problems.length) throw AppError.validation(problems);

  await BusinessSetting.updateValues(values, actor.id);
  await audit(actor, 'settings.updated', 'settings', null, { keys });
  return BusinessSetting.findAll();
}
