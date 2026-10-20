import config from '../config/environment.js';
import { closePool } from '../config/database.js';
import { runMigrations } from '../services/migrationService.js';
import { syncPermissionsAndRoles } from '../services/rbacService.js';
import { syncReferenceData } from '../services/referenceDataService.js';

async function main() {
  console.log(`Migrating database "${config.DB_NAME}" on ${config.DB_HOST}:${config.DB_PORT}`);
  const { executed, total } = await runMigrations({ log: (m) => console.log(`  ${m}`) });
  console.log(executed.length ? `Applied ${executed.length} migration(s).` : `Database is up to date (${total} migration(s)).`);

  const rbac = await syncPermissionsAndRoles();
  console.log(`Permissions synchronised (${rbac.permissions}). New roles: ${rbac.rolesCreated.join(', ') || 'none'}.`);

  await syncReferenceData();
  console.log('Reference data (placements, categories, settings, content) ensured.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
