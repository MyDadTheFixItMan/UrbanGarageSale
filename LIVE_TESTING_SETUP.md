# UrbanGarageSale Live Testing Setup Guide

## Overview
This guide sets up the UrbanGarageSale garage sale platform for live testing with real Stripe integration and Deno API edge functions.

## Prerequisites

### 1. Stripe Account
- Create a Stripe account at https://stripe.com
- Get your API keys from the Stripe Dashboard (Developers > API Keys)
- You'll need:
  - Publishable Key (starts with `pk_test_` or `pk_live_`)
  - Secret Key (starts with `sk_test_` or `sk_live_`)

### 2. Deno Deployment Option (Choose One)

#### Option A: Deno Deploy (Recommended for beginners)
1. Go to https://deno.com/deploy
2. Sign up for a free account
3. Create a new project
4. Note your deployment URL (e.g., `https://your-project.deno.dev`)

#### Option B: Self-Hosted (Node.js Alternative)
1. Install Node.js 18+
2. Create a backend server using the API functions
3. Host on services like Vercel, Netlify, or Railway

#### Option C: Local Testing (For development)
1. Run Deno locally: `deno run --allow-all API/createStripeCheckout.ts`
2. Use `http://localhost:8000` as your API base URL

## Configuration

### Step 1: Update Environment Variables

**For Web App (.env.local)**
```
VITE_GOOGLE_PLACES_API_KEY=your-google-places-key
VITE_STRIPE_PUBLIC_KEY=pk_test_YOUR_PUBLISHABLE_KEY
VITE_API_BASE_URL=http://localhost:3000
```

**For API Backend (.env or deployment platform)**
```
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
BASE44_APP_ID=your-urbangarageSale-app-id
```

### Step 2: Update API Endpoints

The system is configured to call:
- `POST /createStripeCheckout` - Creates a Stripe checkout session
- `POST /verifyStripePayment` - Verifies and completes the payment

## Running for Live Testing

### Option 1: Local Development with Deno (Simplest)

1. **Terminal 1: Start the Deno API server**
   ```bash
   cd API
   deno run --allow-all --allow-env createStripeCheckout.ts
   ```
   
   This starts the API at `http://localhost:8000`

2. **Update VITE_API_BASE_URL in .env.local:**
   ```
   VITE_API_BASE_URL=http://localhost:8000
   ```

3. **Terminal 2: Start the web app**
   ```bash
   cd web-app
   npm run dev
   ```

4. **Test the payment flow:**
   - Create a new listing
   - Submit for payment
   - You'll be redirected to Stripe Checkout
   - Use test card: `4242 4242 4242 4242`, any future expiry, any CVV
   - Complete the payment
   - You'll be redirected back to verify the payment

### Option 2: Deploy to Deno Deploy

1. **Create a Deno Deploy project**
   - Go to https://dash.deno.com
   - Click "New Project"
   - Choose "Deploy from URL"

2. **Deploy the API functions**
   ```
   https://raw.githubusercontent.com/yourusername/urbangarageSale/main/API/createStripeCheckout.ts
   ```

3. **Set environment variables in Deno Deploy:**
   - Go to project settings
   - Add environment variables:
     - `STRIPE_SECRET_KEY`
     - `URBANGARAGESALE_APP_ID`

4. **Update web app .env.local:**
   ```
   VITE_API_BASE_URL=https://your-deno-deploy-url
   ```

## Testing Payments

### Stripe Test Cards

| Card Number | Use Case |
|------------|----------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 0002 | Card declined |
| 4000 0025 0000 3155 | Requires authentication |

**Expiry:** Any future date  
**CVC:** Any 3 digits  
**Name:** Any name  

## Troubleshooting

### "Failed to create checkout session"
- Check STRIPE_SECRET_KEY is set correctly on the backend
- Ensure the API endpoint URL is correct in VITE_API_BASE_URL
- Check browser console for detailed error messages

### "Payment verification failed"
- Verify the session ID is being passed correctly
- Check that STRIPE_SECRET_KEY can access Stripe account
- Ensure verifyStripePayment API is running

### CORS Issues
- The API server should handle CORS headers
- For local development, ensure both web and API servers are running
- For production, update CORS settings in the API

## Production Checklist

- [ ] Switch to live Stripe keys (pk_live_, sk_live_)
- [ ] Set up Stripe webhooks for production
- [ ] Deploy API to production environment
- [ ] Update VITE_API_BASE_URL to production URL
- [ ] Enable HTTPS (required by Stripe)
- [ ] Set up payment confirmation emails
- [ ] Test end-to-end payment flow with real card
- [ ] Set up error monitoring and logging
- [ ] Configure database for payment persistence
- [ ] Set up admin payment history and reconciliation

## Key Files Modified

- `web-app/.env.local` - Environment configuration
- `web-app/src/api/firebaseClient.js` - API client now calls real endpoints
- `API/createStripeCheckout.ts` - API function for session creation
- `API/verifyStripePayment.ts` - API function for payment verification

## Next Steps

1. Set up your Stripe account and get API keys
2. Choose your deployment option (local/Deno Deploy/self-hosted)
3. Follow the "Running for Live Testing" section
4. Test with Stripe test cards
5. Monitor the Admin Dashboard Payments tab for transaction records

