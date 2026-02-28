// lib/screens/manual_cash_entry.dart

import 'package:flutter/material.dart';
import '../services/urban_pay_service.dart';

class ManualCashEntryScreen extends StatefulWidget {
  const ManualCashEntryScreen({super.key});

  @override
  State<ManualCashEntryScreen> createState() => _ManualCashEntryScreenState();
}

class _ManualCashEntryScreenState extends State<ManualCashEntryScreen> {
  final _urbanPayService = UrbanPayService();
  final _descriptionController = TextEditingController();
  final _amountController = TextEditingController();
  
  double _selectedAmount = 0;
  bool _isProcessing = false;
  String? _error;

  // Quick amount buttons
  final List<double> _quickAmounts = [5, 10, 20, 50];

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

  Future<void> _recordCashSale() async {
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
      await _urbanPayService.recordSale(
        amount: _selectedAmount,
        description: _descriptionController.text,
        paymentMethod: 'cash',
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Cash sale recorded! \$${_selectedAmount.toStringAsFixed(2)}',
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
        _error = e.toString();
        _isProcessing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1E8),
      appBar: AppBar(
        title: const Text(
          'Record Cash Sale',
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
              // Info Card
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  border: Border.all(color: Colors.blue),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.info, color: Colors.blue),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Record cash payments from your garage sale. These won\'t go through Stripe.',
                        style: TextStyle(color: Colors.blue, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

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
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
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
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _descriptionController,
                        decoration: InputDecoration(
                          hintText: 'e.g., Mirror, painting, and cushions',
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

              // Record Sale Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isProcessing ? null : _recordCashSale,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
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
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : Text(
                          _selectedAmount > 0
                              ? 'Record Sale - \$${_selectedAmount.toStringAsFixed(2)}'
                              : 'Record Sale',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                );
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
