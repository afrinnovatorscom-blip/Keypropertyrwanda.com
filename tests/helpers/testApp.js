// Test harness: boots the real Express app against a dedicated MySQL test
// database (TEST_DB_NAME), recreated from migrations on every run.
// Server modules are imported dynamically so the environment is set first.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'key_property_rwanda_test';
process.env.UPLOAD_DIR = path.join(root, 'tmp', 'test-uploads');
if (process.env.DB_NAME === 'key_property_rwanda') throw new Error('TEST_DB_NAME must differ from the main database');

export const PASSWORD = 'TestPassw0rd!';

export async function startTestApp() {
  const mysql = (await import('mysql2/promise')).default;
  const config = (await import('../../server/config/environment.js')).default;

  // Fresh database for a deterministic run.
  const admin = await mysql.createConnection({ host: config.DB_HOST, port: config.DB_PORT, user: config.DB_USER, password: config.DB_PASSWORD });
  await admin.query(`DROP DATABASE IF EXISTS \`${config.DB_NAME}\``);
  await admin.end();

  const { runMigrations } = await import('../../server/services/migrationService.js');
  const { syncPermissionsAndRoles } = await import('../../server/services/rbacService.js');
  const { syncReferenceData } = await import('../../server/services/referenceDataService.js');
  await runMigrations();
  await syncPermissionsAndRoles();
  await syncReferenceData();

  const db = await import('../../server/config/database.js');
  const { Role } = await import('../../server/models/Role.js');
  const { User } = await import('../../server/models/User.js');
  const { hashPassword } = await import('../../server/services/authService.js');
  await db.query("UPDATE business_settings SET setting_value = '50' WHERE setting_key = 'inquiry_rate_limit_per_hour'");

  const users = {};
  for (const slug of ['super_admin', 'property_manager', 'marketing_manager', 'inquiry_officer', 'content_manager', 'viewer']) {
    const role = await Role.findBySlug(slug);
    const email = `${slug}@test.local`;
    users[slug] = { id: await User.create({ roleId: role.id, fullName: slug, email, passwordHash: await hashPassword(PASSWORD) }), email };
  }

  const { createApp } = await import('../../server/app.js');
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  return {
    baseUrl,
    db,
    users,
    client: () => new TestClient(baseUrl),
    async login(role) {
      const c = new TestClient(baseUrl);
      const res = await c.login(users[role].email, PASSWORD);
      if (res.status !== 200) throw new Error(`Login failed for ${role}: ${JSON.stringify(res.body)}`);
      return c;
    },
    async close() {
      app.locals.sessionStore?.close();
      await new Promise((resolve) => server.close(resolve));
      await db.closePool();
    },
  };
}

/** Minimal HTTP client with a cookie jar and automatic CSRF header. */
export class TestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
    this.csrf = null;
    this.userAgent = 'Mozilla/5.0 (TestRunner) Chrome/140';
  }

  async request(method, url, { body, form, headers = {}, csrf = true } = {}) {
    const h = { 'User-Agent': this.userAgent, ...headers };
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (csrf && this.csrf && method !== 'GET') h['X-CSRF-Token'] = this.csrf;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) {
      h['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(this.baseUrl + url, { method, headers: h, body: payload, redirect: 'manual' });
    for (const cookie of res.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const [k, ...v] = pair.split('=');
      this.cookies.set(k.trim(), v.join('='));
    }
    const type = res.headers.get('content-type') ?? '';
    const parsed = type.includes('json') ? await res.json() : await res.text();
    return { status: res.status, body: parsed, headers: res.headers };
  }

  get(url, opts) { return this.request('GET', url, opts); }
  post(url, body, opts) { return this.request('POST', url, { ...opts, body }); }
  put(url, body, opts) { return this.request('PUT', url, { ...opts, body }); }
  patch(url, body, opts) { return this.request('PATCH', url, { ...opts, body }); }
  del(url, opts) { return this.request('DELETE', url, opts); }

  async fetchCsrf() {
    const res = await this.get('/api/v1/auth/csrf');
    this.csrf = res.body.data.csrfToken;
    return this.csrf;
  }

  async login(email, password) {
    await this.fetchCsrf();
    const res = await this.post('/api/v1/auth/login', { email, password });
    if (res.status === 200) this.csrf = res.body.data.csrfToken;
    return res;
  }
}

/** A tiny valid PNG (1×1) for upload tests. */
export const PNG_1X1 = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360f8cfc00000000301010018dd8db00000000049454e44ae426082',
  'hex',
);
