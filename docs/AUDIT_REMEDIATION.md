# Audit remediation status

Response to the *Urban Garage Sale — Full Application Audit* (8 Oct 2026, commit f6c496f).
"Done" means changed in code or configuration in this repository. "Owner" means it needs an
account owner's action in a console or a decision; the steps are in `docs/DEPLOYMENT.md`.

## High

| ID | Issue | Status |
|---|---|---|
| SEC-1 | No backups / PITR / delete protection | Done (live config, 9 Oct): PITR 7 days, daily backups kept 14 days, delete protection. Restore procedure in DEPLOYMENT.md → Rollback. |
| SEC-2 | No monitoring or error tracking | Done (9 Oct): Error Reporting for web, API and functions; email alerts; `healthCheck` every 10 minutes. |
| PERF-1 | Search downloads every listing | Done (9 Oct): geohash radius queries, capped per cell; saved listings load by ID. |
| CMP-1 | Vercel Hobby is non-commercial | **Owner:** upgrade both Vercel projects to Pro. |

## Security (Medium / Low)

| ID | Issue | Status |
|---|---|---|
| SEC-3 | App Check not enforced | Done in code: web client sends tokens; API, callables and rules ready. **Owner:** set `VITE_APPCHECK_SITE_KEY`, watch metrics, then enforce (DEPLOYMENT.md → App Check). |
| SEC-4 | Rules don't validate fields | Done: `validListing()` and `validUserProfile()` in `firestore.rules` (allowed keys, types, sizes, formats); contact messages already checked. Covered by `tests/rules`. |
| SEC-5 | 6-character passwords | Done: 12+ characters with letters and numbers in the UI; Firebase policy via `scripts/set-auth-settings.mjs`. |
| SEC-6 | No rate limiting | Done: per-user Firestore counters on all API endpoints and callables; contact form one per minute in rules. |
| SEC-7 | Partial CSP | Done: full `default-src 'self'` policy with reporting on the website; strict CSP on the API. |
| SEC-8 | Revoked keys in public git history | Done: `.gitleaksignore` baseline of the 27 historical findings, so full-history scans pass and new leaks still fail. **Owner:** confirm every key in the baseline is revoked (see note below). |
| SEC-9 | Long-lived broad service-account key | **Owner:** create the least-privilege `urban-pay-api` account, swap the Vercel key, delete the old key and local copies (DEPLOYMENT.md → Service accounts). |
| SEC-10 | Admin actions not audited; per-request `get()` | Done: `admin` custom claim (rules check the token, no document read); `setUserRole` callable; `auditLog` written by role changes, rejections/refunds and user deletion; admins can no longer write `role` directly. |
| SEC-11 | Account enumeration | Done: sign-up and password-reset messages no longer confirm an email exists; `set-auth-settings.mjs` turns on Firebase email enumeration protection. |
| SEC-12 | Request IDs not validated | Done: `^[A-Za-z0-9_-]{1,128}$` check before every Admin SDK lookup in functions and API; OAuth state must be 64 hex characters. |
| SEC-13 | Vulnerable packages | Done: React Router 7.18; `@grpc/grpc-js` pinned to a patched 1.14 (Node-only path); `tailwindcss-animate` moved to dev dependencies. `npm audit --omit=dev` reports 0 for web app, API and functions. |

## Scalability and performance

| ID | Issue | Status |
|---|---|---|
| PERF-2 | Admin dashboard loads whole collections | Done (12 Oct): paged admin queries, aggregation counts, nightly `expireListings`. |
| PERF-3 | 1st-gen functions in us-central1 | Done in code: all functions are 2nd gen in `australia-southeast1`. **Owner/deploy:** one-time cutover (DEPLOYMENT.md → One-time move). |
| PERF-4 | 500 KB main bundle | Done: every page except Home is lazy-loaded; main chunk ~250 KB, admin dashboard and charts load only for admins. |
| PERF-5 | Photos served at upload size | Done: a 480 px thumbnail is uploaded with each photo and used in lists (`coverImage()`); older listings fall back to the full photo. |
| PERF-6 | Seller stats hotspot | No change: fine below ~1 write/second per seller, as the audit notes. Revisit if Urban Pay is used at large events. |
| MEM-1 | Globals and a no-op timer | Done: reCAPTCHA verifier is module-scoped; suburb lookup imported directly; the Maps polling timer was removed earlier. |

## Code quality

| ID | Issue | Status |
|---|---|---|
| CQ-1 | God components | Done (12–15 Oct): largest page is now Home at ~550 lines; admin, profile, Urban Pay, listing form and login are split by feature. |
| CQ-2 | One client module does everything | Done (12 Oct): `api/firebase/{auth,entities,services,listingSearch}.js`. |
| CQ-3 | Inconsistent data model | Partly done: `lib/listings.js` holds status constants and the naming convention (snake_case for listings/payments/users, camelCase for Urban Pay documents shared with the mobile app). Renaming stored fields was not done: it needs a data migration and a mobile app release. |
| CQ-4 | Errors rewrapped as plain text | Done: `AppError { code, message, cause }` with `toAppError()` mapping Firebase codes to friendly text; raw Firebase messages no longer reach users. |
| CQ-5 | Tests mostly exercise mocks | Done for the highest-risk layers: 22 Firestore and 4 Storage rules tests on the emulator, API helper tests, functions helper tests, axe accessibility tests; all in CI. Integration and end-to-end tests need the staging project (below). |
| CQ-6 | Stripe client set up 6 times | Done: `api/_shared/stripe.js`. |
| CQ-7 | Hard-coded API URLs in Flutter | Done: `--dart-define=API_BASE_URL` (`lib/config/api_config.dart`). |
| CQ-8 | No static typing | Done for the service layer: `tsconfig.check.json` type-checks `src/api`, `src/lib` and the form helpers with `checkJs`; `npm run typecheck` runs in CI. |
| CQ-9 | Errors only logged to console | Done (9 Oct): ErrorBoundary and API report to Error Reporting. |

## Dependencies and compliance

| ID | Issue | Status |
|---|---|---|
| Dependabot | No automated updates | Done: `.github/dependabot.yml`, weekly grouped updates for npm (3 packages), pub and Actions. |
| Stripe SDK | Functions on v13, API on v14 | Done: both on Stripe SDK 14. A move to the current major (new API version) should be planned and tested in staging. |
| CMP-2 | Photos and drafts kept indefinitely | Done: `cleanupExpiredDrafts` deletes drafts after 2 days with their photos; `deleteUser` deletes the user's photos and contact messages; deleting a listing deletes its photos. |
| CMP-3 | Unlabelled inputs, no a11y tests | Done: all form controls labelled (the address field ignored its `id`, now fixed); axe-core tests in CI. |
| CMP-4 | `lang="en"` | Done: `lang="en-AU"`. |
| CMP-5 | No refund flow; no ABN | Done: rejecting a listing calls `rejectListing`, which refunds the Stripe fee (idempotent) and records it; Terms updated. ABN shows in footer and Terms when `VITE_BUSINESS_ABN` is set. **Owner:** set the ABN if registered. |

## Production readiness

| Area | Status |
|---|---|
| Environments (DEV-1) | **Owner:** create the staging Firebase project and Stripe test keys (DEPLOYMENT.md → Staging). CI and the deploy workflow already support a `staging` target. |
| CI/CD (DEV-2) | Done in code: `.github/workflows/deploy.yml` deploys only after all tests pass, in a safe order. **Owner:** add environment secrets and protect `main` (DEPLOYMENT.md → Deploying from CI). |
| Rollback | Done: documented for website, API, rules, functions and data. |
| Email | **Owner:** renew SendGrid and verify the sender domain. |
| Only admin locked out | Done: `scripts/sync-admin-claims.mjs --reset-2fa / --grant` recovery procedure. **Owner:** add a second admin account. |
| SMS toll fraud | **Owner:** add a billing budget alert. |

## Note on SEC-8

The repository is public. The full-history scan found, among the 27 findings, a **private key**
in `.env` at commit `c8298126` (March 2026) as well as Stripe and SendGrid keys. Rotation
documents show keys were rotated in June 2026. Confirmed 16 Oct 2026: that private key
(`firebase-adminsdk-fbsvc`, key ID `d4c97a0c…`) no longer exists in IAM. The account has three
active keys (`c80da7df…`, `ef122b11…`, `e4bcd32b…`); only the one the API uses should remain.
The Stripe and SendGrid dashboards should also show the old keys as deleted. Rewriting git history doesn't
remove copies others may already have, so revocation is what matters.

## Follow-up review (29 Oct 2026)

Security, third-party setup, links and buttons, code quality and Australian requirements were
reviewed again. Every page was loaded logged out at desktop and phone widths (Edge, local build).

| Area | Finding | Status |
|---|---|---|
| Payments | `createPaymentIntent` accepted any `garageSaleId`, so a card could be charged for another seller's sale and the sale then refused by `recordTapToPaySale` | Done: ownership checked before the PaymentIntent is created |
| Payments | Stripe OAuth state read and deleted separately; debug logs included part of the OAuth URL | Done: state consumed in one transaction; logs removed; `code` validated |
| Dependencies | `body-parser` (high) and `qs` (moderate) advisories | Done: `npm audit fix` in root and functions. Remaining: `deepmerge` inside `@sendgrid/mail` (no fix released; only server-built emails pass through it) |
| Links | Poster QR codes opened `/?page=ListingDetails&id=…`, which nothing handled (landed on Home) | Done: QR opens `/ListingDetails?id=…`; old address forwarded |
| Links | `PaymentSuccess` / `PaymentCancelled` pages unused (Stripe returns to `/Payment` and `/CreateListing`) and showed "Payment Received!" to anyone | Done: removed |
| Buttons | Admin approve / reject / delete / view used `onMouseDown`, so keyboard users could not use them | Done: `onClick` |
| Buttons | Favourites toast could say "Saved" after removing (state read before it updated); logic copied in Home and ListingDetails | Done: `lib/useToggleSaved.js`, with tests |
| Content | About, Contact, Privacy and Terms read promotions in the wrong shape, so admin promotions never showed there | Done: `lib/usePromotions.js` shared by all pages |
| Tidy | Debug logging in SavedListings; "favorite" spelling | Done |
| Mobile app | Card reader / Tap to Pay native code (`StripeTerminalManager.kt`, `StripeTerminalPlugin.swift`) is never registered, so those screens fail with MissingPluginException. The Android connection-token call also runs on the main thread | **Open:** needs a mobile developer with a test device. Payment Sheet and cash sales are unaffected |
| Mobile app | Android `applicationId` is `com.example.urbangarageSale` and release builds are signed with debug keys | **Open:** both must change before a Play Store release |
| Storage | Any signed-in user can upload photos (10 MB each, no count limit) without 2FA | **Open (low):** consider requiring the 2FA claim in `storage.rules`, as listing creation does |
| Not run locally | Rules tests (need Java) and `flutter analyze` (local Flutter is older than the app needs) | Run in CI / after upgrading Flutter |
