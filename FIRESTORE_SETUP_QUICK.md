# Firestore Setup - Quick Reference (5 Minutes)

## Go Here
1. Open https://console.firebase.google.com
2. Click project: **urbangaragesale**
3. Left sidebar: Click **Firestore Database**

---

## Create 4 Collections (Copy-Paste These)

### Collection 1: garageSales
- Click **Create Collection**
- Collection ID: `garageSales`
- Click **Auto-generate ID** then **Save**
- Add these fields to the document:
  - `title`: string → "Sample Garage Sale"
  - `suburb`: string → "Melbourne"
  - `postcode`: string → "3000"
  - `state`: string → "VIC"
  - `user_id`: string → "test123"
  - `created_by`: string → "seller@example.com"
  - `status`: string → "active"
  - `payment_status`: string → "pending"

### Collection 2: savedListings
- Click **Create Collection**
- Collection ID: `savedListings`
- Click **Auto-generate ID** then **Save**
- Add to document:
  - `user_id`: string → "test123"
  - `garage_sale_id`: string → "sample_id"

### Collection 3: payments
- Click **Create Collection**
- Collection ID: `payments`
- Click **Auto-generate ID** then **Save**
- Add to document:
  - `user_id`: string → "test123"
  - `amount`: number → 1000
  - `status`: string → "pending"

### Collection 4: users
- Click **Create Collection**
- Collection ID: `users`
- Document ID: `test123` (exactly this)
- Add to document:
  - `email`: string → "seller@example.com"
  - `full_name`: string → "Test Seller"

---

## Set Firestore Rules
1. In Firestore, go to **Rules** tab
2. Replace all content with:

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

3. Click **Publish**

---

## Set Firebase Storage Rules
1. In Firebase Console, go to **Storage** → **Rules** tab
2. Replace all content with:

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

3. Click **Publish**

---

## Set Firebase Storage Rules
1. In Firebase Console, go to **Storage** → **Rules** tab
2. Replace all content with:

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

3. Click **Publish**

---

## Create Test Accounts
1. Left sidebar → **Authentication**
2. Click **Users** tab
3. Click **Add User** button
4. Create 2 accounts:
   - Email: `seller@example.com` / Password: `password123`
   - Email: `buyer@example.com` / Password: `password123`

---

**Done!** Once finished, come back and we'll test the app.
