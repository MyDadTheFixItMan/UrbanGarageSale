// lib/services/tap_to_pay_service.dart

import 'package:flutter/foundation.dart';
import 'package:mek_stripe_terminal/mek_stripe_terminal.dart';
import 'package:permission_handler/permission_handler.dart';
import 'urban_pay_service.dart';

/// Stripe's simulated reader takes the place of the phone's NFC reader, so the whole flow can
/// be tested without a real card. Android refuses real Tap to Pay in debuggable builds, so debug
/// builds are simulated unless overridden with --dart-define=TERMINAL_SIMULATED=false.
/// Simulated readers only work with Stripe test-mode keys.
const bool terminalSimulated = bool.fromEnvironment('TERMINAL_SIMULATED', defaultValue: kDebugMode);

/// A problem the seller can act on, with a message suitable for showing them.
class TapToPayException implements Exception {
  final String message;
  TapToPayException(this.message);

  @override
  String toString() => message;
}

/// Uses the phone itself as a Stripe Terminal reader (Tap to Pay on iPhone / Android).
///
/// The phone connects as a reader for one garage sale at a time, because Stripe ties each
/// Tap to Pay payment to the garage sale's address (its Terminal location).
class TapToPayService {
  TapToPayService._();
  static final TapToPayService instance = TapToPayService._();

  final UrbanPayService _api = UrbanPayService();
  String? _connectedGarageSaleId;
  CancelableFuture<PaymentIntent>? _processing;

  Future<void> _ensureInitialized() async {
    if (Terminal.isInitialized) return;

    // Stripe checks the phone's location for every Tap to Pay payment.
    final permission = await Permission.locationWhenInUse.request();
    if (!permission.isGranted) {
      throw TapToPayException('Allow location access for Urban Pay in your phone settings to take Tap to Pay payments.');
    }
    await Terminal.init(fetchToken: _api.fetchConnectionToken);
  }

  /// Connects the phone as the reader for [garageSaleId], reconnecting if it was set up for
  /// a different garage sale.
  Future<void> connect(String garageSaleId) async {
    await _ensureInitialized();

    final connected = await Terminal.instance.getConnectedReader();
    if (connected != null && _connectedGarageSaleId == garageSaleId) return;
    if (connected != null) {
      await Terminal.instance.disconnectReader();
      _connectedGarageSaleId = null;
    }

    final setup = await _api.prepareTapToPay(garageSaleId);
    final readers = await Terminal.instance
        .discoverReaders(TapToPayDiscoveryConfiguration(isSimulated: terminalSimulated))
        .firstWhere((found) => found.isNotEmpty)
        .timeout(
          const Duration(seconds: 30),
          onTimeout: () => throw TapToPayException('This phone could not start Tap to Pay. Check NFC is turned on and try again.'),
        );

    await Terminal.instance.connectReader(
      readers.first,
      configuration: TapToPayConnectionConfiguration(
        locationId: setup.locationId,
        onBehalfOf: setup.onBehalfOf,
        merchantDisplayName: setup.merchantDisplayName,
        readerDelegate: _ReaderDelegate(onDisconnected: () => _connectedGarageSaleId = null),
      ),
    );
    _connectedGarageSaleId = garageSaleId;
  }

  /// Takes a card payment for [amount] dollars and records the sale. Returns the Stripe
  /// PaymentIntent ID. The customer taps their card or phone on the back of this phone.
  Future<String> charge({
    required String garageSaleId,
    required double amount,
    required String description,
  }) async {
    try {
      await connect(garageSaleId);

      final created = await _api.createPaymentIntent(
        amount: amount,
        description: description,
        garageSaleId: garageSaleId,
        channel: 'tap_to_pay',
      );
      final intent = await Terminal.instance.retrievePaymentIntent(created.clientSecret);

      final processing = Terminal.instance.processPaymentIntent(intent, skipTipping: true);
      _processing = processing;
      final PaymentIntent result;
      try {
        result = await processing;
      } finally {
        _processing = null;
      }
      if (result.status != PaymentIntentStatus.succeeded) {
        throw TapToPayException('The payment did not go through (${result.status.name}). Please try again.');
      }

      await _recordSale(result.id, description);
      return result.id;
    } on TerminalException catch (e) {
      throw TapToPayException(_friendlyMessage(e));
    }
  }

  /// Stops waiting for the customer's card.
  Future<void> cancel() async => _processing?.cancel();

  // The customer has already paid at this point, so a failed save is retried before giving up.
  Future<void> _recordSale(String paymentIntentId, String description) async {
    for (var attempt = 1; ; attempt++) {
      try {
        await _api.recordCardSale(
          paymentIntentId: paymentIntentId,
          description: description,
          paymentMethod: 'tap_to_pay',
        );
        return;
      } catch (e) {
        if (attempt == 3) {
          throw TapToPayException(
            'The customer has paid, but the sale could not be saved to your records. '
            'Payment reference: $paymentIntentId. Check your connection; the payment is safe in Stripe.',
          );
        }
        await Future<void>.delayed(Duration(seconds: attempt * 2));
      }
    }
  }

  String _friendlyMessage(TerminalException e) {
    switch (e.code) {
      case TerminalExceptionCode.canceled:
        return 'Payment cancelled.';
      case TerminalExceptionCode.locationServicesDisabled:
        return 'Turn on location services to take Tap to Pay payments.';
      case TerminalExceptionCode.tapToPayUnsupportedDevice:
        return 'This phone does not support Tap to Pay (it needs NFC and a secure hardware keystore).';
      case TerminalExceptionCode.tapToPayUnsupportedOperatingSystemVersion:
        return 'Update your phone\'s operating system to use Tap to Pay.';
      case TerminalExceptionCode.tapToPayDeviceTampered:
        return 'Tap to Pay cannot run on a rooted or modified phone.';
      case TerminalExceptionCode.tapToPayDebugNotSupported:
        return 'Tap to Pay does not run in development builds. Use a release build, or a simulated reader for testing.';
      case TerminalExceptionCode.tapToPayInsecureEnvironment:
        return 'Close screen recording or other apps using the camera, then try again.';
      default:
        return e.message.isNotEmpty ? e.message : 'Tap to Pay failed (${e.code.name}).';
    }
  }
}

class _ReaderDelegate extends TapToPayReaderDelegate {
  final VoidCallback onDisconnected;
  _ReaderDelegate({required this.onDisconnected});

  @override
  void onDisconnect(DisconnectReason reason) => onDisconnected();

  // Required on iOS: Apple's Tap to Pay prepares itself (a short "configuring" step) the first
  // time it's used on a phone. Its progress is shown by the system, so nothing extra is needed.
  @override
  void onStartInstallingUpdate(ReaderSoftwareUpdate update, Cancellable cancelUpdate) {}

  @override
  void onReportReaderSoftwareUpdateProgress(double progress) {}

  @override
  void onFinishInstallingUpdate(ReaderSoftwareUpdate? update, TerminalException? exception) {}

  @override
  void onRequestReaderDisplayMessage(ReaderDisplayMessage message) {}

  @override
  void onRequestReaderInput(List<ReaderInputOption> options) {}
}
