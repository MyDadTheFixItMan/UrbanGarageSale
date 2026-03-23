import 'package:flutter/material.dart';
import '../services/stripe_terminal_service.dart';

class TerminalPaymentScreen extends StatefulWidget {
  final double amount;
  final String description;
  final String paymentIntentId;
  final Function(Map<String, dynamic>) onPaymentComplete;
  final Function(String) onPaymentError;

  const TerminalPaymentScreen({
    super.key,
    required this.amount,
    required this.description,
    required this.paymentIntentId,
    required this.onPaymentComplete,
    required this.onPaymentError,
  });

  @override
  State<TerminalPaymentScreen> createState() => _TerminalPaymentScreenState();
}

class _TerminalPaymentScreenState extends State<TerminalPaymentScreen> {
  bool isProcessing = false;
  String status = 'Ready to collect payment';
  Map<String, dynamic>? readerStatus;

  @override
  void initState() {
    super.initState();
    _checkReaderStatus();
  }

  Future<void> _checkReaderStatus() async {
    try {
      final status = await StripeTerminalService.getReaderStatus();
      setState(() => readerStatus = status);
    } catch (e) {
      debugPrint('Error checking reader status: $e');
    }
  }

  Future<void> _collectPayment() async {
    setState(() {
      isProcessing = true;
      status = 'Processing payment...';
    });

    try {
      final result = await StripeTerminalService.collectPayment(
        widget.amount,
        widget.description,
        widget.paymentIntentId,
      );

      if (mounted) {
        setState(() {
          isProcessing = false;
          status = result['status'] == 'succeeded'
              ? 'Payment successful!'
              : 'Payment status: ${result['status']}';
        });

        widget.onPaymentComplete(result);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          isProcessing = false;
          status = 'Payment failed';
        });
        widget.onPaymentError(e.toString());
      }
    }
  }

  Future<void> _disconnectReader() async {
    try {
      await StripeTerminalService.disconnectReader();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !isProcessing,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && isProcessing) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Cannot close while processing payment'),
            ),
          );
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Tap to Pay'),
          centerTitle: true,
          automaticallyImplyLeading: !isProcessing,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Amount to charge
              Text(
                '\$${widget.amount.toStringAsFixed(2)}',
                style: Theme.of(context).textTheme.displayMedium?.copyWith(
                  color: Colors.green,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                widget.description,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 48),

              // Status indicator
              if (isProcessing)
                Column(
                  children: [
                    const CircularProgressIndicator(),
                    const SizedBox(height: 24),
                    Text(
                      status,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Please tap card or phone on reader',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey),
                    ),
                  ],
                )
              else if (status.contains('successful'))
                Column(
                  children: [
                    const Icon(
                      Icons.check_circle,
                      color: Colors.green,
                      size: 64,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      status,
                      textAlign: TextAlign.center,
                      style: Theme.of(
                        context,
                      ).textTheme.bodyLarge?.copyWith(color: Colors.green),
                    ),
                  ],
                )
              else
                Column(
                  children: [
                    if (readerStatus?['connected'] != true)
                      Column(
                        children: [
                          const Icon(
                            Icons.bluetooth_disabled,
                            color: Colors.red,
                            size: 48,
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Reader not connected',
                            style: TextStyle(color: Colors.red),
                          ),
                          const SizedBox(height: 20),
                        ],
                      )
                    else
                      Column(
                        children: [
                          const Icon(
                            Icons.payment,
                            color: Colors.blue,
                            size: 48,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            status,
                            style: Theme.of(context).textTheme.bodyLarge,
                          ),
                          const SizedBox(height: 20),
                        ],
                      ),
                    ElevatedButton(
                      onPressed: readerStatus?['connected'] == true
                          ? _collectPayment
                          : null,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 48,
                          vertical: 16,
                        ),
                      ),
                      child: const Text(
                        'Collect Payment',
                        style: TextStyle(fontSize: 16),
                      ),
                    ),
                  ],
                ),

              const SizedBox(height: 48),

              // Disconnect button
              TextButton(
                onPressed: isProcessing ? null : _disconnectReader,
                child: const Text('Disconnect Reader'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
