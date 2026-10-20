import { transaction } from '../config/database.js';
import { AdvertisementPlacement } from '../models/AdvertisementPlacement.js';
import { BusinessSetting } from '../models/BusinessSetting.js';
import { PropertyCategory } from '../models/PropertyCategory.js';
import { WebsiteContent } from '../models/WebsiteContent.js';

export const PLACEMENTS = [
  { slug: 'home_hero', name: 'Homepage hero banner', description: 'Large banner shown in the homepage hero area', maxItems: 3 },
  { slug: 'home_promo', name: 'Homepage promotional banner', description: 'Wide banner between homepage sections', maxItems: 2 },
  { slug: 'listing_page', name: 'Property listing page', description: 'Banner at the top of property search results', maxItems: 1 },
  { slug: 'details_page', name: 'Property details page', description: 'Banner below the property description', maxItems: 1 },
  { slug: 'sidebar', name: 'Sidebar', description: 'Compact card in page sidebars', maxItems: 2 },
  { slug: 'in_content', name: 'In-content promotional block', description: 'Card injected inside listing grids', maxItems: 1 },
  { slug: 'mobile_banner', name: 'Mobile banner', description: 'Banner shown only on small screens', maxItems: 1 },
];

export const DEFAULT_CATEGORIES = [
  { name: 'Houses', slug: 'houses', typeGroup: 'residential', sortOrder: 1 },
  { name: 'Apartments', slug: 'apartments', typeGroup: 'residential', sortOrder: 2 },
  { name: 'Villas', slug: 'villas', typeGroup: 'residential', sortOrder: 3 },
  { name: 'Land', slug: 'land', typeGroup: 'land', sortOrder: 4 },
  { name: 'Plots', slug: 'plots', typeGroup: 'land', sortOrder: 5 },
  { name: 'Commercial Properties', slug: 'commercial-properties', typeGroup: 'commercial', sortOrder: 6 },
  { name: 'Offices', slug: 'offices', typeGroup: 'commercial', sortOrder: 7 },
  { name: 'Shops', slug: 'shops', typeGroup: 'commercial', sortOrder: 8 },
  { name: 'Warehouses', slug: 'warehouses', typeGroup: 'commercial', sortOrder: 9 },
];

export const SETTINGS = [
  { key: 'company_name', value: 'Key Property Rwanda', group: 'company', label: 'Company name', isPublic: true },
  { key: 'tagline', value: 'Your key to property in Rwanda', group: 'company', label: 'Tagline', isPublic: true },
  { key: 'site_url', value: 'https://keypropertyrwanda.com', group: 'company', label: 'Public website URL', isPublic: true },
  { key: 'phone', value: '+250 788 000 000', group: 'contact', label: 'Phone number', isPublic: true },
  { key: 'whatsapp_number', value: '+250788000000', group: 'contact', label: 'WhatsApp number (international format)', isPublic: true },
  { key: 'email', value: 'info@keypropertyrwanda.com', group: 'contact', label: 'Public email', isPublic: true },
  { key: 'address', value: 'KG 7 Ave, Kacyiru, Kigali, Rwanda', group: 'contact', label: 'Office address', isPublic: true },
  { key: 'office_hours', value: 'Mon – Fri 8:00 – 18:00, Sat 9:00 – 14:00', group: 'contact', label: 'Office hours', isPublic: true },
  { key: 'facebook_url', value: '', group: 'social', label: 'Facebook URL', isPublic: true },
  { key: 'instagram_url', value: '', group: 'social', label: 'Instagram URL', isPublic: true },
  { key: 'x_url', value: '', group: 'social', label: 'X (Twitter) URL', isPublic: true },
  { key: 'linkedin_url', value: '', group: 'social', label: 'LinkedIn URL', isPublic: true },
  { key: 'default_currency', value: 'RWF', group: 'listings', label: 'Default currency', isPublic: true },
  { key: 'hero_animation', value: 'fade', group: 'hero', label: 'Hero animation (slide, fade or flip)', isPublic: true },
  { key: 'hero_interval_seconds', value: '6', group: 'hero', label: 'Hero autoplay interval (seconds)', isPublic: true },
  { key: 'inquiry_rate_limit_per_hour', value: '5', group: 'inquiries', label: 'Max inquiries per visitor per hour', isPublic: false },
  { key: 'inquiry_notification_email', value: '', group: 'inquiries', label: 'Internal inquiry notification email', isPublic: false },
];

export const CONTENT = [
  {
    key: 'home_hero',
    title: 'Find your key to the perfect property in Rwanda',
    body: 'Houses, apartments, land and commercial spaces for sale and rent across Kigali and beyond.',
    description: 'Homepage hero heading (title) and subheading (body)',
  },
  {
    key: 'home_intro',
    title: 'Trusted real estate partners in Rwanda',
    body: 'Key Property Rwanda connects buyers, tenants and investors with verified properties across the country. Our team handles every listing personally — from site visits and documentation to negotiation — so you can move forward with confidence.\n\nWhether you are looking for a family home in Kigali, a plot to build on, or a commercial space for your business, we will help you find the right fit.',
    description: 'Homepage company introduction',
  },
  {
    key: 'home_cta',
    title: 'Looking to buy, rent or list a property?',
    body: 'Talk to our team today. We respond quickly by phone, email or WhatsApp.',
    description: 'Homepage contact call-to-action',
  },
  {
    key: 'about_page',
    title: 'About Key Property Rwanda',
    body: 'Key Property Rwanda is a real estate agency dedicated to making property transactions in Rwanda simple, transparent and secure.\n\nWe list houses, apartments, land, plots and commercial properties for sale and rent, and we personally verify the properties we market. Our clients include families relocating to Kigali, members of the diaspora investing at home, and businesses looking for offices, shops and warehouses.\n\nOur values\n- Integrity: honest pricing and accurate listings.\n- Local expertise: deep knowledge of Kigali neighbourhoods and districts across Rwanda.\n- Service: responsive support from the first inquiry to handing over the keys.',
    description: 'About Us page',
  },
  {
    key: 'contact_page',
    title: 'Contact us',
    body: 'Have a question about a property, or want us to market yours? Send us a message and our team will get back to you within one business day.',
    description: 'Contact page introduction',
  },
  {
    key: 'privacy_policy',
    title: 'Privacy Policy',
    body: 'Key Property Rwanda respects your privacy. This policy explains what information we collect and how we use it.\n\nInformation we collect\nWhen you send an inquiry we collect your name, phone number, optional email address, your message and the property you asked about. We do not sell your personal information.\n\nHow we use it\nWe use inquiry details only to respond to you about properties and related services. Authorised staff can access inquiries for this purpose.\n\nAnalytics\nWe measure how often advertisements and promotions are viewed and clicked using anonymous, daily-rotating identifiers. We do not store your IP address in our analytics.\n\nRetention\nInquiries are retained for as long as needed to provide our services and meet legal obligations.\n\nYour rights\nYou may ask us to access, correct or delete your personal information by contacting us using the details on our Contact page.',
    description: 'Privacy Policy page',
  },
  {
    key: 'terms_conditions',
    title: 'Terms and Conditions',
    body: 'By using KeyPropertyRwanda.com you agree to these terms.\n\nListings\nWe make every effort to keep listings accurate, but property details, prices and availability may change without notice. Listings do not constitute an offer or a contract.\n\nOffers and promotions\nHot Deals and promotions are valid only during their stated dates and while the property remains available.\n\nAdvertisements\nAdvertisements are clearly labelled. Third-party websites linked from advertisements are not controlled by Key Property Rwanda.\n\nLiability\nKey Property Rwanda is not liable for decisions made solely on the basis of information published on this website. Please verify details with our team before entering into any agreement.\n\nContact\nQuestions about these terms can be sent through our Contact page.',
    description: 'Terms and Conditions page',
  },
];

/** Ensure required reference data exists. Idempotent; never overwrites admin edits. */
export async function syncReferenceData() {
  await transaction(async (conn) => {
    for (const placement of PLACEMENTS) await AdvertisementPlacement.upsert(placement, conn);
    for (const category of DEFAULT_CATEGORIES) {
      if (!(await PropertyCategory.slugExists(category.slug, 0, conn)) && !(await PropertyCategory.nameExists(category.name, 0, conn))) {
        await PropertyCategory.create(category, conn);
      }
    }
    for (const setting of SETTINGS) await BusinessSetting.insertIfMissing(setting, conn);
    for (const content of CONTENT) await WebsiteContent.insertIfMissing(content, conn);
  });
}
