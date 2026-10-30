// lib/services/urban_pay_service.dart

import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:convert';
import '../models/sale.dart';
import '../config/api_config.dart' as config;

class UrbanPayService {
  static const String apiBaseUrl = config.apiBaseUrl;

  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  Future<String> _getAuthToken() async {
    final user = _auth.currentUser;
    if (user == null) throw Exception('User not authenticated');
    final token = await user.getIdToken();
    if (token == null) throw Exception('Failed to get auth token');
    return token;
  }

  String _errorFrom(http.Response response) {
    try {
      final data = jsonDecode(response.body);
      if (data is Map && data['error'] != null) return data['error'].toString();
    } catch (_) {}
    return 'Request failed (${response.statusCode})';
  }

  /// Create a payment intent for a sale (AUD).
  /// Use channel 'terminal' for card-present (reader / Tap to Pay) payments.
  Future<PaymentIntentResponse> createPaymentIntent({
    required double amount,
    required String description,
    String? garageSaleId,
    String? channel,
  }) async {
    final token = await _getAuthToken();
    final response = await http.post(
      Uri.parse('$apiBaseUrl/urbanPayment/createPaymentIntent'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'amount': amount,
        'description': description,
        if (garageSaleId != null) 'garageSaleId': garageSaleId,
        if (channel != null) 'channel': channel,
      }),
    );

    if (response.statusCode == 200) {
      return PaymentIntentResponse.fromJson(jsonDecode(response.body));
    }
    throw Exception(_errorFrom(response));
  }

  /// Record a cash sale.
  Future<Map<String, dynamic>> recordCashSale({
    required double amount,
    required String description,
    String? garageSaleId,
  }) async {
    final token = await _getAuthToken();
    final response = await http.post(
      Uri.parse('$apiBaseUrl/urbanPayment/recordSale'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'amount': amount,
        'description': description,
        'paymentMethod': 'cash',
        if (garageSaleId != null) 'garageSaleId': garageSaleId,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception(_errorFrom(response));
  }

  /// Record a card sale after Stripe has confirmed the payment.
  /// The server reads the amount and status from Stripe.
  Future<Map<String, dynamic>> recordCardSale({
    required String paymentIntentId,
    required String description,
    String paymentMethod = 'card',
  }) async {
    final token = await _getAuthToken();
    final response = await http.post(
      Uri.parse('$apiBaseUrl/urbanPayment/recordTapToPaySale'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'paymentIntentId': paymentIntentId,
        'description': description,
        'paymentMethod': paymentMethod,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception(_errorFrom(response));
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    final token = await _getAuthToken();
    final response = await http.post(
      Uri.parse('$apiBaseUrl$path'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(body),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw Exception(_errorFrom(response));
  }

  /// A Stripe Terminal connection token, used by the Terminal SDK to talk to Stripe.
  Future<String> fetchConnectionToken() async {
    final data = await _post('/stripeTerminal/createConnectionToken', {});
    return data['secret'] as String;
  }

  /// The Terminal location and connected account to use for Tap to Pay at a garage sale.
  Future<TapToPaySetup> prepareTapToPay(String garageSaleId) async {
    final data = await _post('/urbanPayment/initializeTapToPayReader', {'garageSaleId': garageSaleId});
    return TapToPaySetup.fromJson(data);
  }

  /// The seller's live (approved) garage sales, which are the ones that can take card payments.
  Future<List<GarageSaleOption>> getActiveGarageSales(String sellerId) async {
    final snapshot = await _db
        .collection('garageSales')
        .where('user_id', isEqualTo: sellerId)
        .where('status', isEqualTo: 'active')
        .get();
    return snapshot.docs
        .map((doc) => GarageSaleOption.fromFirestore(doc.id, doc.data()))
        .toList();
  }

  /// Get seller's lifetime sales statistics.
  Future<SellerStats> getSellerStats(String sellerId) async {
    final doc = await _db.collection('sellerStats').doc(sellerId).get();
    return SellerStats.fromFirestore(sellerId, doc.data() ?? {});
  }

  /// Get seller's sales history, newest first.
  Future<List<Sale>> getSalesHistory(String sellerId) async {
    final snapshot = await _db
        .collection('sales')
        .where('sellerId', isEqualTo: sellerId)
        .get();
    final sales = snapshot.docs
        .map((doc) => Sale.fromFirestore(doc.id, doc.data()))
        .toList();
    sales.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return sales;
  }
}
