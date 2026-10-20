// Real photographs for the demo listings and hero slides.
// Source: Unsplash (https://unsplash.com/license — free for commercial use,
// attribution appreciated but not required). Files are downloaded at seed time
// and stored in uploads/ like any staff-uploaded image.
import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../../config/environment.js';
import { detectImageType } from '../../services/uploadService.js';

const unsplash = (id, width = 1600) => `https://images.unsplash.com/photo-${id}?w=${width}&q=80&fm=jpg&fit=crop&auto=format`;

/** Photo ids per demo listing title (first photo = main image). */
export const PROPERTY_PHOTOS = {
  'Modern 4-Bedroom Family House in Kibagabaga': ['1494526585095-c41746248156', '1484154218962-a197022b5858', '1493809842364-78817add7ffb'],
  'Furnished 2-Bedroom Apartment in Kimihurura': ['1545324418-cc1a3fa10c00', '1522708323590-d24dbb6b0267', '1502672260266-1c1ef2d93688'],
  'Residential Plot with Views in Rebero': ['1500382017468-9049fed747ef'],
  'Grade A Office Space in Kigali CBD': ['1486406146926-c627a92ad1ab', '1497366811353-6870744d04b2', '1497366216548-37526070297c'],
  'Retail Shop on KN 4 Avenue': ['1441986300917-64674bd600d8', '1604719312566-8912e9227c6a'],
  'Warehouse near Kigali Special Economic Zone': ['1553413077-190dd305871c', '1586528116311-ad8dd3c8310d'],
  'Elegant 5-Bedroom Villa in Nyarutarama': ['1580587771525-78b9dba3b914', '1613490493576-7fde63acd811', '1600607687939-ce8a6c25118c'],
  'Affordable 3-Bedroom House in Kanombe': ['1570129477492-45c003edd2be', '1505691938895-1758d7feb511'],
  'Commercial Building in Musanze Town': ['1582407947304-fd86f028f716', '1460317442991-0ec209397118'],
  'Lakeside Land in Rubavu': ['1500076656116-558758c991c1'],
  'Studio Apartment near University in Huye': ['1502672260266-1c1ef2d93688', '1484154218962-a197022b5858'],
  'Townhouse in Gacuriro Estate': ['1600585154340-be6161a56a0c', '1600566753190-17f0baa2a6c3', '1505691938895-1758d7feb511'],
  'Draft: Penthouse in Kiyovu (coming soon)': ['1600607687939-ce8a6c25118c'],
};

export const HERO_SLIDES = [
  {
    title: 'Find your key to the perfect property in Rwanda',
    subtitle: 'Houses, apartments, land and commercial spaces for sale and rent across Kigali and beyond.',
    photo: '1600596542815-ffad4c1539a9',
    buttonLabel: 'Browse properties',
    buttonUrl: '/properties',
    textAlign: 'left',
  },
  {
    title: 'Family homes in Kigali’s best neighbourhoods',
    subtitle: 'Kibagabaga, Nyarutarama, Kimihurura, Gacuriro — verified listings with clear titles.',
    photo: '1568605114967-8130f3a36994',
    buttonLabel: 'Houses & apartments',
    buttonUrl: '/properties/houses-apartments',
    textAlign: 'left',
  },
  {
    title: 'Limited-time Hot Deals',
    subtitle: 'Special prices on selected properties — while they last.',
    photo: '1564013799919-ab600027ffc6',
    buttonLabel: 'See hot deals',
    buttonUrl: '/hot-deals',
    textAlign: 'center',
  },
];

/**
 * Download an Unsplash photo into uploads/<folder>/seed/<name>.jpg.
 * Returns the stored relative path, or null when offline / not an image.
 */
export async function downloadPhoto(photoId, folder, name, width) {
  try {
    const res = await fetch(unsplash(photoId, width), { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const type = detectImageType(buffer);
    if (!type) return null;
    const relativePath = `${folder}/seed/${name}.${type.ext}`;
    const absolute = path.join(config.uploadRoot, relativePath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, buffer);
    return { filePath: relativePath, mimeType: type.mime, sizeBytes: buffer.length };
  } catch {
    return null;
  }
}
