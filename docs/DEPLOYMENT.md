# Deployment guide

Everything below runs from the project root unless stated. Log in once with
`npx firebase-tools login` and `npx vercel login`.

## 1. Website (Vercel project `web-app`)

```bash
cd web-app
npm run lint && npm test
npx vercel deploy --prod
```

Production settings come from Vercel (Project → Settings → Environment Variables), which
override `web-app/.env.production` at build time:

| Variable | Notes |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web key (public). Also used for Google geocoding. |
| `VITE_GOOGLE_PLACES_API_KEY` | Maps/Places browser key (public). Restrict it to your domains in Google Cloud. |
| other `VITE_FIREBASE_*`, `VITE_API_BASE_URL` | From `web-app/.env.production` — see `web-app/.env.example` |

## 2. API (Vercel project `urban-garage-sale`)

```bash
npx vercel deploy --prod
```

Vercel's Hobby plan allows at most **12 functions**. Every file in `api/` (outside `_shared/`)
counts, so put shared code in `api/_shared/`.

| Variable (Production) | Type |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Secret — Firebase Admin service account JSON |
| `STRIPE_SECRET_KEY` | Secret — live Stripe secret key |
| `STRIPE_CLIENT_ID` | Stripe Connect OAuth client ID (`ca_…`), needed for "link existing Stripe account" |
| `ALLOWED_ORIGINS` | `https://urbangaragesales.com.au,https://www.urbangaragesales.com.au` |
| `FRONTEND_URL`, `APP_URL` | `https://urbangaragesales.com.au` |
| `NODE_ENV` | `production` |

Changing a variable takes effect only after the next deploy.

## 3. Cloud Functions (Firebase)

```bash
cd web-app
npx firebase-tools deploy --only functions --project urbangaragesale
```

- Non-secret settings: `web-app/functions/.env` (`APP_URL`, `SENDGRID_FROM_EMAIL`) — see
  `web-app/functions/.env.example`.
- Secrets live in Google Secret Manager. To change one, run the command, **wait for the
  prompt**, then paste the value once:

  ```bash
  npx firebase-tools functions:secrets:set STRIPE_SECRET_KEY --project urbangaragesale
  npx firebase-tools functions:secrets:set STRIPE_WEBHOOK_SECRET --project urbangaragesale
  npx firebase-tools functions:secrets:set SENDGRID_API_KEY --project urbangaragesale
  ```

  Redeploy the functions afterwards.
- Stripe webhook endpoint: `https://us-central1-urbangaragesale.cloudfunctions.net/stripeWebhook`
  (events `checkout.session.completed`, `checkout.session.async_payment_succeeded`).

## 4. Security rules and indexes (Firebase)

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage --project urbangaragesale
```

Radius search needs the `garageSales` (status, geohash) index in `firestore.indexes.json`; a new
index takes a few minutes to build after deploying. The admin dashboard's totals (Firestore
count/sum aggregations) and the `expireListings` job need the other indexes in that file, so
deploy indexes before the web app and functions that use them.

Rules require admins to have 2FA enabled — make sure every admin has enrolled before
deploying rule changes.

## 5. Firebase Authentication settings (console)

- Identity Platform enabled, **SMS multi-factor authentication** on.
- SMS region policy: allow **Australia** only.
- Authorized domains include `urbangaragesales.com.au` and `www.urbangaragesales.com.au`.

## Backups and monitoring

- Firestore: point-in-time recovery (7 days), daily backups kept 14 days, delete protection.
  Restore from the Firebase console (Firestore → Disaster recovery) or
  `npx firebase-tools firestore:databases:restore`.
- Errors from the website, the API and Cloud Functions go to Google Cloud **Error Reporting**
  (through the `reportClientError` function). Turn on its email notifications in the Google
  Cloud console.
- `healthCheck` runs every 10 minutes and reports an error if the website or API is down.
- `expireListings` runs daily at 00:15 (Melbourne) and marks listings whose end date has passed
  as completed, so they leave public search and the admin dashboard's active counts.

## Admin scripts

Run with a service account key stored **outside** the project folder:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/sync-2fa-claims.mjs          # dry run
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/sync-2fa-claims.mjs --apply
```

`scripts/cleanup-past-listings.js` and `scripts/cleanup-orphaned-saved-listings.js` read the
same credentials from `.env` (`FIREBASE_SERVICE_ACCOUNT_JSON`).

## Mobile app (Flutter)

Build with your publishable key:
`flutter build appbundle --dart-define=STRIPE_PUBLISHABLE_KEY=pk_live_…` (Android) or
`flutter build ipa --dart-define=…` (iOS). See `docs/TAP_TO_PAY_SETUP.md` and
`docs/STRIPE_TERMINAL_SETUP.md`.

Process documents in this folder (testing strategy, risk assessment, compliance checklist and
so on) predate the October 2026 security changes; check details against this guide.
