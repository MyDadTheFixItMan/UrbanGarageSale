import 'package:flutter/services.dart';

class StripeTerminalService {
  static const platform = MethodChannel('com.urbangarageSale/stripe_terminal');

  /// Initialize Stripe Terminal with API key
  static Future<bool> initializeTerminal(String apiKey) async {
    try {
      final bool result = await platform.invokeMethod('initializeTerminal', {
        'apiKey': apiKey,
      });
      print('✓ Stripe Terminal initialized: $result');
      return result;
    } catch (e) {
      print('✗ Error initializing terminal: $e');
      throw Exception('Failed to initialize Stripe Terminal: $e');
    }
  }

  /// Get connection token from backend
  static Future<String> getConnectionToken(String authToken) async {
    try {
      final String token = await platform.invokeMethod('getConnectionToken', {
        'authToken': authToken,
      });
      print('✓ Got connection token');
      return token;
    } catch (e) {
      print('✗ Error getting connection token: $e');
      throw Exception('Failed to get connection token: $e');
    }
  }

  /// Discover available payment readers
  static Future<List<Map<String, dynamic>>> discoverReaders() async {
    try {
      final List<dynamic> result = await platform.invokeMethod('discoverReaders');
      print('✓ Found ${result.length} readers');
      return result.cast<Map<String, dynamic>>();
    } catch (e) {
      print('✗ Error discovering readers: $e');
      throw Exception('Failed to discover readers: $e');
    }
  }

  /// Connect to a payment reader
  static Future<bool> connectReader(String readerId) async {
    try {
      final bool result = await platform.invokeMethod('connectReader', {
        'readerId': readerId,
      });
      print('✓ Connected to reader: $readerId');
      return result;
    } catch (e) {
      print('✗ Error connecting to reader: $e');
      throw Exception('Failed to connect to reader: $e');
    }
  }

  /// Collect payment from reader (tap/insert card)
  static Future<Map<String, dynamic>> collectPayment(
    double amount,
    String description,
    String paymentIntentId,
  ) async {
    try {
      final Map<dynamic, dynamic> result =
          await platform.invokeMethod('collectPayment', {
        'amount': (amount * 100).toInt(), // Convert to cents
        'description': description,
        'paymentIntentId': paymentIntentId,
      });
      
      print('✓ Payment collected: ${result['status']}');
      return result.cast<String, dynamic>();
    } catch (e) {
      print('✗ Error collecting payment: $e');
      throw Exception('Failed to collect payment: $e');
    }
  }

  /// Disconnect from reader
  static Future<bool> disconnectReader() async {
    try {
      final bool result = await platform.invokeMethod('disconnectReader');
      print('✓ Disconnected from reader');
      return result;
    } catch (e) {
      print('✗ Error disconnecting: $e');
      throw Exception('Failed to disconnect reader: $e');
    }
  }

  /// Get connected reader status
  static Future<Map<String, dynamic>> getReaderStatus() async {
    try {
      final Map<dynamic, dynamic> result =
          await platform.invokeMethod('getReaderStatus');
      return result.cast<String, dynamic>();
    } catch (e) {
      print('✗ Error getting reader status: $e');
      return {};
    }
  }

  /// Listen to reader connection/disconnection events
  static Stream<Map<String, dynamic>> get readerStatusStream {
    return EventChannel('com.urbangarageSale/stripe_terminal_events')
        .receiveBroadcastStream()
        .cast<Map<String, dynamic>>();
  }
}
