// Replace the generated illustrations on the demo listings with real photographs,
// and create the demo hero slides if there are none.
// Only images created by the seeder (uploads/properties/seed/*.png) are replaced;
// photos uploaded by staff are never touched.
// Usage: npm run demo:photos
import path from 'node:path';
import { closePool, query, transaction } from '../config/database.js';
import { SUPER_ADMIN_ROLE } from '../config/permissions.js';
import { PropertyImage } from '../models/PropertyImage.js';
import { deleteUpload } from '../services/uploadService.js';
import { runMigrations } from '../services/migrationService.js';
import { syncPermissionsAndRoles } from '../services/rbacService.js';
import { syncReferenceData } from '../services/referenceDataService.js';
import { downloadPhoto, PROPERTY_PHOTOS } from './lib/demoPhotos.js';
import { seedHeroSlides } from './lib/heroSeed.js';

async function main() {
  await runMigrations();
  await syncPermissionsAndRoles();
  await syncReferenceData();

  let updated = 0;
  for (const [title, photoIds] of Object.entries(PROPERTY_PHOTOS)) {
    const [property] = await query('SELECT id, slug FROM properties WHERE title = ?', [title]);
    if (!property) continue;
    const images = await PropertyImage.listForProperty(property.id);
    const generated = images.filter((i) => /^properties\/seed\/.+\.png$/.test(i.filePath));
    if (!generated.length || generated.length !== images.length) continue; // has staff photos or already real

    const photos = [];
    for (const [i, photoId] of photoIds.entries()) {
      const stored = await downloadPhoto(photoId, 'properties', `${property.slug}-${i + 1}`);
      if (stored) photos.push(stored);
    }
    if (!photos.length) {
      console.log(`  ! Could not download photos for "${title}" (offline?) — kept illustrations.`);
      continue;
    }
    await transaction(async (conn) => {
      for (const image of generated) await PropertyImage.delete(image.id, conn);
      for (const [i, photo] of photos.entries()) {
        await PropertyImage.create({ propertyId: property.id, ...photo, altText: `${title} — photo ${i + 1}`, sortOrder: i, originalName: path.basename(photo.filePath) }, conn);
      }
    });
    for (const image of generated) await deleteUpload(image.filePath);
    updated += 1;
    console.log(`  ✓ ${title} (${photos.length} photo${photos.length === 1 ? '' : 's'})`);
  }
  console.log(`Real photos applied to ${updated} demo listing(s).`);

  const [admin] = await query(
    "SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.slug = ? ORDER BY u.id LIMIT 1",
    [SUPER_ADMIN_ROLE],
  );
  const heroCount = await seedHeroSlides(admin?.id ?? null);
  console.log(heroCount ? `Created ${heroCount} homepage hero slides.` : 'Hero slides already exist — left unchanged.');
}

main()
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
