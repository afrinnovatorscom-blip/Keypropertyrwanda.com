const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Accepts absolute http(s) URLs or site-relative paths ("/properties/...").
 * Rejects javascript:, data:, vbscript:, protocol-relative ("//evil.com") and
 * anything containing control characters or whitespace tricks.
 */
export function isSafeUrl(value) {
  if (typeof value !== 'string') return false;
  const url = value.trim();
  if (!url || url.length > 500) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s\\]/.test(url)) return false;
  if (url.startsWith('/')) return !url.startsWith('//');
  try {
    const parsed = new URL(url);
    return SAFE_PROTOCOLS.has(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/** True for http(s) URLs only (no relative paths) — used for video / virtual tour links. */
export function isSafeExternalUrl(value) {
  return isSafeUrl(value) && !String(value).trim().startsWith('/');
}
