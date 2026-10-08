// lib/models/sale.dart

import 'package:cloud_firestore/cloud_firestore.dart';

DateTime? _toDateTime(dynamic value) {
  if (value is Timestamp) return value.toDate();
  if (value is DateTime) return value;
  if (value is String) return DateTime.tryParse(value);
  return null;
}

class Sale {
  final String id;
  final String sellerId;
  final double amount;
  final String description;
  final String paymentMethod; // 'card' or 'cash'
  final DateTime timestamp;
  final String status; // 'completed' or 'recorded'
  final String? paymentIntentId;

  Sale({
    required this.id,
    required this.sellerId,
    required this.amount,
    required this.description,
    required this.paymentMethod,
    required this.timestamp,
    required this.status,
    this.paymentIntentId,
  });

  factory Sale.fromJson(Map<String, dynamic> json) {
    return Sale(
      id: json['id'] as String,
      sellerId: json['sellerId'] as String,
      amount: (json['amount'] as num).toDouble(),
      description: json['description'] as String,
      paymentMethod: json['paymentMethod'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      status: json['status'] as String,
      paymentIntentId: json['paymentIntentId'] as String?,
    );
  }

  /// Builds a Sale from a document in the `sales` collection.
  factory Sale.fromFirestore(String id, Map<String, dynamic> data) {
    return Sale(
      id: id,
      sellerId: data['sellerId'] as String? ?? '',
      amount: (data['amount'] as num?)?.toDouble() ?? 0.0,
      description: data['description'] as String? ?? '',
      paymentMethod: data['paymentMethod'] as String? ?? 'cash',
      timestamp: _toDateTime(data['createdAt'] ?? data['timestamp']) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      status: data['status'] as String? ?? 'completed',
      paymentIntentId: data['paymentIntentId'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sellerId': sellerId,
      'amount': amount,
      'description': description,
      'paymentMethod': paymentMethod,
      'timestamp': timestamp.toIso8601String(),
      'status': status,
      'paymentIntentId': paymentIntentId,
    };
  }
}

class SellerStats {
  final String sellerId;
  final double totalSales;
  final int transactionCount;
  final DateTime? firstSaleTime;
  final DateTime? lastSaleTime;

  SellerStats({
    required this.sellerId,
    required this.totalSales,
    required this.transactionCount,
    this.firstSaleTime,
    this.lastSaleTime,
  });

  factory SellerStats.fromJson(Map<String, dynamic> json) {
    return SellerStats(
      sellerId: json['sellerId'] as String,
      totalSales: (json['totalSales'] as num).toDouble(),
      transactionCount: json['transactionCount'] as int,
      firstSaleTime: json['firstSaleTime'] != null
          ? DateTime.parse(json['firstSaleTime'] as String)
          : null,
      lastSaleTime: json['lastSaleTime'] != null
          ? DateTime.parse(json['lastSaleTime'] as String)
          : null,
    );
  }

  /// Builds stats from a `sellerStats/{sellerId}` document.
  /// [totalSales] is the dollar total; [transactionCount] is the number of sales.
  factory SellerStats.fromFirestore(String sellerId, Map<String, dynamic> data) {
    return SellerStats(
      sellerId: sellerId,
      totalSales: (data['totalEarnings'] as num?)?.toDouble() ?? 0.0,
      transactionCount: (data['totalSales'] as num?)?.toInt() ?? 0,
      lastSaleTime: _toDateTime(data['lastSaleDate']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'sellerId': sellerId,
      'totalSales': totalSales,
      'transactionCount': transactionCount,
      'firstSaleTime': firstSaleTime?.toIso8601String(),
      'lastSaleTime': lastSaleTime?.toIso8601String(),
    };
  }
}

class PaymentIntentResponse {
  final String clientSecret;
  final String paymentIntentId;

  PaymentIntentResponse({
    required this.clientSecret,
    required this.paymentIntentId,
  });

  factory PaymentIntentResponse.fromJson(Map<String, dynamic> json) {
    return PaymentIntentResponse(
      clientSecret: json['clientSecret'] as String,
      paymentIntentId: json['paymentIntentId'] as String,
    );
  }
}
