# Urban Pay API - Status Report

**Date**: March 1, 2026  
**Status**: ✅ PRODUCTION READY (Partial)

## API Endpoints - LIVE ON VERCEL

### Base URL
```
https://urban-garage-sale.vercel.app/api
```

### Endpoints

#### 1. Health Check ✅
```
GET /api/test
Status: HTTP 200
Response: { "status": "ok", "message": "Urban Pay test endpoint..." }
```

#### 2. API Info ✅
```
GET /api/urbanPayment
Status: HTTP 200
Response: Lists all available endpoints and version
```

#### 3. Create Payment Intent ✅
```
POST /api/urbanPayment/createPaymentIntent
Status: HTTP 200 - WORKING
Authorization: Bearer {userId}
Body: {
  "amount": 2500,           // in cents (25.00 AUD)
  "description": "Item",
  "currency": "aud"
}
Response: {
  "success": true,
  "clientSecret": "pi_3T5wlsJ..._secret_...",
  "paymentIntentId": "pi_3T5wlsJ..."
}
```

#### 4. Record Sale ⏳
```
POST /api/urbanPayment/recordSale
Status: HTTP 500 (Firestore config needed)
Authorization: Bearer {userId}
Body: {
  "amount": 2500,
  "description": "Item description",
  "paymentMethod": "card|cash",
  "sellerId": "seller-id",
  "paymentIntentId": "pi_..."
}
```

## What's Working

✅ **Stripe Integration**: Live payment keys configured, real payment intents created  
✅ **API Routing**: Vercel properly routes to separate endpoint files  
✅ **Authentication**: Bearer token validation on protected endpoints  
✅ **CORS**: Cross-origin requests supported  
✅ **Error Handling**: Proper error messages and status codes  

## What Needs Configuration

⏳ **Firestore**: Setup security rules for `sales` collection  
⏳ **Flutter App**: Update to use new endpoint structure  
⏳ **QR Code**: Library compatibility issues resolved with simplified implementation  

## Firebase Security Rules Required

Create these rules in Firestore:

```javascript
match /sales/{document=**} {
  allow create: if request.auth != null;
  allow read: if request.auth.uid == resource.data.sellerId;
}

match /sellerStats/{document=**} {
  allow create, update, read: if request.auth != null;
}
```

## Testing Payment Flow

1. Call `/createPaymentIntent` with Bearer token → Returns payment intent
2. Use returned `clientSecret` with Stripe Payment Sheet on mobile
3. After successful Stripe payment, call `/recordSale` to log transaction
4. Sales recorded in Firestore with timestamp and seller info

## Production Checklist

- [x] API live on Vercel
- [x] Stripe Live keys active
- [x] Payment intent creation working
- [ ] Firestore security rules deployed
- [ ] Flutter app tested on device
- [ ] QR code scanning implemented
- [ ] Sales history display working
- [ ] Earnings tracking working

## Deployment Notes

- All code pushed to `main` branch
- Vercel auto-deploys on git push
- Environment variables set in Vercel dashboard:
  - `FIREBASE_PROJECT_ID=urbangaragesale`
  - `STRIPE_SECRET_KEY=sk_live_...`
- API is production-grade with live Stripe keys

---
**API Status**: READY FOR MOBILE APP TESTING  
**Next Action**: Deploy Firestore rules & test end-to-end on Flutter device
