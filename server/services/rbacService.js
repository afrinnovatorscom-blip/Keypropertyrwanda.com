import { transaction } from '../config/database.js';
import { PERMISSIONS, SUPER_ADMIN_ROLE, SYSTEM_ROLES } from '../config/permissions.js';
import { Permission } from '../models/Permission.js';
import { Role } from '../models/Role.js';

/**
 * Synchronise the permission catalog and system roles.
 * - New permissions are inserted.
 * - Missing system roles are created with their default permissions.
 * - Super Admin always receives every permission.
 * Existing role customisations are preserved.
 */
export async function syncPermissionsAndRoles() {
  return transaction(async (conn) => {
    await Permission.upsertMany(PERMISSIONS, conn);
    const all = await Permission.findAll(conn);
    const idBySlug = new Map(all.map((p) => [p.slug, p.id]));
    const created = [];

    for (const def of SYSTEM_ROLES) {
      let role = await Role.findBySlug(def.slug, conn);
      if (!role) {
        const id = await Role.create({ ...def, isSystem: true }, conn);
        role = { id };
        await Role.setPermissions(id, def.permissions.map((s) => idBySlug.get(s)).filter(Boolean), conn);
        created.push(def.slug);
      }
      if (def.slug === SUPER_ADMIN_ROLE) {
        await Role.addPermissions(role.id, all.map((p) => p.id), conn);
      }
    }
    return { permissions: all.length, rolesCreated: created };
  });
}
