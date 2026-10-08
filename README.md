# UrbanGarageSale - Garage Sale Finder Platform

Live testing setup complete! This guide will get you up and running with real Stripe payment processing.

## 🚀 Quick Start (2 minutes)

### 1. Get Your Stripe Keys
- Go to https://stripe.com and sign up
- Navigate to Developers > API Keys
- Copy your **test mode** keys (pk_test_..., sk_test_...)

### 2. Configure
Edit `.env`:
```bash
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

Edit `web-app/.env.local`:
```bash
VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_KEY_HERE
VITE_API_BASE_URL=http://localhost:3000
```

### 3. Run (Two Terminals)

**Terminal 1:**
```bash
npm run dev:api
```
Expect: `🚀 UrbanGarageSale API Server running at http://localhost:3000`

**Terminal 2:**
```bash
npm run dev:web
```
Expect: `VITE ... ready in ... ms` and link to http://localhost:5175

### 4. Test
1. Open http://localhost:5175
2. Sign in
3. Create a listing
4. Submit for payment
5. Use card: **4242 4242 4242 4242** (Stripe test card)
6. Check Admin Dashboard > Payments for the transaction

## 📚 Documentation

- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Quick start guide with troubleshooting
- **[LIVE_TESTING_SETUP.md](LIVE_TESTING_SETUP.md)** - Comprehensive setup guide
- **[LIVE_TESTING_CHANGES.md](LIVE_TESTING_CHANGES.md)** - What changed in this version

## 🏗️ Architecture

```
Web App (React)          API Server (Node.js)        Stripe
├─ Create Listing   →    ├─ createStripeCheckout  →  Checkout Session
├─ Submit Payment   →    ├─ verifyStripePayment   →  Verify Payment
└─ View Payments   ←     └─ Payment Records       ←
```

## 🛠️ What's Included

✅ **Frontend:**
- Address autocomplete (Google Places)
- Photo upload
- Draft listing save
- Payment checkout
- Admin dashboard with payment history
- Payment filtering by date/suburb/state

✅ **Backend:**
- Node.js API server with Express
- Stripe Checkout Session creation
- Payment verification
- Payment record storage

✅ **Testing:**
- Stripe test mode with test cards
- Mock Stripe cards for development
- Full payment flow validation
- Admin payment dashboard

## 📋 System Requirements

- Node.js 16+ 
- npm 8+
- Stripe account (free)
- Google Places API key
- Two terminal windows

## 🔑 Environment Variables

### Root `.env` (Backend)
```
STRIPE_SECRET_KEY=sk_test_...    # Required
URBANGARAGESALE_APP_ID=optional-id
PORT=3000
NODE_ENV=development
```

### `web-app/.env.local` (Frontend)
```
VITE_GOOGLE_PLACES_API_KEY=...   # Required
VITE_STRIPE_PUBLIC_KEY=pk_test_...  # Required
VITE_API_BASE_URL=http://localhost:3000  # Required for local testing
```

## 🧪 Stripe Test Cards

| Card | Expected Result |
|------|-----------------|
| 4242 4242 4242 4242 | ✅ Success (use this!) |
| 4000 0000 0000 0002 | ❌ Declined |
| 4000 0025 0000 3155 | ⚠️ 3D Secure |

All cards: Any future expiry, any 3-digit CVC

## 📊 Admin Dashboard

After a payment:
1. Go to http://localhost:5175/admin
2. **All Listings** - View pending approval
3. **Pending Approval** - Approve/reject
4. **Payments** - See payment history with:
   - User name and email
   - Payment amount and date/time
   - Location (suburb, state)
   - Transaction ID
   - Filters by date, suburb, state

## 🚨 Troubleshooting

### "Failed to create checkout session"
- Check STRIPE_SECRET_KEY is in `.env`
- Verify the key starts with `sk_test_`
- Check API server is running on port 3000

### API won't start
- Port 3000 in use: Kill the process or change PORT in `.env`
- Missing dependencies: Run `npm install`
- Node/npm not found: Install Node.js

### Payment page blank/errors
- Check VITE_API_BASE_URL in `web-app/.env.local`
- Both servers must be running
- Clear browser cache

Full troubleshooting: See [GETTING_STARTED.md](GETTING_STARTED.md#troubleshooting)

## 📦 Project Structure

```
urbangarageSale/
├── API/
│   ├── server.js                 ← Local development server
│   ├── createStripeCheckout.ts   ← Deno edge function
│   └── verifyStripePayment.ts    ← Deno edge function
├── web-app/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── CreateListing.jsx
│   │   │   ├── Payment.jsx
│   │   │   └── AdminDashboard.jsx
│   │   ├── api/
│   │   │   └── firebaseClient.js   ← Real API integration
│   │   ├── components/
│   │   └── lib/
│   └── .env.local
├── .env                          ← Backend config
├── .env.example                  ← Template
├── package.json                  ← Root dependencies
├── GETTING_STARTED.md            ← Quick reference
├── LIVE_TESTING_SETUP.md         ← Full guide
└── validate.js                   ← Setup validator
```

## ✨ Key Features

**For Users:**
- Secure Stripe payment processing
- Automatic address validation
- Photo upload for listings
- Draft saving
- Payment history

**For Admins:**
- Listing approval workflow
- Payment dashboard with filters
- Suburb/state analytics
- Date-based filtering
- Delete listings

## 🔒 Security Notes

- All test keys start with `pk_test_` and `sk_test_`
- Secret key only on backend (never in frontend)
- Payments verified with Stripe servers
- HTTPS required for production

### Google API Key Hardening Checklist

- Use a dedicated browser key for `VITE_GOOGLE_PLACES_API_KEY`
- Set **Application restrictions** to `HTTP referrers (web sites)`
- Allow only required referrers:
   - `https://www.urbangaragesale.com.au/*`
   - `https://urbangaragesale.com.au/*`
   - `https://web-app-pied-eta.vercel.app/*`
   - `https://*.vercel.app/*` (only if preview builds need Google Maps)
   - `http://localhost:5173/*` (dev only)
- Set **API restrictions** to only:
   - `Maps JavaScript API`
   - `Places API`
   - `Geocoding API`
- Do not use unrestricted browser keys in production
- Rotate and delete older Google keys after cutover
- Store keys in deployment environment variables, not committed files
- Keep server-only Google keys separate; use IP allowlist only when static egress IPs exist

## 🚀 Production Deployment

Ready to go live? See [LIVE_TESTING_SETUP.md](LIVE_TESTING_SETUP.md#production-checklist)

Key steps:
1. Get live Stripe keys (pk_live_, sk_live_)
2. Deploy API server (Deno Deploy recommended)
3. Update environment variables
4. Enable HTTPS
5. Set up Stripe webhooks

## 📞 Support

- **Stripe Issues**: https://support.stripe.com
- **Setup Help**: Check GETTING_STARTED.md
- **API Logs**: Terminal running `npm run dev:api`
- **Browser Console**: F12 in browser

## ✅ Validation

Run setup validator:
```bash
node validate.js
```

All checks should pass ✅

## 📝 Version Info

- **UrbanGarageSale Version**: 1.0.0
- **Node.js**: 16+
- **Stripe API**: v14.0.0
- **React**: 18+
- **Vite**: 6+

---

**Ready?** Start with [GETTING_STARTED.md](GETTING_STARTED.md)! 🎉
