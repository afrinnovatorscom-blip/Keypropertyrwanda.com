import fs from 'node:fs';
import config from './config/environment.js';
import { closePool, pingDatabase } from './config/database.js';
import { createApp } from './app.js';
import { startCampaignScheduler } from './services/campaignScheduler.js';
import { logger } from './utils/logger.js';

async function start() {
  fs.mkdirSync(config.uploadRoot, { recursive: true });

  try {
    await pingDatabase();
    logger.info(`Connected to MySQL database "${config.DB_NAME}" on ${config.DB_HOST}:${config.DB_PORT}`);
  } catch (error) {
    logger.error(`Cannot connect to MySQL (${error.code ?? error.message}). Check DB_* settings in the root .env and run "npm run db:migrate".`);
    process.exit(1);
  }

  const app = createApp();
  const stopScheduler = startCampaignScheduler();
  // Hosting platforms inject PORT; fall back to the .env value.
  const server = app.listen(config.PORT, () => {
    logger.info(`${config.APP_NAME} server listening on http://localhost:${config.PORT} (${config.NODE_ENV})`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    stopScheduler();
    app.locals.sessionStore?.close();
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
