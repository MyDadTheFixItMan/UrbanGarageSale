// lib/firebase_options.dart
// Firebase configuration for UrbanGarageSale

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;

/// Which Firebase project the app uses: `production` (default) or `staging`, e.g.
///   flutter run --dart-define=FIREBASE_ENV=staging
/// Staging is a separate project (urbangaragesale-staging) with Stripe test keys, so tests never
/// touch live data. Pair it with the staging API (API_BASE_URL) and a pk_test_ key.
const String firebaseEnv = String.fromEnvironment('FIREBASE_ENV', defaultValue: 'production');

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform => switch (firebaseEnv) {
        'production' => production,
        'staging' => staging,
        _ => throw StateError('Unknown FIREBASE_ENV "$firebaseEnv" (use production or staging).'),
      };

  static const FirebaseOptions production = FirebaseOptions(
    apiKey: 'AIzaSyCmAD0m-2Z_-WomxpDvREimaPSp2CtjmEY',
    appId: '1:264749197802:web:f09553f241658137af6a93',
    messagingSenderId: '264749197802',
    projectId: 'urbangaragesale',
    authDomain: 'urbangaragesale.firebaseapp.com',
    databaseURL: 'https://urbangaragesale.firebaseio.com',
    storageBucket: 'urbangaragesale.firebasestorage.app',
  );

  static const FirebaseOptions staging = FirebaseOptions(
    apiKey: 'AIzaSyBzhMcB4NMLXF8WsJToUg8uOeAfWcJ4I9s',
    appId: '1:868761567226:web:ddf0e8f1e402168607ee43',
    messagingSenderId: '868761567226',
    projectId: 'urbangaragesale-staging',
    authDomain: 'urbangaragesale-staging.firebaseapp.com',
    storageBucket: 'urbangaragesale-staging.firebasestorage.app',
  );
}
