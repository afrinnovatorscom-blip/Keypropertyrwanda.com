import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../config/environment.js';
import { BusinessSetting } from '../models/BusinessSetting.js';
import { Property } from '../models/Property.js';
import { Promotion } from '../models/Promotion.js';
import { logger } from '../utils/logger.js';

const SITE_NAME = 'Key Property Rwanda';
const DEFAULT_DESCRIPTION =
  'Houses, apartments, land and commercial properties for sale and rent in Kigali and across Rwanda. Featured listings, hot deals and trusted local agents.';

const STATIC_PAGES = {
  '/': { title: `${SITE_NAME} — Houses, Apartments, Land & Commercial Property in Rwanda`, description: DEFAULT_DESCRIPTION },
  '/properties': { title: `Properties for Sale and Rent in Rwanda | ${SITE_NAME}`, description: 'Browse every published property listing in Rwanda. Filter by location, category, price, bedrooms and more.' },
  '/properties/for-sale': { title: `Properties for Sale in Rwanda | ${SITE_NAME}`, description: 'Houses, apartments, land and commercial properties for sale across Rwanda.' },
  '/properties/for-rent': { title: `Properties for Rent in Rwanda | ${SITE_NAME}`, description: 'Houses, apartments, offices and shops for rent in Kigali and across Rwanda.' },
  '/properties/houses-apartments': { title: `Houses and Apartments in Rwanda | ${SITE_NAME}`, description: 'Family homes, villas and apartments for sale and rent in Rwanda.' },
  '/properties/land-plots': { title: `Land and Plots for Sale in Rwanda | ${SITE_NAME}`, description: 'Residential and commercial land and plots in Kigali and across Rwanda.' },
  '/properties/commercial': { title: `Commercial Properties in Rwanda | ${SITE_NAME}`, description: 'Offices, shops, warehouses and commercial buildings for sale and rent in Rwanda.' },
  '/featured': { title: `Featured Properties | ${SITE_NAME}`, description: 'Hand-picked featured properties from Key Property Rwanda.' },
  '/hot-deals': { title: `Hot Deals on Property in Rwanda | ${SITE_NAME}`, description: 'Limited-time property offers in Rwanda.' },
  '/promotions': { title: `Promotions | ${SITE_NAME}`, description: 'Current property campaigns and promotions from Key Property Rwanda.' },
  '/about': { title: `About Us | ${SITE_NAME}`, description: 'Learn about Key Property Rwanda, your trusted real estate partner in Rwanda.' },
  '/contact': { title: `Contact Us | ${SITE_NAME}`, description: 'Call, email or WhatsApp Key Property Rwanda about buying, renting or listing a property.' },
  '/privacy-policy': { title: `Privacy Policy | ${SITE_NAME}`, description: 'How Key Property Rwanda collects and uses personal information.' },
  '/terms-and-conditions': { title: `Terms and Conditions | ${SITE_NAME}`, description: 'Terms of use for KeyPropertyRwanda.com.' },
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Serialize JSON-LD safely for embedding in a <script> tag. */
export const safeJsonLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

const truncate = (text, max = 160) => {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

export const siteUrl = () => config.APP_URL.replace(/\/$/, '');
const absolute = (url) => (!url ? null : /^https?:\/\//i.test(url) ? url : `${siteUrl()}${url.startsWith('/') ? '' : '/'}${url}`);

const AVAILABILITY_SCHEMA = {
  available: 'https://schema.org/InStock',
  under_offer: 'https://schema.org/LimitedAvailability',
  sold: 'https://schema.org/SoldOut',
  rented: 'https://schema.org/SoldOut',
  unavailable: 'https://schema.org/OutOfStock',
};

/** schema.org RealEstateListing for a property detail page. */
export function propertyStructuredData(property, images = []) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    description: truncate(property.description, 500),
    url: `${siteUrl()}/property/${property.slug}`,
    identifier: property.reference,
    datePosted: property.publishedAt ? new Date(property.publishedAt).toISOString() : undefined,
    image: (images.length ? images.map((i) => i.url) : [property.mainImage]).filter(Boolean).map(absolute),
    contentLocation: {
      '@type': 'Place',
      name: [property.neighborhood, property.district, property.city].filter(Boolean).join(', '),
      address: {
        '@type': 'PostalAddress',
        streetAddress: property.address || undefined,
        addressLocality: property.city,
        addressRegion: property.district,
        addressCountry: 'RW',
      },
    },
    offers: {
      '@type': 'Offer',
      price: property.price,
      priceCurrency: property.currency,
      availability: AVAILABILITY_SCHEMA[property.availabilityStatus] ?? 'https://schema.org/InStock',
      businessFunction: property.purpose === 'rent' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell',
      seller: { '@type': 'RealEstateAgent', name: SITE_NAME, url: siteUrl() },
    },
  };
  if (property.bedrooms !== null && property.bedrooms !== undefined) data.numberOfBedrooms = property.bedrooms;
  if (property.bathrooms !== null && property.bathrooms !== undefined) data.numberOfBathroomsTotal = property.bathrooms;
  if (property.propertySize) data.floorSize = { '@type': 'QuantitativeValue', value: property.propertySize, unitCode: 'MTK' };
  return JSON.parse(JSON.stringify(data));
}

export async function organizationStructuredData() {
  const settings = await BusinessSetting.findPublicMap();
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: settings.company_name || SITE_NAME,
    url: siteUrl(),
    logo: absolute('/assets/key-property-logo.png'),
    telephone: settings.phone || undefined,
    email: settings.email || undefined,
    address: { '@type': 'PostalAddress', streetAddress: settings.address || undefined, addressLocality: 'Kigali', addressCountry: 'RW' },
    sameAs: ['facebook_url', 'instagram_url', 'x_url', 'linkedin_url'].map((k) => settings[k]).filter(Boolean),
  };
}

/** Head tags for a given public URL path. */
export async function headForPath(urlPath) {
  const pathname = urlPath.split('?')[0].replace(/\/+$/, '') || '/';
  let meta = STATIC_PAGES[pathname];
  let jsonLd = null;
  let image = absolute('/assets/key-property-logo.png');
  let noindex = false;

  const propertyMatch = pathname.match(/^\/property\/([a-z0-9-]+)$/);
  if (propertyMatch) {
    const property = await Property.findBySlug(propertyMatch[1], { publicOnly: true });
    if (property) {
      const purpose = property.purpose === 'rent' ? 'for Rent' : 'for Sale';
      meta = {
        title: `${property.title} — ${purpose} in ${property.district} | ${SITE_NAME}`,
        description: truncate(property.description),
      };
      image = absolute(property.mainImage) ?? image;
      jsonLd = propertyStructuredData(property);
    }
  }
  if (pathname === '/') jsonLd = await organizationStructuredData();
  if (pathname.startsWith('/admin')) {
    meta = { title: `Admin | ${SITE_NAME}`, description: DEFAULT_DESCRIPTION };
    noindex = true;
  }
  meta = meta ?? { title: SITE_NAME, description: DEFAULT_DESCRIPTION };

  const canonical = `${siteUrl()}${pathname === '/' ? '/' : pathname}`;
  const tags = [
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${propertyMatch ? 'article' : 'website'}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : '',
    '<meta name="twitter:card" content="summary_large_image" />',
    noindex ? '<meta name="robots" content="noindex, nofollow" />' : '',
    jsonLd ? `<script type="application/ld+json" data-ssr="true">${safeJsonLd(jsonLd)}</script>` : '',
  ].filter(Boolean);
  return { title: meta.title, tags: tags.join('\n    ') };
}

let cachedTemplate = null;

async function loadTemplate() {
  if (cachedTemplate && config.isProduction) return cachedTemplate;
  cachedTemplate = await fs.readFile(path.join(config.distDir, 'index.html'), 'utf8');
  return cachedTemplate;
}

/** The built index.html with page-specific title, meta and structured data injected. */
export async function renderIndexHtml(urlPath) {
  const template = await loadTemplate();
  try {
    const head = await headForPath(urlPath);
    return template
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(head.title)}</title>`)
      .replace('<!--app-head-->', head.tags);
  } catch (error) {
    logger.warn('SEO head rendering failed; serving default HTML', error.message);
    return template;
  }
}

export async function buildSitemap() {
  const base = siteUrl();
  const [properties, promotions] = await Promise.all([Property.publicSlugs(), Promotion.findLive({ limit: 100 })]);
  const urls = [
    ...Object.keys(STATIC_PAGES).map((p) => ({ loc: `${base}${p === '/' ? '/' : p}` })),
    ...properties.map((p) => ({ loc: `${base}/property/${p.slug}`, lastmod: new Date(p.updatedAt).toISOString().slice(0, 10) })),
    ...promotions.map((p) => ({ loc: `${base}/promotions/${p.slug}` })),
  ];
  const body = urls
    .map((u) => `  <url><loc>${escapeHtml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function robotsTxt() {
  return `User-agent: *\nDisallow: /admin\nDisallow: /api/\nAllow: /\n\nSitemap: ${siteUrl()}/sitemap.xml\n`;
}
