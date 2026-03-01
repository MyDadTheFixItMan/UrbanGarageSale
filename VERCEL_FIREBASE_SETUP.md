# Vercel Firebase Admin SDK Setup Guide

The Urban Pay API endpoints require Firebase Admin SDK credentials to write to Firestore. Follow these steps to configure Vercel.

## Step 1: Get Firebase Service Account Credentials

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your **urbangaragesale** project
3. Click the **Settings icon** (⚙️) in the top-left, then **Project Settings**
4. Go to the **Service Accounts** tab
5. Click **Generate New Private Key**
6. A JSON file will download (e.g., `urbangaragesale-abc123.json`)
7. **Keep this file secure** - it contains sensitive credentials

## Step 2: Add Credentials to Vercel

### Option A: Via Vercel Web Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **UrbanGarageSale** project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Create a new variable:
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_JSON`
   - **Value**: Copy the **entire contents** of the service account JSON file
   - **Environment**: Select all (Production, Preview, Development)
6. Click **Save**

### Option B: Via Vercel CLI

```bash
vercel env add FIREBASE_SERVICE_ACCOUNT_JSON
# Paste the entire service account JSON when prompted
```

## Step 3: Verify Firebase Project ID (Already Set)

Your Vercel project should already have:
- **FIREBASE_PROJECT_ID**: `urbangaragesale`

If not:
1. Go to **Settings** → **Environment Variables**
2. Add `FIREBASE_PROJECT_ID` with value `urbangaragesale`

## Step 4: Test the Setup

After adding the environment variable:

1. **Redeploy** your project (Vercel will auto-deploy on git push)
   ```bash
   git push
   ```

2. Test the Record Cash Sale endpoint:
   ```bash
   curl -X POST https://urban-garage-sale.vercel.app/api/urbanPayment/recordSale \
     -H "Authorization: Bearer YOUR_ID_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "amount": 25.50,
       "description": "Test sale",
       "paymentMethod": "cash",
       "sellerId": "YOUR_USER_ID"
     }'
   ```

3. Check **Vercel Logs**:
   - Go to your project in Vercel
   - Click **Deployments** → latest deployment
   - Click **Logs** to see API execution logs

## Troubleshooting

### Error: "Firestore error: Forbidden"

**Cause**: Firebase credentials not properly configured in Vercel

**Solution**:
- Verify `FIREBASE_SERVICE_ACCOUNT_JSON` is set in Vercel Environment Variables
- Check the JSON is **complete** (not truncated)
- Ensure no extra spaces or newlines around the credential value
- Redeploy with `git push`

### Error: "Firebase Admin initialization error"

**Cause**: Invalid or malformed service account JSON

**Solution**:
- Download a fresh service account key from Firebase Console
- Copy the **entire** JSON file contents
- Paste into Vercel environment variable (no modifications)

### Error: "STRIPE_SECRET_KEY not configured"

**Cause**: Stripe key missing from Vercel

**Solution**:
- Go to **Settings** → **Environment Variables** in Vercel
- Add `STRIPE_SECRET_KEY` with your Stripe secret key
- Value should be: `sk_live_...` or `sk_test_...`

## What the API Now Does

With credentials configured, your API endpoints:

1. **`recordSale`** - Records cash sales to Firestore
   - Verifies the user's Firebase ID token
   - Writes the sale to `/sales` collection
   - Respects Firestore security rules

2. **`recordTapToPaySale`** - Records Tap to Pay transactions
   - Verifies payment with Stripe
   - Stores transaction in Firestore
   - Calculates and saves transaction fees

## Security Notes

- **Never** commit the service account JSON to GitHub
- **Never** share the `FIREBASE_SERVICE_ACCOUNT_JSON` value
- Use Vercel's built-in secrets management
- Regenerate the key periodically and update Vercel
- Each deployment to Vercel is isolated and secure

## Quick Reference

| Variable | Value | Set? |
|----------|-------|------|
| `FIREBASE_PROJECT_ID` | `urbangaragesale` | ✅ |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Service account JSON | ⏳ (You need to add) |
| `STRIPE_SECRET_KEY` | `sk_live_...` | ✅ |

## Next Steps

After setup is complete:
1. ✅ Commit code changes (already done)
2. ⏳ Add Firebase credentials to Vercel
3. ⏳ Test Record Cash Sale on web app
4. ⏳ Monitor Vercel logs for any errors

---

For questions, check the [Firebase Admin SDK docs](https://firebase.google.com/docs/admin/setup) or [Vercel Environment Variables guide](https://vercel.com/docs/concepts/projects/environment-variables).
