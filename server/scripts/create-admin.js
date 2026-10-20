// Create (or reset the password of) a Super Admin account.
// Usage: npm run admin:create -- --email=you@example.com --name="Your Name" --password="StrongPassw0rd"
import { closePool } from '../config/database.js';
import { SUPER_ADMIN_ROLE } from '../config/permissions.js';
import { Role } from '../models/Role.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { hashPassword } from '../services/authService.js';
import { passwordRule } from '../validators/adminValidators.js';
import { email as emailRule } from '../validators/common.js';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

async function main() {
  const email = emailRule.parse(arg('email') ?? '');
  const password = passwordRule.parse(arg('password') ?? '');
  const fullName = arg('name') ?? 'Administrator';
  const role = await Role.findBySlug(SUPER_ADMIN_ROLE);
  if (!role) throw new Error('Run "npm run db:migrate" first.');

  const existing = await User.findAuthByEmail(email);
  if (existing) {
    await User.updatePassword(existing.id, await hashPassword(password));
    await User.update(existing.id, { roleId: role.id, status: 'active' });
    await Session.destroyForUser(existing.id);
    console.log(`Updated ${email}: password reset, Super Admin role, active.`);
  } else {
    await User.create({ roleId: role.id, fullName, email, passwordHash: await hashPassword(password) });
    console.log(`Created Super Admin ${email}.`);
  }
}

main()
  .catch((error) => {
    console.error(error.issues ? error.issues.map((i) => i.message).join('; ') : error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
