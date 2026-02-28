// lib/screens/urban_pay_dashboard.dart

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:intl/intl.dart';
import '../models/sale.dart';
import '../services/urban_pay_service.dart';
import 'urban_pay_payment.dart';
import 'manual_cash_entry.dart';

class UrbanPayDashboard extends StatefulWidget {
  const UrbanPayDashboard({super.key});

  @override
  State<UrbanPayDashboard> createState() => _UrbanPayDashboardState();
}

class _UrbanPayDashboardState extends State<UrbanPayDashboard> {
  final _urbanPayService = UrbanPayService();
  final _auth = FirebaseAuth.instance;

  late String _sellerId;
  late SellerStats _stats;
  late List<Sale> _recentSales;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _sellerId = _auth.currentUser?.uid ?? '';
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      final stats = await _urbanPayService.getSellerStats(_sellerId);
      final sales = await _urbanPayService.getSalesHistory(_sellerId);

      setState(() {
        _stats = stats;
        _recentSales = sales.take(10).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  String _formatCurrency(double amount) {
    final formatter = NumberFormat.currency(symbol: '\$', decimalDigits: 2);
    return formatter.format(amount);
  }

  String _formatTime(DateTime date) {
    final formatter = DateFormat('MMM dd, hh:mm a');
    return formatter.format(date);
  }

  void _openPaymentScreen() {
    Navigator.of(context)
        .push(
          MaterialPageRoute(
            builder: (context) => const UrbanPayPaymentScreen(),
          ),
        )
        .then((_) => _loadData());
  }

  void _openManualCashEntry() {
    Navigator.of(context)
        .push(
          MaterialPageRoute(
            builder: (context) => const ManualCashEntryScreen(),
          ),
        )
        .then((_) => _loadData());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1E8),
      appBar: AppBar(
        title: const Text(
          'Urban Pay',
          style: TextStyle(
            color: Color(0xFF001F3F),
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF001F3F)),
              ),
            )
          : _error != null
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Error: $_error',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.red),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _loadData,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: _loadData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      // QR Code Section
                      Card(
                        color: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            children: [
                              const Text(
                                'Your Payment QR Code',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF001F3F),
                                ),
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'Ask buyers to scan this with their phone',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey,
                                ),
                              ),
                              const SizedBox(height: 24),
                              Container(
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  border: Border.all(
                                    color: const Color(0xFF001F3F),
                                    width: 2,
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                padding: const EdgeInsets.all(16),
                                child: QrImage(
                                  data: _urbanPayService.generateQRCodeUrl(
                                    _sellerId,
                                  ),
                                  version: QrVersions.auto,
                                  size: 250,
                                  gapless: false,
                                  errorStateBuilder: (context, err) {
                                    return const Center(
                                      child: Text('Error generating QR code'),
                                    );
                                  },
                                ),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton.icon(
                                onPressed: () {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'Screenshot your QR code to share!',
                                      ),
                                    ),
                                  );
                                },
                                icon: const Icon(Icons.info_outline),
                                label: const Text(
                                  'Tip: Screenshot to print or share',
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.blueGrey,
                                  foregroundColor: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Quick Stats Section
                      Row(
                        children: [
                          Expanded(
                            child: Card(
                              color: Colors.white,
                              child: Padding(
                                padding: const EdgeInsets.all(16.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Total Earnings',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: Colors.grey,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      _formatCurrency(_stats.totalSales),
                                      style: const TextStyle(
                                        fontSize: 24,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF001F3F),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Card(
                              color: Colors.white,
                              child: Padding(
                                padding: const EdgeInsets.all(16.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Transactions',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: Colors.grey,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      '${_stats.transactionCount}',
                                      style: const TextStyle(
                                        fontSize: 24,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF001F3F),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // Action Buttons
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: _openPaymentScreen,
                              icon: const Icon(Icons.payment),
                              label: const Text('Card Payment'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF001F3F),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: _openManualCashEntry,
                              icon: const Icon(Icons.attach_money),
                              label: const Text('Cash Entry'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // Recent Sales Section
                      if (_recentSales.isNotEmpty)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Recent Sales',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF001F3F),
                              ),
                            ),
                            const SizedBox(height: 12),
                            ListView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _recentSales.length,
                              itemBuilder: (context, index) {
                                final sale = _recentSales[index];
                                return Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(12.0),
                                    child: Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                sale.description,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                  color: Color(0xFF001F3F),
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                _formatTime(sale.timestamp),
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.grey,
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 8,
                                                      vertical: 4,
                                                    ),
                                                decoration: BoxDecoration(
                                                  color:
                                                      sale.paymentMethod ==
                                                          'card'
                                                      ? Colors.blue[50]
                                                      : Colors.green[50],
                                                  borderRadius:
                                                      BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  sale.paymentMethod == 'card'
                                                      ? 'Card'
                                                      : 'Cash',
                                                  style: TextStyle(
                                                    fontSize: 11,
                                                    color:
                                                        sale.paymentMethod ==
                                                            'card'
                                                        ? Colors.blue
                                                        : Colors.green,
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Text(
                                          _formatCurrency(sale.amount),
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF001F3F),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }
}
