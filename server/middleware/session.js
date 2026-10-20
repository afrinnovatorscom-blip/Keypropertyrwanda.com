import session from 'express-session';
import config from '../config/environment.js';
import { Session } from '../models/Session.js';
import { logger } from '../utils/logger.js';

/** express-session store backed by the `sessions` MySQL table. */
export class MySqlSessionStore extends session.Store {
  constructor({ ttlMs, cleanupIntervalMs = 15 * 60 * 1000 } = {}) {
    super();
    this.ttlMs = ttlMs;
    if (cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => {
        Session.deleteExpired().catch((error) => logger.warn('Session cleanup failed', error.message));
      }, cleanupIntervalMs);
      this.cleanupTimer.unref();
    }
  }

  expiry(sess) {
    const expires = sess?.cookie?.expires ? new Date(sess.cookie.expires) : null;
    return expires && !Number.isNaN(expires.getTime()) ? expires : new Date(Date.now() + this.ttlMs);
  }

  get(sid, callback) {
    Session.get(sid)
      .then((data) => callback(null, data ? JSON.parse(data) : null))
      .catch((error) => callback(error));
  }

  set(sid, sess, callback = () => {}) {
    Session.upsert(sid, JSON.stringify(sess), this.expiry(sess), sess.userId ?? null)
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  touch(sid, sess, callback = () => {}) {
    Session.touch(sid, this.expiry(sess))
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  destroy(sid, callback = () => {}) {
    Session.destroy(sid)
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  close() {
    clearInterval(this.cleanupTimer);
  }
}

export function createSessionMiddleware() {
  const store = new MySqlSessionStore({
    ttlMs: config.sessionMaxAgeMs,
    cleanupIntervalMs: config.isTest ? 0 : undefined,
  });
  const middleware = session({
    name: config.SESSION_COOKIE_NAME,
    secret: config.SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    unset: 'destroy',
    proxy: config.TRUST_PROXY > 0,
    cookie: {
      httpOnly: true,
      secure: config.COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: config.sessionMaxAgeMs,
      path: '/',
    },
  });
  return { middleware, store };
}
