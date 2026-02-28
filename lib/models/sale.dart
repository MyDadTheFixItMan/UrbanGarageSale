// lib/models/sale.dart

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
