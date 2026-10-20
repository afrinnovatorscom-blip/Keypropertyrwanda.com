import crypto from 'node:crypto';
import { AppError } from '../utils/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-csrf-token';

/** Return the session's CSRF token, creating one if needed (persists the session). */
export function issueCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

/**
 * Synchronizer-token CSRF protection for session-authenticated routes.
 * Unsafe requests must echo the session token in the X-CSRF-Token header.
 */
export function verifyCsrf(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const expected = req.session?.csrfToken;
  const provided = req.get(CSRF_HEADER);
  if (
    !expected ||
    typeof provided !== 'string' ||
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    return next(new AppError(403, 'Invalid or missing CSRF token. Refresh the page and try again.', 'CSRF_INVALID'));
  }
  return next();
}
