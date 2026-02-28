# Urban Pay - Setup & Integration Guide

## Overview
Urban Pay is a mobile payment system for garage sale sellers, enabling them to accept card and cash payments during their sales events. Buyers scan a QR code on the seller's phone to pay instantly via Stripe.

## Architecture

### Components
- **Mobile App (Flutter)**: Dashboard, QR code display, payment processing, sales history
- **Backend API (Deno)**: Payment intent creation, sales recording, transaction management
- **Firestore**: Sales records, seller statistics
- **Stripe**: Payment processing and settlement

### Data Flow

```
Seller Dashboard
    ├── Shows QR Code (links to: https://yourdomain.com/pay/{sellerId})
    ├── Records Card Payments (via Stripe)
    ├── Records Cash Payments (manual entry)
    └── Views Sales History & Earnings

When Buyer Scans QR:
    1. Opens payment page
    2. Enters (or sees pre-filled) amount
    3. Completes Stripe payment
    4. Sale automatically recorded in Firestore

Seller Dashboard Updates:
    1. Total earnings
    2. Transaction count
    3. Recent sales list
```

## Setup Instructions

### 1. Flutter App Configuration

#### A. Update pubspec.yaml
✅ Already updated with:
- firebase_core
- cloud_firestore
- firebase_auth
- flutter_stripe
- qr_flutter
- http
- intl
- provider

Run: `flutter pub get`

#### B. Initialize Stripe in main.dart
Add to your main() function before runApp():

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  
  Stripe.publishableKey = 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY';
  // For production: Stripe.publishableKey = 'pk_live_YOUR_STRIPE_KEY';
  
  runApp(const MyApp());
}
```

#### C. Add Urban Pay to Navigation
In your main app navigation, include:
```dart
const UrbanPayDashboard()  // Main Urban Pay screen
```

#### D. Platform-Specific Setup

**iOS (ios/Podfile)**:
```ruby
post_install do |installer|
  installer.pods_project.targets.each do |target|
    flutter_additional_ios_build_settings(target)
    target.build_configurations.each do |config|
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= [
        '$(inherited)',
        'PERMISSION_CAMERA=1',
      ]
    end
  end
end
```

**Android (android/app/build.gradle)**:
No additional configuration needed - flutter_stripe handles most setup automatically.

### 2. Backend API Setup

#### A. Update API Endpoint
In `lib/services/urban_pay_service.dart`, change:
```dart
static const String apiBaseUrl = 'https://your-deno-deployment-url.com';
```
to your actual Deno deployment URL.

#### B. Deploy urbanPayment.ts
The API file is ready at `API/urbanPayment.ts`

Deploy using Deno Deploy, Vercel, or your preferred serverless platform:

```bash
# Option 1: Deno Deploy CLI
deno deploy --project=your-project API/urbanPayment.ts

# Option 2: Manual upload to Vercel/other platform
# Follow their documentation for Deno functions
```

#### C. Environment Variables
Set these on your deployment platform:

- `FIREBASE_PROJECT_ID`: Your Firebase project ID
- `STRIPE_SECRET_KEY`: Your Stripe secret API key

### 3. Firestore Setup

#### A. Create Collections
Create these Firestore collections:

**1. sales** (auto-created on first record)
```
Document structure:
{
  sellerId: string,
  amount: number,
  description: string,
  paymentMethod: "card" | "cash",
  paymentIntentId: string | null,
  timestamp: ISO8601 string,
  status: "completed" | "recorded"
}
```

**2. sellerStats** (auto-created on first sale)
```
Document: {sellerId}
{
  sellerId: string,
  totalSales: number,
  transactionCount: number,
  firstSaleTime: ISO8601 string,
  lastSaleTime: ISO8601 string
}
```

**3. users** (add stripeAccountId field)
```
Document: {userId}
{
  // existing fields...
  stripeAccountId: string  // Connected Stripe account ID
}
```

#### B. Firestore Security Rules
Add these rules to your Firestore:

```javascript
// Only authenticated users can read their own sales
match /sales/{document=**} {
  allow read: if request.auth.uid == resource.data.sellerId;
  allow create: if request.auth.uid != null;
}

// Seller stats - read own, system creates
match /sellerStats/{sellerId} {
  allow read: if request.auth.uid == sellerId;
}

// Users - read own data
match /users/{userId} {
  allow read: if request.auth.uid == userId;
  allow update: if request.auth.uid == userId;
}
```

### 4. Stripe Configuration

#### A. Create Stripe Account
1. Go to https://stripe.com
2. Create/login to your Stripe account
3. Get your API keys from the Dashboard > Developers > API Keys

#### B. Set Up Connected Accounts (for seller payouts)
1. Enable Connect in your Stripe dashboard
2. When users create their garage sale, redirect them to:
   ```
   https://connect.stripe.com/oauth/authorize?
   client_id=YOUR_STRIPE_CLIENT_ID&
   state=YOUR_STATE&
   stripe_user[email]={seller_email}&
   stripe_user[first_name]={seller_first_name}&
   stripe_user[last_name]={seller_last_name}&
   stripe_user[street_address]={seller_address}
   ```

#### C. Save Connected Account ID
When seller authenticates with Stripe Connect, save their `stripeAccountId` to their user document in Firestore.

### 5. Create Payment Redirect Page

You need a web page that buyers see when scanning the QR code:

**Create: `web/pay/[sellerId].html`** or use your web-app routing:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Urban Garage Sale - Payment</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://js.stripe.com/v3/"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; }
    .container { max-width: 500px; margin: 50px auto; padding: 20px; }
    h1 { color: #001F3F; }
    .amount-input { font-size: 24px; padding: 10px; width: 100%; }
    button { background: #001F3F; color: white; padding: 12px; width: 100%; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Complete Payment</h1>
    <input type="number" id="amount" class="amount-input" placeholder="Amount ($)" step="0.01">
    <input type="text" id="description" placeholder="What are you buying?">
    <button onclick="processPayment()">Pay Now</button>
    <div id="status"></div>
  </div>

  <script>
    const stripe = Stripe('pk_test_YOUR_STRIPE_KEY');
    
    async function processPayment() {
      const amount = document.getElementById('amount').value;
      const description = document.getElementById('description').value;
      const sellerId = document.location.pathname.split('/')[2];
      
      // Call your backend to create payment intent
      const response = await fetch('/api/createPaymentIntent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId, amount, description })
      });
      
      // Handle Stripe payment...
    }
  </script>
</body>
</html>
```

## Files Created

- ✅ `API/urbanPayment.ts` - Backend payment API
- ✅ `lib/models/sale.dart` - Data models
- ✅ `lib/services/urban_pay_service.dart` - API service
- ✅ `lib/screens/urban_pay_dashboard.dart` - Main dashboard
- ✅ `lib/screens/urban_pay_payment.dart` - Card payment screen
- ✅ `lib/screens/manual_cash_entry.dart` - Cash entry screen

## Testing Urban Pay

### Development/Testing Mode
1. Use Stripe TEST keys (pk_test_xxx)
2. Test card numbers:
   - 4242 4242 4242 4242 (Visa - success)
   - 4000 0000 0000 0002 (Visa - decline)
   - 5555 5555 5555 4444 (Mastercard - success)

### Manual Testing Flow
1. Launch Flutter app
2. Navigate to Urban Pay Dashboard
3. View QR code
4. Scan QR or copy URL manually
5. Enter amount and description
6. Complete Stripe payment
7. Verify sale appears in history
8. Check seller stats updated

## Security Considerations

1. **Never expose Stripe Secret Key** in client code
2. **Use Firebase Authentication** to verify seller identity
3. **Validate amounts** on backend before processing
4. **Use HTTPS** for all payment communications
5. **Store Stripe Account IDs securely** in Firestore
6. **Implement webhook verification** for payment confirmations

## Integration Checklist

- [ ] Add Stripe publishable key to main.dart
- [ ] Deploy urbanPayment.ts API
- [ ] Set environment variables (STRIPE_SECRET_KEY, FIREBASE_PROJECT_ID)
- [ ] Create Firestore collections and security rules
- [ ] Update API base URL in urban_pay_service.dart
- [ ] Set up Stripe Connected Accounts
- [ ] Create payment redirect web page
- [ ] Test with Stripe test cards
- [ ] Configure production Stripe keys before launch

## Future Enhancements

- Push notifications when payment received
- Analytics/graphs for earnings over time
- Receipt emails for buyers
- Scheduled payouts to seller's bank account
- Multi-currency support
- Gratuity/tip options
- Inventory management during sales
- Customer profiles/repeat buyer tracking

## Support

For issues:
1. Check Stripe API documentation: https://stripe.com/docs
2. Check Firebase documentation: https://firebase.google.com/docs
3. Check Flutter Stripe plugin: https://pub.dev/packages/flutter_stripe
4. Check Deno documentation: https://deno.land/manual
