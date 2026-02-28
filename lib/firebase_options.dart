// lib/firebase_options.dart
// Generated file for Firebase configuration
// Update with your Firebase project credentials

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    // TODO: Replace with your Firebase project credentials
    return const FirebaseOptions(
      apiKey: 'YOUR_FIREBASE_API_KEY',
      appId: 'YOUR_FIREBASE_APP_ID',
      messagingSenderId: 'YOUR_FIREBASE_MESSAGING_SENDER_ID',
      projectId: 'YOUR_FIREBASE_PROJECT_ID',
      authDomain: 'YOUR_FIREBASE_PROJECT_ID.firebaseapp.com',
      databaseURL: 'https://YOUR_FIREBASE_PROJECT_ID.firebaseio.com',
      storageBucket: 'YOUR_FIREBASE_PROJECT_ID.appspot.com',
    );
  }
}
