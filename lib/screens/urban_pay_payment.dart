// lib/screens/urban_pay_payment.dart

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart' hide Card;
import '../models/sale.dart';
import '../services/urban_pay_service.dart';

class UrbanPayPaymentScreen extends StatefulWidget {
  const UrbanPayPaymentScreen({super.key});

  @override
  State<UrbanPayPaymentScreen> createState() => _UrbanPayPaymentScreenState();
}

class _UrbanPayPaymentScreenState extends State<UrbanPayPaymentScreen> {
  final _urbanPayService = UrbanPayService();
  final _descriptionController = TextEditingController();
  final _amountController = TextEditingController();

  List<GarageSaleOption>? _garageSales;
  String? _garageSaleId;
  double _selectedAmount = 0;
  bool _isProcessing = false;
  String? _error;

  // Quick amount buttons
  final List<double> _quickAmounts = [5, 10, 20, 50];

  @override
  void initState() {
    super.initState();
    _loadGarageSales();
  }

  Future<void> _loadGarageSales() async {
    try {
      final sellerId = FirebaseAuth.instance.currentUser?.uid ?? '';
      final sales = await _urbanPayService.getActiveGarageSales(sellerId);
      if (!mounted) return;
      setState(() {
        _garageSales = sales;
        _garageSaleId = sales.length == 1 ? sales.first.id : null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load your garage sales. Go back and try again.');
    }
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  void _selectAmount(double amount) {
    setState(() {
      _selectedAmount = amount;
      _amountController.text = amount.toStringAsFixed(2);
      _error = null;
    });
  }

  Future<void> _processPayment() async {
    final garageSaleId = _garageSaleId;
    if (garageSaleId == null) {
      setState(() {
        _error = 'Choose the garage sale you are selling at';
      });
      return;
    }

    if (_selectedAmount <= 0) {
      setState(() {
        _error = 'Please enter a valid amount';
      });
      return;
    }

    if (_descriptionController.text.isEmpty) {
      setState(() {
        _error = 'Please describe the items sold';
      });
      return;
    }

    setState(() {
      _isProcessing = true;
      _error = null;
    });

    try {
      // Step 1: Create payment intent
      final paymentIntent = await _urbanPayService.createPaymentIntent(
        amount: _selectedAmount,
        description: _descriptionController.text,
        garageSaleId: garageSaleId,
      );

      // Step 2: Initialize Payment Sheet
      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: paymentIntent.clientSecret,
          merchantDisplayName: 'Urban Garage Sale',
          style: ThemeMode.light,
        ),
      );

      // Step 3: Present Payment Sheet
      await Stripe.instance.presentPaymentSheet();

      // Step 4: Record the sale (server confirms the payment with Stripe)
      await _urbanPayService.recordCardSale(
        paymentIntentId: paymentIntent.paymentIntentId,
        description: _descriptionController.text,
      );

      // Success
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Payment successful! \$${_selectedAmount.toStringAsFixed(2)} received',
            ),
            backgroundColor: Colors.green,
          ),
        );

        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            Navigator.pop(context);
          }
        });
      }
    } catch (e) {
      setState(() {
        _error = e.toString().contains('Stripe')
            ? 'Payment cancelled or failed'
            : e.toString();
        _isProcessing = false;
      });
    }
  }

  // Card payments need a live listing (createPaymentIntent refuses them otherwise).
  Widget _buildGarageSaleCard() {
    final sales = _garageSales;
    final Widget content;
    if (sales == null) {
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
        onChanged: _isProcessing ? null : (id) => setState(() => _garageSaleId = id),
      );
    }

    return Card(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Garage sale',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF001F3F)),
            ),
            const SizedBox(height: 12),
            content,
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1E8),
      appBar: AppBar(
        title: const Text(
          'Card Payment',
          style: TextStyle(
            color: Color(0xFF001F3F),
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF001F3F)),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildGarageSaleCard(),
              const SizedBox(height: 16),

              // Amount Section
              Card(
                color: Colors.white,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Amount',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF001F3F),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _amountController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: InputDecoration(
                          prefixText: '\$ ',
                          hintText: '0.00',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                        ),
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                        onChanged: (value) {
                          setState(() {
                            _selectedAmount = double.tryParse(value) ?? 0;
                            _error = null;
                          });
                        },
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Quick Amounts',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        children: _quickAmounts.map((amount) {
                          final isSelected = _selectedAmount == amount;
                          return ChoiceChip(
                            label: Text('\$${amount.toInt()}'),
                            selected: isSelected,
                            onSelected: (_) => _selectAmount(amount),
                            backgroundColor: Colors.grey[200],
                            selectedColor: const Color(0xFF001F3F),
                            labelStyle: TextStyle(
                              color: isSelected ? Colors.white : Colors.black,
                              fontWeight: FontWeight.w600,
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Description Section
              Card(
                color: Colors.white,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'What did they buy?',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF001F3F),
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Brief description of items sold',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _descriptionController,
                        decoration: InputDecoration(
                          hintText: 'e.g., Lamp, books, and frames',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          contentPadding: const EdgeInsets.all(12),
                        ),
                        maxLines: 3,
                        maxLength: 200,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Error message
              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red[50],
                    border: Border.all(color: Colors.red),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(color: Colors.red),
                  ),
                )
              else
                const SizedBox(height: 0),
              const SizedBox(height: 16),

              // Process Payment Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isProcessing ? null : _processPayment,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF001F3F),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _isProcessing
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                          ),
                        )
                      : Text(
                          _selectedAmount > 0
                              ? 'Process Payment - \$${_selectedAmount.toStringAsFixed(2)}'
                              : 'Process Payment',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
