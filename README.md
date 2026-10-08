# Urban Garage Sale

Australian garage sale listings platform with **Urban Pay** (cash and card sales for sellers).
Live at **https://www.urbangaragesales.com.au**.

## Project structure

| Folder | What it is | Deployed to |
|---|---|---|
| `web-app/` | React + Vite website | Vercel project `web-app` |
| `web-app/functions/` | Firebase Cloud Functions (listing fee checkout, Stripe webhook, admin emails, user deletion) | Firebase |
| `api/` | Serverless API for Urban Pay, Stripe Connect and 2FA (`api/_shared/` holds shared helpers) | Vercel project `urban-garage-sale` |
| `public/` | Holding page for the API domain | Vercel project `urban-garage-sale` |
| `lib/`, `android/`, `ios/`, … | Flutter mobile app (Urban Pay, Tap to Pay) | App stores |
| `firestore.rules`, `storage.rules` | Database and file storage security rules | Firebase |
| `scripts/` | Admin maintenance scripts (run locally) | — |
| `docs/` | Deployment guide and process documents | — |

## Local development

Requirements: Node.js 22+, npm.

```bash
npm install
cd web-app && npm install && cd ..
cp .env.example .env                    # API settings
cp web-app/.env.example web-app/.env.local   # website settings
npm run dev                             # API on :3000 and website on :5173
```

Set `VITE_API_BASE_URL=http://localhost:3000` in `web-app/.env.local` to use the local API.
SMS sign-in in development needs Firebase test phone numbers
(Firebase console → Authentication → Sign-in method → Phone).

## Checks

```bash
cd web-app
npm run lint    # ESLint
npm test        # Jest
npm run build   # production build (debug logging is stripped automatically)
```

## Security model (summary)

- **Firestore rules** are the main access control: users can't change their role, 2FA flag,
  Stripe status or payment status; sales and stats are written only by the server; the public
  can read only active listings.
- **Two-factor authentication** uses Firebase multi-factor auth (SMS). Creating listings,
  Urban Pay and all admin actions require a session that passed the SMS step; the API and the
  rules both check this.
- **Payments**: listing fees are confirmed server-side with Stripe (plus a signed webhook);
  card sales are recorded only after Stripe confirms them and go to the seller's own Stripe
  account.
- **Secrets** are never stored in the repo: Vercel environment variables for the API,
  Google Secret Manager for Cloud Functions. `.env*` files are git-ignored.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for how to deploy each part and where every
setting lives.
