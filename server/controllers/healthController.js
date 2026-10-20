import config from '../config/environment.js';
import { pingDatabase } from '../config/database.js';

/** Application + database availability. Exposes no configuration or secrets. */
export async function health(_req, res) {
  const started = process.uptime();
  try {
    const db = await pingDatabase();
    res.status(200).json({
      status: 'ok',
      app: config.APP_NAME,
      uptimeSeconds: Math.round(started),
      database: { status: 'up', latencyMs: db.latencyMs },
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      app: config.APP_NAME,
      uptimeSeconds: Math.round(started),
      database: { status: 'down' },
      timestamp: new Date().toISOString(),
    });
  }
}
