# Stripe Terminal Setup Guide

This document outlines the setup required to enable Tap-to-Pay functionality using Stripe Terminal in the UrbanGarageSale app.

## Prerequisites

- Stripe Terminal account (apply at https://stripe.com/docs/terminal)
- Stripe Terminal-compatible reader (Chipper 2X, WisePOS E, or others)
- iOS 13+ or Android 7+

## iOS Setup

### 1. Add Stripe Terminal SDK to Podfile

```ruby
# ios/Podfile
pod 'StripeTerminal'
```

### 2. Update Runner.xcodeproj

1. Open `ios/Runner.xcodeproj` in Xcode
2. Select **Runner** → **Build Settings**
3. Search for **Framework Search Paths**
4. No additional setup needed if using CocoaPods

### 3. Update Info.plist

```xml
<!-- ios/Runner/Info.plist -->
<key>NSBluetoothPeripheralUsageDescription</key>
<string>We need Bluetooth to connect to payment reader</string>
<key>NSBluetoothAlwaysUsageDescription</key>
<string>We need Bluetooth to accept payments</string>
<key>NSLocalNetworkUsageDescription</key>
<string>We need local network access for payment reader</string>
<key>NSBonjourServices</key>
<array>
    <string>_connection-token._tcp</string>
</array>
```

### 4. Capabilities

1. In Xcode: **Runner** → **Signing & Capabilities**
2. Click **+ Capability**
3. Add:
   - **Background Modes** → Check "External accessory communication"
   - **Bluetooth** → Check both Bluetooth permissions
   - **Local Network**

## Android Setup

### 1. Add Dependencies

Update `android/app/build.gradle`:

```gradle
dependencies {
    // Stripe Terminal
    implementation 'com.stripe:stripeterminal:3.2.0'
    
    // Add these if not present
    implementation 'org.json:json:20230227'
    implementation 'androidx.appcompat:appcompat:1.6.1'
}
```

### 2. Update AndroidManifest.xml

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

### 3. Runtime Permissions (Android 12+)

Update `MainActivity.kt`:

```kotlin
import android.Manifest
import android.os.Build

class MainActivity: FlutterActivity() {
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        // Request Bluetooth permissions at runtime
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissions(arrayOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.ACCESS_FINE_LOCATION
            ), 1)
        }
    }
}
```

## Backend Configuration

The backend needs to provide connection tokens for Terminal. See `/api/stripeTerminal/createConnectionToken.js`.

**Required environment variables in Vercel:**
```
STRIPE_SECRET_KEY=sk_live_...
FIREBASE_PROJECT_ID=urbangaragesale
FIREBASE_SERVICE_ACCOUNT_JSON={...}
```

## Usage

### In Flutter Code

```dart
import 'services/stripe_terminal_service.dart';

// 1. Get connection token
String token = await StripeTerminalService.getConnectionToken(authToken);

// 2. Discover readers
List<Map<String, dynamic>> readers = await StripeTerminalService.discoverReaders();

// 3. Connect to a reader
await StripeTerminalService.connectReader(readers[0]['id']);

// 4. Collect payment
Map<String, dynamic> payment = await StripeTerminalService.collectPayment(
  100.00, // Amount in dollars
  'Garage sale items',
  paymentIntentId,
);

// 5. Disconnect
await StripeTerminalService.disconnectReader();
```

### Integration with UrbanPay

The Stripe Terminal integration is ready to be added to the UrbanPay page. You can:

1. Show a "Select Reader" dialog after clicking "Tap to Pay"
2. Call `discoverReaders()` to find available terminals
3. Let the user select which reader to use
4. Call `collectPayment()` when customer taps card
5. Record the transaction in Firestore

## Testing

### Stripe Test Reader

While waiting for physical readers, use Stripe's simulated reader:

```dart
// The service uses simulated mode by default in dev
// It will return mock readers and payments for testing
```

### Test Payment Card

Use Stripe test cards:
- `4242 4242 4242 4242` (success)
- `4000 0000 0000 0002` (failure)

## Troubleshooting

### "Terminal not initialized"
- Ensure `StripeTerminalService.initializeTerminal()` was called in `main()`
- Check Stripe publishable key is correct

### Bluetooth Permissions Denied
- Check `Info.plist` (iOS) and `AndroidManifest.xml` have correct permissions
- Prompt user for runtime permissions (Android 6+)

### Reader Not Discovered
- Ensure reader is turned on and within Bluetooth range
- Check device Bluetooth is enabled
- Try physical device instead of emulator (Bluetooth can be unreliable on emulators)

### Payment Fails
- Verify connection token is valid and recent (expires 15 min)
- Check reader has good network connection
- Ensure payment intent exists and hasn't expired

## Next Steps

1. ✅ Stripe Terminal SDK integrated
2. ✅ Platform channels configured
3. ✅ Method channel setup for iOS/Android
4. ✅ Backend connection token endpoint created
5. ⬜ Update UrbanPay UI to add reader selection
6. ⬜ Add payment confirmation screen
7. ⬜ Handle terminal reader lifecycle events
8. ⬜ Store transaction receipts

## Resources

- [Stripe Terminal Docs](https://stripe.com/docs/terminal)
- [Stripe Terminal iOS SDK](https://github.com/stripe/stripe-terminal-ios)
- [Stripe Terminal Android SDK](https://github.com/stripe/stripe-terminal-android)
- [Flutter Platform Channels](https://flutter.dev/docs/development/platform-integration/platform-channels)
