import crypto from 'node:crypto';
import config from '../config/environment.js';

/**
 * Anonymous visitor fingerprint used for analytics de-duplication.
 * The salt rotates daily, so hashes cannot be linked across days and no raw
 * IP address or user agent is stored.
 */
export function visitorHash(ip, userAgent, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  return crypto
    .createHmac('sha256', config.SESSION_SECRET)
    .update(`${day}|${ip ?? ''}|${userAgent ?? ''}`)
    .digest('hex');
}

/** Stable keyed hash of an IP address (used for inquiry spam throttling). */
export function ipHash(ip) {
  return crypto.createHmac('sha256', config.SESSION_SECRET).update(`ip|${ip ?? ''}`).digest('hex');
}

export function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
