# Firestore Rules Deployment Guide

## How to Update Firestore Security Rules

### Option 1: Deploy via Firebase Console (Manual)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **urban-garage-sale-dev**
3. Go to **Firestore Database** → **Rules** tab
4. Replace all existing rules with the rules from `firestore.rules` file
5. Click **Publish**

### Option 2: Deploy via Firebase CLI (If Installed)

```bash
firebase deploy --only firestore:rules
```

## Updated Rules (For Manual Entry)

Copy and paste these rules into Firebase Console Firestore Rules tab:

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

    // Garage sales listings (public read, authenticated create, own/admin update)
    match /garageSales/{document=**} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null && (
        request.auth.uid == resource.data.user_id || isAdmin()
      );
      allow delete: if request.auth != null && (
        request.auth.uid == resource.data.user_id || isAdmin()
      );
    }

    // Saved listings (user-specific)
    match /savedListings/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.user_id;
      allow create: if request.auth != null;
    }

    // Payment records (user can read own, admin can read all, functions write)
    match /payments/{document=**} {
      allow read: if request.auth != null && (
        request.auth.uid == resource.data.user_id || isAdmin()
      );
      allow create: if request.auth != null;
      allow write: if false; // Cloud Functions only
    }

    // User profiles
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && isAdmin();
    }
  }
}
```

## Key Changes from Previous Rules

1. **Added `admin_settings` collection** - Allows authenticated users to READ promotional messages, but ONLY admins can WRITE them
2. **Updated `garageSales` rules** - Now admins can UPDATE any listing (previously only owners could)
3. **Added `isAdmin()` helper function** - Reusable logic to check admin status across rules
4. **Clarified payment rules** - Users can only read their own payments; functions handle payments

## Testing the Rules

After publishing:

1. **Test promotional message read**: Admin Dashboard should load without permission errors
2. **Test promotional message write**: Admin should be able to create/edit promotional messages
3. **Test listing approval**: Admin should be able to update listing status (pending → approved)

## Troubleshooting

If you still get permission errors:

1. Make sure the user account is marked as admin in Firestore `users/{uid}` doc
   - Should have `role: 'admin'` field
2. Hard refresh browser (Ctrl+Shift+R)
3. Check browser console for specific error messages
4. Verify the rules were published successfully (status should show green checkmark)

