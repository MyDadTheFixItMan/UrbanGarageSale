# UrbanGarageSale - Getting Started for Live Testing

## Quick Start (5 minutes)

### 1. Get Stripe API Keys

1. Go to https://stripe.com and sign up (free account)
2. Go to Developers > API Keys
3. Copy your test keys:
   - **Publishable Key** (starts with `pk_test_`)
   - **Secret Key** (starts with `sk_test_`)

### 2. Configure Environment Variables

**In the root directory, edit `.env`:**
```bash
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

**In `web-app/.env.local`:**
```bash
VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_KEY_HERE
VITE_API_BASE_URL=http://localhost:3000
```

### 3. Install Dependencies

```bash
npm install
cd web-app && npm install && cd ..
```

### 4. Start the Services

**Terminal 1 (API Server):**
```bash
npm run dev:api
```
Expected output: `🚀 UrbanGarageSale API Server running at http://localhost:3000`

**Terminal 2 (Web App):**
```bash
npm run dev:web
```
Expected output: `VITE v... ready in ... ms`

### 5. Test Payment Flow

1. Open http://localhost:5173
2. Log in with test account
3. Create a new listing
4. Submit for payment
5. Enter Stripe test card: `4242 4242 4242 4242`
6. Any future expiry date, any CVC
7. Click "Pay"
8. You should see payment success message
9. Go to Admin Dashboard > Payments to see the payment record

## Stripe Test Cards

| Card | Behavior |
|------|----------|
| 4242 4242 4242 4242 | ✅ Successful payment |
| 4000 0000 0000 0002 | ❌ Card declined |
| 4000 0025 0000 3155 | ⚠️ Requires authentication |
| 3782 822463 10005 | ✅ American Express test |

**For all test cards:**
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)
- Cardholder: Any name

## Architecture

```
┌─────────────────────────────────────┐
│    Browser (React Web App)          │
│  - Address Autocomplete             │
│  - Photo Upload                     │
│  - Payment Flow                     │
└────────────────┬────────────────────┘
                 │ HTTP/API calls
                 ↓
┌─────────────────────────────────────┐
│    API Server (Node.js)             │
│  - /createStripeCheckout            │
│  - /verifyStripePayment             │
│  - Stripe integration               │
└────────────────┬────────────────────┘
                 │ REST API
                 ↓
          ┌──────────────┐
          │   Stripe     │
          │   (Live)     │
          └──────────────┘
```

## Payment Flow Diagram

```
User Creates Listing
  ↓
Submits for Payment
  ↓
Browser calls: POST /createStripeCheckout
  ↓
API creates Stripe session
  ↓
User redirected to Stripe Checkout
  ↓
User pays with test card
  ↓
Stripe redirects back with session_id
  ↓
Browser calls: POST /verifyStripePayment
  ↓
API verifies with Stripe
  ↓
Payment record created
  ↓
Listing status → "active" with "paid"
```

## Troubleshooting

### API Server won't start
```
Error: connect ECONNREFUSED
```
- Port 3000 is already in use
- Solution: `lsof -i :3000` then kill the process, or change PORT in .env

### "Failed to create checkout session"
- Missing STRIPE_SECRET_KEY in .env
- Stripe key is invalid/expired
- Solution: Verify key is correct in https://dashboard.stripe.com/apikeys

### Payment page shows blank/error
- VITE_API_BASE_URL is wrong
- API server is not running
- Solution: Check both servers are running and URLs are correct

### CORS errors in browser console
- API server CORS not configured correctly
- Solution: Check API server is responding to http://localhost:3000

## Admin Testing

After a payment is made:

1. Log in as admin
2. Go to Admin Dashboard
3. **All Listings**: See pending_approval status
4. **Pending Admin Approval**: Approve or reject the listing
5. **Payments**: See payment history with date, amount, user

## File Structure

```
urbangarageSale/
├── API/
│   ├── server.js                 ← Local API server
│   ├── createStripeCheckout.ts   ← Deno edge function
│   └── verifyStripePayment.ts    ← Deno edge function
├── web-app/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── CreateListing.jsx → Submit payment
│   │   │   ├── Payment.jsx       → Verify payment
│   │   │   └── AdminDashboard.jsx → View payments
│   │   └── api/
│   │       └── firebaseClient.js   → API calls
│   └── .env.local                ← Stripe Public Key
├── .env                          ← Stripe Secret Key
├── .env.example                  ← Template
├── LIVE_TESTING_SETUP.md         ← Full setup guide
└── SETUP.bat                     ← Windows setup script
```

## Production Deployment

When ready to go live:

1. **Get live Stripe keys** (pk_live_, sk_live_)
2. **Update environment variables** in production
3. **Deploy API server** to:
   - Deno Deploy (recommended)
   - Vercel Edge Functions
   - AWS Lambda
   - Heroku
4. **Update VITE_API_BASE_URL** to production URL
5. **Enable HTTPS** (required by Stripe)
6. **Set up webhooks** for Stripe notifications

### Google API Key Hardening (Required)

- Use a dedicated browser key for `VITE_GOOGLE_PLACES_API_KEY`
- Set **Application restrictions** to `HTTP referrers (web sites)`
- Allow only required referrers:
  - `https://www.urbangaragesale.com.au/*`
  - `https://urbangaragesale.com.au/*`
  - `https://web-app-pied-eta.vercel.app/*`
  - `https://*.vercel.app/*` (only if preview deployments need Maps)
  - `http://localhost:5173/*` (development only)
- Set **API restrictions** to only:
  - `Maps JavaScript API`
  - `Places API`
  - `Geocoding API`
- Do not use unrestricted browser keys in production
- Rotate and delete old Google keys after cutover
- Store keys in deployment environment variables, not committed files
- Keep server-only Google keys separate; use IP allowlist only when static egress IPs exist

## Support & Next Steps

- For Stripe issues: https://support.stripe.com
- For UrbanGarageSale issues: Check LIVE_TESTING_SETUP.md
- For payment verification: Check Admin Dashboard
- For listing issues: Check browser console logs

Happy testing! 🎉
