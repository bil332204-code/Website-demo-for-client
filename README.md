# SAMP

An eight-page cinematic SAMP engineering website with a Node.js/Express API, persistent SQLite inquiry storage, private admin inbox, and optional Gmail SMTP email notifications. React, Vite, Three.js, GSAP, and Lucide power the frontend. The source review is in [docs/SOURCE-AUDIT.md](docs/SOURCE-AUDIT.md).

## Local development

Requires **Node.js 24+** (uses built-in `node:sqlite`), npm, and Chromium for browser tests.

```sh
npm ci --cache /tmp/samp-npm-cache
# Only if .env does not already exist:
cp .env.example .env
npm run admin:setup
npm run dev
```

The development runner starts the API on port 3001 and Vite on port 5173. Vite proxies `/api` to the backend. Set `PORT` to change the API port. Use the existing checkout in the isolated cloud task; no Git worktree is needed.

`npm run admin:setup` generates a strong token in the ignored `.env` file, restricts its permissions, and never prints it. It preserves an existing token. Retrieve the token privately from your local configuration and sign in at the website's `/admin` route. The browser keeps it only in memory; reload/sign-out clears it. Never paste tokens into chat or commit `.env`.

## What works

- Contact, consultation, mentorship, and product-inquiry forms submit to `POST /api/inquiries`.
- Validation on the server, consent recording, a honeypot, same-origin checks, request limits, and IP rate limiting protect submissions.
- SQLite commits the inquiry and an outbox record before acknowledging success. A random reference identifies the receipt. Idempotency prevents retries from duplicating an unchanged submission.
- `/admin` provides authenticated search, filtering, pagination, new/in-progress/closed status, notification status/retry, and confirmed permanent deletion.
- A background delivery worker retries failed notifications up to five times. Delivery can be disabled while submissions continue to work.
- Production Node serves both `dist/` and the API on one origin. Runtime data and credentials are never served as static files.

## Gmail notifications

The user's mailbox is configured as `bil332204@gmail.com`. The recipient remains `contact@sampventure.com`; change `INQUIRY_TO` if you want delivery to another inbox.

Add these to the deployment host's **private environment settings**, or your private `.env` for local development:

```dotenv
EMAIL_TRANSPORT=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=bil332204@gmail.com
SMTP_PASSWORD=YOUR_GOOGLE_APP_PASSWORD
MAIL_FROM=SAMP <bil332204@gmail.com>
INQUIRY_TO=contact@sampventure.com
```

Enable Google 2-Step Verification and create a Google App Password for this connection. Use an App Password, not your regular Google password. Some managed Google accounts restrict App Passwords; check with the account administrator in that case. Never put it in a `VITE_` variable or in source code. Restart the backend after changing configuration.

Port 587 requires STARTTLS; port 465 uses implicit TLS. Certificate verification and TLS 1.2+ remain enabled. Your host must permit outbound SMTP to `smtp.gmail.com` on the chosen port. HTTPS-only credential proxies cannot substitute credentials into an SMTP connection; use the deployment host's native secret injection for `SMTP_PASSWORD`.

Email is **disabled by default** (`EMAIL_TRANSPORT=disabled`). Enabling it also processes previously pending notifications. Check pending inquiries first if you don't want historical notifications sent. The local tests use mocked transports and never send real email. Live mailbox authentication and inbox delivery remain unverified until credentials are supplied. SMTP delivery is at least once: a connection lost after a mail server accepts a message can result in a duplicate retry, although stable Message-ID headers are used. A notification marked sent means provider acceptance, not proof of inbox placement.

Resend is retained as an optional alternative: set `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY`, `MAIL_FROM` (verified sender), and `INQUIRY_TO`. No Resend key is needed for Gmail SMTP.

## Production deployment

A Docker image and persistent-volume Compose configuration are prepared. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for temporary provider addresses, required runtime settings, and deployment status. The site is deployed on Render’s free plan at https://sampventures.tech. Its local SQLite disk is ephemeral; use persistent storage for durable production inquiries.

Deploy to a Node-capable host with a persistent writable disk; static-only hosting cannot run this API.

```sh
npm ci
npm run build
NODE_ENV=production APP_ORIGIN=https://your-real-domain.example npm start
```

Configure `ADMIN_TOKEN` (at least 32 bytes), SMTP settings if desired, and `DATABASE_PATH` to a path on the persistent volume. The production server binds to `0.0.0.0`; `PORT` defaults to 3001. Put it behind HTTPS. `APP_ORIGIN` must exactly match the public HTTPS origin. Set `TRUST_PROXY_HOPS` only to the exact number of trusted reverse proxies so IP limits identify clients correctly; keep the backend inaccessible except through those trusted proxies. Do not trust arbitrary forwarded headers.

Run **one API process per SQLite database**. For multiple replicas/serverless environments, migrate persistence and rate limiting to shared services first. The current limiter is in memory and resets on restart. Take consistent SQLite backups (use the SQLite backup API or stop the process and copy the database plus WAL files); do not copy only an active main database file. Protect backups as they contain inquiry contact information. Establish retention and a privacy policy before collecting production submissions. An administrator can permanently delete individual records through the inbox.

## Verification

```sh
npm run test:api   # 16 real API/database/transport tests; temporary databases
npm run build
npm test          # browser checks against an isolated full-stack server
```

The browser suite starts its own server with temporary data, a random administrator token, and disabled notifications, then removes the data. It covers real form submission, failure recovery, idempotent retry, admin sign-in/search/status/deletion, all nine service panels, eight directly loadable pages, refresh and browser history, page metadata, sitemap/404 behavior, image loading, reduced motion, and eleven viewport widths on every page. It uses `/usr/bin/chromium`; override `CHROMIUM_PATH` if needed. `TEST_BASE_URL` optionally targets an existing instance but skips admin checks that require the isolated test token; this mode writes a test inquiry and should not target production.

## API

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `GET /api/health` | Public | Database readiness |
| `POST /api/inquiries` | Public, limited | Validate and persist inquiry; JSON and `Idempotency-Key` required |
| `GET /api/admin/inquiries` | Bearer token | Search and paginate; `search`, `status`, `page`, `limit` |
| `PATCH /api/admin/inquiries/:id` | Bearer token | Set status: `new`, `in_progress`, `closed` |
| `DELETE /api/admin/inquiries/:id` | Bearer token | Delete inquiry and its outbox record |
| `POST /api/admin/inquiries/:id/retry-notification` | Bearer token | Retry an exhausted failed notification |

POST payload: `name`, `email`, optional `phone`, `category` (a published service or mentorship/inquiry option), `message`, optional `notes`, `consent: true`, and an empty `website` honeypot. `Idempotency-Key` must be 16–128 characters from letters, numbers, hyphens, or underscores; the frontend generates one automatically per payload. A successful write returns HTTP 201 with `{id, status: "received"}`. An identical retry returns 200 with the same ID; reusing a key for different contents returns 409. Public APIs never expose stored contact data.

## Editing

- `src/data.js`: service content and FAQ
- `src/main.jsx`: shared navigation, route-specific content, and dialogs
- `src/pages.js`: shared public paths, titles, descriptions, and scene variants
- `src/PageExperience.jsx` / `src/pages.css`: page introductions, chapter cards, transitions, and layout
- `src/ContactForm.jsx`: backend-connected inquiry form
- `src/Admin.jsx`: private inbox
- `src/mechanicalStudies.js`: mechanical geometry, gear ratios, thread travel, toolpaths, and CAD studies
- `src/DesignScene.jsx`: original rotating gear trains, threaded fasteners, machining, CAD, and exploded assemblies
- `server/`: API, SQLite, validation, notification queue

The source shop is empty and learning has no published schedule/prices. This backend supports inquiries for those areas; it does not invent inventory, payments, customer accounts, or an LMS.

## Cinematic motion and brand

The displayed company name is SAMP; Ventures remains only in existing domain/social/repository identifiers. `src/useCinematicMotion.js` manages scroll choreography, viewport activity, pointer depth, and magnetic controls. `src/motion.css` adds continuous photo movement, scan overlays, layered atmospheric effects, floating cards, and moving typography. `src/DesignScene.jsx` and `src/studio.css` supply full-bleed sculptural backgrounds, using original mechanical assemblies with environment-lit steel and red components, plus blueprint grids, dimensions, and wireframe views. Scenes initialize as they approach the viewport, draw at up to 20 fps, and retain gradient fallbacks when WebGL is unavailable. Motion can be disabled with the hero control and respects the operating system reduced-motion preference. Images and other ambient effects pause outside the viewport; the 3D scene lowers rendering resolution on small screens and stops drawing while hidden or paused. Responsive checks cover widths from 320 to 1920 pixels, including 1366-pixel laptops.


## Public pages

`/`, `/expertise`, `/approach`, `/research`, `/about`, `/learning`, `/products`, and `/contact` are separate documents with real navigation links, unique titles and descriptions, and direct-load support. The production server supplies metadata, canonical links, `/sitemap.xml`, `/robots.txt`, and an animated 404 page. Expertise accepts `?discipline=<service-id>` for shared links. The motion control persists across page navigation in the current browser tab. Unknown URLs return HTTP 404. `/admin` remains a private inbox.

Mechanical motion checks: `node --test tests/mechanical.test.mjs` verifies gear speed ratios/directions, clockwise nut travel against thread pitch, closed CNC toolpaths, and prototype depth growth. These are illustrative engineering scenes, not a published product catalogue.
