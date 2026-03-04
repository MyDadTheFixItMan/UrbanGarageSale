package com.urbangarageSale

import android.content.Context
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.EventChannel
import com.stripe.stripeterminal.Terminal
import com.stripe.stripeterminal.TerminalListener
import com.stripe.stripeterminal.callable.Callback
import com.stripe.stripeterminal.log.LogLevel
import com.stripe.stripeterminal.model.external.Reader
import com.stripe.stripeterminal.model.external.ReaderSoftwareUpdate
import java.util.concurrent.ConcurrentHashMap

class StripeTerminalManager {
    companion object {
        private const val CHANNEL = "com.urbangarageSale/stripe_terminal"
        private const val EVENT_CHANNEL = "com.urbangarageSale/stripe_terminal_events"
        
        fun setupChannel(flutterEngine: FlutterEngine, context: Context) {
            val methodChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            val eventChannel = EventChannel(flutterEngine.dartExecutor.binaryMessenger, EVENT_CHANNEL)
            
            val manager = StripeTerminalImpl(context)
            
            methodChannel.setMethodCallHandler { call, result ->
                when (call.method) {
                    "initializeTerminal" -> manager.initializeTerminal(result)
                    "getConnectionToken" -> manager.getConnectionToken(call.argument("authToken") ?: "", result)
                    "discoverReaders" -> manager.discoverReaders(result)
                    "connectReader" -> manager.connectReader(call.argument("readerId") ?: "", result)
                    "collectPayment" -> {
                        val amount = call.argument<Int>("amount") ?: 0
                        val description = call.argument<String>("description") ?: ""
                        val paymentIntentId = call.argument<String>("paymentIntentId") ?: ""
                        manager.collectPayment(amount, description, paymentIntentId, result)
                    }
                    "disconnectReader" -> manager.disconnectReader(result)
                    "getReaderStatus" -> manager.getReaderStatus(result)
                    else -> result.notImplemented()
                }
            }
            
            eventChannel.setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    manager.eventSink = events
                }
                
                override fun onCancel(arguments: Any?) {
                    manager.eventSink = null
                }
            })
        }
    }
}

class StripeTerminalImpl(val context: Context) : TerminalListener {
    var eventSink: EventChannel.EventSink? = null
    private val discoveredReaders = mutableListOf<Reader>()
    
    init {
        initializeTerminalSDK()
    }
    
    private fun initializeTerminalSDK() {
        try {
            Terminal.initialize(context, LogLevel.VERBOSE, object : Callback<Terminal> {
                override fun onSuccess(terminal: Terminal) {
                    println("✓ Stripe Terminal initialized")
                    terminal.setTerminalListener(this@StripeTerminalImpl)
                }
                
                override fun onFailure(e: Exception) {
                    println("✗ Failed to initialize terminal: ${e.message}")
                }
            })
        } catch (e: Exception) {
            println("✗ Terminal init error: ${e.message}")
        }
    }
    
    fun initializeTerminal(result: MethodChannel.Result) {
        try {
            result.success(true)
        } catch (e: Exception) {
            result.error("INIT_ERROR", e.message, null)
        }
    }
    
    fun getConnectionToken(authToken: String, result: MethodChannel.Result) {
        val urlString = "https://urban-garage-sale.vercel.app/api/stripeTerminal/createConnectionToken"
        
        try {
            val url = java.net.URL(urlString)
            val connection = url.openConnection() as java.net.HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $authToken")
            
            val responseCode = connection.responseCode
            if (responseCode == 200) {
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                val json = org.json.JSONObject(response)
                val secret = json.optString("secret", "")
                
                if (secret.isNotEmpty()) {
                    result.success(secret)
                } else {
                    result.error("NO_SECRET", "No secret in response", null)
                }
            } else {
                result.error("HTTP_ERROR", "HTTP $responseCode", null)
            }
        } catch (e: Exception) {
            result.error("NETWORK_ERROR", e.message, null)
        }
    }
    
    fun discoverReaders(result: MethodChannel.Result) {
        try {
            val terminal = Terminal.getInstance()
            if (terminal?.isInitialized == false) {
                result.error("NOT_INITIALIZED", "Terminal not initialized", null)
                return
            }
            
            // Return simulated reader list for now
            val readers = mutableListOf<Map<String, Any>>()
            discoveredReaders.forEach { reader ->
                readers.add(mapOf(
                    "id" to (reader.id ?: ""),
                    "label" to (reader.label ?: "Unknown"),
                    "serialNumber" to (reader.serialNumber ?: ""),
                    "status" to (reader.connectionStatus?.toString() ?: "unknown")
                ))
            }
            
            result.success(readers)
        } catch (e: Exception) {
            result.error("DISCOVERY_ERROR", e.message, null)
        }
    }
    
    fun connectReader(readerId: String, result: MethodChannel.Result) {
        try {
            println("Connecting to reader: $readerId")
            result.success(true)
        } catch (e: Exception) {
            result.error("CONNECT_ERROR", e.message, null)
        }
    }
    
    fun collectPayment(amount: Int, description: String, paymentIntentId: String, result: MethodChannel.Result) {
        try {
            println("Collecting payment: $amount cents")
            
            // Return simulated successful payment
            result.success(mapOf(
                "success" to true,
                "status" to "succeeded",
                "transactionId" to paymentIntentId,
                "amount" to amount
            ))
        } catch (e: Exception) {
            result.error("PAYMENT_ERROR", e.message, null)
        }
    }
    
    fun disconnectReader(result: MethodChannel.Result) {
        try {
            result.success(true)
        } catch (e: Exception) {
            result.error("DISCONNECT_ERROR", e.message, null)
        }
    }
    
    fun getReaderStatus(result: MethodChannel.Result) {
        try {
            val terminal = Terminal.getInstance()
            result.success(mapOf(
                "connected" to (terminal?.connectedReader != null),
                "status" to (terminal?.connectionStatus?.toString() ?: "unknown")
            ))
        } catch (e: Exception) {
            result.error("STATUS_ERROR", e.message, null)
        }
    }
    
    // TerminalListener implementation
    override fun onPaymentStatusChange(status: com.stripe.stripeterminal.model.external.PaymentStatus) {
        eventSink?.success(mapOf(
            "event" to "paymentStatusChanged",
            "status" to status.toString()
        ))
    }
    
    override fun onConnectionStatusChange(status: com.stripe.stripeterminal.model.external.ConnectionStatus) {
        eventSink?.success(mapOf(
            "event" to "connectionStatusChanged",
            "status" to status.toString()
        ))
    }
    
    override fun onUnexpectedReaderDisconnect(reader: Reader) {
        eventSink?.success(mapOf(
            "event" to "readerDisconnected",
            "readerId" to reader.id
        ))
    }
}
