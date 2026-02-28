// lib/services/urban_pay_service.dart

import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:convert';
import '../models/sale.dart';

class UrbanPayService {
  static const String apiBaseUrl = 'https://your-deno-deployment-url.com';
  
  final FirebaseAuth _auth = FirebaseAuth.instance;

  Future<String> _getAuthToken() async {
    final user = _auth.currentUser;
    if (user == null) throw Exception('User not authenticated');
    return await user.getIdToken();
  }

  /// Create a payment intent for a sale
  Future<PaymentIntentResponse> createPaymentIntent({
    required double amount,
    required String description,
    String currency = 'aud',
  }) async {
    try {
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
          'currency': currency,
        }),
      );

      if (response.statusCode == 200) {
        return PaymentIntentResponse.fromJson(jsonDecode(response.body));
      } else {
        throw Exception('Failed to create payment intent: ${response.body}');
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Record a sale in Firestore
  Future<Map<String, dynamic>> recordSale({
    required double amount,
    required String description,
    required String paymentMethod,
    String? paymentIntentId,
  }) async {
    try {
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
          'paymentMethod': paymentMethod,
          'paymentIntentId': paymentIntentId,
        }),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to record sale: ${response.body}');
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Get seller's sales statistics
  Future<SellerStats> getSellerStats(String sellerId) async {
    try {
      final token = await _getAuthToken();
      final response = await http.get(
        Uri.parse('$apiBaseUrl/urbanPayment/stats/$sellerId'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        return SellerStats.fromJson(jsonDecode(response.body));
      } else {
        throw Exception('Failed to fetch stats: ${response.body}');
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Get seller's sales history
  Future<List<Sale>> getSalesHistory(String sellerId) async {
    try {
      final token = await _getAuthToken();
      final response = await http.get(
        Uri.parse('$apiBaseUrl/urbanPayment/sales/$sellerId'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final salesList = (data['sales'] as List)
            .map((sale) => Sale.fromJson(sale as Map<String, dynamic>))
            .toList();
        return salesList;
      } else {
        throw Exception('Failed to fetch sales: ${response.body}');
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Generate QR code data for seller
  /// QR code should link to: https://yourdomain.com/pay/{sellerId}
  String generateQRCodeUrl(String sellerId) {
    return '$apiBaseUrl/pay/$sellerId';
  }
}
