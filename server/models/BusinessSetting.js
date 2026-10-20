import { executor } from '../config/database.js';
import { bool } from './helpers.js';

const map = (r) => ({
  key: r.setting_key,
  value: r.setting_value,
  group: r.setting_group,
  label: r.label,
  isPublic: bool(r.is_public),
  updatedAt: r.updated_at,
});

export const BusinessSetting = {
  async findAll(conn) {
    const [rows] = await executor(conn).query('SELECT * FROM business_settings ORDER BY setting_group, id');
    return rows.map(map);
  },

  /** Only settings flagged public — safe to expose to the website. */
  async findPublicMap(conn) {
    const [rows] = await executor(conn).query(
      'SELECT setting_key, setting_value FROM business_settings WHERE is_public = 1',
    );
    return Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  },

  async get(key, fallback = null, conn) {
    const [rows] = await executor(conn).query('SELECT setting_value FROM business_settings WHERE setting_key = ?', [key]);
    return rows[0]?.setting_value ?? fallback;
  },

  async existingKeys(keys, conn) {
    if (!keys.length) return [];
    const [rows] = await executor(conn).query('SELECT setting_key FROM business_settings WHERE setting_key IN (?)', [
      keys,
    ]);
    return rows.map((r) => r.setting_key);
  },

  /** Update values of existing settings. */
  async updateValues(values, userId, conn) {
    const db = executor(conn);
    for (const [key, value] of Object.entries(values)) {
      await db.query('UPDATE business_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?', [
        value,
        userId ?? null,
        key,
      ]);
    }
  },

  /** Insert definitions if missing (seeder) — never overwrites edited values. */
  async insertIfMissing({ key, value, group, label, isPublic }, conn) {
    await executor(conn).query(
      `INSERT INTO business_settings (setting_key, setting_value, setting_group, label, is_public) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE label = VALUES(label), setting_group = VALUES(setting_group), is_public = VALUES(is_public)`,
      [key, value ?? null, group, label, isPublic ? 1 : 0],
    );
  },
};

export default BusinessSetting;
