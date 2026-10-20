import bcrypt from 'bcryptjs';
import { Role } from '../models/Role.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { audit } from './auditService.js';

export const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
// Used to keep response timing similar when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', 10);

export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

/** Verify credentials and return the user (without the hash). Handles lockout and auditing. */
export async function authenticate(email, password, context) {
  const user = await User.findAuthByEmail(email);
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    await audit({ ...context, id: null }, 'auth.login_failed', 'user', null, { email, reason: 'unknown_email' });
    throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    throw new AppError(423, 'This account is temporarily locked after repeated failed sign-ins. Try again later.', 'ACCOUNT_LOCKED');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await User.recordLoginFailure(user.id, MAX_FAILED_ATTEMPTS, LOCK_MINUTES);
    await audit({ ...context, id: user.id }, 'auth.login_failed', 'user', user.id, { reason: 'bad_password' });
    throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  if (user.status !== 'active') {
    throw new AppError(403, 'This account is suspended. Contact an administrator.', 'ACCOUNT_SUSPENDED');
  }

  await User.recordLoginSuccess(user.id);
  await audit({ ...context, id: user.id }, 'auth.login', 'user', user.id);
  const { passwordHash: _omit, ...safe } = user;
  return safe;
}

/** Current user profile with permissions, for the admin UI. */
export async function profile(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  const permissions = await Role.getPermissionSlugs(user.role.id);
  return { ...user, permissions };
}

export async function changePassword(actor, { currentPassword, newPassword }, currentSessionId) {
  const hash = await User.findPasswordHash(actor.id);
  if (!hash || !(await bcrypt.compare(currentPassword, hash))) {
    throw AppError.validation([{ path: 'currentPassword', message: 'Current password is incorrect' }]);
  }
  await User.updatePassword(actor.id, await hashPassword(newPassword));
  // Sign out every other session of this user.
  await Session.destroyForUser(actor.id, currentSessionId);
  await audit(actor, 'auth.password_changed', 'user', actor.id);
}
