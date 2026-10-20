# Key Property Rwanda — KeyPropertyRwanda.com

A real estate platform for Rwanda. Visitors browse, search and filter properties for sale and rent, view property details, and send inquiries by form or WhatsApp. They also see Featured Properties, Hot Deals, promotions and advertisements. Staff use a secure administration dashboard with role-based permissions to manage everything.

| Layer | Technology |
|---|---|
| Frontend | Vite, React 19 (JavaScript/JSX), React Router, Tailwind CSS 4, shadcn/ui-style components (Radix), Lucide, TanStack Query, React Hook Form, Zod, Recharts |
| Backend | Node.js, Express 5, plain JavaScript ES modules (`.js` only), mysql2, Zod, bcryptjs, express-session (MySQL-backed store), helmet, express-rate-limit, multer |
| Database | MySQL 8 / MariaDB 10.4+ |

There is **one** `package.json`, **one** `package-lock.json`, **one** `.env` and one Git repository at the project root.

---

## Contents

1. [Requirements](#1-requirements)
2. [Installation](#2-installation)
3. [Environment configuration](#3-environment-configuration)
4. [Database setup and migrations](#4-database-setup-and-migrations)
5. [Administrator setup](#5-administrator-setup)
6. [Development](#6-development)
7. [Production build and start](#7-production-build-and-start)
8. [Deployment](#8-deployment)
9. [Testing](#9-testing)
10. [Backups](#10-backups)
11. [Project structure](#11-project-structure)
12. [Features and business rules](#12-features-and-business-rules)
13. [REST API](#13-rest-api)
14. [Security](#14-security)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Requirements

- Node.js **20.6 or newer** (developed and tested on Node 24)
- npm 10+
- MySQL 8+ or MariaDB 10.4+ (XAMPP, WAMP, Laragon or a managed MySQL service all work)

## 2. Installation

```bash
git clone <repository-url> key-property-rwanda
cd key-property-rwanda
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `.env` (see below), then create the database and the first administrator:

```bash
npm run db:setup            # = npm run db:migrate && npm run db:seed
```

## 3. Environment configuration

All configuration lives in the single root `.env`. The Express server always loads this file, whatever the working directory. Vite loads it from the same directory (`envDir`), and **only variables prefixed with `VITE_` reach the browser**. Database credentials and secrets are never bundled.

| Variable | Purpose | Default |
|---|---|---|
| `NODE_ENV` | `development`, `production` or `test` | `development` |
| `PORT` | HTTP port. Hosting platforms that inject `PORT` override it | `4000` |
| `APP_URL` | Public site URL, used for canonical links, sitemap and Open Graph tags. Set it to `https://keypropertyrwanda.com` in production | `http://localhost:5173` |
| `API_URL` | API origin that the Vite dev server proxies to | `http://localhost:4000` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL connection | `localhost`, `3306`, `key_property_rwanda`, `root`, empty |
| `DB_CONNECTION_LIMIT` | Pool size | `10` |
| `SESSION_SECRET` | Long random secret that signs session cookies. **Required.** Production refuses to start with the example value | — |
| `SESSION_COOKIE_NAME` | Session cookie name | `keyproperty_session` |
| `SESSION_MAX_AGE_HOURS` | Idle session lifetime (rolling) | `8` |
| `COOKIE_SECURE` | `true` when served over HTTPS (marks cookies `Secure`) | `false` |
| `TRUST_PROXY` | Number of reverse proxies in front of the app (e.g. `1` behind Nginx) | `0` |
| `UPLOAD_DIR` | Upload folder, absolute or relative to the project root | `uploads` |
| `MAX_UPLOAD_SIZE_MB` | Maximum size per image | `5` |
| `DEFAULT_TIMEZONE` | Display timezone | `Africa/Kigali` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | First Super Admin, created by `npm run db:seed` | — |
| `TEST_DB_NAME` | Throw-away database used by `npm test` (dropped and recreated) | `key_property_rwanda_test` |
| `VITE_APP_NAME` | Public app name (browser-visible) | `Key Property Rwanda` |

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 4. Database setup and migrations

```bash
npm run db:migrate    # creates the database if missing, applies pending migrations,
                      # syncs permissions/roles and required reference data
npm run db:seed       # creates the Super Admin and, on an empty database, demo data
npm run db:seed -- --no-demo   # Super Admin only, no demo listings
npm run demo:photos   # replace demo illustrations with real photos + create demo hero slides
```

- Migrations are versioned files in `server/migrations/` (`001_initial_schema.js`, …). Each exports an `up` array of SQL statements. Applied versions are recorded in `schema_migrations`.
- To change the schema, add a new file such as `002_add_property_floor.js` and run `npm run db:migrate`. Never edit a migration that has already run in production.
- Migrating is idempotent and safe to run on every deploy. It never overwrites content or settings that administrators have edited.
- All timestamps are stored in **UTC**. The UI displays them in Africa/Kigali time.

**Tables:** hero_slides, users, roles, permissions, role_permissions, sessions, properties, property_categories, property_images, amenities, property_amenities, inquiries, inquiry_notes, advertisements, advertisement_placements, advertisement_events, promotions, promotion_properties, featured_property_campaigns, hot_deals, campaign_events, website_content, business_settings, audit_logs, schema_migrations.

## 5. Administrator setup

`npm run db:seed` creates a Super Admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Sign in at **`/admin/login`** and change the password straight away under **My account**.

To create another Super Admin or reset a forgotten password from the command line:

```bash
npm run admin:create -- --email=you@example.com --name="Your Name" --password="StrongPassw0rd"
```

Passwords need at least 10 characters with upper- and lower-case letters and a number. Further staff accounts are created under **Administration → Users**.

### Roles

| Role | Can do |
|---|---|
| **Super Admin** | Everything, including users, roles, settings and audit logs |
| **Property Manager** | Listings (create, edit, prices, availability, publish, archive, export), categories, featured placements |
| **Marketing Manager** | Featured, hot deals (including verifying original prices), advertisements, promotions, analytics |
| **Inquiry Officer** | View, update, annotate and export inquiries |
| **Content Manager** | Website content; view settings |
| **Viewer** | Read-only access to listings, campaigns, analytics and inquiries |

Roles other than Super Admin can be edited, and new roles can be created, under **Roles & Permissions**. There are 38 granular permissions, and the server checks them on every request.

## 6. Development

```bash
npm run dev
```

This runs, with one command:

- the API on `http://localhost:4000` (`node --watch`, restarts when files change)
- the Vite dev server on **`http://localhost:5173`**, which proxies `/api`, `/uploads`, `/sitemap.xml` and `/robots.txt` to the API

Open http://localhost:5173 for the website and http://localhost:5173/admin for the dashboard.

## 7. Production build and start

```bash
npm run build     # builds the React app into dist/
npm start         # Express serves dist/ and the API from one process
```

In production the single Express process:

- serves `/api/v1/*` and `/api/health`
- serves `/uploads/*` (public images only; `uploads/private` is never served)
- serves the built frontend with long-lived caching for hashed assets
- answers every other `GET` with the SPA shell, so React Router routes survive a refresh. Property pages get their `<title>`, meta description, Open Graph tags and JSON-LD structured data injected on the server for search engines and link previews.
- serves `/sitemap.xml` and `/robots.txt`
- runs the campaign scheduler every minute (scheduled → active → expired)

## 8. Deployment

Typical steps on a VPS or Node-capable host (cPanel Node.js App, Render, Railway, a DigitalOcean droplet, etc.):

1. Provision MySQL and create a dedicated user with rights on the database.
2. Upload the code and run `npm ci`.
3. Create `.env` with `NODE_ENV=production`, the database credentials, a strong `SESSION_SECRET`, `APP_URL=https://keypropertyrwanda.com`, `COOKIE_SECURE=true` and `TRUST_PROXY=1` (behind a proxy).
4. Run `npm run db:migrate`, then `npm run db:seed -- --no-demo` once.
5. Run `npm run build`.
6. Start with `npm start`, under a process manager such as **pm2** (`pm2 start server/server.js --name keyproperty`) or systemd.
7. Put Nginx (or the host's TLS proxy) in front for HTTPS. Example:

```nginx
server {
  server_name keypropertyrwanda.com www.keypropertyrwanda.com;
  client_max_body_size 25m;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

8. Keep the `uploads/` directory on persistent storage. Container platforms with ephemeral disks need a mounted volume, with `UPLOAD_DIR` pointing at it.
9. Check `GET /api/health`. It returns `200` with `database.status: "up"`, or `503` if the database is unreachable. No configuration or secrets are exposed.

**On every deploy:** pull the code, run `npm ci`, `npm run db:migrate` and `npm run build`, then restart the process.

## 9. Testing

```bash
npm run build   # optional: enables the production-serving tests
npm test
```

`npm test` uses Node's built-in test runner. It drops and recreates the `TEST_DB_NAME` database, applies the migrations, starts the real Express app on a random port and exercises it over HTTP. Your development data is never touched.

Coverage: authentication (CSRF, lockout, HttpOnly cookies, logout), role permissions, property CRUD, publication rules, image upload validation and ordering, search and filters, pagination, inquiries (storage, consent, honeypot, rate limit, notes, follow-ups), WhatsApp link encoding, featured scheduling, hot deal discount calculation and expiry, deals ending when a property is sold, advert placement and scheduling, unsafe-URL rejection, promotion scheduling and expiry, analytics de-duplication and bot filtering, campaign attribution, dashboard figures, production frontend serving, SEO files and database connectivity.

## 10. Backups

Back up **both** the database and the uploads folder.

```bash
# Database (daily, e.g. from cron)
mysqldump --single-transaction --routines -u <user> -p key_property_rwanda | gzip > backup-$(date +%F).sql.gz

# Uploaded images
tar czf uploads-$(date +%F).tar.gz uploads/
```

Restore with `gunzip < backup.sql.gz | mysql -u <user> -p key_property_rwanda` and extract the uploads archive in the project root. Keep copies off the server, and test a restore regularly.

## 11. Project structure

```text
key-property-rwanda/
├── package.json / package-lock.json / .env / .env.example
├── vite.config.js            # loads the root .env, dev proxy, builds to dist/
├── index.html
├── public/assets/key-property-logo.png
├── src/                      # React app (JS/JSX)
│   ├── main.jsx, App.jsx
│   ├── routes/AppRoutes.jsx  # public + lazy-loaded admin routes
│   ├── layouts/              # PublicLayout, AdminLayout (+ permission guard)
│   ├── pages/                # Home, Properties, PropertyDetails, FeaturedProperties, HotDeals,
│   │   │                     # Promotions, About, Contact, PrivacyPolicy, Terms, NotFound
│   │   └── admin/            # Dashboard, Properties, PropertyEditor, Categories, Featured, HotDeals,
│   │                         # Advertisements, Promotions, Analytics, Inquiries, Content, Users, Roles,
│   │                         # Settings, AuditLogs, Account, Login
│   ├── components/{ui,layout,property,promotions,admin}/
│   ├── services/             # publicApi.js, adminApi.js
│   ├── hooks/, contexts/, lib/, styles/
├── server/                   # Express API — every file is .js (ES modules)
│   ├── server.js, app.js
│   ├── config/               # environment.js, database.js, permissions.js
│   ├── models/               # SQL data access, one module per entity
│   ├── services/             # business rules (publication, discounts, scheduling, analytics, …)
│   ├── controllers/          # HTTP adapters
│   ├── routes/               # /api/v1 route modules
│   ├── middleware/           # auth, CSRF, validation, rate limits, uploads, sessions, errors
│   ├── validators/           # Zod schemas
│   ├── utils/
│   ├── migrations/           # versioned schema migrations
│   └── scripts/              # migrate.js, seed.js, create-admin.js, generate-brand-assets.js
├── tests/                    # node:test unit + integration tests
├── uploads/                  # user uploads (git-ignored)
└── dist/                     # production build (git-ignored)
```

**Layering:** routes → controllers (HTTP only) → services (business rules, transactions, audit logging) → models (parameterised SQL through the shared `mysql2` pool).

## 12. Features and business rules

**Public website.** Homepage (hero search with location, category, sale/rent and price range; featured, latest, hot deals, current promotions, company introduction, contact call-to-action, advert slots, WhatsApp button). All Properties, For Sale, For Rent, Houses & Apartments, Land & Plots and Commercial listing pages, with keyword, location, category, purpose, price, bedrooms, bathrooms, size and availability filters, sorting, pagination, active-filter chips and "clear all". Property details (gallery with lightbox, specifications, amenities, video or virtual tour, related properties, inquiry form, WhatsApp and call buttons, structured data). Featured Properties, Hot Deals, Promotions (list and detail), About, Contact, Privacy Policy, Terms and a custom 404 page.

**Properties.** Each property has a unique reference (`KPR-00001`) and an SEO slug. **Publication status** (draft, published, unpublished, archived) is separate from **availability** (available, under offer, sold, rented, unavailable). A property can only be published with at least one photo and complete details. Archiving keeps the record and its inquiry and campaign history, ends running hot deals and deactivates featured placements. Visitors only ever see published listings that are not marked unavailable.

**Featured.** Scheduled start and end, display order, an optional badge label and optional priority in search results. A placement is live only while active, inside its dates and attached to a published, available property. Featuring never changes the price.

**Hot deals.** Always tied to an existing property. The server calculates the promotional price from a percentage, an amount or a fixed price, and rejects negative prices and discounts of 100% or more. The property's own price never changes. The original price and discount are shown publicly **only after a user with `hot_deals.verify_price` verifies them**. Expired deals, and deals on unpublished or unavailable properties, are excluded from public results immediately. The scheduler also marks them expired. Ended and expired deals are kept as history.

**Advertisements.** Seven placements: homepage hero, homepage promo, listing page, details page, sidebar, in-content and mobile. Statuses are draft, scheduled, active, paused, expired and archived. Destination URLs must be `http(s)` or a site path (`javascript:`, `data:` and `//host` are rejected), and external links open with `rel="noopener noreferrer sponsored"`. Every advert carries a visible **"Advertisement"** label.

**Promotions.** Five campaign types: general, featured, hot deals, category and seasonal. A campaign links one or more properties by reference (property data is never copied), and has a placement, a banner, a destination and a schedule. An expired campaign can never appear as active: public queries check dates directly, and an expired schedule cannot be republished.

**Analytics.** An *impression* means an advert was at least 50% visible in the viewport. A *view* means a promotion or deal card was displayed. A *click* means the visitor followed the link. Each event is counted at most **once per anonymous visitor, item and day**, using an HMAC of IP and user-agent with a daily-rotating salt; raw IPs are not stored. Known bots are ignored. *Attributed inquiries* are inquiries sent after the visitor clicked a campaign in the same browser session. They are labelled as attribution, never as sales.

**Inquiries.** Stored in MySQL with status (new, contacted, in progress, converted, closed), assignee, follow-up date, internal notes, CSV export and attribution. Spam protection uses a honeypot field, a minimum fill time, per-visitor hourly limits, IP rate limits and duplicate suppression. IP addresses are stored only as keyed hashes. A consent checkbox is required.

**Home Hero.** Under **Administration → Home Hero**, staff with `content.manage` can manage up to 10 slides. Each slide has a heading, subheading, background photo, optional button, overlay darkness and text alignment. Slides can be shown, hidden and reordered. One setting chooses the animation (**Slide**, **Fade** or **Flip**) and another sets the autoplay interval (3–30 seconds), with a live preview of the result. The homepage search box stays fixed while the slides change. Autoplay pauses on hover, visitors can pause it themselves, and it is switched off for visitors who prefer reduced motion. With no active slides, the homepage falls back to the "Homepage hero" text in Website Content.

**Demo photos.** On a new install, `npm run db:seed` downloads real photographs from [Unsplash](https://unsplash.com/license) (free for commercial use) for the demo listings and hero slides. Offline, it uses generated illustrations instead. `npm run demo:photos` swaps illustrations for real photos on an existing database. It only replaces images the seeder created, never photos uploaded by staff. Replace the demo photos with your own before going live.

**Dashboard.** Every figure is computed live from the database: properties (total, published, drafts, for sale and rent), active featured placements, deals, adverts and promotions, new and in-progress inquiries, follow-ups due, and campaigns expiring within 7 days.

## 13. REST API

All endpoints are under `/api/v1` and return `{ success, data, meta? }` or `{ success: false, error: { code, message, details? } }`.

| Area | Endpoints |
|---|---|
| Health | `GET /api/health` |
| Auth | `GET /auth/csrf`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password` |
| Public | `GET /site`, `/content/:key`, `/categories`, `/locations`, `/properties`, `/properties/:slug`, `/featured`, `/hot-deals`, `/hot-deals/:id`, `/promotions`, `/promotions/:slug`, `/advertisements?placement=` · `POST /inquiries`, `/events/ad`, `/events/campaign` |
| Admin | `/admin/dashboard`, `/admin/properties` (CRUD, `publish`, `unpublish`, `availability`, `archive`, `restore`, `images`, `images/order`, `export`, `options`), `/admin/categories`, `/admin/amenities`, `/admin/featured`, `/admin/hot-deals` (+ `calculate`, `activate`, `pause`, `end`), `/admin/advertisements` (+ `publish`, `pause`, `archive`, `restore`), `/admin/advertisement-placements`, `/admin/promotions` (+ actions), `/admin/analytics`, `/admin/uploads`, `/admin/inquiries` (+ `notes`, `export`, `staff`), `/admin/content`, `/admin/settings`, `/admin/users`, `/admin/roles`, `/admin/audit-logs` |

## 14. Security

- Passwords are hashed with bcrypt (cost 12). Accounts lock for 15 minutes after 5 failed sign-ins, and login attempts are rate-limited per IP.
- Sessions are server-side in MySQL. Cookies are `HttpOnly` and `SameSite=Lax` (`Secure` with `COOKIE_SECURE=true`), expire on a rolling basis, get a new session ID at login, and are revoked on password change or suspension.
- Every state-changing admin and auth request requires a synchronizer CSRF token (`X-CSRF-Token`).
- Permissions are re-read from the database on every request, so role changes take effect immediately. Price and availability changes need their own permissions. Only a Super Admin can grant Super Admin, and the last active Super Admin cannot be removed.
- Request bodies, queries and parameters are validated with Zod, and every SQL query is parameterised.
- Uploads are limited by size and count and verified by magic bytes (JPEG, PNG, WebP), then stored under random names outside any code path and served with `nosniff`.
- Helmet sets a strict Content Security Policy and other security headers. Errors are handled centrally, and stack traces are never sent in production. Dot-files such as `.env` always return 404.
- Logins, failed logins, publishing, price and availability changes, archiving, campaign actions, user and role changes, settings, content edits and exports are written to the audit log.

## 15. Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot connect to MySQL (ECONNREFUSED)` | Start MySQL (XAMPP: start MySQL in the control panel) and check the `DB_*` values in `.env` |
| `Invalid environment configuration` | A required variable is missing or invalid. The message names it (often `SESSION_SECRET`) |
| `ER_ACCESS_DENIED_ERROR` | Wrong `DB_USER`/`DB_PASSWORD`, or the user lacks rights to create the database. Create it manually and grant privileges |
| Port 4000 or 5173 already in use | Change `PORT` (and `API_URL`), or stop the other process |
| "Invalid or missing CSRF token" | The session expired. Reload the page and sign in again |
| Login works locally but not in production | Over plain HTTP, `COOKIE_SECURE=true` blocks the cookie. Use HTTPS, and set `TRUST_PROXY=1` behind a proxy |
| Images 404 after deploy | `uploads/` was not preserved. Mount persistent storage and point `UPLOAD_DIR` at it |
| Refreshing `/admin/...` returns 404 in production | Run `npm run build` so `dist/index.html` exists, then restart `npm start` |
| `npm test` fails at start | MySQL must be running, and the DB user must be able to `DROP`/`CREATE` the `TEST_DB_NAME` database |
| Account locked | Wait 15 minutes, or reset it with `npm run admin:create -- --email=… --password=…` |
