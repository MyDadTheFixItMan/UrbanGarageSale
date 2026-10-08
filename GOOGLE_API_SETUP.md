# Google Places API Setup Guide

This document explains how to set up and configure Google Places API for address autocomplete on the Create Listing page.

## Overview

The application now uses **Google Places API** instead of HandyAPI for address autocomplete. This provides better accuracy and features for Australian addresses.

## Setup Steps

### 1. Get a Google Places API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable only the APIs this app uses:
   - **Maps JavaScript API**
   - **Places API**
   - **Geocoding API**
4. Create an API key:
   - Go to **Credentials** → **Create Credentials** → **API Key**
   - Restrict the key to:
     - **Application restrictions**: HTTP referrers (web sites)
     - **API restrictions**: Select only:
       - `Maps JavaScript API`
       - `Places API`
       - `Geocoding API`
     - **HTTP referrers**: Add only required origins:
       - `https://www.urbangaragesale.com.au/*`
       - `https://urbangaragesale.com.au/*`
       - `https://web-app-pied-eta.vercel.app/*`
       - `https://*.vercel.app/*` (optional, only if Preview deployments must use this key)
       - `http://localhost:5173/*` (development only)

### 1.1 Key Segmentation (Recommended)

Use separate keys per environment/surface:

- **Web Browser Key (required)**
  - Variable: `VITE_GOOGLE_PLACES_API_KEY`
  - Restriction type: **HTTP referrers**
  - APIs: Maps JavaScript API, Places API, Geocoding API

- **Server Key (optional; only if backend calls Google APIs)**
  - Variable: `GOOGLE_PLACES_API_KEY`
  - Restriction type: **IP allowlist** (only when static egress IP exists)
  - APIs: only backend-required APIs

If you run on serverless egress without static IPs, avoid IP-restricted server keys until static egress is in place.

### 2. Configure Environment Variables

#### For Development (Vite)

Create or update `web-app/.env.local`:

```env
VITE_GOOGLE_PLACES_API_KEY=YOUR_GOOGLE_PLACES_API_KEY_HERE
```

#### For Production

Add the environment variable to your deployment platform (Vercel, Netlify, etc.):

```
VITE_GOOGLE_PLACES_API_KEY=YOUR_GOOGLE_PLACES_API_KEY_HERE
```

### 3. Update HTML Configuration

The `web-app/index.html` file includes the Google Maps library. Replace the placeholder:

```html
<script
  src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_PLACES_API_KEY&libraries=places"
  async
  defer
></script>
```

**Note**: For development, keep `YOUR_GOOGLE_PLACES_API_KEY` as the placeholder. The app will use the environment variable from `.env.local`.

For production, you can either:
- Use the environment variable at build time
- Or rely on the environment variable being injected at runtime

### 4. Update index.html for Production Build

If you want the API key to be embedded at build time, update `web-app/index.html`:

```html
<script
  src="https://maps.googleapis.com/maps/api/js?key=%VITE_GOOGLE_PLACES_API_KEY%&libraries=places"
  async
  defer
></script>
```

Then in your build process or vite.config.js, ensure the environment variable is substituted.

**Alternative (Recommended)**: Update the HTML to load the script dynamically in `App.jsx`:

```jsx
useEffect(() => {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  if (apiKey && !window.google) {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }
}, []);
```

## Files Modified

### New Files
- **`web-app/src/api/googlePlacesService.js`** - Google Places API service wrapper
- **`web-app/src/components/GooglePlacesAutocomplete.jsx`** - Address autocomplete component

### Updated Files
- **`web-app/index.html`** - Added Google Maps script
- **`web-app/src/pages/CreateListing.jsx`** - Replaced SuburbAutocomplete with GooglePlacesAutocomplete

## Component Usage

### GooglePlacesAutocomplete Component

```jsx
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete';

<GooglePlacesAutocomplete
  value={searchText}
  onChange={(text) => setSearchText(text)}
  onSelect={(place) => {
    // place object contains:
    // - address: full formatted address
    // - suburb: suburb/locality
    // - state: state code (NSW, VIC, etc.)
    // - postcode: postcode
    // - latitude: coordinates
    // - longitude: coordinates
    console.log(place);
  }}
  placeholder="Enter address"
/>
```

## Features

✅ **Address Autocomplete** - Type-ahead suggestions as you type
✅ **Location Extraction** - Automatically extracts suburb, state, postcode
✅ **Coordinates** - Provides latitude/longitude for map display
✅ **Australia Restricted** - Only shows Australian addresses
✅ **Debounced Search** - Efficient API calls with 300ms debounce

## Troubleshooting

### API Key Issues
- Ensure the API key has the correct restrictions
- Check that your domain is whitelisted in HTTP referrers
- Verify the key has only Maps JavaScript API, Places API, and Geocoding API enabled

### Restriction Validation Checklist
- In Google Cloud Console → APIs & Services → Credentials → your key:
  - Application restriction = `HTTP referrers (web sites)`
  - API restrictions = `Restrict key` with only the 3 required APIs
  - Remove wildcard/unneeded referrers
  - Delete unused old keys after cutover

### Script Loading
- Open browser DevTools → Network tab
- Check if the Google Maps script loads successfully
- Verify no CSP (Content Security Policy) issues

### Autocomplete Not Working
- Check browser console for errors
- Ensure `VITE_GOOGLE_PLACES_API_KEY` is set in `.env.local`
- Verify Google Places API is enabled in Google Cloud Console
- Make sure you're typing at least 3 characters

### Testing in Development

```bash
cd web-app
echo "VITE_GOOGLE_PLACES_API_KEY=YOUR_KEY_HERE" > .env.local
npm run dev
```

Then test the Create Listing page and try searching for addresses.

## API Quota & Pricing

Google Places API has generous free quotas:
- **First 25,000 requests/month**: Free
- **Additional requests**: $0.02-0.07 per request

Monitor usage in Google Cloud Console → Billing.

## Fallback for Missing API Key

The app includes error handling:
- If the API key is missing, users will see an error message
- The app won't crash, but address autocomplete won't work
- Consider implementing a fallback to the previous HandyAPI if needed

## Next Steps

1. Get your Google Places API key from Google Cloud Console
2. Add it to `.env.local` in the `web-app/` directory
3. Test the Create Listing page
4. Deploy with the environment variable configured in your hosting platform
