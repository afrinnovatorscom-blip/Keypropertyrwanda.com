import { transaction } from '../config/database.js';
import { BusinessSetting } from '../models/BusinessSetting.js';
import { HeroSlide } from '../models/HeroSlide.js';
import { WebsiteContent } from '../models/WebsiteContent.js';
import { AppError } from '../utils/AppError.js';
import { audit, diff } from './auditService.js';

export const HERO_ANIMATIONS = ['slide', 'fade', 'flip'];
export const MAX_HERO_SLIDES = 10;
const DEFAULTS = { animation: 'fade', intervalSeconds: 6 };

async function requireSlide(id, conn) {
  const slide = await HeroSlide.findById(id, conn);
  if (!slide) throw AppError.notFound('Hero slide not found');
  return slide;
}

export async function getHeroSettings() {
  const [animation, interval] = await Promise.all([
    BusinessSetting.get('hero_animation', DEFAULTS.animation),
    BusinessSetting.get('hero_interval_seconds', String(DEFAULTS.intervalSeconds)),
  ]);
  return {
    animation: HERO_ANIMATIONS.includes(animation) ? animation : DEFAULTS.animation,
    intervalSeconds: Number.parseInt(interval, 10) || DEFAULTS.intervalSeconds,
  };
}

export async function updateHeroSettings({ animation, intervalSeconds }, actor) {
  const before = await getHeroSettings();
  const values = {};
  if (animation !== undefined) values.hero_animation = animation;
  if (intervalSeconds !== undefined) values.hero_interval_seconds = String(intervalSeconds);
  await BusinessSetting.updateValues(values, actor.id);
  await audit(actor, 'hero.settings_updated', 'hero', null, diff(before, { animation, intervalSeconds }, ['animation', 'intervalSeconds']));
  return getHeroSettings();
}

/** Admin view: every slide plus the animation settings. */
export async function getHeroAdmin() {
  const [slides, settings] = await Promise.all([HeroSlide.findAll(), getHeroSettings()]);
  return { slides, settings };
}

/**
 * Public hero. Only active slides are returned. When none exist, the
 * home_hero content block is used as a single text-only slide.
 */
export async function getPublicHero() {
  const [slides, settings] = await Promise.all([HeroSlide.findActive(), getHeroSettings()]);
  let publicSlides = slides.map(({ id, title, subtitle, backgroundImage, buttonLabel, buttonUrl, overlayOpacity, textAlign }) => ({
    id, title, subtitle, backgroundImage, buttonLabel, buttonUrl, overlayOpacity, textAlign,
  }));
  if (!publicSlides.length) {
    const fallback = await WebsiteContent.findByKey('home_hero');
    publicSlides = [{ id: 0, title: fallback?.title ?? 'Find your key to the perfect property in Rwanda', subtitle: fallback?.body ?? null, backgroundImage: null, buttonLabel: null, buttonUrl: null, overlayOpacity: 55, textAlign: 'left' }];
  }
  return { ...settings, slides: publicSlides };
}

export async function createSlide(input, actor) {
  if ((await HeroSlide.count()) >= MAX_HERO_SLIDES) {
    throw AppError.conflict(`A maximum of ${MAX_HERO_SLIDES} hero slides is allowed. Delete or reuse an existing slide.`);
  }
  if (input.buttonLabel && !input.buttonUrl) throw AppError.validation([{ path: 'buttonUrl', message: 'Add a link for the button' }]);
  const id = await HeroSlide.create({ ...input, displayOrder: await HeroSlide.nextOrder(), userId: actor.id });
  await audit(actor, 'hero.slide_created', 'hero_slide', id, { title: input.title });
  return requireSlide(id);
}

export async function updateSlide(id, input, actor) {
  const existing = await requireSlide(id);
  const buttonLabel = input.buttonLabel === undefined ? existing.buttonLabel : input.buttonLabel;
  const buttonUrl = input.buttonUrl === undefined ? existing.buttonUrl : input.buttonUrl;
  if (buttonLabel && !buttonUrl) throw AppError.validation([{ path: 'buttonUrl', message: 'Add a link for the button' }]);
  await HeroSlide.update(id, { ...input, updatedBy: actor.id });
  await audit(actor, 'hero.slide_updated', 'hero_slide', id, diff(existing, input, ['title', 'subtitle', 'backgroundImage', 'buttonLabel', 'buttonUrl', 'overlayOpacity', 'textAlign', 'isActive']));
  return requireSlide(id);
}

export async function reorderSlides(orderedIds, actor) {
  const all = await HeroSlide.findAll();
  const current = all.map((s) => s.id).sort((a, b) => a - b);
  const requested = [...new Set(orderedIds)];
  if (requested.length !== current.length || [...requested].sort((a, b) => a - b).some((v, i) => v !== current[i])) {
    throw AppError.badRequest('The new order must include every slide exactly once.');
  }
  await transaction(async (conn) => {
    await HeroSlide.reorder(requested, conn);
    await audit(actor, 'hero.slides_reordered', 'hero', null, { order: requested }, conn);
  });
  return HeroSlide.findAll();
}

export async function deleteSlide(id, actor) {
  const existing = await requireSlide(id);
  await HeroSlide.delete(id);
  await audit(actor, 'hero.slide_deleted', 'hero_slide', id, { title: existing.title });
}
