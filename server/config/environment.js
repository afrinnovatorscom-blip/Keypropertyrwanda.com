import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path of the repository root (where the single package.json and .env live). */
export const ROOT_DIR = path.resolve(here, '..', '..');

// Always load the single root .env, regardless of the current working directory.
// Variables that are already set in the process environment take precedence
// (useful for hosting platforms and for the test runner).
dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

const bool = (fallback) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_NAME: z.string().default('KeyPropertyRwanda'),
  APP_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:4000'),

  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().min(1).default('key_property_rwanda'),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),

  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  SESSION_COOKIE_NAME: z.string().default('keyproperty_session'),
  SESSION_MAX_AGE_HOURS: z.coerce.number().positive().default(8),
  COOKIE_SECURE: bool(false),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(5),

  DEFAULT_TIMEZONE: z.string().default('Africa/Kigali'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration (check the root .env file):\n${details}`);
}

const env = parsed.data;

if (env.NODE_ENV === 'production' && /replace_with/i.test(env.SESSION_SECRET)) {
  throw new Error('SESSION_SECRET still has the example value. Set a long random secret in the root .env.');
}

export const config = {
  ...env,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  uploadRoot: path.isAbsolute(env.UPLOAD_DIR) ? env.UPLOAD_DIR : path.join(ROOT_DIR, env.UPLOAD_DIR),
  distDir: path.join(ROOT_DIR, 'dist'),
  maxUploadBytes: Math.round(env.MAX_UPLOAD_SIZE_MB * 1024 * 1024),
  sessionMaxAgeMs: Math.round(env.SESSION_MAX_AGE_HOURS * 60 * 60 * 1000),
};

export default config;
