# Urban Pay - Stripe Tap to Pay Implementation

## Overview

Urban Pay now supports **Stripe Tap to Pay**, enabling merchants to accept contactless payments (cards, Apple Pay, Google Pay, Samsung Pay) directly on their iPhone or Android device **without requiring any additional hardware**.

## What is Tap to Pay?

Tap to Pay is Stripe's "phone as terminal" technology that leverages:
- **NFC (Near Field Communication)** capability built into modern smartphones
- **iOS devices**: iPhone XS and later with iOS 16 or later (Tap to Pay on iPhone)
- **Android devices**: Compatible Android 8.0+ with NFC support (Tap to Pay on Android)

## Architecture

### Frontend (Flutter Mobile App)

**New Screens:**
- `lib/screens/urban_pay_home.dart` - Navigation hub with Dashboard and Tap to Pay tabs
- `lib/screens/tap_to_pay_reader.dart` - Main Tap to Pay reader interface

**Services:**
- `lib/services/tap_to_pay_service.dart` - Handles Tap to Pay initialization, payment processing, and reader management

**Features:**
- Reader activation status display
- Quick amount buttons ($5, $10, $20, $50, $100, $250)
- Custom amount entry with optional item description
- Real-time transaction feedback
- Payment confirmation with transaction ID

### Backend (Vercel API)

**New Endpoints:**

1. **POST `/api/urbanPayment/initializeTapToPayReader`**
   - Initializes a Tap to Pay reader for a seller
   - Returns: `readerRegistrationToken`
   - Registers reader info in backend

2. **POST `/api/urbanPayment/recordTapToPaySale`**
   - Records a completed Tap to Pay transaction
   - Verifies payment intent with Stripe
   - Stores sale in Firestore with Tap to Pay metadata
   - Tracks transaction fees and net earnings

3. **Updated GET `/api/urbanPayment/sellerStats`**
   - Now includes:
     - `tapToPayEarnings` - Total earnings from Tap to Pay
     - `tapToPayTransactions` - Count of Tap to Pay transactions

## How It Works

### User Flow for Sellers

1. **Access Tap to Pay**
   - Tap the "Tap to Pay" tab in bottom navigation
   - Flutter app displays reader interface

2. **Activate Reader**
   - Tap "Activate Reader" button
   - Device initializes NFC reader capabilities
   - Status changes to "Reader Active"

3. **Accept Payment**
   - Choose quick amount or enter custom amount
   - Customer taps their card/phone at device
   - NFC transaction processes through Stripe
   - Payment confirmed immediately
   - Transaction ID displayed

4. **Track Earnings**
   - Return to Dashboard tab
   - View updated total earnings
   - See breakdown in transaction history

## Technical Details

### Payment Flow

```
1. Seller enters amount in app
   ↓
2. App creates Payment Intent via Stripe API
   ↓
3. Tap to Pay Reader initializes on device
   ↓
4. Customer taps card/Apple Pay/Google Pay
   ↓
5. NFC transaction completes
   ↓
6. Payment Intent confirmed with Stripe
   ↓
7. Sale recorded to Firestore
   ↓
8. Earnings updated in real-time
```

### Stripe Integration

**Publishable Key:** `pk_live_OlSbCxeHrHkFwobGROFX32Md` (Live)
- Used in Flutter app for payment initialization
- Hardcoded in `lib/main.dart`

**Secret Key:** Environment variable `STRIPE_SECRET_KEY` (Vercel)
- Used in backend to verify payments
- Configured in Vercel secrets

**Payment Intents:**
- Created on-demand for each transaction
- Automatic currency conversion (AUD)
- 2.9% + $0.30 transaction fee (Stripe standard)

### Firebase Firestore Collections

**New/Updated Collections:**

- **`/sales`** - All transactions (payment method tagged as 'tap_to_pay')
- **`/sellerStats`** - Aggregated earnings by seller
  - `totalEarnings` - All payment methods
  - `totalSales` - All transactions
  - `tapToPayEarnings` - Tap to Pay only
  - `tapToPayTransactions` - Tap to Pay count

**Sample Sale Record:**
```javascript
{
  sellerId: "user_123",
  amount: 25.00,
  description: "Tap to Pay Sale - $25.00",
  paymentMethod: "tap_to_pay",
  paymentIntentId: "pi_3T5x0pJfup56Xzkj0...",
  status: "completed",
  currency: "AUD",
  timestamp: Timestamp(2026-03-01T...),
  transactionFee: 1.03,
  netEarnings: 23.97
}
```

## Device Requirements

### iPhone (Recommended)
- iPhone XS or later
- iOS 16.0 or later
- NFC capabilities enabled
- Requires contactless-capable cards/Apple Pay

### Android
- Android 8.0 or later
- NFC hardware support
- Google Pay or compatible payment app installed
- Contactless payment support

## Security Considerations

✅ **Implemented:**
- Firebase Authentication required
- Bearer token validation on all endpoints
- Stripe Payment Intent verification
- Firestore security rules for seller isolation

**Add for Production:**
- TLS/HTTPS for all API calls (automatic with Vercel)
- Stripe webhook signatures for payment verification
- Rate limiting on reader initialization
- Audit logging of all transactions
- PCI compliance verification

## Testing

### Simulate on Device

```bash
# iOS (Mac required)
flutter run -d <iPhone_ID>

# Android
flutter run -d <Android_Device_ID>
```

### Test Cards (Stripe)

Use these test card numbers in development:
- Visa: `4242 4242 4242 4242`
- Mastercard: `5555 5555 5555 4444`
- Amex: `3782 822463 10005`

Use any future expiry date and CVC.

### API Testing

```bash
# Initialize reader
curl -X POST https://urban-garage-sale.vercel.app/api/urbanPayment/initializeTapToPayReader \
  -H "Authorization: Bearer <firebase_token>" \
  -H "Content-Type: application/json" \
  -d '{"sellerId":"seller_123","sellerEmail":"seller@example.com"}'

# Record sale (after payment confirmed)
curl -X POST https://urban-garage-sale.vercel.app/api/urbanPayment/recordTapToPaySale \
  -H "Authorization: Bearer <firebase_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount":25.00,
    "description":"Test Sale",
    "paymentIntentId":"pi_...",
    "currency":"aud"
  }'
```

## Features

### Current Features ✅
- NFC-based contactless payments
- Apple Pay support (iOS)
- Google Pay support (Android)
- Quick amount buttons
- Custom amount entry
- Real-time transaction confirmation
- Seller stats with Tap to Pay breakdown
- Firestore integration
- Firebase authentication

### Future Enhancements 🔄
- Physical card readers (Stripe Terminal API)
- Receipt generation/printing
- Inventory management integration
- Customer loyalty tracking
- Scheduled payouts dashboard
- Offline payment queuing
- Multi-reader management
- Advanced analytics

## Firestore Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Sales collection - Tap to Pay records
    match /sales/{saleId} {
      allow create: if request.auth.uid != null;
      allow read: if request.auth.uid == resource.data.sellerId || 
                     request.auth.token.admin == true;
      allow update: if request.auth.uid == resource.data.sellerId && 
                       resource.data.status == 'pending';
      allow delete: if request.auth.token.admin == true;
    }

    // Seller stats
    match /sellerStats/{sellerId} {
      allow read, write: if request.auth.uid == sellerId;
      allow read: if request.auth.token.admin == true;
      allow update: if request.auth.token.admin == true;
      allow delete: if request.auth.token.admin == true;
    }
  }
}
```

## File Structure

```
lib/
├── services/
│   ├── tap_to_pay_service.dart       ← New Tap to Pay service
│   └── urban_pay_service.dart
├── screens/
│   ├── urban_pay_home.dart           ← New navigation home
│   ├── tap_to_pay_reader.dart        ← New Tap to Pay interface
│   ├── urban_pay_dashboard.dart
│   ├── urban_pay_payment.dart
│   └── manual_cash_entry.dart
└── main.dart                          ← Updated to use UrbanPayHome

API/urbanPayment/
├── initializeTapToPayReader.js       ← New endpoint
├── recordTapToPaySale.js             ← New endpoint
├── createPaymentIntent.js
└── recordSale.js
```

## Deployment

### Flutter App
```bash
cd /path/to/UrbanGarageSale
flutter pub get
flutter run -d <device>
```

### Backend API (Auto-deploy)
- Vercel auto-deploys on `git push` to `main` branch
- New endpoints automatically available
- Environment variables: `STRIPE_SECRET_KEY`

### Firestore Rules
Deploy security rules using `firebase` CLI:
```bash
firebase deploy --only firestore:rules
```

## Troubleshooting

### Issue: "Tap to Pay not supported on this device"
**Solution:** Ensure device has NFC hardware and is on supported OS (iOS 16+ or Android 8.0+)

### Issue: "Reader initialization failed"
**Solution:** 
- Check Firebase authentication
- Verify `STRIPE_SECRET_KEY` on Vercel
- Check network connectivity

### Issue: Payment fails after tap
**Solution:**
- Verify Stripe live keys are correct
- Ensure card is contactless-capable
- Check Stripe account status

### Issue: Transaction not recorded
**Solution:**
- Check Firestore rules deployment
- Verify Firestore collection permissions
- Check backend API logs on Vercel

## Support Resources

- **Stripe Docs:** https://stripe.com/docs/tap-to-pay-mobile
- **Flutter Stripe Plugin:** https://pub.dev/packages/flutter_stripe
- **Firebase Documentation:** https://firebase.google.com/docs
- **NFC in Flutter:** https://pub.dev/packages/nfc_manager

## Summary

Tap to Pay transforms Urban Pay from a QR code/manual entry system into a modern, **hardware-free POS solution**. Sellers can now accept contactless payments instantly on any compatible smartphone, making it perfect for garage sales and mobile commerce.

**Key Benefits:**
- 💳 Accept all major payment methods
- 📱 Works on any modern smartphone
- 🚀 Instant payment processing
- 📊 Real-time earnings tracking
- 🔒 Secure Stripe integration
- 💰 Low transaction fees (2.9% + $0.30)
