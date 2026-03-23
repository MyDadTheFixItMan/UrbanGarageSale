// lib/screens/tap_to_pay_reader.dart

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../services/stripe_terminal_service.dart';
import '../widgets/reader_selection_dialog.dart';
import 'terminal_payment_screen.dart';

class TapToPayReader extends StatefulWidget {
  final String? stripeConnectId;

  const TapToPayReader({super.key, this.stripeConnectId});

  @override
  State<TapToPayReader> createState() => _TapToPayReaderState();
}

class _TapToPayReaderState extends State<TapToPayReader> {
  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _auth = FirebaseAuth.instance;
  final _firestore = FirebaseFirestore.instance;

  bool _isProcessing = false;
  bool _stripeValid = true;
  String? _connectedReaderId;
  String? _connectedReaderLabel;

  @override
  void initState() {
    super.initState();
    _verifyStripeStatus();
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

      setState(() => _stripeValid = hasStripe);
    } catch (e) {
      setState(() => _stripeValid = false);
    }
  }

  Future<void> _selectAndConnectReader() async {
    showDialog(
      context: context,
      builder: (context) => ReaderSelectionDialog(
        onReaderSelected: (reader) {
          setState(() {
            _connectedReaderId = reader['id'] as String;
            _connectedReaderLabel = reader['label'] as String?;
          });
          _showMessage('Connected to ${reader['label']}');
        },
      ),
    );
  }

  Future<void> _processPayment() async {
    final amount = double.tryParse(_amountController.text);
    final description = _descriptionController.text.trim();

    if (amount == null || amount <= 0) {
      _showMessage('Please enter a valid amount');
      return;
    }

    if (description.isEmpty) {
      _showMessage('Please enter a description');
      return;
    }

    if (_connectedReaderId == null) {
      _showMessage('Please select and connect a reader first');
      return;
    }

    setState(() => _isProcessing = true);

    try {
      // Step 1: Create payment intent on backend
      final user = _auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      final idToken = await user.getIdToken();

      final response = await http.post(
        Uri.parse(
          'https://urban-garage-sale.vercel.app/api/urbanPayment/createPaymentIntent',
        ),
        headers: {
          'Authorization': 'Bearer $idToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'amount': amount,
          'description': description,
          'currency': 'aud',
        }),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to create payment intent');
      }

      final paymentData = jsonDecode(response.body);
      final paymentIntentId = paymentData['paymentIntentId'] as String;

      // Step 2: Show payment screen with reader
      if (mounted) {
        // Navigate to terminal payment screen
        final result = await Navigator.push<Map<String, dynamic>>(
          context,
          MaterialPageRoute(
            builder: (context) => TerminalPaymentScreen(
              amount: amount,
              description: description,
              paymentIntentId: paymentIntentId,
              onPaymentComplete: (result) {
                Navigator.pop(context, result);
              },
              onPaymentError: (error) {
                _showMessage('Payment error: $error');
              },
            ),
          ),
        );

        if (result != null) {
          // Payment was successful - record it
          await _recordPaymentInDatabase(
            amount,
            description,
            paymentIntentId,
            result,
          );

          // Clear form
          _amountController.clear();
          _descriptionController.clear();

          _showMessage('Payment recorded successfully!');
        }
      }
    } catch (e) {
      _showMessage('Error: $e');
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _recordPaymentInDatabase(
    double amount,
    String description,
    String paymentIntentId,
    Map<String, dynamic> paymentResult,
  ) async {
    try {
      final user = _auth.currentUser;
      if (user == null) return;

      final idToken = await user.getIdToken();

      await http.post(
        Uri.parse(
          'https://urban-garage-sale.vercel.app/api/urbanPayment/recordTapToPaySale',
        ),
        headers: {
          'Authorization': 'Bearer $idToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'amount': amount,
          'description': description,
          'paymentIntentId': paymentIntentId,
          'currency': 'aud',
          'paymentMethod': 'tap_to_pay',
        }),
      );
    } catch (e) {
      debugPrint('Error recording payment: $e');
    }
  }

  Future<void> _disconnectReader() async {
    try {
      await StripeTerminalService.disconnectReader();
      setState(() {
        _connectedReaderId = null;
        _connectedReaderLabel = null;
      });
      _showMessage('Reader disconnected');
    } catch (e) {
      _showMessage('Error disconnecting: $e');
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_stripeValid) {
      return Scaffold(
        backgroundColor: const Color(0xFFF5F1E8),
        appBar: AppBar(
          title: const Text('Tap to Pay'),
          backgroundColor: const Color(0xFF1e3a5f),
          elevation: 0,
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
                    color: const Color(0xFFFF9500).withValues(alpha: 0.1),
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
                  'To accept card payments with Tap to Pay, you need to enable card payments in your profile first.',
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
      backgroundColor: const Color(0xFFF5F1E8),
      appBar: AppBar(
        title: const Text('Tap to Pay Terminal'),
        backgroundColor: const Color(0xFF1e3a5f),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Reader Connection Status
            Card(
              margin: const EdgeInsets.only(bottom: 24),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Reader Status',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1e3a5f),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (_connectedReaderId != null)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(
                                Icons.check_circle,
                                color: Colors.green,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Connected: $_connectedReaderLabel',
                                  style: const TextStyle(color: Colors.green),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton(
                              onPressed: _disconnectReader,
                              child: const Text('Disconnect Reader'),
                            ),
                          ),
                        ],
                      )
                    else
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(
                                Icons.bluetooth_disabled,
                                color: Colors.red,
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'No reader connected',
                                style: TextStyle(color: Colors.red),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _selectAndConnectReader,
                              icon: const Icon(Icons.bluetooth_connected),
                              label: const Text('Select & Connect Reader'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF1e3a5f),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),

            // Payment Form
            Card(
              margin: const EdgeInsets.only(bottom: 24),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Payment Amount',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1e3a5f),
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
                          horizontal: 16,
                          vertical: 12,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Description',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1e3a5f),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _descriptionController,
                      decoration: InputDecoration(
                        hintText: 'What is being purchased?',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                      ),
                      maxLines: 2,
                    ),
                  ],
                ),
              ),
            ),

            // Process Button
            ElevatedButton(
              onPressed: _isProcessing || _connectedReaderId == null
                  ? null
                  : _processPayment,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1e3a5f),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                disabledBackgroundColor: Colors.grey,
              ),
              child: _isProcessing
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Text(
                      'Collect Payment',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            ),

            const SizedBox(height: 24),

            // Info Box
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.blue.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'How Tap to Pay Works:',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1e3a5f),
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    '1. Select and connect a payment reader\n'
                    '2. Enter the payment amount\n'
                    '3. Add a description\n'
                    '4. Tap "Collect Payment"\n'
                    '5. Customer taps their card/phone',
                    style: TextStyle(fontSize: 14, color: Colors.grey),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
