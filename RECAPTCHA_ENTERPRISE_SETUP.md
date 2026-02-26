# reCAPTCHA Enterprise Setup Guide

## Overview
reCAPTCHA Enterprise is Firebase's recommended solution for Phone Authentication in production. It provides advanced fraud detection and is more reliable than standard reCAPTCHA.

## Setup Steps (Reading First - Then Implementation)

### Step 1: Enable reCAPTCHA Enterprise API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Make sure **UrbanGarageSale** project is selected
3. Search for **reCAPTCHA Enterprise API** in the search bar
4. Click on it and press **Enable**
5. Wait 1-2 minutes for it to enable

### Step 2: Create a Service Account (for Backend)
reCAPTCHA Enterprise works differently - it needs a service account:

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Fill in:
   - **Service account name**: `recaptcha-enterprise-service`
   - **Service account ID**: Auto-fills
   - Click **Create and Continue**
4. Grant Role: Search for **reCAPTCHA Enterprise Agent**
5. Add that role and click **Continue**
6. Click **Done**

### Step 3: Create API Key for the Service Account
1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key** > **Create new key**
4. Choose **JSON**
5. Click **Create** - this downloads a JSON file
6. **Keep this file safe** - you'll need it

### Step 4: Create reCAPTCHA Enterprise Key
1. Go to [reCAPTCHA Admin Console](https://console.cloud.google.com/security/recaptcha)
2. Click **Create or select a key**
3. Click **Create Key**
4. Fill in:
   - **Display name**: `Urban Garage Sale Enterprise`
   - **Platform**: Select both:
     - ✅ Web
     - ✅ Android (if using Flutter app)
   - **Type**: ✅ **reCAPTCHA v3** (Score-based)
   - **Domains**: Add:
     - `localhost`
     - `localhost:5173`
     - `urbangaragesale.com.au`
     - Your production domain
5. Click **Create Key**
6. You'll see:
   - **Site Key** (public) - note this
   - **Secret Key** (private) - note this

### Step 5: Configure Firebase to Use Enterprise
1. Go to **Firebase Console** > **Authentication** > **Settings**
2. In the **reCAPTCHA configuration** section
3. Click **Manage reCAPTCHA**
4. Look for the new Enterprise key you created
5. Select it and click **Save**

### Step 6: Update Your Code

#### A. Update `.env.local`
Add the Enterprise key:
```dotenv
VITE_FIREBASE_RECAPTCHA_ENTERPRISE_KEY=6Lc6P20sAAAAALHLNL7oohnJ50l7cN8_hr4V03Kg
```

#### B. Update Firebase Configuration
Update `firebaseClient.js` to use Enterprise mode:

```javascript
// Remove the development bypass and use proper Enterprise setup
const auth = getAuth(app);

// For Enterprise reCAPTCHA
auth.settings.appVerificationDisabledForTesting = false; // IMPORTANT: Set to false for production
```

### Step 7: Backend Configuration (Node.js API)
If you're sending SMS from your backend:

1. Store the service account JSON key securely
2. Configure the API to use it:

```javascript
const admin = require('firebase-admin');
const key = require('./path-to-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(key),
  projectId: 'urbangaragesale'
});
```

## Testing Enterprise Setup

### Development Testing
1. Start your app: `npm run dev:web`
2. Go to `http://localhost:5173/`
3. Sign Up > Phone field
4. Enter test phone: `+61 412 345 678`
5. Check console for: `✓ Phone Auth: App verification enabled for production`
6. It should work without the "app verification disabled" message

### Production Checklist
Before going live:
- [ ] Enterprise key is created and active
- [ ] Domain is added to Enterprise key whitelist
- [ ] Firebase Console is using the Enterprise key
- [ ] Code has `appVerificationDisabledForTesting = false`
- [ ] Service account is configured (if using backend)
- [ ] Test with real phone number on staging environment
- [ ] Monitor reCAPTCHA Admin Console for abuse scores

## Monitoring & Management

### Monitor Abuse Scores
1. Go to reCAPTCHA Admin Console
2. Check **Dashboard** tab for score distribution
3. Look for suspicious patterns

### Configure Fraud Rules
1. Go to **Settings** in reCAPTCHA Admin Console
2. Set abuse score thresholds
3. Configure webhook for suspicious activities (optional)

## Billing

reCAPTCHA Enterprise is a **paid service**:
- **First 1,000 requests/month**: FREE
- **After that**: ~$1 per 1,000 requests
- Recommended: Set budget alert in Google Cloud Console

Set Budget Alert:
1. Go to **Billing**
2. Click **Budgets and alerts**
3. Create new budget with alert at $10/month (example)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid app credential" after setup | Enterprise key wasn't selected in Firebase Console |
| Requests are blocked | Check abuse score rules in Enterprise settings |
| High costs | Review and possibly increase abuse score threshold |
| SMS still not sending | Verify backend is using correct service account |

## Architecture (Enterprise vs Standard)

### Standard reCAPTCHA v3 (Current)
```
Browser ← reCAPTCHA.js ← Google reCAPTCHA
    ↓
Firebase Auth ← Verifier
    ↓
SMS Service
```

### Enterprise reCAPTCHA (Recommended)
```
Browser ← Enterprise JS ← Google Cloud (Enterprise API)
    ↓
Backend Service Account ← Verification
    ↓
Firebase Auth
    ↓
SMS Service
```

## Next Steps

1. **Enable reCAPTCHA Enterprise API** in Google Cloud Console
2. **Create the service account**
3. **Create Enterprise key**
4. **Update Firebase settings**
5. **Test thoroughly**
6. **Deploy with Enterprise key active**

## Important Notes

⚠️ **Do NOT mix keys**:
- Don't use standard v3 for Enterprise
- Don't use Enterprise key format for standard auth
- Keep Secret Key private (don't put in frontend code)

✅ **Best Practice**:
- Development: Use development bypass if needed
- Staging: Test with Enterprise key active
- Production: Always use Enterprise key with abuse monitoring

