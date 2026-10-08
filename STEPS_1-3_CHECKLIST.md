# Steps 1-3: Production Deployment Setup

## Step 1: Add Environment Variables to Vercel Dashboard

**Go to:** https://vercel.com/mydadthefixitmans-projects/web-app/settings/environment-variables

**Add these variables for Production:**

| Variable Name | Value |
|---------------|-------|
| VITE_STRIPE_PUBLIC_KEY | YOUR_STRIPE_PUBLISHABLE_KEY |
| VITE_API_BASE_URL | https://api.urbangaragesale.com.au |
| VITE_FIREBASE_PROJECT_ID | UrbanGarageSale |
| VITE_FIREBASE_AUTH_DOMAIN | urbangaragesale.firebaseapp.com |
| VITE_GOOGLE_PLACES_API_KEY | YOUR_GOOGLE_PLACES_API_KEY |
| VITE_HANDY_API_KEY | YOUR_HANDY_KEY |
| NODE_ENV | production |

**For each variable:**
1. Click "Add New"
2. Enter Variable Name
3. Enter Value
4. Select "Production" scope
5. Click "Save"

## Step 2: Deploy Web App - ✅ DONE

**Status:** Web app is live at:
- https://web-b6o3jo49o-mydadthefixitmans-projects.vercel.app
- Alias: https://web-app-pied-eta.vercel.app

## Step 3: Deploy API Backend

**Commands to run:**

```bash
# Go to root directory
cd ..

# Link root directory to Vercel (creating new API project)
vercel link

# Deploy API to production
vercel deploy --prod
```

**What will be deployed:**
- API/server.js (Node.js Express server)
- All Stripe payment endpoints
- Firebase integration endpoints
- Health check endpoint

**API will be available at:**
- https://[your-api-project].vercel.app/api/*

**Then update VITE_API_BASE_URL to the API production URL**
