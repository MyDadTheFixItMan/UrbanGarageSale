import Flutter
import StripeTerminal

public class StripeTerminalPlugin: NSObject, FlutterPlugin {
  public static func dummyMethodToEnforceBundling() {
    // This function empty on purpose
  }

  private static var terminal: Terminal?
  private static var discoveryConfig: DiscoveryConfiguration?
  private static var connectedReader: Reader?
  private static var eventSink: FlutterEventSink?

  public static func register(with registrar: FlutterPluginRegistry) {
    let methodChannel = FlutterMethodChannel(
      name: "com.urbangarageSale/stripe_terminal",
      binaryMessenger: registrar.messenger())
    
    let eventChannel = FlutterEventChannel(
      name: "com.urbangarageSale/stripe_terminal_events",
      binaryMessenger: registrar.messenger())
    
    let instance = StripeTerminalPlugin()
    registrar.addMethodCallDelegate(instance, channel: methodChannel)
    eventChannel.setStreamHandler(instance)
  }

  public func dummyMethodToEnforceBundling() {
    // This function empty on purpose
  }

  public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "initializeTerminal":
      initializeTerminal(call: call, result: result)
    case "getConnectionToken":
      getConnectionToken(call: call, result: result)
    case "discoverReaders":
      discoverReaders(result: result)
    case "connectReader":
      connectReader(call: call, result: result)
    case "collectPayment":
      collectPayment(call: call, result: result)
    case "disconnectReader":
      disconnectReader(result: result)
    case "getReaderStatus":
      getReaderStatus(result: result)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func initializeTerminal(call: FlutterMethodCall, result: @escaping FlutterResult) {
    // Initialize Stripe Terminal
    Terminal.initialize(withApiKey: "") { initializeError in
      if let error = initializeError {
        print("✗ Error initializing Terminal: \(error)")
        result(false)
        return
      }
      
      Terminal.shared.delegate = self
      StripeTerminalPlugin.terminal = Terminal.shared
      print("✓ Terminal initialized")
      result(true)
    }
  }

  private func getConnectionToken(call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard let args = call.arguments as? [String: Any] else {
      result(FlutterError(code: "INVALID_ARGS", message: "Missing arguments", details: nil))
      return
    }

    // Call backend to get connection token
    let urlString = "https://urban-garage-sale.vercel.app/api/stripeTerminal/createConnectionToken"
    guard let url = URL(string: urlString) else {
      result(FlutterError(code: "INVALID_URL", message: "Invalid URL", details: nil))
      return
    }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    if let authToken = args["authToken"] as? String {
      request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
    }

    let task = URLSession.shared.dataTask(with: request) { data, response, error in
      if let error = error {
        result(FlutterError(code: "NETWORK_ERROR", message: error.localizedDescription, details: nil))
        return
      }

      guard let data = data else {
        result(FlutterError(code: "NO_DATA", message: "No data returned", details: nil))
        return
      }

      do {
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        if let secret = json?["secret"] as? String {
          result(secret)
        } else {
          result(FlutterError(code: "NO_SECRET", message: "No secret in response", details: nil))
        }
      } catch {
        result(FlutterError(code: "JSON_ERROR", message: error.localizedDescription, details: nil))
      }
    }
    task.resume()
  }

  private func discoverReaders(result: @escaping FlutterResult) {
    guard let terminal = StripeTerminalPlugin.terminal else {
      result(FlutterError(code: "NOT_INITIALIZED", message: "Terminal not initialized", details: nil))
      return
    }

    let config = DiscoveryConfiguration(
      discoveryMethod: .bluetoothProximity,
      simulated: false
    )

    terminal.discoverReaders(config, delegate: self) { readers, error in
      if let error = error {
        result(FlutterError(code: "DISCOVERY_ERROR", message: error.localizedDescription, details: nil))
        return
      }

      let readerData = readers?.map { reader -> [String: Any] in
        return [
          "id": reader.id ?? "",
          "label": reader.label ?? "Unknown",
          "status": reader.connectionStatus.rawValue,
          "serialNumber": reader.serialNumber ?? "",
        ]
      } ?? []

      result(readerData)
    }
  }

  private func connectReader(call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard let args = call.arguments as? [String: Any],
          let readerId = args["readerId"] as? String else {
      result(FlutterError(code: "INVALID_ARGS", message: "Missing readerId", details: nil))
      return
    }

    guard let terminal = StripeTerminalPlugin.terminal else {
      result(FlutterError(code: "NOT_INITIALIZED", message: "Terminal not initialized", details: nil))
      return
    }

    // In a real implementation, we'd find the reader from discovered readers
    // For now, simulating connection
    print("Connecting to reader: \(readerId)")
    result(true)
  }

  private func collectPayment(call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard let args = call.arguments as? [String: Any],
          let amount = args["amount"] as? Int,
          let description = args["description"] as? String,
          let paymentIntentId = args["paymentIntentId"] as? String else {
      result(FlutterError(code: "INVALID_ARGS", message: "Missing arguments", details: nil))
      return
    }

    print("Collecting payment: \(amount) cents, Intent: \(paymentIntentId)")
    
    // Simulate successful payment
    result([
      "success": true,
      "status": "succeeded",
      "transactionId": paymentIntentId,
      "amount": amount,
    ])
  }

  private func disconnectReader(result: @escaping FlutterResult) {
    guard let terminal = StripeTerminalPlugin.terminal else {
      result(FlutterError(code: "NOT_INITIALIZED", message: "Terminal not initialized", details: nil))
      return
    }

    terminal.disconnectReader { error in
      if let error = error {
        result(FlutterError(code: "DISCONNECT_ERROR", message: error.localizedDescription, details: nil))
        return
      }
      result(true)
    }
  }

  private func getReaderStatus(result: @escaping FlutterResult) {
    guard let terminal = StripeTerminalPlugin.terminal else {
      result(FlutterError(code: "NOT_INITIALIZED", message: "Terminal not initialized", details: nil))
      return
    }

    let readerData: [String: Any] = [
      "connected": terminal.connectedReader != nil,
      "status": terminal.connectionStatus.rawValue,
    ]

    result(readerData)
  }
}

// MARK: - TerminalDelegate
extension StripeTerminalPlugin: TerminalDelegate {
  public func terminal(_ terminal: Terminal, didChangeConnectionStatus status: ConnectionStatus) {
    print("Terminal connection status changed: \(status.rawValue)")
    eventSink?([
      "event": "connectionStatusChanged",
      "status": status.rawValue,
    ])
  }

  public func terminal(_ terminal: Terminal, didReportUnexpectedReaderDisconnect reader: Reader) {
    print("Reader disconnected unexpectedly")
    eventSink?([
      "event": "readerDisconnected",
      "readerId": reader.id,
    ])
  }
}

// MARK: - DiscoveryDelegate
extension StripeTerminalPlugin: DiscoveryDelegate {
  public func terminal(_ terminal: Terminal, didUpdateDiscoveredReaders readers: [Reader]) {
    print("Updated discovered readers: \(readers.count)")
    eventSink?([
      "event": "readersUpdated",
      "count": readers.count,
    ])
  }
}

// MARK: - FlutterStreamHandler
extension StripeTerminalPlugin: FlutterStreamHandler {
  public func onListen(
    withArguments arguments: Any?,
    eventSink events: @escaping FlutterEventSink
  ) -> FlutterError? {
    StripeTerminalPlugin.eventSink = events
    return nil
  }

  public func onCancel(withArguments arguments: Any?) -> FlutterError? {
    StripeTerminalPlugin.eventSink = nil
    return nil
  }
}
