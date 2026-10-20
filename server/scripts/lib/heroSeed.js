import { HeroSlide } from '../../models/HeroSlide.js';
import { downloadPhoto, HERO_SLIDES } from './demoPhotos.js';

/** Create the demo hero slides when none exist. Returns the number created. */
export async function seedHeroSlides(userId) {
  if ((await HeroSlide.count()) > 0) return 0;
  let created = 0;
  for (const [i, slide] of HERO_SLIDES.entries()) {
    const stored = await downloadPhoto(slide.photo, 'hero', `hero-${i + 1}`, 2000);
    await HeroSlide.create({ ...slide, backgroundImage: stored?.filePath ?? null, displayOrder: i, userId });
    created += 1;
  }
  return created;
}
