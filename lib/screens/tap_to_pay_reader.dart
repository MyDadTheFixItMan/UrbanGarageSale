// lib/screens/tap_to_pay_reader.dart

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../services/tap_to_pay_service.dart';
import '../services/urban_pay_service.dart';
import '../models/sale.dart';

class TapToPayReader extends StatefulWidget {
  final String? stripeConnectId;

  const TapToPayReader({
    Key? key,
    this.stripeConnectId,
  }) : super(key: key);

  @override
  State<TapToPayReader> createState() => _TapToPayReaderState();
}

class _TapToPayReaderState extends State<TapToPayReader> {
  late TapToPayService _tapToPayService;
  late UrbanPayService _urbanPayService;
  
  bool _isSupported = false;
  bool _isProcessing = false;
  bool _readerActive = false;
  double _currentAmount = 0;
  String? _lastTransactionId;
  bool _stripeValid = true;
  
  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _auth = FirebaseAuth.instance;
  final _firestore = FirebaseFirestore.instance;

  @override
  void initState() {
    super.initState();
    _tapToPayService = TapToPayService();
    _urbanPayService = UrbanPayService();
    _verifyStripeStatus();
    _checkTapToPaySupport();
  }

  Future<void> _verifyStripeStatus() async {
    try {
      final userId = _auth.currentUser?.uid;
      if (userId == null) {
        setState(() => _stripeValid = false);
        return;
      }

      final userDoc = await _firestore.collection('users').doc(userId).get();
      final hasStripe = userDoc.data()?['stripeConnectId'] != null;
      
      setState(() {
        _stripeValid = hasStripe;
      });
    } catch (e) {
      setState(() => _stripeValid = false);
    }
  }

  Future<void> _checkTapToPaySupport() async {
    try {
      final isSupported = await _tapToPayService.isSupported();
      setState(() {
        _isSupported = isSupported;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Tap to Pay not supported: $e')),
        );
      }
    }
  }

  Future<void> _activateReader() async {
    if (!_isSupported) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tap to Pay is not supported on this device')),
      );
      return;
    }

    setState(() => _isProcessing = true);

    try {
      await _tapToPayService.initializeTapToPayReader();
      setState(() => _readerActive = true);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Reader activated! Ready to accept payments'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to activate reader: $e')),
        );
      }
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _processQuickAmount(double amount) async {
    if (!_readerActive) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please activate the reader first')),
      );
      return;
    }

    setState(() => _isProcessing = true);

    try {
      // Create payment intent first
      final paymentIntent = await _urbanPayService.createPaymentIntent(
        amount: amount,
        description: 'Quick Tap to Pay Sale - \$${amount.toStringAsFixed(2)}',
      );

      // Prepare payment sheet
      await _tapToPayService.preparePaymentSheet(
        clientSecret: paymentIntent.clientSecret,
        merchantDisplayName: 'Urban Pay Seller',
        amount: (amount * 100).toStringAsFixed(0),
        currency: 'AUD',
      );

      // Process the payment
      final result = await _tapToPayService.processTapToPayPayment(
        amount: amount,
        description: 'Quick Sale',
        paymentIntentId: paymentIntent.paymentIntentId,
      );

      setState(() {
        _lastTransactionId = paymentIntent.paymentIntentId;
        _currentAmount = amount;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Payment successful! \$${amount.toStringAsFixed(2)} received'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment failed: $e')),
        );
      }
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _processCustomAmount() async {
    if (_amountController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter an amount')),
      );
      return;
    }

    final amount = double.tryParse(_amountController.text);
    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid amount')),
      );
      return;
    }

    await _processQuickAmount(amount);
    _amountController.clear();
    _descriptionController.clear();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // If Stripe is not valid, show error screen
    if (!_stripeValid) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Tap to Pay'),
          backgroundColor: const Color(0xFF1e3a5f),
          foregroundColor: Colors.white,
        ),
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF9500).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(
                    Icons.credit_card,
                    size: 40,
                    color: Color(0xFFFF9500),
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Card Payments Not Enabled',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1e3a5f),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'To use Tap to Pay, please enable card payments in your profile settings first.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tap to Pay Reader'),
        backgroundColor: const Color(0xFF1e3a5f),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Reader Status Card
              Card(
                elevation: 4,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      Icon(
                        _readerActive ? Icons.tap_and_play : Icons.smartphone,
                        size: 48,
                        color: _readerActive ? Colors.green : Colors.orange,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _readerActive ? 'Reader Active' : 'Reader Inactive',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: _readerActive ? Colors.green : Colors.orange,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _isSupported 
                          ? 'Your device supports Tap to Pay'
                          : 'Tap to Pay is not supported on this device',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Activate Reader Button
              if (!_readerActive)
                ElevatedButton.icon(
                  onPressed: _isProcessing ? null : _activateReader,
                  icon: const Icon(Icons.power_settings_new),
                  label: const Text('Activate Reader'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1e3a5f),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    disabledBackgroundColor: Colors.grey,
                  ),
                ),

              if (!_readerActive)
                const SizedBox(height: 24),

              if (_readerActive) ...[
                // Quick Amount Buttons
                Text(
                  'Quick Amounts',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 3,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  children: [5, 10, 20, 50, 100, 250]
                      .map((amount) => ElevatedButton(
                            onPressed: _isProcessing
                                ? null
                                : () => _processQuickAmount(amount.toDouble()),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: const Color(0xFF1e3a5f),
                              side: const BorderSide(
                                color: Color(0xFF1e3a5f),
                              ),
                              disabledBackgroundColor: Colors.grey[200],
                            ),
                            child: Text('\$$amount'),
                          ))
                      .toList(),
                ),
                const SizedBox(height: 24),

                // Custom Amount Section
                Text(
                  'Custom Amount',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _amountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    hintText: 'Enter amount (\$)',
                    filled: true,
                    fillColor: Colors.grey[100],
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _descriptionController,
                  decoration: InputDecoration(
                    hintText: 'Item description (optional)',
                    filled: true,
                    fillColor: Colors.grey[100],
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: _isProcessing ? null : _processCustomAmount,
                  icon: const Icon(Icons.tap_and_play),
                  label: const Text('Accept Payment'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    disabledBackgroundColor: Colors.grey,
                  ),
                ),
                const SizedBox(height: 24),

                // Last Transaction
                if (_lastTransactionId != null)
                  Card(
                    color: Colors.green[50],
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Last Transaction',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text('Amount: \$${_currentAmount.toStringAsFixed(2)}'),
                          Text('ID: $_lastTransactionId'),
                          const SizedBox(height: 8),
                          const Text(
                            '✓ Payment confirmed',
                            style: TextStyle(color: Colors.green),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],

              if (_isProcessing)
                const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: CircularProgressIndicator(),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
