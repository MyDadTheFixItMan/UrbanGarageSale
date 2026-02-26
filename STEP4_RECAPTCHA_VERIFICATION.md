# Step 4: Verify reCAPTCHA Configuration

## Quick Checklist

To properly configure reCAPTCHA for Phone Authentication, follow these steps:

### A. Check Your Current reCAPTCHA Key

In **Firebase Console**:
1. Go to **Authentication** > **Settings** (gear icon)
2. Look for **reCAPTCHA configuration** section
3. You should see a key starting with `6L...` 
4. **Check the type**: Should be either:
   - ✅ **reCAPTCHA v3** (Score-based) - RECOMMENDED
   - ✅ **reCAPTCHA v2 Invisible** - Also works
   - ❌ **reCAPTCHA v2 Checkbox** - DO NOT use this (won't work with Phone Auth)

### B. Get the reCAPTCHA Key from Google Cloud

If you don't see a key or need to create one:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Make sure you're in the **urbangaragesale** project
3. Go to **Security** > **reCAPTCHA Admin Console**
4. You should see your reCAPTCHA keys listed
5. Look for one that says **reCAPTCHA v3 (Score-based)** or similar

#### If no v3 key exists, create one:
1. Click **Create** or **+** button
2. Enter Display Name: `Urban Garage Sale Phone Auth`
3. Choose **reCAPTCHA v3**
4. Add domains:
   - `localhost`
   - `localhost:5173`
   - `127.0.0.1:5173`
   - Your production domain (if applicable)
5. Accept terms and create
6. Copy the **Site Key** (the long key starting with `6L...`)

### C. Verify in your .env.local

Your `web-app/.env.local` file should have:

```dotenv
VITE_FIREBASE_RECAPTCHA_KEY=6Lc6P20sAAAAALHLNL7oohnJ50l7cN8_hr4V03Kg
```

✅ Make sure this key is:
- The **Site Key** (not Secret Key)
- From a **v3 (Score-based)** reCAPTCHA
- Not empty or undefined

### D. Verify in Firebase Console

Back in **Firebase Console** > **Authentication** > **Settings**:

1. The **reCAPTCHA configuration** should show:
   - Your reCAPTCHA v3 key 
   - Status: **Active**
   - Type: **Score-based** or similar

### E. Test the Configuration

1. Start your dev server: `npm run dev:web`
2. Go to `http://localhost:5173/` 
3. Click "Sign Up"
4. Scroll down to phone verification section
5. Enter a test phone number
6. **Check browser console** (F12 > Console tab):
   - Look for: `✓ reCAPTCHA verifier initialized successfully`
   - If success: Configuration is correct! ✅
   - If error: Check step A-D above

## Common Issues

| Issue | Solution |
|-------|----------|
| "reCAPTCHA not initialized" | Verify key is in .env.local and correct |
| "Invalid app credential" | Ensure domain is in reCAPTCHA authorized domains |
| Checkbox appears on page | You're using v2 Checkbox - switch to v3 Score-based |
| SMS still doesn't send | All 4 steps complete + clear browser cache + reload |

## Key Points to Remember

✅ **reCAPTCHA v3 (Score-based)** = Recommended for Phone Auth  
✅ **reCAPTCHA v2 Invisible** = Acceptable alternative  
❌ **reCAPTCHA v2 Checkbox** = Will NOT work with Phone Auth  

✅ **Site Key** (public) = Goes in VITE_FIREBASE_RECAPTCHA_KEY  
❌ **Secret Key** (private) = Never share, never put in .env  

## Still Broken?

If SMS still doesn't work after verifying all steps:

1. Clear browser cache (Ctrl+Shift+Delete)
2. Restart dev server (`npm run dev:web`)
3. Try another test phone number
4. Check browser console for specific error messages
5. Verify all 4 steps were completed

