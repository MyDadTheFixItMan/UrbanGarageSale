# Firebase Phone Authentication Setup Guide

## Overview
Firebase Phone Authentication allows users to sign in using their phone number with SMS verification. This guide covers the complete setup process.

## What Was Fixed
✅ Added reCAPTCHA script to `index.html`
✅ Configured reCAPTCHA key in Firebase initialization
✅ Added validation for reCAPTCHA key
✅ Improved error messages with setup instructions

## Required Configuration Steps

### Step 1: Firebase Console Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your **urbangaragesale** project
3. Navigate to **Authentication** > **Sign-in method**
4. Find **Phone** in the list and click **Enable**
5. This will activate Phone Sign-in for your app

### Step 2: Configure Authorized Domains

Phone authentication requires your domain to be whitelisted:

1. In Authentication > Phone > Settings
2. Add your domain to **Authorized domains**:
   - Development: `localhost`
   - Or specific ports: `localhost:5173`, `localhost:5174`

### Step 3: Verify Environment Variables

Ensure your `web-app/.env.local` has these values:

```dotenv
VITE_FIREBASE_RECAPTCHA_KEY=6Lc6P20sAAAAALHLNL7oohnJ50l7cN8_hr4V03Kg
VITE_FIREBASE_API_KEY=AIzaSyCmAD0m-2Z_-WomxpDvREimaPSp2CtjmEY
VITE_FIREBASE_AUTH_DOMAIN=urbangaragesale.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=urbangaragesale
VITE_FIREBASE_APP_ID=1:264749197802:web:f09553f241658137af6a93
```

**Important**: The reCAPTCHA key should be a **score-based** or **invisible** reCAPTCHA v3 key, not v2 checkbox.

### Step 4: Verify Web App Configuration

Check that `web-app/index.html` includes the reCAPTCHA script:

```html
<script async defer src="https://www.google.com/recaptcha/api.js"></script>
```

This should be in the `<body>` before the main React script.

### Step 5: Firebase Settings in Console

Go to **Authentication** > **Settings** > **User accounts**:

✅ Email/Password - Keep enabled
✅ Google - Recommended for testing
✅ **Phone** - Must be enabled
✅ Anonymous - Optional

## How Phone Authentication Works

1. User enters phone number (e.g., +61 412 345 678)
2. reCAPTCHA verifies the user is not a bot
3. Firebase sends SMS with verification code
4. User enters code to complete authentication
5. User is signed in and can use the app

## Testing Phone Authentication

### Development Environment

Use Firebase **test phone numbers** for free testing:

1. Go to **Authentication** > **Phone** > **Test numbers**
2. Add test numbers (e.g., +61 412 345 678)
3. Set a test code (e.g., 123456)
4. No real SMS will be sent - you'll see the code in the sign-up flow

### Production Environment

Once deployed:
- Real SMS will be sent to users
- Firebase will bill for each SMS sent
- Check Firebase Pricing for SMS costs per region

## Common Issues & Solutions

### Issue: "SMS service not properly configured"

**Cause**: Phone Sign-in not enabled in Firebase or domain not whitelisted

**Fix**:
```
1. Firebase Console > Authentication > Phone > Enable
2. Add your domain to Authorized domains
3. Wait 1-2 minutes for changes to propagate
4. Refresh the browser
```

### Issue: "reCAPTCHA not initialized"

**Cause**: Google reCAPTCHA script failed to load or key is missing

**Fix**:
```
1. Verify VITE_FIREBASE_RECAPTCHA_KEY is set in .env.local
2. Check that index.html has the reCAPTCHA script tag
3. Check browser console for CSP (Content Security Policy) issues
4. Ensure no ad blockers are blocking recaptcha.net
```

### Issue: "Invalid app credential"

**Cause**: Multiple possible reasons:
- Domain not whitelisted
- reCAPTCHA key misconfigured
- Firebase Phone Auth not enabled
- Using wrong reCAPTCHA key type

**Fix**:
```
1. Verify domain is in whitelist (with trailing slash)
2. Ensure using reCAPTCHA v3 (invisible) key, not v2
3. Double-check Project ID matches in all files
4. Clear browser cache and reload
```

## Debugging

### Browser Console Logs

Phone verification logs will show:

```javascript
// Success
"reCAPTCHA verifier initialized successfully"
"Sending SMS to: +61412345678"
"SMS sent successfully"

// Errors
"Failed to initialize reCAPTCHA: [error details]"
"Phone verification error: [error]"
```

### Firebase Admin SDK Logs

Check Firebase Console > Logs for:
- Phone sign-in attempts
- Verification code delivery status
- Failed authentication attempts

## Frontend Implementation

### In `Login.jsx`:

1. Import phone verification functions:
```jsx
import { firebase } from '@/api/firebaseClient';
```

2. Setup reCAPTCHA:
```jsx
await firebase.auth.setupRecaptcha('recaptcha-container');
```

3. Send SMS:
```jsx
await firebase.auth.sendPhoneVerification(phoneNumber);
```

4. Verify code:
```jsx
await firebase.auth.verifyPhoneCode(verificationCode);
```

## Security Considerations

✅ Phone numbers are validated before sending SMS
✅ reCAPTCHA prevents automated SMS floods
✅ Verification codes expire after 10 minutes (Firebase default)
✅ Phone sign-in uses Firebase secure protocols
⚠️ SMS is not encrypted in transit (limitation of SMS)

## Cost Implications

Firebase Phone Authentication SMS pricing varies by region:
- Australia: ~$0.04-0.05 per SMS
- USA/Europe: ~$0.025-0.04 per SMS
- Other regions: Check Firebase pricing page

For testing, use Firebase test numbers (free, unlimited).

## Next Steps

1. ✅ Verify all environment variables are set
2. ✅ Enable Phone Sign-in in Firebase Console
3. ✅ Add authorized domains
4. ✅ Test with Firebase test phone numbers
5. ✅ Monitor SMS delivery in Firebase Logs
6. ✅ Track SMS costs in Firebase Billing

## Resources

- [Firebase Phone Auth Docs](https://firebase.google.com/docs/auth/web/phone-auth)
- [reCAPTCHA Documentation](https://developers.google.com/recaptcha)
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Firebase Console](https://console.firebase.google.com/)

