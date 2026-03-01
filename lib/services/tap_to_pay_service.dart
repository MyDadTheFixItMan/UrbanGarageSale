// lib/services/tap_to_pay_service.dart

import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/sale.dart';

class TapToPayService {
  static const String apiBaseUrl = 'https://urban-garage-sale.vercel.app';

  final FirebaseAuth _auth = FirebaseAuth.instance;

  Future<String> _getAuthToken() async {
    final user = _auth.currentUser;
    if (user == null) throw Exception('User not authenticated');
    final token = await user.getIdToken();
    if (token == null) throw Exception('Failed to get auth token');
    return token;
  }

  /// Check if device supports Tap to Pay
  Future<bool> isSupported() async {
    try {
      return await Stripe.instance.isApplePaySupported || 
             await Stripe.instance.isGooglePaySupported;
    } catch (e) {
      return false;
    }
  }

  /// Initialize Tap to Pay reader session
  /// Returns a reader registration token from backend
  Future<String> initializeTapToPayReader() async {
    try {
      final token = await _getAuthToken();
      final user = _auth.currentUser;
      
      final response = await http.post(
        Uri.parse('$apiBaseUrl/urbanPayment/initializeTapToPayReader'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'sellerId': user?.uid,
          'sellerEmail': user?.email,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['readerRegistrationToken'] ?? '';
      } else {
        throw Exception('Failed to initialize reader: ${response.body}');
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Process a Tap to Pay payment
  Future<PaymentIntentResponse> processTapToPayPayment({
    required double amount,
    required String description,
    required String paymentIntentId,
    String currency = 'aud',
  }) async {
    try {
      final token = await _getAuthToken();

      // Confirm the payment intent with Stripe
      await Stripe.instance.confirmPaymentSheetPayment();

      // Record the sale in backend
      final response = await http.post(
        Uri.parse('$apiBaseUrl/urbanPayment/recordTapToPaySale'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'amount': amount,
          'description': description,
          'paymentIntentId': paymentIntentId,
          'currency': currency,
          'paymentMethod': 'tap_to_pay',
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return PaymentIntentResponse(
          clientSecret: paymentIntentId,
          paymentIntentId: paymentIntentId,
          status: 'succeeded',
        );
      } else {
        throw Exception('Failed to record payment: ${response.body}');
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Create a payment sheet for Tap to Pay
  Future<void> preparePaymentSheet({
    required String clientSecret,
    required String merchantDisplayName,
    required String amount,
    required String currency,
  }) async {
    try {
      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: merchantDisplayName,
          style: ThemeMode.light,
          billingDetailsCollectionLevel: BillingDetailsCollectionLevel.none,
          googlePay: const PaymentSheetGooglePay(
            testEnv: false,
            currencyCode: 'AUD',
            merchantCountryCode: 'AU',
          ),
          applePay: const PaymentSheetApplePay(
            merchantCountryCode: 'AU',
          ),
        ),
      );
    } catch (e) {
      rethrow;
    }
  }

  /// Get seller statistics including Tap to Pay earnings
  Future<SellerStats> getSellerStats() async {
    try {
      final token = await _getAuthToken();
      final user = _auth.currentUser;

      final response = await http.get(
        Uri.parse('$apiBaseUrl/urbanPayment/sellerStats?sellerId=${user?.uid}'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return SellerStats(
          totalEarnings: (data['totalEarnings'] as num?)?.toDouble() ?? 0.0,
          totalSales: data['totalSales'] ?? 0,
          tapToPayEarnings: (data['tapToPayEarnings'] as num?)?.toDouble() ?? 0.0,
          tapToPayTransactions: data['tapToPayTransactions'] ?? 0,
        );
      } else {
        throw Exception('Failed to fetch stats: ${response.body}');
      }
    } catch (e) {
      rethrow;
    }
  }
}

class SellerStats {
  final double totalEarnings;
  final int totalSales;
  final double tapToPayEarnings;
  final int tapToPayTransactions;

  SellerStats({
    required this.totalEarnings,
    required this.totalSales,
    required this.tapToPayEarnings,
    required this.tapToPayTransactions,
  });
}
