# Deployment guide

Everything below runs from the project root unless stated. Log in once with
`npx firebase-tools login` and `npx vercel login`.

Preferred: deploy from CI (see [Deploying from CI](#deploying-from-ci)), which runs every test
first. The manual steps below are the same steps, for emergencies and first-time setup.

Deploy in this order, so new code never runs against old rules or missing functions:
**4. rules and indexes → 3. Cloud Functions → 2. API → 1. website.**

## 1. Website (Vercel project `web-app`)

```bash
cd web-app
npm run lint && npm run typecheck && npm test
npx vercel deploy --prod
```

Production settings come from Vercel (Project → Settings → Environment Variables), which
override `web-app/.env.production` at build time:

| Variable | Notes |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web key (public). |
| `VITE_GOOGLE_PLACES_API_KEY` | Maps/Places browser key (public). Restrict it to your domains in Google Cloud. |
| `VITE_APPCHECK_SITE_KEY` | reCAPTCHA Enterprise site key for App Check (public). |
| `VITE_BUSINESS_ABN` | Optional. Shown in the footer and Terms when set. |
| other `VITE_FIREBASE_*`, `VITE_API_BASE_URL` | From `web-app/.env.production` — see `web-app/.env.example` |

## 2. API (Vercel project `urban-garage-sale`)

```bash
npm test
npx vercel deploy --prod
```

Vercel's Hobby plan allows at most **12 functions** and is licensed for non-commercial use only;
the site takes payments, so both projects must be on **Pro** (audit CMP-1). Every file in `api/`
(outside `_shared/`) counts as a function, so put shared code in `api/_shared/`.

| Variable (Production) | Type |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Secret — key of the least-privilege `urban-pay-api` service account (see [Service accounts](#service-accounts)) |
| `STRIPE_SECRET_KEY` | Secret — live Stripe secret key |
| `STRIPE_CLIENT_ID` | Stripe Connect OAuth client ID (`ca_…`), needed for "link existing Stripe account" |
| `ALLOWED_ORIGINS` | `https://urbangaragesales.com.au,https://www.urbangaragesales.com.au` |
| `FRONTEND_URL`, `APP_URL` | `https://urbangaragesales.com.au` |
| `APP_CHECK_ENFORCE` | `true` once App Check is enforced (see [App Check](#app-check)) |
| `NODE_ENV` | `production` |

Changing a variable takes effect only after the next deploy.

## 3. Cloud Functions (Firebase, 2nd gen, `australia-southeast1`)

```bash
cd web-app/functions && npm ci && npm test && cd ..
npx firebase-tools deploy --only functions --project urbangaragesale
```

- Functions run in Sydney (`australia-southeast1`), next to the database in Melbourne. The
  website calls them there (`FUNCTIONS_REGION` in `web-app/src/api/firebase/app.js`).
- Non-secret settings: `web-app/functions/.env` (`APP_URL`, `SENDGRID_FROM_EMAIL`,
  optionally `ENFORCE_APP_CHECK=true`) — see `web-app/functions/.env.example`.
- Secrets live in Google Secret Manager. To change one, run the command, **wait for the
  prompt**, then paste the value once:

  ```bash
  npx firebase-tools functions:secrets:set STRIPE_SECRET_KEY --project urbangaragesale
  npx firebase-tools functions:secrets:set STRIPE_WEBHOOK_SECRET --project urbangaragesale
  npx firebase-tools functions:secrets:set SENDGRID_API_KEY --project urbangaragesale
  ```

  Redeploy the functions afterwards.
- Stripe webhook endpoint:
  `https://australia-southeast1-urbangaragesale.cloudfunctions.net/stripeWebhook`
  (events `checkout.session.completed`, `checkout.session.async_payment_succeeded`).
- Scheduled jobs (Melbourne time): `healthCheck` every 10 minutes, `expireListings` 00:15,
  `cleanupExpiredDrafts` 01:00.

### One-time move from 1st gen `us-central1` (October 2026)

Firebase can't convert a function in place, so the new functions are created alongside the old
ones and the old ones are deleted last:

1. Deploy rules (section 4) — admins need the `admin` claim first (see below).
2. `npx firebase-tools deploy --only functions --project urbangaragesale` — answer **No** when
   asked to delete the `us-central1` functions, so the live website keeps working.
3. In Stripe (Developers → Webhooks), change the endpoint URL to the one above and copy its
   signing secret into `STRIPE_WEBHOOK_SECRET` if it changed (then redeploy functions).
4. Deploy the API (section 2) and the website (section 1); both now point at the new region.
5. Delete the old functions:
   `npx firebase-tools functions:delete createStripeCheckout verifyStripePayment stripeWebhook sendApprovalEmail sendContactResponseEmail deleteUser reportClientError healthCheck expireListings adminTopPostcodes --region us-central1 --project urbangaragesale`

## 4. Security rules and indexes (Firebase)

```bash
cd tests/rules && npm ci && npm test && cd ../..     # needs Java 21
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage --project urbangaragesale
```

Radius search needs the `garageSales` (status, geohash) index in `firestore.indexes.json`; a new
index takes a few minutes to build after deploying. Deploy indexes before the web app and
functions that use them.

**Admin access is a custom claim.** `isAdmin()` in the rules checks the `admin` claim (set only
server-side) plus a 2FA session. Before deploying rules that use it for the first time, give
existing admins the claim, then have them sign out and in again:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/sync-admin-claims.mjs          # dry run
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/sync-admin-claims.mjs --apply
```

After that, change roles from the admin dashboard (Users → Change role); it calls
`setUserRole`, which sets the claim and writes `auditLog`.

## 5. Firebase Authentication settings

- Identity Platform enabled, **SMS multi-factor authentication** on.
- SMS region policy: allow **Australia** only.
- Authorized domains include `urbangaragesales.com.au` and `www.urbangaragesales.com.au`.
- Password policy (12+ characters with a number) and **email enumeration protection**: apply
  with `scripts/set-auth-settings.mjs --apply` (see Admin scripts).

## Deploying from CI

`.github/workflows/deploy.yml` (Actions → Deploy → Run workflow) runs the whole test suite
(lint, typecheck, unit, accessibility, API, functions and security-rules tests), then deploys
rules → functions → API → website in that order.

One-time setup in GitHub (Settings → Environments), for `staging` and `production`:

- **Secrets:** `VERCEL_TOKEN`, `VERCEL_ORG_ID` (`team_zTdwXRmdLmyXkpeIFlfKp9Ft`),
  `VERCEL_WEB_PROJECT_ID`, `VERCEL_API_PROJECT_ID`, `FIREBASE_DEPLOY_SA_KEY`.
- **Variables:** `FIREBASE_PROJECT`, `APP_URL`, `SENDGRID_FROM_EMAIL`.
- On `production`, add yourself as a **required reviewer** so every production deploy is approved.
- Protect `main` (Settings → Branches): require a pull request and the "Test Suite" and
  "Security Scan" checks to pass.

## Staging

A separate Firebase project, **`urbangaragesale-staging`** (set up October 2026), with Stripe
**test** keys, so tests never touch live payments or real users' data. The Vercel **Preview**
deployments of `urban-garage-sale` are the staging API.

| Part | Staging setup |
|---|---|
| Firebase | Blaze; Firestore `australia-southeast2`; Auth like production (email/password, SMS MFA, 12+ character password policy, enumeration protection); Storage. Same rules and indexes: `npx firebase-tools deploy --only firestore,storage --project urbangaragesale-staging`. |
| Cloud Functions | `npx firebase-tools deploy --only functions --project urbangaragesale-staging` (from `web-app`). `web-app/functions/.env.urbangaragesale-staging` overrides `.env`. Secrets: `STRIPE_SECRET_KEY` = Stripe **test** secret key; `SENDGRID_API_KEY` and `STRIPE_WEBHOOK_SECRET` = `not-configured` until needed. |
| API (Vercel Preview env) | `FIREBASE_PROJECT_ID=urbangaragesale-staging`; `FIREBASE_SERVICE_ACCOUNT_JSON` = key of `urban-pay-api@urbangaragesale-staging` (`datastore.user`, `firebaseauth.admin`); `STRIPE_SECRET_KEY` = test key; `FRONTEND_URL`, `APP_URL`, `ALLOWED_ORIGINS` = `http://localhost:5173`. |
| Vercel Authentication | Stays on for previews. Test builds of the mobile app send a *Protection Bypass for Automation* secret (Project → Settings → Deployment Protection) via `--dart-define=VERCEL_PROTECTION_BYPASS=…`. |
| Website (local) | `cd web-app && npm run dev:staging`, then open http://localhost:5173. Settings are in `web-app/.env.staging`; put `VERCEL_PROTECTION_BYPASS=…` in `web-app/.env.staging.local` (not committed). The dev server forwards `/api` to `STAGING_API_URL` and adds the bypass, so the secret never reaches the browser. For the SMS step use the test number **0491 570 156**, code **123456** (Auth → Phone numbers for testing). |
| Mobile app | `--dart-define=FIREBASE_ENV=staging` plus a `pk_test_` key and the preview `API_BASE_URL`; the app refuses to start with staging Firebase and live Stripe or the live API. See `docs/TAP_TO_PAY_SETUP.md`. |

Run the checks in `docs/TEST_PLAN.md` against staging before deploying to production.

## Rollback

| Part | How to roll back |
|---|---|
| Website, API | Vercel → project → Deployments → previous deployment → **Promote to Production** (instant). |
| Firestore / Storage rules | `git checkout <good-commit> -- firestore.rules storage.rules`, then deploy rules (section 4). The Firebase console (Firestore → Rules) also keeps rule history. |
| Cloud Functions | `git checkout <good-commit> -- web-app/functions`, then deploy functions (section 3). |
| Data | Point-in-time recovery (7 days) or a daily backup (14 days): Firebase console → Firestore → Disaster recovery, or `npx firebase-tools firestore:databases:restore`. Restore into a **new** database first and check it before switching. |

Test a restore every quarter into a scratch database.

## Backups and monitoring

- Firestore: point-in-time recovery (7 days), daily backups kept 14 days, delete protection.
- Errors from the website, the API and Cloud Functions go to Google Cloud **Error Reporting**
  (through the `reportClientError` function). Turn on its email notifications in the Google
  Cloud console.
- `healthCheck` runs every 10 minutes and reports an error if the website or API is down.
- Billing: create a budget alert (Google Cloud → Billing → Budgets & alerts), e.g. A$50/month
  with emails at 50%, 90% and 100%, so SMS toll fraud or a runaway query is noticed early.

## App Check

The website sends App Check tokens (reCAPTCHA Enterprise) once `VITE_APPCHECK_SITE_KEY` is set.
To enforce:

1. Watch Firebase console → App Check → Metrics for a week; verified requests should be ~100%
   for the web app.
2. Enforce for Firestore and Storage in the console (App Check → APIs).
3. Set `ENFORCE_APP_CHECK=true` in `web-app/functions/.env` and redeploy functions.
4. Set `APP_CHECK_ENFORCE=true` on the API **only after** the mobile app sends App Check tokens.

## Service accounts

The API should not use the all-powerful `firebase-adminsdk` account. Create a least-privilege
one and rotate its key every 90 days:

```bash
gcloud iam service-accounts create urban-pay-api --project urbangaragesale
# Firestore read/write, and Auth (verify sessions, set the 2FA claim). Nothing else.
for role in roles/datastore.user roles/firebaseauth.admin; do
  gcloud projects add-iam-policy-binding urbangaragesale \
    --member serviceAccount:urban-pay-api@urbangaragesale.iam.gserviceaccount.com --role $role
done
gcloud iam service-accounts keys create /secure/place/urban-pay-api.json \
  --iam-account urban-pay-api@urbangaragesale.iam.gserviceaccount.com
```

App Check tokens are verified with Google's public keys, so no role is needed for them. Store the key in Vercel with
`vercel env add FIREBASE_SERVICE_ACCOUNT_JSON production --sensitive` (paste at the prompt),
redeploy the API, check it works, then delete the old key in IAM and every local copy.

## Admin scripts

Run with a service account key stored **outside** the project folder:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/sync-2fa-claims.mjs          # dry run
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/sync-2fa-claims.mjs --apply
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/sync-admin-claims.mjs --apply
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/set-auth-settings.mjs          # show settings
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/set-auth-settings.mjs --apply  # apply them
```

### If the only admin is locked out (lost phone)

1. Remove the lost phone: `node scripts/sync-admin-claims.mjs --apply --reset-2fa you@example.com`
2. Sign in with your password, verify your email if asked, and enrol the new mobile number on
   the Profile page.
3. If the account had lost admin access: `node scripts/sync-admin-claims.mjs --apply --grant you@example.com`,
   then sign out and in again.

Keep a **second admin account** (a different person or phone) so this is rarely needed.

`scripts/cleanup-past-listings.js` and `scripts/cleanup-orphaned-saved-listings.js` read the
same credentials from `.env` (`FIREBASE_SERVICE_ACCOUNT_JSON`).

## Mobile app (Flutter)

Build with your publishable key (and, for a non-production API, its address):
`flutter build appbundle --dart-define=STRIPE_PUBLISHABLE_KEY=pk_live_… [--dart-define=API_BASE_URL=https://…/api]`
(Android) or `flutter build ipa --dart-define=…` (iOS). Needs Flutter 3.44 or later. Tap to Pay setup, testing and the iPhone entitlement:
`docs/TAP_TO_PAY_SETUP.md`.

Process documents in this folder (testing strategy, risk assessment, compliance checklist and
so on) predate the October 2026 security changes; check details against this guide.
