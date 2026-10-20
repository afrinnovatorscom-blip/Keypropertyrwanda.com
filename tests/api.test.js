import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { PASSWORD, PNG_1X1, startTestApp } from './helpers/testApp.js';

const DAY = 86_400_000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString();

let t;
let admin;
let anon;

const propertyBody = (overrides = {}) => ({
  title: 'Test Family House in Kicukiro',
  description: 'A spacious family house used by the automated test-suite.',
  categoryId: 1,
  purpose: 'sale',
  price: 120000000,
  district: 'Kicukiro',
  city: 'Kigali',
  neighborhood: 'Niboye',
  bedrooms: 4,
  bathrooms: 3,
  propertySize: 250,
  amenities: ['Garden', 'Parking'],
  ...overrides,
});

async function uploadPng(client, propertyId) {
  const form = new FormData();
  form.append('images', new Blob([PNG_1X1], { type: 'image/png' }), 'photo.png');
  return client.request('POST', `/api/v1/admin/properties/${propertyId}/images`, { form });
}

/** Create a published property (with a photo) and return its record. */
async function publishedProperty(overrides) {
  const created = await admin.post('/api/v1/admin/properties', propertyBody(overrides));
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.id;
  assert.equal((await uploadPng(admin, id)).status, 201);
  const published = await admin.post(`/api/v1/admin/properties/${id}/publish`);
  assert.equal(published.status, 200, JSON.stringify(published.body));
  return published.body.data;
}

before(async () => {
  t = await startTestApp();
  admin = await t.login('super_admin');
  anon = t.client();
});

after(async () => {
  await t?.close();
});

describe('Health and database connectivity', () => {
  it('reports app and database status without secrets', async () => {
    const res = await anon.get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.database.status, 'up');
    const text = JSON.stringify(res.body);
    assert.ok(!/password|secret|DB_/i.test(text));
  });
});

describe('Authentication', () => {
  it('requires a CSRF token to sign in', async () => {
    const c = t.client();
    const res = await c.post('/api/v1/auth/login', { email: t.users.viewer.email, password: PASSWORD });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'CSRF_INVALID');
  });

  it('rejects wrong passwords and records the attempt', async () => {
    const c = t.client();
    const res = await c.login(t.users.viewer.email, 'WrongPassword1');
    assert.equal(res.status, 401);
    const [row] = await t.db.query("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'auth.login_failed'");
    assert.ok(Number(row.n) >= 1);
  });

  it('locks the account after repeated failures', async () => {
    const c = t.client();
    for (let i = 0; i < 5; i += 1) await c.login(t.users.content_manager.email, 'WrongPassword1');
    const res = await c.login(t.users.content_manager.email, PASSWORD);
    assert.equal(res.status, 423);
    await t.db.query('UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = ?', [t.users.content_manager.id]);
  });

  it('issues an HTTP-only session cookie and returns the profile', async () => {
    const c = t.client();
    await c.fetchCsrf();
    const res = await c.post('/api/v1/auth/login', { email: t.users.viewer.email, password: PASSWORD });
    assert.equal(res.status, 200);
    const cookie = res.headers.getSetCookie().join(';');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    const me = await c.get('/api/v1/auth/me');
    assert.equal(me.body.data.user.role.slug, 'viewer');
  });

  it('rejects unauthenticated admin access and ends sessions on logout', async () => {
    assert.equal((await anon.get('/api/v1/admin/dashboard')).status, 401);
    const c = await t.login('viewer');
    assert.equal((await c.get('/api/v1/admin/dashboard')).status, 200);
    assert.equal((await c.post('/api/v1/auth/logout')).status, 200);
    assert.equal((await c.get('/api/v1/admin/dashboard')).status, 401);
  });
});

describe('Role permissions (enforced on the backend)', () => {
  it('blocks viewers and inquiry officers from creating or publishing', async () => {
    const viewer = await t.login('viewer');
    assert.equal((await viewer.post('/api/v1/admin/properties', propertyBody())).status, 403);
    const officer = await t.login('inquiry_officer');
    assert.equal((await officer.post('/api/v1/admin/properties', propertyBody())).status, 403);
    assert.equal((await officer.get('/api/v1/admin/users')).status, 403);
  });

  it('prevents marketing managers from changing prices or availability', async () => {
    const property = await publishedProperty({ title: 'Permission Test House' });
    const marketing = await t.login('marketing_manager');
    assert.equal((await marketing.put(`/api/v1/admin/properties/${property.id}`, { price: 1 })).status, 403);
    assert.equal((await marketing.post(`/api/v1/admin/properties/${property.id}/availability`, { status: 'sold' })).status, 403);
  });

  it('allows property managers to edit but not to manage users', async () => {
    const pm = await t.login('property_manager');
    const created = await pm.post('/api/v1/admin/properties', propertyBody({ title: 'PM Created Property' }));
    assert.equal(created.status, 201);
    assert.equal((await pm.post('/api/v1/admin/users', { fullName: 'X', email: 'x@test.local', roleId: 1, password: 'Abcdefgh12' })).status, 403);
  });

  it('prevents unauthorised users from publishing campaigns', async () => {
    const property = await publishedProperty({ title: 'Campaign Permission House' });
    const promo = await admin.post('/api/v1/admin/promotions', {
      name: 'Permission Promo', campaignType: 'general', placement: 'promotions_page', startAt: iso(-1), endAt: iso(5), propertyIds: [property.id],
    });
    assert.equal(promo.status, 201);
    for (const role of ['viewer', 'property_manager', 'inquiry_officer', 'content_manager']) {
      const c = await t.login(role);
      assert.equal((await c.post(`/api/v1/admin/promotions/${promo.body.data.id}/publish`)).status, 403, role);
    }
    const marketing = await t.login('marketing_manager');
    assert.equal((await marketing.post(`/api/v1/admin/promotions/${promo.body.data.id}/publish`)).status, 200);
  });

  it('only a Super Admin may grant the Super Admin role', async () => {
    const roles = await admin.get('/api/v1/admin/roles');
    const superRole = roles.body.data.roles.find((r) => r.slug === 'super_admin');
    const res = await admin.post('/api/v1/admin/users', { fullName: 'Second Admin', email: 'second@test.local', roleId: superRole.id, password: 'Abcdefgh12' });
    assert.equal(res.status, 201);
  });
});

describe('Property CRUD, publication and images', () => {
  let property;

  it('creates a draft with a reference and slug', async () => {
    const res = await admin.post('/api/v1/admin/properties', propertyBody({ title: 'Draft Only Villa' }));
    assert.equal(res.status, 201);
    property = res.body.data;
    assert.match(property.reference, /^KPR-\d{5}$/);
    assert.equal(property.slug, 'draft-only-villa');
    assert.equal(property.publicationStatus, 'draft');
    assert.deepEqual(property.amenities.sort(), ['Garden', 'Parking']);
  });

  it('validates input', async () => {
    const res = await admin.post('/api/v1/admin/properties', { title: 'x', price: -5, videoUrl: 'javascript:alert(1)' });
    assert.equal(res.status, 422);
    const paths = res.body.error.details.map((d) => d.path);
    assert.ok(paths.includes('title') && paths.includes('price') && paths.includes('videoUrl'));
  });

  it('cannot be published without a photo', async () => {
    const res = await admin.post(`/api/v1/admin/properties/${property.id}/publish`);
    assert.equal(res.status, 422);
  });

  it('rejects non-image uploads by signature', async () => {
    const form = new FormData();
    form.append('images', new Blob([Buffer.from('<?php system($_GET[1]); ?> padding')], { type: 'image/png' }), 'shell.png');
    const res = await admin.request('POST', `/api/v1/admin/properties/${property.id}/images`, { form });
    assert.equal(res.status, 415);
  });

  it('uploads, reorders and serves images', async () => {
    assert.equal((await uploadPng(admin, property.id)).status, 201);
    const second = await uploadPng(admin, property.id);
    const ids = second.body.data.map((i) => i.id);
    const reordered = await admin.put(`/api/v1/admin/properties/${property.id}/images/order`, { imageIds: [...ids].reverse() });
    assert.equal(reordered.status, 200);
    assert.deepEqual(reordered.body.data.map((i) => i.id), [...ids].reverse());
    const file = await anon.get(reordered.body.data[0].url);
    assert.equal(file.status, 200);
    assert.equal((await admin.put(`/api/v1/admin/properties/${property.id}/images/order`, { imageIds: [ids[0]] })).status, 400);
  });

  it('keeps unpublished properties out of public results', async () => {
    const list = await anon.get('/api/v1/properties?q=Draft%20Only%20Villa');
    assert.equal(list.body.meta.total, 0);
    assert.equal((await anon.get(`/api/v1/properties/${property.slug}`)).status, 404);
  });

  it('publishes, updates and unpublishes', async () => {
    assert.equal((await admin.post(`/api/v1/admin/properties/${property.id}/publish`)).status, 200);
    assert.equal((await anon.get(`/api/v1/properties/${property.slug}`)).status, 200);
    const upd = await admin.put(`/api/v1/admin/properties/${property.id}`, { price: 130000000, bedrooms: 5 });
    assert.equal(upd.body.data.price, 130000000);
    const logs = await t.db.query("SELECT action FROM audit_logs WHERE entity_type = 'property' AND entity_id = ? ORDER BY id", [String(property.id)]);
    assert.ok(logs.some((l) => l.action === 'property.price_changed'));
    assert.equal((await admin.post(`/api/v1/admin/properties/${property.id}/unpublish`)).status, 200);
    assert.equal((await anon.get(`/api/v1/properties/${property.slug}`)).status, 404);
  });

  it('archives without deleting history, and restores', async () => {
    const res = await admin.post(`/api/v1/admin/properties/${property.id}/archive`);
    assert.equal(res.body.data.publicationStatus, 'archived');
    assert.equal((await admin.put(`/api/v1/admin/properties/${property.id}`, { title: 'Edited after archive' })).status, 409);
    const restored = await admin.post(`/api/v1/admin/properties/${property.id}/restore`);
    assert.equal(restored.body.data.publicationStatus, 'unpublished');
  });
});

describe('Property search', () => {
  before(async () => {
    await publishedProperty({ title: 'Search Rent Apartment', categoryId: 2, purpose: 'rent', price: 800000, pricePeriod: 'month', bedrooms: 2, district: 'Gasabo', propertySize: 90 });
    await publishedProperty({ title: 'Search Land Plot', categoryId: 4, purpose: 'sale', price: 30000000, bedrooms: null, bathrooms: null, propertySize: null, landSize: 600, district: 'Rubavu', city: 'Rubavu' });
  });

  it('filters by purpose, location, category, price, bedrooms and size', async () => {
    const rent = await anon.get('/api/v1/properties?purpose=rent&location=Gasabo&maxPrice=1000000');
    assert.ok(rent.body.data.every((p) => p.purpose === 'rent' && p.price <= 1000000));
    assert.ok(rent.body.data.some((p) => p.title === 'Search Rent Apartment'));

    const land = await anon.get('/api/v1/properties?group=land&minSize=500');
    assert.deepEqual(land.body.data.map((p) => p.title), ['Search Land Plot']);

    const beds = await anon.get('/api/v1/properties?bedrooms=3');
    assert.ok(beds.body.data.every((p) => p.bedrooms >= 3));

    const cat = await anon.get('/api/v1/properties?category=apartments');
    assert.ok(cat.body.data.every((p) => p.category.slug === 'apartments'));
  });

  it('paginates and sorts', async () => {
    const res = await anon.get('/api/v1/properties?limit=1&page=2&sort=price_asc');
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.meta.page, 2);
    const all = await anon.get('/api/v1/properties?sort=price_asc&limit=50');
    const prices = all.body.data.map((p) => p.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  });

  it('rejects invalid filters', async () => {
    assert.equal((await anon.get('/api/v1/properties?purpose=steal')).status, 422);
  });
});

describe('Inquiries and WhatsApp', () => {
  let property;
  before(async () => {
    property = await publishedProperty({ title: 'Inquiry Test House' });
  });

  it('stores an inquiry in MySQL linked to the property', async () => {
    const res = await anon.post('/api/v1/inquiries', {
      customerName: 'Aline', phone: '+250 788 123 456', message: 'Is this still available?', propertySlug: property.slug, consent: true, elapsedMs: 8000, source: 'property_page',
    });
    assert.equal(res.status, 201);
    const [row] = await t.db.query('SELECT * FROM inquiries WHERE property_id = ?', [property.id]);
    assert.equal(row.customer_name, 'Aline');
    assert.equal(row.property_reference, property.reference);
    assert.equal(row.status, 'new');
    assert.equal(row.ip_hash.length, 64);
  });

  it('requires consent and validates fields', async () => {
    const res = await anon.post('/api/v1/inquiries', { customerName: 'A', phone: 'abc', message: 'short' });
    assert.equal(res.status, 422);
  });

  it('silently drops honeypot and too-fast submissions', async () => {
    const before = await t.db.query('SELECT COUNT(*) AS n FROM inquiries');
    await anon.post('/api/v1/inquiries', { customerName: 'Bot', phone: '+250788000001', message: 'Buy cheap stuff now!!!', consent: true, website: 'http://spam', elapsedMs: 9000 });
    await anon.post('/api/v1/inquiries', { customerName: 'Bot', phone: '+250788000002', message: 'Buy cheap stuff now!!!', consent: true, elapsedMs: 200 });
    const after = await t.db.query('SELECT COUNT(*) AS n FROM inquiries');
    assert.equal(Number(after[0].n), Number(before[0].n));
  });

  it('enforces the per-visitor hourly limit', async () => {
    await t.db.query("UPDATE business_settings SET setting_value = '1' WHERE setting_key = 'inquiry_rate_limit_per_hour'");
    const res = await anon.post('/api/v1/inquiries', { customerName: 'Jean', phone: '+250788999999', message: 'Another question about plots', consent: true, elapsedMs: 9000 });
    assert.equal(res.status, 429);
    await t.db.query("UPDATE business_settings SET setting_value = '50' WHERE setting_key = 'inquiry_rate_limit_per_hour'");
  });

  it('lets staff update status, add notes and track follow-ups', async () => {
    const [row] = await t.db.query('SELECT id FROM inquiries WHERE property_id = ?', [property.id]);
    const officer = await t.login('inquiry_officer');
    const upd = await officer.patch(`/api/v1/admin/inquiries/${row.id}`, { status: 'contacted', followUpAt: iso(-1), assignedTo: t.users.inquiry_officer.id });
    assert.equal(upd.body.data.status, 'contacted');
    assert.ok(upd.body.data.contactedAt);
    const note = await officer.post(`/api/v1/admin/inquiries/${row.id}/notes`, { note: 'Called, viewing on Saturday.' });
    assert.equal(note.body.data.notes.length, 1);
    const due = await officer.get('/api/v1/admin/inquiries?followUpDue=true');
    assert.ok(due.body.data.some((i) => i.id === row.id));
    const viewer = await t.login('viewer');
    assert.equal((await viewer.patch(`/api/v1/admin/inquiries/${row.id}`, { status: 'closed' })).status, 403);
  });

  it('builds an encoded WhatsApp link on the property page', async () => {
    const res = await anon.get(`/api/v1/properties/${property.slug}`);
    const link = res.body.data.whatsappUrl;
    assert.match(link, /^https:\/\/wa\.me\/\d+\?text=/);
    const text = decodeURIComponent(link.split('?text=')[1]);
    assert.ok(text.includes(property.reference) && text.includes(property.title));
    assert.equal(res.body.data.structuredData['@type'], 'RealEstateListing');
  });
});

describe('Featured properties', () => {
  it('shows only live placements of published, available properties', async () => {
    const live = await publishedProperty({ title: 'Featured Live House' });
    const future = await publishedProperty({ title: 'Featured Future House' });
    const expired = await publishedProperty({ title: 'Featured Expired House' });
    const marketing = await t.login('marketing_manager');
    assert.equal((await marketing.post('/api/v1/admin/featured', { propertyId: live.id, startAt: iso(-1), endAt: iso(5) })).status, 201);
    assert.equal((await marketing.post('/api/v1/admin/featured', { propertyId: future.id, startAt: iso(2) })).status, 201);
    assert.equal((await marketing.post('/api/v1/admin/featured', { propertyId: expired.id, startAt: iso(-1), endAt: iso(5) })).status, 201);
    await t.db.query('UPDATE featured_property_campaigns SET start_at = ?, end_at = ? WHERE property_id = ?', [new Date(Date.now() - 3 * DAY), new Date(Date.now() - DAY), expired.id]);

    let titles = (await anon.get('/api/v1/featured')).body.data.map((p) => p.title);
    assert.ok(titles.includes('Featured Live House'));
    assert.ok(!titles.includes('Featured Future House'));
    assert.ok(!titles.includes('Featured Expired House'));

    // Becoming unavailable removes it from the featured list without changing its price.
    await admin.post(`/api/v1/admin/properties/${live.id}/availability`, { status: 'sold' });
    titles = (await anon.get('/api/v1/featured')).body.data.map((p) => p.title);
    assert.ok(!titles.includes('Featured Live House'));
    const [row] = await t.db.query('SELECT price FROM properties WHERE id = ?', [live.id]);
    assert.equal(Number(row.price), live.price);
  });

  it('refuses to feature an unpublished property', async () => {
    const draft = await admin.post('/api/v1/admin/properties', propertyBody({ title: 'Unpublished Feature Attempt' }));
    const res = await admin.post('/api/v1/admin/featured', { propertyId: draft.body.data.id, startAt: iso(0) });
    assert.equal(res.status, 422);
  });
});

describe('Hot deals', () => {
  let property;
  let deal;
  before(async () => {
    property = await publishedProperty({ title: 'Hot Deal House', price: 200000000 });
  });

  it('calculates discounts on the backend and rejects invalid ones', async () => {
    const calc = await admin.post('/api/v1/admin/hot-deals/calculate', { propertyId: property.id, discountType: 'percentage', discountValue: 15 });
    assert.equal(calc.body.data.promotionalPrice, 170000000);
    assert.equal((await admin.post('/api/v1/admin/hot-deals/calculate', { propertyId: property.id, discountType: 'amount', discountValue: 300000000 })).status, 422);
    assert.equal((await admin.post('/api/v1/admin/hot-deals', { propertyId: property.id, title: 'Bad', discountType: 'percentage', discountValue: -5, startAt: iso(-1), endAt: iso(5) })).status, 422);
  });

  it('creates a draft, activates it and shows it publicly', async () => {
    const res = await admin.post('/api/v1/admin/hot-deals', {
      propertyId: property.id, title: 'Weekend Special', discountType: 'amount', discountValue: 20000000, originalPrice: 210000000, startAt: iso(-1), endAt: iso(7),
    });
    assert.equal(res.status, 201);
    deal = res.body.data;
    assert.equal(deal.status, 'draft');
    assert.equal(deal.promotionalPrice, 190000000);
    assert.equal(deal.originalPriceVerified, false);
    assert.equal((await anon.get('/api/v1/hot-deals')).body.data.some((d) => d.id === deal.id), false);
    const activated = await admin.post(`/api/v1/admin/hot-deals/${deal.id}/activate`);
    assert.equal(activated.body.data.status, 'active');
    const pub = (await anon.get('/api/v1/hot-deals')).body.data.find((d) => d.id === deal.id);
    assert.ok(pub);
    assert.equal(pub.originalPrice, null, 'unverified original price must be hidden');
    const [row] = await t.db.query('SELECT price FROM properties WHERE id = ?', [property.id]);
    assert.equal(Number(row.price), 200000000, 'deal must not change the property price');
  });

  it('shows the original price only after verification by authorised staff', async () => {
    const pm = await t.login('property_manager');
    assert.equal((await pm.put(`/api/v1/admin/hot-deals/${deal.id}`, { originalPriceVerified: true })).status, 403);
    const marketing = await t.login('marketing_manager');
    const ok = await marketing.put(`/api/v1/admin/hot-deals/${deal.id}`, { originalPriceVerified: true });
    assert.equal(ok.status, 200);
    const pub = (await anon.get(`/api/v1/hot-deals/${deal.id}`)).body.data;
    assert.equal(pub.originalPrice, 210000000);
    assert.ok(pub.discountPercentage > 0);
  });

  it('excludes expired deals even before the scheduler runs, then marks them expired', async () => {
    await t.db.query('UPDATE hot_deals SET end_at = ? WHERE id = ?', [new Date(Date.now() - 1000), deal.id]);
    assert.equal((await anon.get(`/api/v1/hot-deals/${deal.id}`)).status, 404);
    const { syncCampaignStatuses } = await import('../server/services/campaignScheduler.js');
    await syncCampaignStatuses();
    const [row] = await t.db.query('SELECT status FROM hot_deals WHERE id = ?', [deal.id]);
    assert.equal(row.status, 'expired');
    assert.equal((await admin.put(`/api/v1/admin/hot-deals/${deal.id}`, { title: 'Edit expired' })).status, 409);
  });

  it('ends running deals when the property becomes unavailable', async () => {
    const p = await publishedProperty({ title: 'Deal Then Sold House' });
    const d = await admin.post('/api/v1/admin/hot-deals', { propertyId: p.id, title: 'Quick sale', discountType: 'percentage', discountValue: 5, startAt: iso(-1), endAt: iso(5) });
    await admin.post(`/api/v1/admin/hot-deals/${d.body.data.id}/activate`);
    await admin.post(`/api/v1/admin/properties/${p.id}/availability`, { status: 'sold' });
    assert.equal((await anon.get(`/api/v1/hot-deals/${d.body.data.id}`)).status, 404);
    const [row] = await t.db.query('SELECT status FROM hot_deals WHERE id = ?', [d.body.data.id]);
    assert.equal(row.status, 'ended');
    assert.equal((await admin.post(`/api/v1/admin/hot-deals/${d.body.data.id}/activate`)).status, 409);
  });
});

describe('Advertisements, promotions and analytics', () => {
  let ad;
  let imagePath;

  before(async () => {
    const form = new FormData();
    form.append('image', new Blob([PNG_1X1], { type: 'image/png' }), 'banner.png');
    const up = await admin.request('POST', '/api/v1/admin/uploads?folder=advertisements', { form });
    assert.equal(up.status, 201);
    imagePath = up.body.data.path;
  });

  it('rejects unsafe destination URLs', async () => {
    const placements = await admin.get('/api/v1/admin/advertisement-placements');
    for (const url of ['javascript:alert(1)', 'data:text/html,x', '//evil.example']) {
      const res = await admin.post('/api/v1/admin/advertisements', { internalName: 'Bad', headline: 'Bad', placementId: placements.body.data[0].id, startAt: iso(-1), destinationUrl: url });
      assert.equal(res.status, 422, url);
    }
  });

  it('shows only published adverts within schedule, in the right placement', async () => {
    const placements = (await admin.get('/api/v1/admin/advertisement-placements')).body.data;
    const sidebar = placements.find((p) => p.slug === 'sidebar');
    const res = await admin.post('/api/v1/admin/advertisements', { internalName: 'Sidebar test', headline: 'Visit us', placementId: sidebar.id, desktopImage: imagePath, destinationUrl: 'https://example.com', startAt: iso(-1), endAt: iso(3) });
    assert.equal(res.status, 201);
    ad = res.body.data;
    assert.equal((await anon.get('/api/v1/advertisements?placement=sidebar')).body.data.length, 0, 'drafts are hidden');
    const marketing = await t.login('marketing_manager');
    assert.equal((await marketing.post(`/api/v1/admin/advertisements/${ad.id}/publish`)).body.data.status, 'active');
    const live = (await anon.get('/api/v1/advertisements?placement=sidebar')).body.data;
    assert.deepEqual(live.map((a) => a.id), [ad.id]);
    assert.equal((await anon.get('/api/v1/advertisements?placement=home_promo')).body.data.length, 0);

    await marketing.post(`/api/v1/admin/advertisements/${ad.id}/pause`);
    assert.equal((await anon.get('/api/v1/advertisements?placement=sidebar')).body.data.length, 0, 'paused adverts are hidden');
    await marketing.post(`/api/v1/admin/advertisements/${ad.id}/publish`);
  });

  it('schedules future adverts instead of showing them', async () => {
    const placements = (await admin.get('/api/v1/admin/advertisement-placements')).body.data;
    const promo = placements.find((p) => p.slug === 'home_promo');
    const res = await admin.post('/api/v1/admin/advertisements', { internalName: 'Future', headline: 'Soon', placementId: promo.id, desktopImage: imagePath, startAt: iso(3) });
    const published = await admin.post(`/api/v1/admin/advertisements/${res.body.data.id}/publish`);
    assert.equal(published.body.data.status, 'scheduled');
    assert.equal((await anon.get('/api/v1/advertisements?placement=home_promo')).body.data.length, 0);
  });

  it('tracks impressions and clicks once per visitor per day and ignores bots', async () => {
    const visitor = t.client();
    for (let i = 0; i < 3; i += 1) await visitor.post('/api/v1/events/ad', { advertisementId: ad.id, eventType: 'impression' });
    const click = await visitor.post('/api/v1/events/ad', { advertisementId: ad.id, eventType: 'click' });
    assert.equal(click.body.data.recorded, true);
    const bot = t.client();
    bot.userAgent = 'Googlebot/2.1';
    assert.equal((await bot.post('/api/v1/events/ad', { advertisementId: ad.id, eventType: 'impression' })).body.data.recorded, false);
    const [row] = await t.db.query("SELECT SUM(event_type='impression') AS i, SUM(event_type='click') AS c FROM advertisement_events WHERE advertisement_id = ?", [ad.id]);
    assert.equal(Number(row.i), 1);
    assert.equal(Number(row.c), 1);
    const analytics = await admin.get('/api/v1/admin/analytics');
    const stats = analytics.body.data.advertisements.find((a) => a.id === ad.id);
    assert.equal(stats.impressions, 1);
    assert.equal(stats.ctr, 100);
  });

  it('attributes inquiries to a clicked campaign', async () => {
    const p = await publishedProperty({ title: 'Attribution House' });
    const res = await anon.post('/api/v1/inquiries', { customerName: 'Clicker', phone: '+250788555555', message: 'Saw your advert, interested.', consent: true, elapsedMs: 9000, propertySlug: p.slug, advertisementId: ad.id });
    assert.equal(res.status, 201);
    const analytics = await admin.get('/api/v1/admin/analytics');
    assert.equal(analytics.body.data.advertisements.find((a) => a.id === ad.id).attributedInquiries, 1);
  });

  it('schedules promotions and never shows expired ones', async () => {
    const p = await publishedProperty({ title: 'Promotion Member House' });
    const created = await admin.post('/api/v1/admin/promotions', { name: 'Season Test Promo', campaignType: 'seasonal', placement: 'homepage', startAt: iso(-1), endAt: iso(10), propertyIds: [p.id] });
    const id = created.body.data.id;
    await admin.post(`/api/v1/admin/promotions/${id}/publish`);
    const pub = await anon.get(`/api/v1/promotions/${created.body.data.slug}`);
    assert.equal(pub.status, 200);
    assert.deepEqual(pub.body.data.properties.map((x) => x.id), [p.id]);

    await t.db.query('UPDATE promotions SET end_at = ? WHERE id = ?', [new Date(Date.now() - 1000), id]);
    assert.equal((await anon.get(`/api/v1/promotions/${created.body.data.slug}`)).status, 404);
    assert.ok(!(await anon.get('/api/v1/promotions')).body.data.some((x) => x.id === id));
    const { syncCampaignStatuses } = await import('../server/services/campaignScheduler.js');
    await syncCampaignStatuses();
    const detail = await admin.get(`/api/v1/admin/promotions/${id}`);
    assert.equal(detail.body.data.status, 'expired');
    assert.equal((await admin.post(`/api/v1/admin/promotions/${id}/publish`)).status, 422, 'an expired schedule cannot be republished');
  });

  it('computes dashboard metrics from the database', async () => {
    const res = await admin.get('/api/v1/admin/dashboard');
    const [row] = await t.db.query("SELECT COUNT(*) AS total, SUM(publication_status='published') AS pub FROM properties");
    assert.equal(res.body.data.properties.total, Number(row.total));
    assert.equal(res.body.data.properties.published, Number(row.pub));
    assert.ok(res.body.data.campaigns.activeAdvertisements >= 1);
  });
});

describe('Home hero', () => {
  it('falls back to the home_hero content when there are no slides', async () => {
    const res = await anon.get('/api/v1/hero');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.slides.length, 1);
    assert.equal(res.body.data.animation, 'fade');
  });

  it('lets content managers manage slides; others cannot', async () => {
    const viewer = await t.login('viewer');
    assert.equal((await viewer.post('/api/v1/admin/hero/slides', { title: 'Nope' })).status, 403);
    const marketing = await t.login('marketing_manager');
    assert.equal((await marketing.put('/api/v1/admin/hero/settings', { animation: 'flip' })).status, 403);

    const content = await t.login('content_manager');
    const form = new FormData();
    form.append('image', new Blob([PNG_1X1], { type: 'image/png' }), 'hero.png');
    const up = await content.request('POST', '/api/v1/admin/uploads?folder=hero', { form });
    assert.equal(up.status, 201);
    // Content managers may not upload into advertisement folders.
    const adForm = new FormData();
    adForm.append('image', new Blob([PNG_1X1], { type: 'image/png' }), 'ad.png');
    assert.equal((await content.request('POST', '/api/v1/admin/uploads?folder=advertisements', { form: adForm })).status, 403);

    const a = await content.post('/api/v1/admin/hero/slides', { title: 'First slide', subtitle: 'Hello', backgroundImage: up.body.data.path, buttonLabel: 'Browse', buttonUrl: '/properties' });
    assert.equal(a.status, 201);
    const b = await content.post('/api/v1/admin/hero/slides', { title: 'Hidden slide', isActive: false });
    const c = await content.post('/api/v1/admin/hero/slides', { title: 'Third slide', textAlign: 'center' });
    assert.equal((await content.post('/api/v1/admin/hero/slides', { title: 'Bad link', buttonLabel: 'Go', buttonUrl: 'javascript:alert(1)' })).status, 422);
    assert.equal((await content.post('/api/v1/admin/hero/slides', { title: 'No link', buttonLabel: 'Go' })).status, 422);

    const order = await content.put('/api/v1/admin/hero/slides/order', { slideIds: [c.body.data.id, a.body.data.id, b.body.data.id] });
    assert.deepEqual(order.body.data.map((s) => s.id), [c.body.data.id, a.body.data.id, b.body.data.id]);

    const settings = await content.put('/api/v1/admin/hero/settings', { animation: 'flip', intervalSeconds: 8 });
    assert.deepEqual(settings.body.data, { animation: 'flip', intervalSeconds: 8 });
    assert.equal((await content.put('/api/v1/admin/hero/settings', { animation: 'spin' })).status, 422);
    assert.equal((await content.put('/api/v1/admin/hero/settings', { intervalSeconds: 1 })).status, 422);

    const pub = (await anon.get('/api/v1/hero')).body.data;
    assert.equal(pub.animation, 'flip');
    assert.equal(pub.intervalSeconds, 8);
    assert.deepEqual(pub.slides.map((s) => s.title), ['Third slide', 'First slide'], 'hidden slides are excluded, order respected');
    assert.match(pub.slides[1].backgroundImage, /^\/uploads\/hero\//);

    assert.equal((await content.del(`/api/v1/admin/hero/slides/${b.body.data.id}`)).status, 204);
    const logs = await t.db.query("SELECT action FROM audit_logs WHERE action LIKE 'hero.%'");
    assert.ok(logs.length >= 5);
  });
});

describe('Production frontend serving', () => {
  const built = fs.existsSync(path.resolve('dist', 'index.html'));

  it('serves the SPA with SEO tags and supports React Router refreshes', { skip: !built && 'run "npm run build" first' }, async () => {
    const p = await publishedProperty({ title: 'SEO Test Villa' });
    const page = await anon.get(`/property/${p.slug}`, { headers: { Accept: 'text/html' } });
    assert.equal(page.status, 200);
    assert.match(page.body, /<title>SEO Test Villa/);
    assert.match(page.body, /application\/ld\+json/);
    assert.match(page.body, /<div id="root">/);
    const deep = await anon.get('/admin/properties', { headers: { Accept: 'text/html' } });
    assert.equal(deep.status, 200);
    assert.match(deep.body, /noindex/);
  });

  it('never exposes environment files', async () => {
    assert.equal((await anon.get('/.env')).status, 404);
    assert.equal((await anon.get('/api/v1/nope')).status, 404);
  });

  it('serves sitemap.xml and robots.txt', async () => {
    const sitemap = await anon.get('/sitemap.xml');
    assert.match(sitemap.body, /<urlset/);
    assert.match((await anon.get('/robots.txt')).body, /Disallow: \/admin/);
  });
});
