# Tap to Pay (Urban Pay mobile app)

Sellers take card payments with their own phone: the customer taps a card, phone or watch
on the back of it. No separate card reader is needed.

## How it works

1. The seller opens the **Tap to Pay** tab (only shown once card payments are enabled in their
   Profile) and picks one of their live garage sales.
2. The app asks for location permission (Stripe checks where each payment is taken), starts
   Stripe Terminal and calls `POST /api/urbanPayment/initializeTapToPayReader` with the garage sale.
3. The API checks the seller owns the sale, that it is live (`status: active`) and that card
   payments are enabled, then returns:
   - a Stripe **Terminal location** for the garage sale's address, created on first use and stored
     in `terminalLocations/{garageSaleId}` (server only);
   - the seller's connected account (`onBehalfOf`), because payments go to the seller.
4. The phone connects to itself as a Tap to Pay reader for that location.
5. Each payment: `createPaymentIntent` (`channel: tap_to_pay`, card-present, destination charge to
   the seller) → the customer taps → `recordTapToPaySale`, which reads the amount and status from
   Stripe, so the phone can't change them.

Code: `lib/services/tap_to_pay_service.dart` (Stripe Terminal through the
[`mek_stripe_terminal`](https://pub.dev/packages/mek_stripe_terminal) plugin),
`lib/screens/tap_to_pay_reader.dart`, `api/urbanPayment/initializeTapToPayReader.js`,
`api/_shared/terminal.js`.

## Requirements

| | Android | iPhone |
|---|---|---|
| Phone | NFC, Android 11+ recommended (app minimum 8.0), not rooted, Google Play services | iPhone XS or later, iOS 16.4+ (app minimum 15) |
| Build | **Release build** for real cards (Android refuses Tap to Pay in debug builds) | Built on a Mac with Xcode |
| Approval | None beyond Stripe | Apple's **Tap to Pay on iPhone entitlement** (see below) |

Stripe: Terminal must be available on the platform account (it is in Australia), and each seller's
connected account must be able to take card payments (`cardPaymentsEnabled`). Locations are in
Australia and charges are in AUD, as Stripe requires.

### iPhone entitlement (one-time)

1. In the Apple Developer account, request the *Tap to Pay on iPhone* entitlement for the app's
   bundle ID (Account → Certificates, Identifiers & Profiles → the App ID → Capabilities → request).
2. Once Apple approves it, in Xcode add `ios/Runner/Runner.entitlements` with
   `com.apple.developer.proximity-reader.payment.acceptance` = `YES`, and regenerate the
   provisioning profile. Don't add the entitlement before approval: signing will fail.

## Testing without a real card

Debug builds use Stripe's **simulated reader** automatically (override with
`--dart-define=TERMINAL_SIMULATED=false`). The simulated reader only works with Stripe
**test-mode** keys, so test against **staging** (see *Staging* in `DEPLOYMENT.md`): the
`urbangaragesale-staging` Firebase project and a Vercel Preview deployment of the API.

```bash
flutter run \
  --dart-define=FIREBASE_ENV=staging \
  --dart-define=STRIPE_PUBLISHABLE_KEY=pk_test_… \
  --dart-define=API_BASE_URL=https://<preview-deployment>.vercel.app/api \
  --dart-define=VERCEL_PROTECTION_BYPASS=<bypass secret>
```

The bypass secret is under Vercel → `urban-garage-sale` → Settings → Deployment Protection →
Protection Bypass for Automation. Never pass it, or `FIREBASE_ENV=staging`, to a release build.

Test accounts live only in staging: sign up in the test build with any email you control. The
garage sale must be live (`active`) and the seller's **test** connected account must have card
payments enabled.

## Going live checklist

- [ ] Android: release signing key and real `applicationId` (currently `com.example…`).
- [ ] iPhone: entitlement approved and added; build on a Mac.
- [ ] Test a real $0.50 payment on an Android release build and an iPhone, then refund it in Stripe.
- [ ] Stripe Dashboard → Terminal → Locations shows one location per garage sale used.
