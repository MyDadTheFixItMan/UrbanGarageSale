# Stripe Terminal Testing Setup - Complete Guide

## ✅ Setup Status

### Completed Automated Steps
- ✅ **iOS Configuration** - Bluetooth permissions added to Info.plist
- ✅ **Android Configuration** - Dependencies and permissions configured
- ✅ **Flutter Service Layer** - `stripe_terminal_service.dart` fully implemented
- ✅ **iOS Native Code** - `StripeTerminalPlugin.swift` ready (Swift)
- ✅ **Android Native Code** - `StripeTerminalManager.kt` ready (Kotlin)
- ✅ **UI Integration** - `tap_to_pay_reader.dart` integrated with Stripe Terminal
- ✅ **Backend API** - Connection token endpoint deployed to Vercel
- ✅ **Git Deployment** - All code committed and pushed (commit b33c1e4)

### Remaining Manual Steps (Do These Now)

## iOS Setup (For iPhone Testing)

### Step 1: Install CocoaPods Dependencies
After pulling the latest code, run:
```bash
cd ios
pod install --repo-update
cd ..
```

**What it does:** Installs the Stripe Terminal SDK for iOS via CocoaPods

### Step 2: Open Xcode and Configure Capabilities
```bash
open ios/Runner.xcworkspace
```

In Xcode:
1. Select **Runner** in the left sidebar
2. Select **Runner** target (not the project)
3. Go to **Signing & Capabilities** tab
4. Click **+ Capability** button
5. Add these capabilities:
   - ✅ **Background Modes**
     - Check: "External accessory communication"
   - ✅ **Bluetooth** (may already exist)
   - ✅ **Local Network** (may need to add)

### Step 3: Verify Info.plist Bluetooth Entries
The following entries should already be in `ios/Runner/Info.plist`:
```xml
<key>NSBluetoothPeripheralUsageDescription</key>
<string>We need Bluetooth to connect to payment readers and accept card payments</string>
<key>NSBluetoothAlwaysUsageDescription</key>
<string>We need Bluetooth to connect to payment readers and accept card payments</string>
<key>NSBluetoothCentralUsageDescription</key>
<string>We need Bluetooth to connect to payment readers</string>
<key>NSLocalNetworkUsageDescription</key>
<string>We need local network access to connect to payment readers</string>
<key>NSBonjourServices</key>
<array>
    <string>_stripe_terminal._tcp</string>
</array>
```

✅ **Already configured**

### Step 4: Enable Local Network Privacy (Xcode)
1. In Xcode, select **Runner** target
2. Go to **Build Settings**
3. Search for "LOCAL_NETWORK"
4. Make sure `NSLocalNetworkUsageDescription` is set ✅

## Android Setup (For Android Testing)

### Step 1: Verify Gradle Dependency
The Stripe Terminal dependency should be in `android/app/build.gradle.kts`:
```kotlin
dependencies {
    // Stripe Terminal for payment readers
    implementation("com.stripe:stripeterminal:3.2.0")
}
```

✅ **Already configured**

### Step 2: Verify AndroidManifest Permissions
The following permissions should be in `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CHANGE_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

✅ **Already configured**

### Step 3: Gradle Sync
In Android Studio:
1. File → Sync Now
2. Wait for Gradle sync to complete
3. Should show no errors

Or from command line:
```bash
cd android
./gradlew clean build
cd ..
```

## Next: Build and Test

### iOS Build & Run
```bash
# Clean and build for iOS
flutter clean
flutter pub get
flutter run -d iPhone  # or your specific device

# Or with verbose output for debugging
flutter run -d iPhone -v
```

### Android Build & Run
```bash
# Clean and build for Android
flutter clean
flutter pub get
flutter run -d android  # or your specific device

# Or with verbose output for debugging
flutter run -d android -v
```

## Testing the Integration

### Prerequisites
1. **Physical iPhone or Android device** (Bluetooth is unreliable on emulators)
2. **Stripe Terminal Reader** (Chipper 2X, WisePOS E, etc.)
3. **Device with Bluetooth enabled**
4. **Firebase Login** with 2FA enabled in your test account

### Test Flow
1. **Launch App**
   ```bash
   flutter run -d <device_id>
   ```

2. **Navigate to UrbanPay > Tap to Pay**
   - Should see "No reader connected" message
   - "Connect Reader" button available

3. **Select & Connect Reader**
   - Tap "Select & Connect Reader" button
   - Wait for reader discovery (shows "Searching for readers...")
   - Should see your Stripe Terminal reader in the list
   - Tap to connect

4. **Enter Payment Details**
   - Enter amount (e.g., "10.50")
   - Enter description (e.g., "Test Sale")
   - Tap "Collect Payment"

5. **Payment Collection Screen**
   - Shows amount and "Ready to collect payment"
   - Instructions: "Tap card or phone on reader"
   - Blue Bluetooth indicator shows connection status

6. **Tap Payment**
   - Use **Stripe test card**: `4242 4242 4242 4242`
   - Any future expiry date
   - Any CVC/ZIP
   - **Hold card on reader** for 1-2 seconds until payment completes

7. **Verify Success**
   - Screen should show ✓ checkmark
   - Navigate back to Tap to Pay
   - Stats should update with new sale (may need to refresh)
   - Check Firestore in [Firebase Console](https://console.firebase.google.com):
     - `sales/` collection should have new document
     - `sellerStats/{userId}` should show updated earnings

## Troubleshooting

### "Reader not discovered"
- **Cause**: Bluetooth disabled or reader out of range
- **Fix**: 
  - Enable Bluetooth on device
  - Bring reader within 10 feet
  - Restart reader and try again
  - Check that reader is not connected to another device

### "Permission denied" errors
- **iOS**: Go to Settings → App → Permissions → Enable Bluetooth (iOS 13+)
- **Android**: Go to Settings → Apps → UrbanGarageSale → Permissions → Enable Bluetooth

### "Connection timeout"
- **Cause**: Reader not compatible or Stripe Terminal not enabled
- **Fix**:
  - Verify Stripe Terminal reader model (Chipper 2X, WisePOS E, etc.)
  - Check that Stripe Terminal is enabled in your [Stripe Dashboard](https://dashboard.stripe.com)
  - Restart reader and app

### "Payment failed" with no card collected
- **Cause**: Reader may not have collected card tap
- **Fix**:
  - Hold card firmly on reader for 1-2 seconds
  - Try a different card or phone
  - Verify test card `4242 4242 4242 4242` is working
  - Check [Stripe Dashboard](https://dashboard.stripe.com) for payment intent details

### App Crashes on Payment Screen
- **Cause**: Native platform channel error
- **Fix**:
  - Check logcat (Android) or Xcode console (iOS) for stack trace
  - Verify native code compilation: `flutter clean && flutter pub get`
  - Run with `-v` flag for verbose output: `flutter run -d <device> -v`

## Verification Checklist

Before testing on a physical device:

- [ ] iOS: Ran `pod install --repo-update` in `ios/` directory
- [ ] iOS: Opened Xcode and added capabilities (Background Modes, Local Network)
- [ ] iOS: Verified Info.plist has Bluetooth entries
- [ ] Android: Verified Gradle dependency in build.gradle.kts
- [ ] Android: Verified permissions in AndroidManifest.xml
- [ ] Android: Ran Gradle sync or `./gradlew clean build`
- [ ] Called `flutter pub get` after all changes
- [ ] Device has Bluetooth enabled
- [ ] Firebase account has 2FA enabled (required for sales)
- [ ] Stripe Terminal reader is powered on and nearby
- [ ] Stripe test card available: `4242 4242 4242 4242`

## File Locations Reference

| Component | File Path |
|-----------|-----------|
| iOS Config | `ios/Runner/Info.plist` |
| iOS Native Code | `ios/Runner/StripeTerminalPlugin.swift` |
| iOS Xcode Project | `ios/Runner.xcworkspace/` |
| Android Config | `android/app/build.gradle.kts` |
| Android Permissions | `android/app/src/main/AndroidManifest.xml` |
| Android Native Code | `android/app/src/main/kotlin/StripeTerminalManager.kt` |
| Flutter Service | `lib/services/stripe_terminal_service.dart` |
| UI Integration | `lib/screens/tap_to_pay_reader.dart` |
| Reader Dialog | `lib/widgets/reader_selection_dialog.dart` |
| Payment Screen | `lib/screens/terminal_payment_screen.dart` |
| Backend Endpoint | `api/stripeTerminal/createConnectionToken.js` |

## Support Resources

- **Stripe Terminal Docs**: https://stripe.com/docs/terminal
- **Stripe Test Cards**: https://stripe.com/docs/testing#test-cards
- **Firebase Console**: https://console.firebase.google.com
- **Stripe Dashboard**: https://dashboard.stripe.com

## Next Steps

1. ✅ **Complete iOS/Android setup** (this document)
2. 🔄 **Run on physical device** with Stripe Terminal reader
3. 📊 **Test full payment flow** (discover → connect → collect → record)
4. 🎯 **Verify stats update** in app and Firestore
5. 🚀 **Deploy to production** when testing complete

---

**Status**: Setup Complete - Ready for Device Testing  
**Last Updated**: March 4, 2026  
**Deployment Commit**: b33c1e4
