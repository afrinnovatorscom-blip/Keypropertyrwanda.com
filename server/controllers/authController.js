import { actorFrom } from '../middleware/auth.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import * as authService from '../services/authService.js';
import { audit } from '../services/auditService.js';
import config from '../config/environment.js';
import { ok } from '../utils/response.js';

const regenerate = (req) => new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
const save = (req) => new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
const destroy = (req) => new Promise((resolve) => req.session.destroy(() => resolve()));

export async function csrf(req, res) {
  const csrfToken = issueCsrfToken(req);
  await save(req);
  ok(res, { csrfToken });
}

export async function login(req, res) {
  const { email, password } = req.valid.body;
  const user = await authService.authenticate(email, password, { ip: req.ip, userAgent: req.get('user-agent') });
  // New session id on privilege change (prevents session fixation).
  await regenerate(req);
  req.session.userId = user.id;
  req.session.loginAt = Date.now();
  const csrfToken = issueCsrfToken(req);
  await save(req);
  ok(res, { user: await authService.profile(user.id), csrfToken });
}

export async function logout(req, res) {
  if (req.user) await audit(actorFrom(req), 'auth.logout', 'user', req.user.id);
  await destroy(req);
  res.clearCookie(config.SESSION_COOKIE_NAME, { path: '/' });
  ok(res, { loggedOut: true });
}

export async function me(req, res) {
  ok(res, { user: await authService.profile(req.user.id), csrfToken: issueCsrfToken(req) });
}

export async function changePassword(req, res) {
  await authService.changePassword(actorFrom(req), req.valid.body, req.sessionID);
  ok(res, { changed: true });
}
