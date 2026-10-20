import { transaction } from '../config/database.js';
import { SUPER_ADMIN_ROLE } from '../config/permissions.js';
import { Permission } from '../models/Permission.js';
import { Role } from '../models/Role.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta, paginate } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';
import { audit, diff } from './auditService.js';
import { hashPassword } from './authService.js';

// ------------------------------------------------------------------- Users

export async function listUsers(filters) {
  const page = paginate(filters);
  const { rows, total } = await User.list({ ...filters, ...page });
  return { rows, meta: pageMeta(page, total) };
}

async function requireUser(id, conn) {
  const user = await User.findById(id, conn);
  if (!user) throw AppError.notFound('User not found');
  return user;
}

async function requireRole(roleId, actor, conn) {
  const role = await Role.findById(roleId, conn);
  if (!role) throw AppError.validation([{ path: 'roleId', message: 'Role does not exist' }]);
  // Only a Super Admin can grant the Super Admin role.
  if (role.slug === SUPER_ADMIN_ROLE && !actor.user?.isSuperAdmin) {
    throw AppError.forbidden('Only a Super Admin can assign the Super Admin role.');
  }
  return role;
}

export async function createUser(input, actor) {
  const id = await transaction(async (conn) => {
    await requireRole(input.roleId, actor, conn);
    if (await User.emailExists(input.email, 0, conn)) throw AppError.validation([{ path: 'email', message: 'This email is already registered' }]);
    const newId = await User.create({ ...input, passwordHash: await hashPassword(input.password) }, conn);
    await audit(actor, 'user.created', 'user', newId, { email: input.email, roleId: input.roleId }, conn);
    return newId;
  });
  return requireUser(id);
}

export async function updateUser(id, input, actor) {
  await transaction(async (conn) => {
    const existing = await requireUser(id, conn);
    if (existing.role.slug === SUPER_ADMIN_ROLE && !actor.user?.isSuperAdmin) {
      throw AppError.forbidden('Only a Super Admin can modify a Super Admin account.');
    }
    if (input.roleId !== undefined && input.roleId !== existing.role.id) await requireRole(input.roleId, actor, conn);
    if (input.email && (await User.emailExists(input.email, id, conn))) {
      throw AppError.validation([{ path: 'email', message: 'This email is already registered' }]);
    }
    if (id === actor.id && (input.status === 'suspended' || (input.roleId !== undefined && input.roleId !== existing.role.id))) {
      throw AppError.conflict('You cannot suspend yourself or change your own role.');
    }
    // Never leave the platform without an active Super Admin.
    const losesSuperAdmin =
      existing.role.slug === SUPER_ADMIN_ROLE &&
      existing.status === 'active' &&
      (input.status === 'suspended' || (input.roleId !== undefined && input.roleId !== existing.role.id));
    if (losesSuperAdmin && (await User.countActiveWithRole(SUPER_ADMIN_ROLE, conn)) <= 1) {
      throw AppError.conflict('At least one active Super Admin is required.');
    }

    await User.update(id, input, conn);
    if (input.password) await User.updatePassword(id, await hashPassword(input.password), conn);
    if (input.password || input.status === 'suspended') await Session.destroyForUser(id, '', conn);

    const changes = diff({ ...existing, roleId: existing.role.id }, input, ['fullName', 'email', 'phone', 'roleId', 'status']);
    if (input.password) changes.password = 'reset';
    await audit(actor, 'user.updated', 'user', id, changes, conn);
  });
  return requireUser(id);
}

// ------------------------------------------------------------------- Roles

export async function listRoles() {
  const [roles, permissions] = await Promise.all([Role.findAll(), Permission.findAll()]);
  return { roles, permissions };
}

async function permissionIds(slugs, conn) {
  const unique = [...new Set(slugs)];
  const found = await Permission.findBySlugs(unique, conn);
  if (found.length !== unique.length) {
    const known = new Set(found.map((p) => p.slug));
    throw AppError.validation([{ path: 'permissions', message: `Unknown permission(s): ${unique.filter((s) => !known.has(s)).join(', ')}` }]);
  }
  return found.map((p) => p.id);
}

export async function createRole(input, actor) {
  const id = await transaction(async (conn) => {
    const slug = slugify(input.name, 80).replace(/-/g, '_');
    if (await Role.nameOrSlugExists(input.name, slug, 0, conn)) throw AppError.validation([{ path: 'name', message: 'A role with this name already exists' }]);
    const newId = await Role.create({ name: input.name, slug, description: input.description }, conn);
    await Role.setPermissions(newId, await permissionIds(input.permissions, conn), conn);
    await audit(actor, 'role.created', 'role', newId, { name: input.name, permissions: input.permissions }, conn);
    return newId;
  });
  return Role.findById(id);
}

export async function updateRole(id, input, actor) {
  await transaction(async (conn) => {
    const role = await Role.findById(id, conn);
    if (!role) throw AppError.notFound('Role not found');
    if (role.slug === SUPER_ADMIN_ROLE) throw AppError.conflict('The Super Admin role always has every permission and cannot be edited.');
    if (input.name && input.name !== role.name && (await Role.nameOrSlugExists(input.name, '', id, conn))) {
      throw AppError.validation([{ path: 'name', message: 'A role with this name already exists' }]);
    }
    await Role.update(id, { name: input.name, description: input.description === undefined ? role.description : input.description }, conn);
    if (input.permissions) await Role.setPermissions(id, await permissionIds(input.permissions, conn), conn);
    await audit(actor, 'role.updated', 'role', id, {
      name: input.name,
      added: input.permissions?.filter((p) => !role.permissions.includes(p)),
      removed: input.permissions ? role.permissions.filter((p) => !input.permissions.includes(p)) : undefined,
    }, conn);
  });
  return Role.findById(id);
}

export async function deleteRole(id, actor) {
  const role = await Role.findById(id);
  if (!role) throw AppError.notFound('Role not found');
  if (role.isSystem) throw AppError.conflict('System roles cannot be deleted.');
  if (role.userCount > 0) throw AppError.conflict('Reassign the users of this role before deleting it.');
  await Role.delete(id);
  await audit(actor, 'role.deleted', 'role', id, { name: role.name });
}
