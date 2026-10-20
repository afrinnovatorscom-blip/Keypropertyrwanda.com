import { executor } from '../config/database.js';

/** Persistence for server-side sessions (backs the express-session store). */
export const Session = {
  async get(sessionId, conn) {
    const [rows] = await executor(conn).query(
      'SELECT data FROM sessions WHERE session_id = ? AND expires_at > NOW()',
      [sessionId],
    );
    return rows[0] ? rows[0].data : null;
  },

  async upsert(sessionId, data, expiresAt, userId, conn) {
    await executor(conn).query(
      `INSERT INTO sessions (session_id, user_id, data, expires_at) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), data = VALUES(data), expires_at = VALUES(expires_at)`,
      [sessionId, userId ?? null, data, expiresAt],
    );
  },

  async touch(sessionId, expiresAt, conn) {
    await executor(conn).query('UPDATE sessions SET expires_at = ? WHERE session_id = ?', [expiresAt, sessionId]);
  },

  async destroy(sessionId, conn) {
    await executor(conn).query('DELETE FROM sessions WHERE session_id = ?', [sessionId]);
  },

  /** Revoke every session of a user (optionally keeping the current one). */
  async destroyForUser(userId, exceptSessionId = '', conn) {
    await executor(conn).query('DELETE FROM sessions WHERE user_id = ? AND session_id <> ?', [
      userId,
      exceptSessionId,
    ]);
  },

  async deleteExpired(conn) {
    const [result] = await executor(conn).query('DELETE FROM sessions WHERE expires_at <= NOW()');
    return result.affectedRows;
  },
};

export default Session;
