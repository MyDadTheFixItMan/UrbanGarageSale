# Google Places API Setup Guide

This document explains how to set up and configure Google Places API for address autocomplete on the Create Listing page.

## Overview

The application now uses **Google Places API** instead of HandyAPI for address autocomplete. This provides better accuracy and features for Australian addresses.

## Setup Steps

### 1. Get a Google Places API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the following APIs:
   - **Maps JavaScript API**
   - **Places API**
4. Create an API key:
   - Go to **Credentials** → **Create Credentials** → **API Key**
   - Restrict the key to:
     - **Application restrictions**: HTTP referrers (web sites)
     - **API restrictions**: Select "Places API" and "Maps JavaScript API"
     - **HTTP referrers**: Add your domain(s) (e.g., `localhost:5173`, `yoursite.com`)

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
- Verify the key has Maps JavaScript API and Places API enabled

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
