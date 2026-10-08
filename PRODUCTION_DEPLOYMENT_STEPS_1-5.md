# Production Deployment Guide - Steps 1-5
# urbangaragesale.com.au on Vercel + Firebase

## What You Just Set Up

✅ `.env.production` - Web app production variables  
✅ `vercel.json` - Vercel configuration for web app
✅ `.env.production` (root) - API backend production variables
✅ `vercel.json` (root) - API routing configuration

---

## STEP 1: Configure Production Environment Variables in Vercel

### Option A: Via Vercel CLI (Recommended)

```bash
# 1. Install Vercel CLI if not already installed
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Set production environment variables
vercel env add VITE_STRIPE_PUBLIC_KEY
# Paste: YOUR_STRIPE_PUBLISHABLE_KEY

vercel env add VITE_API_BASE_URL
# Paste: https://api.urbangaragesale.com.au

vercel env add VITE_FIREBASE_PROJECT_ID
# Paste: UrbanGarageSale

vercel env add STRIPE_SECRET_KEY
# Paste: YOUR_STRIPE_SECRET_KEY

vercel env add FIREBASE_PROJECT_ID
# Paste: UrbanGarageSale

# 4. For remaining variables (Google Places, Firebase Keys, etc.):
#    Get your Firebase config from: Firebase Console > Project Settings > Integration code
#    Get Google Places API from: Google Cloud Console > APIs & Services > Enabled APIs
```

### Option B: Via Vercel Dashboard (Web UI)

1. Go to https://vercel.com/dashboard
2. Select your **UrbanGarageSale** project
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - Name: `VITE_STRIPE_PUBLIC_KEY`
   - Value: `YOUR_STRIPE_PUBLISHABLE_KEY`
   - Select: **Production**
   - Click **Save**

Repeat for all variables listed in `.env.production` and `.env.production` (root)

---

## STEP 2: Deploy Web App to Vercel

```bash
# Navigate to web app directory
cd web-app

# Link your GitHub repo to Vercel (one-time)
vercel link

# Follow prompts:
# - Select existing project: No, create new
# - Project name: urban-garage-sale or urbangaragesale
# - Framework: Vite
# - Root directory: . (current)

# Deploy to production
vercel deploy --prod

# Save the output URL (e.g., https://urban-garage-sale.vercel.app)
```

---

## STEP 3: Deploy API Backend to Vercel

```bash
# Go to root directory
cd ..

# Link root directory to Vercel
vercel link

# When prompted, you can reuse the same project or create new

# Option A: Separate Vercel project for API
# - Create new project for API
# - Keep web app in different project

# Option B: Same Vercel project (easier)
# - Use existing UrbanGarageSale project
# - Vercel will serve both web app and API

# Deploy API
vercel deploy --prod

# Verify API is working
curl https://urbangaragesale.vercel.app/api/health
# Should return: {"status":"ok"}
```

---

## STEP 4: Configure Domain DNS

### For urbangaragesale.com.au at your Registrar:

1. **Get Vercel's DNS Configuration:**
   ```bash
   vercel domains list
   ```
   This shows you Vercel's nameservers

2. **Update at Your Registrar** (GoDaddy, Namecheap, etc.):
   
   **Option A: Point to Vercel**
   - Go to Domain Settings → DNS Management
   - Add CNAME records:
     ```
     Name: www
     Value: cname.vercel.app
     
     Name: api
     Value: cname.vercel.app (or separate Vercel API domain)
     ```
   - Or add A record pointing to Vercel IP

   **Option B: Use Vercel's Nameservers** (easier)
   - Go to Domain Settings → Nameservers
   - Change to Vercel's nameservers:
     ```
     ns1.vercel.com
     ns2.vercel.com
     ```

3. **Add Domain to Vercel Project:**
   ```bash
   vercel domains add urbangaragesale.com.au
   vercel domains add api.urbangaragesale.com.au
   ```

4. **Wait for DNS Propagation:**
   - Can take 15 minutes to 48 hours (usually 15-30 mins)
   - Check status:
     ```bash
     dig urbangaragesale.com.au
     nslookup urbangaragesale.com.au
     ```

---

## STEP 5: Update Production URLs

### In web-app/.env.production (ALREADY DONE)
```
VITE_API_BASE_URL=https://api.urbangaragesale.com.au
```

### In web-app/src/api/firebaseClient.js (or your Firebase config)
```javascript
// Already points to production Firebase if using .env variables
```

### In Flutter app (lib/main.dart)
```dart
const String API_BASE_URL = 'https://api.urbangaragesale.com.au';
const String STRIPE_PUBLISHABLE_KEY = 'YOUR_STRIPE_PUBLISHABLE_KEY';
```

### Commit and Push
```bash
git add .
git commit -m "chore: Configure production environment for urbangaragesale.com.au"
git push origin main

# Vercel auto-deploys on push to main branch
```

---

## Verification Checklist

After completing Steps 1-5, verify:

```bash
# ✅ Web app loads
curl https://urbangaragesale.com.au
curl https://www.urbangaragesale.com.au

# ✅ API health check
curl https://api.urbangaragesale.com.au/api/health

# ✅ Check DNS propagation
nslookup urbangaragesale.com.au
nslookup api.urbangaragesale.com.au

# ✅ Check SSL certificate (should show Vercel)
openssl s_client -connect urbangaragesale.com.au:443 -servername urbangaragesale.com.au
```

---

## MISSING VALUES YOU NEED:

To fully complete this, you need to provide:

1. **Firebase Sender ID**: Firebase Console > Project Settings > Cloud Messaging
2. **Firebase App ID**: Firebase Console > Project Settings
3. **Google Places API Key**: Google Cloud Console > APIs & Services
    - Restrict by **HTTP referrers** to production and required preview/dev origins only
    - Restrict by **enabled APIs only**:
       - Maps JavaScript API
       - Places API
       - Geocoding API
    - Avoid unrestricted browser keys in production
4. **HandyAPI Key**: HandyAPI Dashboard
5. **SendGrid API Key**: SendGrid Dashboard > Settings > API Keys
6. **Firebase Private Key**: Firebase > Project Settings > Service Accounts > Generate New Private Key
7. **Stripe Webhook Secret**: Stripe Dashboard > Developers > Webhooks (add endpoint first)

---

## Quick Command Reference

```bash
# Verify Vercel setup
vercel status

# View project settings
vercel env list

# Redeploy
vercel deploy --prod

# Check logs
vercel logs [function-name]

# List all deployments
vercel list
```

---

## Support

If you run into issues:
- Check Vercel logs: `vercel logs`
- Check Stripe webhook status: Stripe Dashboard > Developers > Webhooks
- Verify Firebase project is in production mode
- Ensure all environment variables are set in Vercel

Next step: Run the commands in Step 1 to set your environment variables!
