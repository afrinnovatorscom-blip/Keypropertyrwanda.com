// Seeds the initial Super Admin and (once, on an empty database) demo listings,
// featured placements, hot deals, advertisements, promotions and inquiries.
// Usage: npm run db:seed            (admin + demo data if no properties exist)
//        npm run db:seed -- --no-demo   (admin only)
import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../config/environment.js';
import { closePool, query, transaction } from '../config/database.js';
import { SUPER_ADMIN_ROLE } from '../config/permissions.js';
import { Advertisement } from '../models/Advertisement.js';
import { AdvertisementPlacement } from '../models/AdvertisementPlacement.js';
import { Amenity } from '../models/Amenity.js';
import { FeaturedProperty } from '../models/FeaturedProperty.js';
import { HotDeal } from '../models/HotDeal.js';
import { Inquiry } from '../models/Inquiry.js';
import { Promotion } from '../models/Promotion.js';
import { Property } from '../models/Property.js';
import { PropertyCategory } from '../models/PropertyCategory.js';
import { PropertyImage } from '../models/PropertyImage.js';
import { Role } from '../models/Role.js';
import { User } from '../models/User.js';
import { hashPassword } from '../services/authService.js';
import { calculateDeal } from '../services/hotDealService.js';
import { runMigrations } from '../services/migrationService.js';
import { syncPermissionsAndRoles } from '../services/rbacService.js';
import { syncReferenceData } from '../services/referenceDataService.js';
import { seedHeroSlides } from './lib/heroSeed.js';
import { downloadPhoto, PROPERTY_PHOTOS } from './lib/demoPhotos.js';
import { bannerImage, propertyImage } from './lib/placeholderImages.js';

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n) => new Date(Date.now() + n * DAY);

const DEMO_PROPERTIES = [
  { title: 'Modern 4-Bedroom Family House in Kibagabaga', category: 'houses', kind: 'house', purpose: 'sale', price: 285000000, district: 'Gasabo', city: 'Kigali', neighborhood: 'Kibagabaga', bedrooms: 4, bathrooms: 3, propertySize: 320, landSize: 600, amenities: ['Garden', 'Parking', 'Security', 'Water tank', 'Fitted kitchen'], description: 'A bright, newly finished family home on a quiet tarmac road in Kibagabaga. The ground floor offers an open-plan living and dining area, a fitted kitchen with pantry and a guest bedroom. Upstairs are three further bedrooms including a master en-suite with a private balcony overlooking the hills. The compound has a landscaped garden, parking for three cars, a 10,000 L water tank and a separate staff quarter.' },
  { title: 'Furnished 2-Bedroom Apartment in Kimihurura', category: 'apartments', kind: 'apartment', purpose: 'rent', price: 1200000, pricePeriod: 'month', district: 'Gasabo', city: 'Kigali', neighborhood: 'Kimihurura', bedrooms: 2, bathrooms: 2, propertySize: 110, amenities: ['Furnished', 'Elevator', 'Backup generator', 'Security', 'Parking', 'Internet'], description: 'Fully furnished apartment in a secure building close to the Kigali Convention Centre, embassies and restaurants. Two en-suite bedrooms, a spacious living room opening onto a balcony, a modern kitchen with appliances, high-speed internet and a backup generator. Ideal for professionals and diplomats.' },
  { title: 'Residential Plot with Views in Rebero', category: 'plots', kind: 'land', purpose: 'sale', price: 45000000, district: 'Kicukiro', city: 'Kigali', neighborhood: 'Rebero', landSize: 800, amenities: ['Title deed', 'Road access', 'Electricity nearby', 'Water nearby'], description: 'A gently sloping 800 m² residential plot in Rebero with panoramic views over Kigali. Freehold title deed ready for transfer, tarmac road access within 200 m, and water and electricity connections nearby. Suitable for a family home or a small apartment block, subject to the Kigali master plan.' },
  { title: 'Grade A Office Space in Kigali CBD', category: 'offices', kind: 'office', purpose: 'rent', price: 4500, pricePeriod: 'month', currency: 'USD', district: 'Nyarugenge', city: 'Kigali', neighborhood: 'CBD', propertySize: 250, bathrooms: 2, amenities: ['Elevator', 'Backup generator', 'Parking', 'Air conditioning', 'Reception'], description: 'Open-plan office floor of 250 m² in a modern tower in the heart of Kigali’s central business district. Includes 24/7 security, backup power, high-speed fibre, dedicated parking bays and a shared reception. Flexible lease terms available.' },
  { title: 'Retail Shop on KN 4 Avenue', category: 'shops', kind: 'shop', purpose: 'rent', price: 950000, pricePeriod: 'month', district: 'Nyarugenge', city: 'Kigali', neighborhood: 'Nyarugenge', propertySize: 60, bathrooms: 1, amenities: ['Street frontage', 'Security', 'Storage room'], description: 'Ground-floor retail unit with excellent street frontage and heavy foot traffic on KN 4 Avenue. Large display windows, a back storage room and a washroom. Suitable for a boutique, pharmacy, electronics or mobile money agency.' },
  { title: 'Warehouse near Kigali Special Economic Zone', category: 'warehouses', kind: 'warehouse', purpose: 'sale', price: 620000000, district: 'Gasabo', city: 'Kigali', neighborhood: 'Masoro', propertySize: 1500, landSize: 3000, bathrooms: 2, amenities: ['Loading bay', 'Three-phase power', 'Truck access', 'Office block'], description: 'Steel-frame warehouse of 1,500 m² on a 3,000 m² plot a short drive from the Kigali Special Economic Zone. Two loading bays, 8 m eaves height, three-phase power, an office block and a secure yard with truck turning space.' },
  { title: 'Elegant 5-Bedroom Villa in Nyarutarama', category: 'villas', kind: 'house', purpose: 'sale', price: 750000000, district: 'Gasabo', city: 'Kigali', neighborhood: 'Nyarutarama', bedrooms: 5, bathrooms: 5, propertySize: 520, landSize: 1200, amenities: ['Swimming pool', 'Garden', 'Security', 'Staff quarters', 'Solar water heater', 'Parking'], description: 'An elegant villa near the Nyarutarama golf course with five en-suite bedrooms, a family lounge, a formal dining room and a chef’s kitchen. The landscaped grounds include a heated swimming pool, covered terrace, staff quarters and parking for six cars.' },
  { title: 'Affordable 3-Bedroom House in Kanombe', category: 'houses', kind: 'house', purpose: 'rent', price: 450000, pricePeriod: 'month', district: 'Kicukiro', city: 'Kigali', neighborhood: 'Kanombe', bedrooms: 3, bathrooms: 2, propertySize: 150, landSize: 400, amenities: ['Parking', 'Garden', 'Water tank'], description: 'A comfortable three-bedroom house close to the airport road and schools in Kanombe. Master bedroom en-suite, spacious living room, enclosed compound with a small garden and parking for two cars.' },
  { title: 'Commercial Building in Musanze Town', category: 'commercial-properties', kind: 'office', purpose: 'sale', price: 380000000, district: 'Musanze', city: 'Musanze', neighborhood: 'Muhoza', propertySize: 900, landSize: 700, bathrooms: 6, amenities: ['Rental income', 'Parking', 'Backup generator'], description: 'Three-storey mixed-use commercial building in central Musanze, the gateway to Volcanoes National Park. Fully let to retail and office tenants with stable rental income. Excellent investment opportunity in a growing tourism hub.' },
  { title: 'Lakeside Land in Rubavu', category: 'land', kind: 'land', purpose: 'sale', price: 120000000, district: 'Rubavu', city: 'Rubavu', neighborhood: 'Nyamyumba', landSize: 5000, amenities: ['Lake view', 'Title deed', 'Road access'], description: 'A rare half-hectare parcel with Lake Kivu views near Gisenyi. Ideal for a boutique hotel, eco-lodge or private residence. Freehold title, road access and electricity nearby.' },
  { title: 'Studio Apartment near University in Huye', category: 'apartments', kind: 'apartment', purpose: 'rent', price: 150000, pricePeriod: 'month', district: 'Huye', city: 'Huye', neighborhood: 'Ngoma', bedrooms: 1, bathrooms: 1, propertySize: 35, amenities: ['Furnished', 'Internet', 'Security'], description: 'Compact furnished studio within walking distance of the University of Rwanda Huye campus. Includes a kitchenette, private shower room, internet and secure compound. Perfect for students and young professionals.' },
  { title: 'Townhouse in Gacuriro Estate', category: 'houses', kind: 'house', purpose: 'sale', price: 195000000, district: 'Gasabo', city: 'Kigali', neighborhood: 'Gacuriro', bedrooms: 3, bathrooms: 3, propertySize: 210, landSize: 300, amenities: ['Gated community', 'Playground', 'Security', 'Parking'], description: 'A modern three-bedroom townhouse in the gated Gacuriro estate with shared playground, 24/7 security and paved roads. Open-plan living, fitted kitchen and a private back garden.' },
];

// Kept as draft to demonstrate that unpublished listings never appear publicly.
const DRAFT_PROPERTY = {
  title: 'Draft: Penthouse in Kiyovu (coming soon)', category: 'apartments', kind: 'apartment', purpose: 'sale', price: 520000000, district: 'Nyarugenge', city: 'Kigali', neighborhood: 'Kiyovu', bedrooms: 3, bathrooms: 3, propertySize: 260, amenities: ['Elevator', 'Rooftop terrace'], description: 'Penthouse listing being prepared by the property team. Photos and final pricing to be confirmed before publication.',
};

async function writeSeedImage(relativePath, buffer) {
  const absolute = path.join(config.uploadRoot, relativePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, buffer);
  return relativePath;
}

async function ensureSuperAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@keypropertyrwanda.com').toLowerCase();
  const existing = await User.findAuthByEmail(email);
  if (existing) {
    console.log(`Super Admin ${email} already exists.`);
    return existing.id;
  }
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 10) {
    throw new Error('Set ADMIN_PASSWORD (min. 10 characters) in the root .env before seeding.');
  }
  const role = await Role.findBySlug(SUPER_ADMIN_ROLE);
  const id = await User.create({
    roleId: role.id,
    fullName: process.env.ADMIN_NAME || 'Super Admin',
    email,
    passwordHash: await hashPassword(password),
  });
  console.log(`Created Super Admin ${email} (change the password after first sign-in).`);
  return id;
}

async function createDemoProperty(def, index, adminId, publish) {
  const category = await PropertyCategory.findBySlug(def.category);
  const slugBase = def.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let slug = slugBase;
  for (let i = 2; await Property.slugExists(slug); i += 1) slug = `${slugBase}-${i}`;

  // Real photographs (downloaded before the transaction); illustrations if offline.
  const photos = [];
  for (const [i, photoId] of (PROPERTY_PHOTOS[def.title] ?? []).entries()) {
    const stored = await downloadPhoto(photoId, 'properties', `${slug}-${i + 1}`);
    if (stored) photos.push(stored);
  }
  if (!photos.length) {
    for (let i = 0; i < (publish ? 3 : 1); i += 1) {
      const filePath = await writeSeedImage(`properties/seed/${slug}-${i + 1}.png`, propertyImage(def.kind, index * 3 + i + 1));
      photos.push({ filePath, mimeType: 'image/png' });
    }
  }

  return transaction(async (conn) => {
    const id = await Property.create(
      {
        ...def,
        slug,
        categoryId: category.id,
        currency: def.currency ?? 'RWF',
        pricePeriod: def.pricePeriod ?? 'total',
        userId: adminId,
      },
      conn,
    );
    await Amenity.setForProperty(id, await Amenity.findOrCreateByNames(def.amenities ?? [], conn), conn);
    for (const [i, photo] of photos.entries()) {
      await PropertyImage.create({ propertyId: id, ...photo, altText: `${def.title} — photo ${i + 1}`, sortOrder: i, originalName: path.basename(photo.filePath) }, conn);
    }
    if (publish) await Property.setPublicationStatus(id, 'published', adminId, conn);
    return id;
  });
}

async function seedDemo(adminId) {
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM properties');
  if (Number(n) > 0) {
    console.log('Properties already exist — skipping demo data.');
    return;
  }
  console.log('Creating demo listings and campaigns ...');
  const ids = [];
  for (let i = 0; i < DEMO_PROPERTIES.length; i += 1) ids.push(await createDemoProperty(DEMO_PROPERTIES[i], i, adminId, true));
  await createDemoProperty(DRAFT_PROPERTY, 99, adminId, false);
  // One sold listing shows availability separate from publication.
  await Property.setAvailability(ids[11], 'sold', adminId);

  // Featured placements.
  const featured = [ids[0], ids[6], ids[1], ids[2], ids[3]];
  for (let i = 0; i < featured.length; i += 1) {
    await FeaturedProperty.create({ propertyId: featured[i], displayOrder: i, startAt: daysFromNow(-3), endAt: daysFromNow(i === 4 ? 5 : 60), priorityInSearch: i < 2, userId: adminId, label: i === 0 ? 'Editor’s pick' : null });
  }

  // Hot deals (discounts calculated by the same service logic used by the API).
  const deals = [
    { idx: 7, title: 'Move-in special: first month 20% off', type: 'percentage', value: 20, verified: false, end: 14 },
    { idx: 2, title: 'Rebero plot — price reduced', type: 'amount', value: 5000000, verified: true, original: 50000000, end: 21 },
    { idx: 4, title: 'Shop on KN 4 Ave — launch offer', type: 'fixed_price', value: 850000, verified: false, end: 4 },
  ];
  for (const d of deals) {
    const [property] = await Property.findBasicByIds([ids[d.idx]]);
    const base = d.original ?? property.price;
    const calc = calculateDeal({ basePrice: base, discountType: d.type, discountValue: d.value });
    const dealId = await HotDeal.create({
      propertyId: property.id, title: d.title, description: 'Limited-time offer. Contact us to arrange a viewing and secure this price.',
      originalPrice: d.original ?? null, originalPriceVerified: d.verified, originalPriceVerifiedBy: d.verified ? adminId : null,
      originalPriceVerifiedAt: d.verified ? new Date() : null, discountType: d.type, discountValue: d.value, currency: property.currency,
      startAt: daysFromNow(-2), endAt: daysFromNow(d.end), userId: adminId, ...calc,
    });
    await HotDeal.setStatus(dealId, 'active', adminId);
  }

  // Advertisements.
  const homePromo = await AdvertisementPlacement.findBySlug('home_promo');
  const listing = await AdvertisementPlacement.findBySlug('listing_page');
  const sidebar = await AdvertisementPlacement.findBySlug('sidebar');
  const details = await AdvertisementPlacement.findBySlug('details_page');
  const ads = [
    { placement: homePromo, internalName: 'Home promo — Valuation service', headline: 'Free property valuation this month', description: 'Thinking of selling or letting? Our agents will value your property at no cost.', destinationUrl: '/contact', seed: 0 },
    { placement: listing, internalName: 'Listings banner — Nyarutarama villa', headline: 'Luxury living in Nyarutarama', description: 'Five bedrooms, pool and golf-course views.', propertyId: ids[6], seed: 1 },
    { placement: sidebar, internalName: 'Sidebar — Diaspora investors', headline: 'Investing from abroad?', description: 'We handle viewings, due diligence and paperwork for diaspora buyers.', destinationUrl: '/contact', seed: 2 },
    { placement: details, internalName: 'Details page — Land month', headline: 'Land & plots across Rwanda', description: 'Browse verified plots with title deeds.', destinationUrl: '/properties/land-plots', seed: 3 },
  ];
  for (const ad of ads) {
    const image = await writeSeedImage(`advertisements/seed/ad-${ad.seed + 1}.png`, bannerImage(ad.seed));
    const adId = await Advertisement.create({ ...ad, placementId: ad.placement.id, desktopImage: image, startAt: daysFromNow(-5), endAt: daysFromNow(45), userId: adminId });
    await Advertisement.setStatus(adId, 'active', adminId);
  }

  // Promotions.
  const land = await PropertyCategory.findBySlug('land');
  const promos = [
    { name: 'End-of-Year Home Hunt', campaignType: 'seasonal', placement: 'homepage', description: 'Hand-picked homes and apartments ready for move-in before the new year.', properties: [ids[0], ids[1], ids[7], ids[11]], seed: 1, end: 40 },
    { name: 'Land Investment Month', campaignType: 'category', categoryId: land.id, placement: 'promotions_page', description: 'Secure land and plots with clean title deeds in Kigali, Rubavu and beyond.', properties: [ids[2], ids[9]], seed: 2, end: 6 },
  ];
  for (const p of promos) {
    const banner = await writeSeedImage(`promotions/seed/promo-${p.seed}.png`, bannerImage(p.seed + 1));
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const promoId = await Promotion.create({ ...p, slug, bannerImage: banner, startAt: daysFromNow(-1), endAt: daysFromNow(p.end), userId: adminId });
    await Promotion.setProperties(promoId, p.properties);
    await Promotion.setStatus(promoId, 'active', adminId);
  }

  // A few sample inquiries.
  const [first] = await Property.findBasicByIds([ids[0]]);
  await Inquiry.create({ propertyId: first.id, propertyReference: first.reference, customerName: 'Aline Uwase', phone: '+250 788 111 222', email: 'aline@example.com', message: 'Is the Kibagabaga house still available? I would like to visit this weekend.', preferredContact: 'whatsapp', source: 'property_page', consent: true });
  await Inquiry.create({ customerName: 'Jean Bosco', phone: '+250 722 333 444', message: 'I want to list my 3-bedroom house in Kicukiro for rent. Please call me.', preferredContact: 'phone', source: 'contact_page', consent: true });
  console.log(`Created ${ids.length + 1} properties, ${featured.length} featured placements, ${deals.length} hot deals, ${ads.length} adverts, ${promos.length} promotions.`);
}

async function main() {
  await runMigrations({ log: (m) => console.log(`  ${m}`) });
  await syncPermissionsAndRoles();
  await syncReferenceData();
  const adminId = await ensureSuperAdmin();
  if (!process.argv.includes('--no-demo')) {
    await seedDemo(adminId);
    const heroCount = await seedHeroSlides(adminId);
    if (heroCount) console.log(`Created ${heroCount} homepage hero slides.`);
  }
  console.log('Seeding complete.');
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
