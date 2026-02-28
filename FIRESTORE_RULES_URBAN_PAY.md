# Urban Pay - Firestore Security Rules Deployment

## Overview

The Firestore security rules have been updated to support **Urban Pay** - the real-time payment system for garage sales.

## New Collections

### 1. `sales` Collection
Stores individual sale transactions from Urban Pay.

**Document Structure:**
```json
{
  "sellerId": "user-id-123",
  "amount": 2500,
  "description": "Vintage Lamp",
  "paymentMethod": "card|cash",
  "paymentIntentId": "pi_3T5x...",
  "timestamp": "2026-03-01T12:34:56Z",
  "status": "completed|recorded"
}
```

**Security Rules:**
```
✅ Sellers can CREATE their own sales
✅ Sellers can READ their own sales
✅ Admins can READ all sales
✅ Sellers can UPDATE their own sales
❌ Only admins can DELETE sales
```

### 2. `sellerStats` Collection
Aggregated statistics for sellers (earnings, transaction count, etc).

**Document Structure:**
```json
{
  "sellerId": "user-id-123",
  "totalEarnings": 25000,
  "totalSales": 10,
  "averageAmount": 2500,
  "lastUpdated": "2026-03-01T12:34:56Z"
}
```

**Security Rules:**
```
✅ Users can READ their own stats
✅ Users can WRITE their own stats
✅ Admins can READ all stats
✅ Admins can UPDATE stats
❌ Only admins can DELETE stats
```

## Deployment Instructions

### Option 1: Firebase Console (Recommended)

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select Project**: `urbangaragesale`
3. **Navigate**: Firestore Database → Rules
4. **Copy this file content** [firestore.rules](../firestore.rules)
5. **Paste** into the rules editor
6. **Click "Publish"**

### Option 2: Firebase CLI

```bash
# Login to Firebase
firebase login

# Set project
firebase use urbangaragesale

# Deploy rules
firebase deploy --only firestore:rules
```

### Option 3: GitHub Actions (Auto-Deploy)

Add this workflow to `.github/workflows/deploy-firestore.yml`:

```yaml
name: Deploy Firestore Rules
on:
  push:
    branches: [main]
    paths: ['firestore.rules']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: urbangaragesale
```

## Testing the Rules

### In Firebase Emulator (Local)

```bash
firebase emulators:start --only firestore
```

### From Urban Pay API

The API automatically validates rules when:

```javascript
// Creating a sale
POST /api/urbanPayment/recordSale
Authorization: Bearer {userId}
Body: {
  "sellerId": "{userId}",
  "amount": 2500,
  "description": "Item",
  "paymentMethod": "card",
  "paymentIntentId": "pi_..."
}
```

## Rule Verification Checklist

- [ ] Rules deployed to Firebase Console
- [ ] `/sales` collection accepts seller transactions
- [ ] `/sellerStats` collection stores user statistics
- [ ] Sellers cannot read other sellers' sales
- [ ] Admins can read all sales
- [ ] Timestamp is required in all sales records
- [ ] Payment intent ID is stored for Stripe reconciliation

## Security Model

```
┌─────────────────────────────────────────┐
│         Urban Pay Transaction           │
└────────────┬────────────────────────────┘
             │
             ├─→ API: /createPaymentIntent
             │   └─→ Returns: clientSecret, paymentIntentId
             │
             ├─→ Mobile: Stripe Payment Sheet
             │   └─→ Returns: paymentIntentId confirmation
             │
             └─→ API: /recordSale
                 ├─→ Validates: Bearer token = sellerId
                 ├─→ Creates: /sales/{saleId}
                 ├─→ Updates: /sellerStats/{sellerId}
                 └─→ Firestore rules enforce access
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing or insufficient permissions" | Check `sellerId` matches `request.auth.uid` |
| "Invalid Bearer token" | Ensure Firebase Auth token is valid |
| "Failed to record sale" | Verify Firestore document structure matches schema |
| "Stats not updating" | Check SellerStats collection permissions |

## Related Files

- **API Handler**: [api/urbanPayment/recordSale.js](../api/urbanPayment/recordSale.js)
- **Rules**: [firestore.rules](../firestore.rules)
- **Status**: [URBAN_PAY_STATUS.md](../URBAN_PAY_STATUS.md)
- **Flutter Service**: [lib/services/urban_pay_service.dart](../lib/services/urban_pay_service.dart)

## Next Steps

1. ✅ Rules defined in firestore.rules
2. ⏳ Deploy rules to Firebase Console
3. ⏳ Test with mobile app or API
4. ⏳ Monitor Firestore analytics
5. ⏳ Set up automated backups

---

**Status**: Rules ready for deployment  
**Last Updated**: March 1, 2026  
**Required for**: Urban Pay live transactions
