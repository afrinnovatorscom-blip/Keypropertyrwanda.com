import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import config from './config/environment.js';
import { health } from './controllers/healthController.js';
import { loadUser } from './middleware/auth.js';
import { apiNotFound, errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { createSessionMiddleware } from './middleware/session.js';
import apiV1 from './routes/index.js';
import { buildSitemap, renderIndexHtml, robotsTxt } from './services/seoService.js';

/**
 * Build the Express application: REST API under /api, uploaded media under
 * /uploads, and (when built) the React frontend from dist/ with SPA fallback.
 */
export function createApp() {
  const app = express();
  const { middleware: sessionMiddleware, store: sessionStore } = createSessionMiddleware();

  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'frame-src': ['https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com', 'https://my.matterport.com', 'https://kuula.co'],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'self'"],
          'upgrade-insecure-requests': config.COOKIE_SECURE ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(compression());

  // --------------------------------------------------------------- API
  app.get('/api/health', health);
  app.use('/api', apiLimiter);
  app.use('/api', express.json({ limit: '1mb' }));
  app.use('/api', sessionMiddleware);
  app.use('/api', loadUser);
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/v1', apiV1);
  app.use('/api', apiNotFound);

  // ----------------------------------------------------- Uploaded media
  // Only public folders are served; anything under uploads/private is never exposed.
  app.use('/uploads/private', (_req, res) => res.status(404).end());
  app.use(
    '/uploads',
    express.static(config.uploadRoot, {
      dotfiles: 'deny',
      index: false,
      maxAge: config.isProduction ? '30d' : 0,
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );
  app.use('/uploads', (_req, res) => res.status(404).type('text/plain').send('Not found'));

  // Never answer requests for dot-files (.env, .git, ...) with anything but 404.
  app.use((req, res, next) => (/(^|\/)\.[^/]/.test(req.path) ? res.status(404).type('text/plain').send('Not found') : next()));

  // --------------------------------------------------------- SEO files
  app.get('/sitemap.xml', async (_req, res) => {
    res.type('application/xml').send(await buildSitemap());
  });
  app.get('/robots.txt', (_req, res) => res.type('text/plain').send(robotsTxt()));

  // ---------------------------------------------- Frontend (production)
  const indexFile = path.join(config.distDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    app.use(
      express.static(config.distDir, {
        index: false,
        dotfiles: 'ignore',
        setHeaders: (res, filePath) => {
          // Hashed build assets can be cached forever; everything else briefly.
          if (filePath.includes(`${path.sep}assets${path.sep}`) && /-[\w-]{8,}\.(js|css|woff2?)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    // React Router fallback: any other GET renders the SPA shell with page-specific SEO tags.
    app.get(/^(?!\/api\/|\/uploads\/).*/, async (req, res, next) => {
      if (!req.accepts('html')) return next();
      try {
        const html = await renderIndexHtml(req.originalUrl);
        res.setHeader('Cache-Control', 'no-cache');
        res.type('html').send(html);
      } catch (error) {
        next(error);
      }
    });
  } else {
    app.get('/', (_req, res) =>
      res
        .type('text/plain')
        .send('Key Property Rwanda API is running. Start the frontend with "npm run dev" or build it with "npm run build".'),
    );
  }

  app.use((req, res) => res.status(404).type('text/plain').send('Not found'));
  app.use(errorHandler);

  app.locals.sessionStore = sessionStore;
  return app;
}

export default createApp;
