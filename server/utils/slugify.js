/** Convert text into a lowercase, URL-safe slug. */
export function slugify(text, maxLength = 200) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/**
 * Return a slug that does not collide, using `exists(slug)` to probe.
 * Appends -2, -3, ... when needed.
 */
export async function uniqueSlug(text, exists, maxLength = 200) {
  const base = slugify(text, maxLength - 6) || 'item';
  let candidate = base;
  for (let i = 2; await exists(candidate); i += 1) {
    candidate = `${base}-${i}`;
  }
  return candidate;
}
