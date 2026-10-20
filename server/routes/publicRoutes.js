import { Router } from 'express';
import * as pub from '../controllers/publicController.js';
import { eventLimiter, inquiryLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import { inquirySubmitSchema } from '../validators/adminValidators.js';
import { adEventSchema, campaignEventSchema } from '../validators/campaignValidators.js';
import { idParam } from '../validators/common.js';
import { publicSearchQuery, slugParam } from '../validators/propertyValidators.js';

/** Public, unauthenticated website API. Only published / live data is ever returned. */
const router = Router();

router.get('/site', pub.siteConfig);
router.get('/hero', pub.hero);
router.get('/content/:key', pub.content);
router.get('/categories', pub.categories);
router.get('/locations', pub.locations);

router.get('/properties', validate({ query: publicSearchQuery }), pub.searchProperties);
router.get('/properties/:slug', validate({ params: slugParam }), pub.propertyDetails);

router.get('/featured', pub.featured);
router.get('/hot-deals', pub.hotDeals);
router.get('/hot-deals/:id', validate({ params: idParam }), pub.hotDeal);
router.get('/promotions', pub.promotions);
router.get('/promotions/:slug', pub.promotion);
router.get('/advertisements', pub.advertisements);

router.post('/events/ad', eventLimiter, validate({ body: adEventSchema }), pub.adEvent);
router.post('/events/campaign', eventLimiter, validate({ body: campaignEventSchema }), pub.campaignEvent);

router.post('/inquiries', inquiryLimiter, validate({ body: inquirySubmitSchema }), pub.submitInquiry);

export default router;
