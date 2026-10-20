import rateLimit from 'express-rate-limit';
import config from '../config/environment.js';

const handler = (message) => (req, res) => {
  res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message } });
};

const common = { standardHeaders: 'draft-8', legacyHeaders: false, skip: () => config.isTest };

/** General API ceiling per IP. */
export const apiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 300,
  handler: handler('Too many requests. Please slow down.'),
});

/** Brute-force protection for sign-in (per IP, failed attempts only). */
export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  handler: handler('Too many sign-in attempts. Please wait 15 minutes and try again.'),
});

/** Public inquiry submissions. */
export const inquiryLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  handler: handler('Too many inquiries from this connection. Please try again later or call us.'),
});

/** Analytics beacons. */
export const eventLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 120,
  handler: handler('Too many events.'),
});
