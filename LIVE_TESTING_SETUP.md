⚠️ **DEPRECATED - This document references outdated Deno deployment options**

# UrbanGarageSale Live Testing Setup Guide - ARCHIVED

**Status**: OUTDATED (March 22, 2026)  
**Reason**: This guide referenced Deno Deploy, which is no longer used. The project now uses Node.js backend deployed to Vercel.

## ⚠️ Use This Instead

🚀 **See [LIVE_TESTING_ACTIVE.md](LIVE_TESTING_ACTIVE.md)** for current setup instructions with Node.js backend.

---

## Archive: Original Content (for reference only)

### What Changed
- **OLD**: Deno Deploy edge functions
- **NEW**: Node.js Express server on Vercel (API/server.js)
- **OLD**: BASE44_APP_ID environment variable
- **NEW**: Firebase authentication (migration complete)

### Original Setup Instructions (Outdated)

Environment variables from original guide (no longer valid):
```
# DEPRECATED - DO NOT USE
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

