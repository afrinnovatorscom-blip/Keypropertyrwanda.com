import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import './helpers/testApp.js'; // sets NODE_ENV=test before server modules load

const { calculateDeal, publicDeal } = await import('../server/services/hotDealService.js');
const { resolveLaunchStatus, effectiveStatus } = await import('../server/services/campaignSchedule.js');
const { isSafeUrl, isSafeExternalUrl } = await import('../server/utils/url.js');
const { buildWhatsAppLink, propertyWhatsAppMessage } = await import('../server/utils/whatsapp.js');
const { toCsv } = await import('../server/utils/csv.js');
const { detectImageType } = await import('../server/services/uploadService.js');
const { slugify } = await import('../server/utils/slugify.js');
const { isBot, ctr } = await import('../server/services/analyticsService.js');
const { PNG_1X1 } = await import('./helpers/testApp.js');

const DAY = 86_400_000;

describe('Hot deal discount calculation', () => {
  it('applies percentage discounts', () => {
    assert.deepEqual(calculateDeal({ basePrice: 450000, discountType: 'percentage', discountValue: 20 }), {
      basePrice: 450000, promotionalPrice: 360000, discountAmount: 90000, discountPercentage: 20,
    });
  });
  it('applies amount discounts and derives the percentage', () => {
    const r = calculateDeal({ basePrice: 50_000_000, discountType: 'amount', discountValue: 5_000_000 });
    assert.equal(r.promotionalPrice, 45_000_000);
    assert.equal(r.discountPercentage, 10);
  });
  it('accepts a fixed promotional price below the base', () => {
    const r = calculateDeal({ basePrice: 950000, discountType: 'fixed_price', discountValue: 850000 });
    assert.equal(r.discountAmount, 100000);
    assert.equal(r.discountPercentage, 10.53);
  });
  it('rejects invalid or negative discounts', () => {
    for (const input of [
      { basePrice: 100, discountType: 'percentage', discountValue: 100 },
      { basePrice: 100, discountType: 'percentage', discountValue: -5 },
      { basePrice: 100, discountType: 'percentage', discountValue: 0 },
      { basePrice: 100, discountType: 'amount', discountValue: 100 },
      { basePrice: 100, discountType: 'amount', discountValue: 150 },
      { basePrice: 100, discountType: 'fixed_price', discountValue: 120 },
      { basePrice: 0, discountType: 'amount', discountValue: 1 },
      { basePrice: -10, discountType: 'amount', discountValue: 1 },
    ]) {
      assert.throws(() => calculateDeal(input), { code: 'VALIDATION_ERROR' }, JSON.stringify(input));
    }
  });
  it('hides the original price and discount unless verified', () => {
    const deal = {
      id: 1, title: 'D', originalPrice: 100, originalPriceVerified: false, promotionalPrice: 80, discountAmount: 20, discountPercentage: 20, currency: 'RWF',
      property: { id: 1, reference: 'KPR-1', title: 'P', slug: 'p' },
    };
    assert.equal(publicDeal(deal).originalPrice, null);
    assert.equal(publicDeal(deal).discountPercentage, null);
    assert.equal(publicDeal({ ...deal, originalPriceVerified: true }).originalPrice, 100);
  });
});

describe('Campaign scheduling', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  it('schedules future campaigns and activates current ones', () => {
    assert.equal(resolveLaunchStatus({ startAt: new Date(now.getTime() + DAY), endAt: null }, now), 'scheduled');
    assert.equal(resolveLaunchStatus({ startAt: new Date(now.getTime() - DAY), endAt: new Date(now.getTime() + DAY) }, now), 'active');
  });
  it('refuses to publish an expired campaign', () => {
    assert.throws(() => resolveLaunchStatus({ startAt: new Date(now.getTime() - 2 * DAY), endAt: new Date(now.getTime() - DAY) }, now));
  });
  it('reports expired campaigns as expired even before the scheduler runs', () => {
    assert.equal(effectiveStatus({ status: 'active', startAt: new Date(now.getTime() - 2 * DAY), endAt: new Date(now.getTime() - 1) }, now), 'expired');
    assert.equal(effectiveStatus({ status: 'scheduled', startAt: new Date(now.getTime() - 1), endAt: null }, now), 'active');
  });
});

describe('URL safety', () => {
  it('accepts http(s) and site paths', () => {
    assert.ok(isSafeUrl('https://example.com/x?y=1'));
    assert.ok(isSafeUrl('/properties/for-rent'));
  });
  it('rejects unsafe schemes and tricks', () => {
    for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,hi', 'vbscript:x', '//evil.com', '/\\evil.com', 'http://', 'ftp://x.com', ' javascript:alert(1)']) {
      assert.equal(isSafeUrl(url), false, url);
    }
    assert.equal(isSafeExternalUrl('/relative'), false);
  });
});

describe('WhatsApp links', () => {
  it('encodes the property message', () => {
    const msg = propertyWhatsAppMessage({ title: 'Villa & Pool "A"', reference: 'KPR-00007', slug: 'villa' }, 'https://keypropertyrwanda.com');
    const link = buildWhatsAppLink('+250 788 000 000', msg);
    assert.ok(link.startsWith('https://wa.me/250788000000?text='));
    assert.equal(decodeURIComponent(link.split('?text=')[1]), msg);
    assert.ok(!link.includes(' ') && !link.includes('&P') && link.includes('%26'));
    assert.ok(msg.includes('KPR-00007') && msg.includes('/property/villa'));
  });
  it('returns null without a number', () => assert.equal(buildWhatsAppLink('', 'x'), null));
});

describe('Utilities', () => {
  it('neutralises CSV formula injection', () => {
    const csv = toCsv([{ a: '=HYPERLINK("x")', b: 'ok, "quoted"' }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]);
    assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
    assert.ok(csv.includes('"ok, ""quoted"""'));
  });
  it('detects images by signature, not extension', () => {
    assert.equal(detectImageType(PNG_1X1).mime, 'image/png');
    assert.equal(detectImageType(Buffer.from('<?php echo 1; ?>        ')), null);
  });
  it('slugifies text', () => assert.equal(slugify('  Villa à Nyarutarama & Pool! '), 'villa-a-nyarutarama-and-pool'));
  it('filters bots and computes CTR', () => {
    assert.ok(isBot('Googlebot/2.1'));
    assert.ok(isBot(''));
    assert.equal(isBot('Mozilla/5.0 Chrome/140'), false);
    assert.equal(ctr(3, 200), 1.5);
    assert.equal(ctr(1, 0), 0);
  });
});
