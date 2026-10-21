# Public deployment

The cloud environment's Publish action saves a development snapshot; it does not deploy a public website. This chat has no ChatGPT Sites deployment capability. A Node/container host can give this site a provider-issued HTTPS address without purchasing a domain.

## Prepared package

The Docker image serves the frontend and API together, runs as a non-root user, excludes local credentials/databases, and includes a database health check. Mount a persistent volume at `/app/data` and run **one replica**. Deployment requires access to an actual hosting account; no provider resources have been created and no public URL exists yet.

Required runtime configuration:

| Setting | Value |
| --- | --- |
| Container port | `3001`, or set `PORT` to the platform-assigned port |
| `APP_ORIGIN` | The exact public HTTPS origin assigned by your host |
| `ADMIN_TOKEN` | A private, randomly generated token of at least 32 bytes |
| `DATABASE_PATH` | `/app/data/samp.sqlite` on the persistent volume |
| `EMAIL_TRANSPORT` | `disabled` until Gmail is configured |
| `TRUST_PROXY_HOPS` | Exact number of trusted reverse proxies; restrict direct backend access |
| Health check | `GET /api/health` |

Do not use a static-only host for the current backend. Providers with ephemeral disks require a database migration before storing real inquiries reliably. Persistent disks may require a paid hosting plan. No paid plan has been authorized or provisioned.

## Container hosting

Build from the repository root:

```sh
docker build -t samp-ventures:latest .
```

Supply runtime environment variables using the hosting provider's native secret settings. Do not bake `.env` or SMTP credentials into the image. Enable HTTPS at the provider ingress and set `APP_ORIGIN` to that public address. Place a persistent volume at `/app/data` with write access for container UID/GID 1000.

For a server with Docker Compose and a separately configured HTTPS reverse proxy:

```sh
# Configure a private .env first; preserve any existing configuration.
# Set APP_ORIGIN to the public address of the reverse proxy.
docker compose up --build -d
```

Compose binds the application to loopback on port 8080 by default. A reverse proxy must terminate HTTPS and forward to that port. This is not itself a public hosting/tunneling service. The named volume keeps inquiries across container replacement; do not delete the volume when updating.

## Gmail

The selected SMTP sender is `bil332204@gmail.com` using `smtp.gmail.com:587` with STARTTLS. `INQUIRY_TO` remains `contact@sampventure.com`. Add a Google App Password as the private `SMTP_PASSWORD` variable, along with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `MAIL_FROM`, and then set `EMAIL_TRANSPORT=smtp`. Never paste credentials into chat. SMTP remains disabled until configured; submitted inquiries still persist in the admin inbox. Verify that the chosen host permits outbound SMTP—some free hosting plans block it.

## Before sharing

Confirm the public homepage loads; submit a test inquiry; confirm its receipt and presence in `/admin`; replace/restart the instance and confirm persistence; test email separately once enabled. A successful local container check does not establish a live public deployment.

## Validation and account access

The production Docker image was built successfully in this cloud environment. `node tests/container.mjs` verified the non-root runtime, exclusion of private `.env`, frontend/admin routes, a real API submission, authenticated inquiry access, and persistence after replacing the container while retaining the test volume. The test removes its own temporary container/volume and does not send email. Local validation is not a public deployment.

For managed deployment, Render is the recommended host. A personal `RENDER_API_KEY` requirement has been added to cloud environment settings, scoped to HTTPS requests to `api.render.com`. Create a Render account and key, then supply it in the secure settings field—not chat. The key permits account API actions, so use an account you control and revoke it when no longer needed. This does not create a service, authorize charges, or publish a live site. Choose between a temporary free demo with ephemeral inquiry storage and a separately priced persistent-storage plan before provisioning.

In this restricted cloud build, existing network proxy routing and its trusted CA were supplied to Docker using standard build arguments and a BuildKit secret mount. Verification remained enabled; credentials and proxy certificates were not copied into the runtime image. A normal hosting builder with standard registry access can use the plain docker build command above.

## Deployment attempt: 21 October 2026

- Source is published on `main` at `bil332204-code/Website-demo-for-client`.
- Render API authentication works and the supplied workspace ID was used.
- Creating a Docker web service with `plan: free` was rejected with HTTP 402: Render requires payment information at `https://dashboard.render.com/billing`.
- No SAMP service was created. No public URL, custom-domain verification, or DNS targets have been provisioned.
- The account owner must satisfy Render's billing prerequisite directly before this deployment can continue. No paid plan has been selected or authorized.

## Deployment update: free service created

After the account owner completed Render's billing prerequisite and explicitly selected free hosting, the service was created successfully:

- Service: `samp-ventures` (`srv-dbcbg77f3r2c739gcn10`)
- Public address: `https://samp-ventures.onrender.com`
- Runtime: Docker; region: Singapore; compute plan: `free`; no persistent disk requested
- Initial deployment: `dep-dbcbg7vf3r2c739gcotg`, reported `live` by Render
- Deployed source: `98b9b8755e28ffb733348c2b83a1ef7540d30324`
- Automatic deploys are disabled; future changes require an explicit deployment.
- Admin access uses the private token already configured locally, transferred securely to Render's environment without logging it. Email notifications remain disabled.
- `sampventures.tech` and `www.sampventures.tech` are registered with Render; `www` redirects to the apex. DNS verification is pending registrar changes.

The free demo uses ephemeral SQLite storage and may sleep when idle. Stored inquiries may be lost on replacement/redeployment. No paid compute or disk was selected.

The workspace network policy currently blocks direct requests to the new public site and Render's documentation. Render's own deployment status is verified; external browser/API validation has not yet been performed. Network additions for `render.com`, `samp-ventures.onrender.com`, `sampventures.tech`, and `www.sampventures.tech` are saved in the environment draft for review/save/publication. Once applied, rerun public HTTP and browser checks. Local full-stack and container checks passed earlier.

## DNS verification and live checks

After the account owner added the registrar records, Render's API reports **verified** for both `sampventures.tech` and `www.sampventures.tech`. The `www` entry redirects to the apex. Render's official other-DNS-provider documentation confirms the apex A target `216.24.57.1`.

Public verification completed on `https://samp-ventures.onrender.com`:

- Database health endpoint returned HTTP 200.
- Authenticated admin inbox responded successfully; unauthenticated access returned 401.
- A temporary inquiry was created, read back, and an identical retry returned the same receipt. The temporary inquiry was deleted afterward. Notifications were confirmed disabled; no email was sent.
- A live browser loaded the homepage and 3D canvas, opened the consultation dialog, and exercised mobile navigation with no page errors or horizontal overflow. Browser requests used Playwright's Node request context with the environment's supplied trusted CA because Chromium's own store lacked the proxy CA. TLS verification stayed enabled.

The custom domains are not yet ready over HTTPS: repeated public checks returned an upstream TLS-handshake failure (HTTP 503 from the egress proxy), despite verified DNS. Render automatically provisions certificates after verification, but successful custom-domain HTTPS has not yet been observed. Leave the verified DNS records unchanged while provisioning completes. Recheck apex `/api/health` and the `www` redirect before claiming custom-domain readiness.

## Custom domain HTTPS active; SAMP motion update

The custom domain is now operational: `https://sampventures.tech/api/health` returns 200, the homepage loads over HTTPS, and `https://www.sampventures.tech/` redirects to the apex. The previous certificate-provisioning limitation is resolved.

The client clarified the display name is **SAMP**. The motion update includes moving images, pointer depth, scan overlays, layered atmospheric effects, orbital trails, floating research elements, a moving typography band, scroll choreography, and motion controls. Local production-build validation passes all 14 browser checks across eleven viewport widths, including an unrevealed-animation resize regression from laptop to phone. Hosting remains on the free plan without a persistent disk; SMTP remains disabled pending credentials.


## Full-width cinematic background redesign

Replaced the technical orbital hero and research diagram with three original real-time 3D motion studies: lavender/silver silk, teal waves, and warm sculptural folds. They sit behind the page content with contrast scrims and mobile-specific framing. No external video service or additional hosting cost is required. Scenes initialize near the viewport and stop drawing when offscreen, hidden, or paused. Browser coverage now verifies changing rendered frames and a stable paused frame, alongside the existing forms, admin, mobile, and reduced-motion checks.

Validation: production build and all 15 browser checks pass, including eleven responsive widths and changing/still background frames. Focused checks also confirm WebGL context loss/recovery and the non-WebGL mobile fallback with a working consultation dialog. Live inquiry inbox was empty before rollout.


## Multiple-page SAMP site

The public site now uses eight separate document URLs: `/`, `/expertise`, `/approach`, `/research`, `/about`, `/learning`, `/products`, and `/contact`. Each inner page has its own full-screen 3D motion study, page introduction, active navigation, and next-chapter link. Service and mentorship inquiries retain the existing API. Product content accurately describes the catalogue as unavailable and offers custom-product inquiries.

Production Express serves each route directly, including refreshes, with unique titles, descriptions, and canonical links. It also serves a public sitemap, robots policy, and a useful HTTP 404 document. The Docker runtime includes the shared page metadata module. Navigation uses normal document links with progressive cross-document transitions; motion preference persists in the browser tab.

Verification covers the production container, all 16 API tests, eight direct page loads, browser history/refresh, eleven widths per page, 3D playback/pause, mentorship and service interactions, and admin workflows. The live inquiry inbox was empty before rollout. Hosting continues on Render’s free plan.

Result: production build, all 18 browser checks, all 16 API checks, and the production container validation pass.
