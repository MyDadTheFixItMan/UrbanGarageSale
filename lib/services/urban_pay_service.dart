// lib/services/urban_pay_service.dart

import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:convert';
import '../models/sale.dart';

class UrbanPayService {
  static const String apiBaseUrl = 'https://urban-garage-sale.vercel.app/api';

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
