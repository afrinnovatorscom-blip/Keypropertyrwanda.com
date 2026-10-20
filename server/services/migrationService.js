import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT_DIR } from '../config/environment.js';
import { ensureDatabaseExists, getPool } from '../config/database.js';

const MIGRATIONS_DIR = path.join(ROOT_DIR, 'server', 'migrations');

async function ensureMigrationsTable(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(150) NOT NULL,
    description VARCHAR(255) NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (version)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

/** Migration files are `NNN_description.js` modules exporting `up` (array of SQL statements). */
export async function listMigrationFiles() {
  const files = await fs.readdir(MIGRATIONS_DIR);
  return files.filter((f) => /^\d{3,}_[\w-]+\.js$/.test(f)).sort();
}

/**
 * Apply pending migrations in order. Each migration's version is recorded in
 * schema_migrations after all of its statements succeed.
 * (MySQL DDL auto-commits, so migrations should be written to be re-runnable
 * or small enough to fix forward.)
 */
export async function runMigrations({ log = () => {} } = {}) {
  await ensureDatabaseExists();
  const db = getPool();
  await ensureMigrationsTable(db);

  const [appliedRows] = await db.query('SELECT version FROM schema_migrations');
  const applied = new Set(appliedRows.map((r) => r.version));
  const files = await listMigrationFiles();
  const executed = [];

  for (const file of files) {
    const version = file.replace(/\.js$/, '');
    if (applied.has(version)) continue;
    const mod = await import(pathToFileURL(path.join(MIGRATIONS_DIR, file)).href);
    const statements = typeof mod.up === 'function' ? await mod.up() : mod.up;
    if (!Array.isArray(statements)) throw new Error(`Migration ${file} must export an "up" array of SQL statements`);
    log(`Applying ${version} ...`);
    for (const sql of statements) {
      await db.query(sql);
    }
    await db.query('INSERT INTO schema_migrations (version, description) VALUES (?, ?)', [
      version,
      mod.description ?? null,
    ]);
    executed.push(version);
  }
  return { executed, total: files.length };
}
