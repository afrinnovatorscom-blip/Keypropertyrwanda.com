/** Escape LIKE wildcards in user input. */
export function likeTerm(value) {
  return `%${String(value).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

/** Public URL of a file stored under the upload directory (or a pass-through absolute URL). */
export function uploadUrl(filePath) {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath) || filePath.startsWith('/')) return filePath;
  return `/uploads/${filePath}`;
}

/**
 * Build "col = ?, col2 = ?" from a camelCase → column map, skipping undefined values.
 * Returns { sql, params } or null when nothing changes.
 */
export function buildSet(columnMap, data) {
  const parts = [];
  const params = [];
  for (const [key, column] of Object.entries(columnMap)) {
    if (data[key] !== undefined) {
      parts.push(`${column} = ?`);
      params.push(data[key]);
    }
  }
  return parts.length ? { sql: parts.join(', '), params } : null;
}

export const bool = (v) => v === 1 || v === true || v === '1';

export const num = (v) => (v === null || v === undefined ? null : Number(v));

/** SQL fragment: campaign row is inside its scheduled window right now. */
export const LIVE_WINDOW = (alias) =>
  `${alias}.start_at <= NOW() AND (${alias}.end_at IS NULL OR ${alias}.end_at > NOW())`;

/** SQL fragment: property can be promoted publicly (published + available). */
export const PROMOTABLE_PROPERTY = (alias) =>
  `${alias}.publication_status = 'published' AND ${alias}.availability_status = 'available'`;
