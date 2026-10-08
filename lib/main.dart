import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'screens/sign_in_screen.dart';
import 'screens/urban_pay_home.dart';
import 'firebase_options.dart';
import 'services/stripe_terminal_service.dart';

const stripePublishableKey = String.fromEnvironment('STRIPE_PUBLISHABLE_KEY', defaultValue: '');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Australian date and number formats throughout the app
  Intl.defaultLocale = 'en_AU';
  await initializeDateFormatting('en_AU');

  // Initialize Firebase
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Initialize Stripe with your publishable key
  if (stripePublishableKey.isEmpty) {
    throw StateError('Missing STRIPE_PUBLISHABLE_KEY (set via --dart-define).');
  }
  Stripe.publishableKey = stripePublishableKey;

  // Initialize Stripe Terminal
  try {
    await StripeTerminalService.initializeTerminal(
      stripePublishableKey,
    );
    debugPrint('✓ Stripe Terminal ready');
  } catch (e) {
    debugPrint('⚠️ Terminal init: $e');
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Urban Garage Sale',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF001F3F),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto',
      ),
      home: StreamBuilder<User?>(
        stream: FirebaseAuth.instance.authStateChanges(),
        builder: (context, snapshot) {
          // Show Urban Pay home with Tap to Pay if authenticated
          if (snapshot.hasData && snapshot.data != null) {
            return const UrbanPayHome();
          }
          // Sign in (password, then SMS code for accounts with 2FA)
          return const SignInScreen();
        },
      ),
    );
  }
}
