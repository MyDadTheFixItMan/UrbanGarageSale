// lib/screens/tap_to_pay_reader.dart

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';
import '../models/sale.dart';
import '../services/tap_to_pay_service.dart';
import '../services/urban_pay_service.dart';

/// Takes card payments with the phone itself: the customer taps their card or phone on the
/// back of the seller's phone. No separate card reader is needed.
class TapToPayReader extends StatefulWidget {
  const TapToPayReader({super.key});

  @override
  State<TapToPayReader> createState() => _TapToPayReaderState();
}

class _TapToPayReaderState extends State<TapToPayReader> {
  static const _navy = Color(0xFF1e3a5f);

  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _tapToPay = TapToPayService.instance;
  final _urbanPay = UrbanPayService();
  final _currency = NumberFormat.currency(locale: 'en_AU', symbol: '\$', decimalDigits: 2);

  List<GarageSaleOption>? _garageSales;
  String? _garageSaleId;
  String? _loadError;
  bool _processing = false;

  @override
  void initState() {
    super.initState();
    _loadGarageSales();
  }

  Future<void> _loadGarageSales() async {
    try {
      final sellerId = FirebaseAuth.instance.currentUser?.uid ?? '';
      final sales = await _urbanPay.getActiveGarageSales(sellerId);
      if (!mounted) return;
      setState(() {
        _garageSales = sales;
        _garageSaleId = sales.length == 1 ? sales.first.id : null;
        _loadError = null;
      });
    } catch (e) {
      if (mounted) setState(() => _loadError = 'Could not load your garage sales. Pull down to try again.');
    }
  }

  Future<void> _charge() async {
    final amount = double.tryParse(_amountController.text.trim());
    final description = _descriptionController.text.trim();
    final garageSaleId = _garageSaleId;

    if (garageSaleId == null) return _showMessage('Choose the garage sale you are selling at');
    if (amount == null || amount < 0.5) return _showMessage('Enter an amount of at least \$0.50');
    if (description.isEmpty) return _showMessage('Enter what is being bought');

    setState(() => _processing = true);
    try {
      await _tapToPay.charge(
        garageSaleId: garageSaleId,
        amount: amount,
        description: description,
      );
      _amountController.clear();
      _descriptionController.clear();
      _showMessage('Paid ${_currency.format(amount)}. Sale recorded.');
    } on TapToPayException catch (e) {
      _showMessage(e.message);
    } catch (e) {
      _showMessage('Payment failed: $e');
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1E8),
      appBar: AppBar(
        title: const Text('Tap to Pay'),
        backgroundColor: _navy,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: _loadGarageSales,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            if (terminalSimulated)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Test mode: payments use Stripe\'s simulated reader. No real card is charged.',
                ),
              ),
            _garageSaleCard(),
            const SizedBox(height: 16),
            _paymentCard(),
            const SizedBox(height: 24),
            if (_processing)
              OutlinedButton(
                onPressed: _tapToPay.cancel,
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                child: const Text('Cancel payment'),
              )
            else
              ElevatedButton.icon(
                onPressed: _garageSaleId == null ? null : _charge,
                icon: const Icon(Icons.contactless),
                label: const Text('Charge', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _navy,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: Colors.grey,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            if (_processing) ...[
              const SizedBox(height: 16),
              const Center(child: CircularProgressIndicator()),
              const SizedBox(height: 12),
              const Text(
                'Ask the customer to hold their card or phone against the back of your phone.',
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: 24),
            const Text(
              'The first payment on a phone can take a little longer while Tap to Pay sets up. '
              'Keep NFC turned on, and keep the app open until the payment finishes.',
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }

  Widget _garageSaleCard() {
    final sales = _garageSales;
    Widget content;
    if (_loadError != null) {
      content = Text(_loadError!, style: const TextStyle(color: Colors.red));
    } else if (sales == null) {
      content = const Center(child: CircularProgressIndicator());
    } else if (sales.isEmpty) {
      content = const Text(
        'You need a live (approved) garage sale listing to take card payments. '
        'Create one on the Urban Garage Sale website.',
      );
    } else {
      content = DropdownButtonFormField<String>(
        initialValue: _garageSaleId,
        isExpanded: true,
        hint: const Text('Choose a garage sale'),
        items: [
          for (final sale in sales)
            DropdownMenuItem(value: sale.id, child: Text(sale.label, overflow: TextOverflow.ellipsis)),
        ],
        onChanged: _processing ? null : (id) => setState(() => _garageSaleId = id),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Garage sale', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _navy)),
            const SizedBox(height: 12),
            content,
          ],
        ),
      ),
    );
  }

  Widget _paymentCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Amount', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _navy)),
            const SizedBox(height: 12),
            TextField(
              controller: _amountController,
              enabled: !_processing,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(prefixText: '\$ ', hintText: '0.00', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            const Text('What is being bought?', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _navy)),
            const SizedBox(height: 8),
            TextField(
              controller: _descriptionController,
              enabled: !_processing,
              maxLength: 100,
              decoration: const InputDecoration(hintText: 'e.g. Bookshelf', border: OutlineInputBorder()),
            ),
          ],
        ),
      ),
    );
  }
}
