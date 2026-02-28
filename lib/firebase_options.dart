// lib/firebase_options.dart
// Firebase configuration for UrbanGarageSale

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    return const FirebaseOptions(
      apiKey: 'AIzaSyCmAD0m-2Z_-WomxpDvREimaPSp2CtjmEY',
      appId: '1:264749197802:web:f09553f241658137af6a93',
      messagingSenderId: '264749197802',
      projectId: 'urbangaragesale',
      authDomain: 'urbangaragesale.firebaseapp.com',
      databaseURL: 'https://urbangaragesale.firebaseio.com',
      storageBucket: 'urbangaragesale.appspot.com',
    );
  }
}
