import { SUPER_ADMIN_ROLE } from '../config/permissions.js';
import { Role } from '../models/Role.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

/**
 * Resolve the signed-in user from the server-side session on every request,
 * so suspensions, role changes and permission changes take effect immediately.
 */
export async function loadUser(req, _res, next) {
  req.user = null;
  const userId = req.session?.userId;
  if (!userId) return next();

  const user = await User.findById(userId);
  if (!user || user.status !== 'active') {
    delete req.session.userId;
    return next();
  }
  const permissions = await Role.getPermissionSlugs(user.role.id);
  req.user = { ...user, permissions: new Set(permissions), isSuperAdmin: user.role.slug === SUPER_ADMIN_ROLE };
  return next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(AppError.unauthorized());
  return next();
}

export function can(user, permission) {
  return Boolean(user && (user.isSuperAdmin || user.permissions.has(permission)));
}

/** Require every listed permission. */
export function requirePermission(...permissions) {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    const missing = permissions.filter((p) => !can(req.user, p));
    if (missing.length) return next(AppError.forbidden());
    return next();
  };
}

/** Require at least one of the listed permissions. */
export function requireAnyPermission(...permissions) {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!permissions.some((p) => can(req.user, p))) return next(AppError.forbidden());
    return next();
  };
}

/** Actor object passed to services (who is acting, from where, with which permissions). */
export function actorFrom(req) {
  return {
    id: req.user?.id ?? null,
    user: req.user ?? null,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? null,
    can: (permission) => can(req.user, permission),
  };
}
