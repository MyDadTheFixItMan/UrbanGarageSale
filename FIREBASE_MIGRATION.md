# Firebase Migration Guide

## Migration Summary

Urban Garage Sale uses Firebase for authentication and Firestore for data storage. The backend APIs use Firebase Admin SDK for server-side authentication and data operations.

## What Changed

### 1. Authentication
- **Old**: Base44 SDK (`base44.auth.*`)
- **New**: Firebase Authentication (`firebase.auth.*`)
- All login/logout functionality now uses Firebase Auth

### 2. Database
- **Old**: Base44 custom entities
- **New**: Firestore (Firebase Cloud Database)
- Collections:
  - `garageSales` - Listings
  - `savedListings` - Saved listings by users
  - `payments` - Payment records
  - `users` - User profiles

### 3. Backend Functions
- **Old**: Base44 functions
- **New**: Firebase Cloud Functions
- Existing functions remain in `API/` and `web-app/functions/` but will need to be rewritten for Firebase Admin SDK

### 4. Files Created
- `web-app/src/api/firebaseClient.js` - Main Firebase configuration and API

## Setup Instructions

### 1. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Create a new project
3. Enable these services:
   - **Authentication** (Email/Password)
   - **Firestore Database**
   - **Cloud Functions**

### 2. Configure Environment Variables

Copy your Firebase config from Console > Project Settings:

```bash
# .env.local
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789...
VITE_FIREBASE_APP_ID=1:123456789:web:abc...
```

### 3. Create Firestore Collections

In Firebase Console > Firestore Database, create these collections:

#### garageSales
```
{
  id: string (auto),
  title: string,
  description: string,
  address: string,
  suburb: string,
  postcode: string,
  state: string,
  latitude: number,
  longitude: number,
  start_date: string (ISO date),
  end_date: string (ISO date),
  start_time: string,
  end_time: string,
  sale_type: string (garage_sale | moving_sale | estate_sale | yard_sale),
  photos: array of URLs,
  created_by: string (email),
  user_id: string (user UID),
  created_at: timestamp,
  status: string (draft | active | pending_approval | completed),
  payment_status: string (pending | paid),
  stripe_session_id: string (optional)
}
```

#### savedListings
```
{
  id: string (auto),
  garage_sale_id: string,
  user_email: string,
  user_id: string,
  created_at: timestamp
}
```

#### payments
```
{
  id: string (auto),
  user_id: string,
  user_email: string,
  garage_sale_id: string,
  stripe_session_id: string,
  amount: number,
  currency: string,
  status: string (pending | completed | failed),
  created_at: timestamp
}
```

### 4. Firestore Security Rules

Set these security rules in Firestore > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is admin
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Admin settings (promotional messages, etc.)
    match /admin_settings/{document=**} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null && isAdmin();
    }

    // Garage sales listings
    match /garageSales/{document=**} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && (request.auth.uid == resource.data.user_id || isAdmin());
    }

    // Saved listings
    match /savedListings/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.user_id;
      allow create: if request.auth != null;
    }

    // Payments
    match /payments/{document=**} {
      allow read: if request.auth != null && (request.auth.uid == resource.data.user_id || isAdmin());
      allow create: if request.auth != null;
      allow write: if false;
    }

    // Users
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && isAdmin();
    }
  }
}
```

### 5. Firebase Storage Rules

Set these security rules in Firebase Console > Storage > Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /listings/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth.uid == userId;
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

Publish these rules.

### 6. Update Backend Functions

The API functions need to be rewritten to use Firebase Admin SDK:

```bash
npm install firebase-admin
```

Example for Cloud Function:

```javascript
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const verifyStripePayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }
  
  const { sessionId, saleId } = data;
  
  // Verify with Stripe
  // Update payment in Firestore
  
  return { success: true };
});
```

## API Changes

### Authentication

```javascript
import { firebase } from '@/api/firebaseClient';

// Login
await firebase.auth.login(email, password);

// Logout
await firebase.auth.logout();

// Get current user
const user = await firebase.auth.me();

// Check if authenticated
const isAuth = await firebase.auth.isAuthenticated();

// Update profile
await firebase.auth.updateProfile({ full_name: "John Doe" });

// Listen to auth changes
firebase.auth.onAuthStateChanged((user) => {
  // user will be null if logged out
});
```

### Entities (Database)

```javascript
import { firebase } from '@/api/firebaseClient';

// Create
const result = await firebase.entities.GarageSale.create({
  title: "Garage Sale",
  address: "123 Main St",
  // ... other fields
});

// Filter/Query
const sales = await firebase.entities.GarageSale.filter({
  created_by: user.email,
  postcode: "3000"
});

// Update
await firebase.entities.GarageSale.update(saleId, {
  status: "active"
});

// Delete
await firebase.entities.GarageSale.delete(saleId);
```

### Cloud Functions

```javascript
import { firebase } from '@/api/firebaseClient';

// Call Cloud Function
const result = await firebase.functions.invoke('verifyStripePayment', {
  sessionId: sessionId,
  saleId: saleId
});
```

## Remaining TODO

1. **Rewrite API functions** in `API/` directory to use Firebase Admin SDK
2. **Remove old base44Client.js** when migration is complete (after verifying everything works)
3. **Set up Cloud Functions** deployment for Stripe verification and other operations
4. **Update AdminDashboard** - Some queries use methods that don't exist (`.list()` instead of `.filter()`)
5. **Admin role functionality** - Implement proper Firebase custom claims for admin access
6. **Demo account creation** - Set up test accounts in Firebase Auth

## Common Issues & Solutions

### Issue: "Firebase API Key not found"
**Solution**: Ensure `.env.local` has correct Firebase config values from Firebase Console

### Issue: "Permission denied" on Firestore operations
**Solution**: Check Firestore security rules - make sure they match your use case

### Issue: Cloud Functions not working
**Solution**: Deploy functions using Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only functions
```

### Issue: Users can't sign up
**Solution**: You may need to implement Firebase `createUserWithEmailAndPassword` separately if email/password signup is disabled in Firebase Console Auth settings.

## Security Notes

1. **Never commit `.env.local`** - Use `.env.example` for reference
2. **Firestore Rules** must be properly configured - default rules are restrictive
3. **Cloud Functions** should validate all user inputs
4. **API Keys** should have IP restrictions and API quotas set

## Support

For Firebase documentation: https://firebase.google.com/docs
For Firestore queries: https://firebase.google.com/docs/firestore/query-data/get-data
For Cloud Functions: https://firebase.google.com/docs/functions
