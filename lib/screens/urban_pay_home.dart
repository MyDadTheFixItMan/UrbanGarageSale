// lib/screens/urban_pay_home.dart

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'urban_pay_dashboard.dart';
import 'tap_to_pay_reader.dart';

class UrbanPayHome extends StatefulWidget {
  const UrbanPayHome({Key? key}) : super(key: key);

  @override
  State<UrbanPayHome> createState() => _UrbanPayHomeState();
}

class _UrbanPayHomeState extends State<UrbanPayHome> {
  int _selectedIndex = 0;
  bool _stripeConnected = false;
  bool _loadingStripeStatus = true;
  String? _stripeConnectId;
  final _auth = FirebaseAuth.instance;
  final _firestore = FirebaseFirestore.instance;

  @override
  void initState() {
    super.initState();
    _checkStripeConnection();
  }

  Future<void> _checkStripeConnection() async {
    try {
      final userId = _auth.currentUser?.uid;
      if (userId == null) {
        setState(() => _loadingStripeStatus = false);
        return;
      }

      final userDoc = await _firestore.collection('users').doc(userId).get();
      final stripeId = userDoc.data()?['stripeConnectId'];
      final hasStripe = stripeId != null;
      
      setState(() {
        _stripeConnected = hasStripe;
        _stripeConnectId = stripeId;
        _loadingStripeStatus = false;
      });
    } catch (e) {
      setState(() => _loadingStripeStatus = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> screens = [
      const UrbanPayDashboard(),
      TapToPayReader(stripeConnectId: _stripeConnectId),
    ];

    return Scaffold(
      body: _loadingStripeStatus
          ? const Center(child: CircularProgressIndicator())
          : screens[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) {
          // Don't allow navigating to Tap to Pay if Stripe isn't connected
          if (index == 1 && !_stripeConnected) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Please enable card payments first'),
                duration: Duration(seconds: 2),
              ),
            );
            return;
          }
          setState(() => _selectedIndex = index);
        },
        items: [
          const BottomNavigationBarItem(
            icon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.tap_and_play),
            label: 'Tap to Pay',
            backgroundColor: _stripeConnected ? null : Colors.grey,
          ),
        ],
        backgroundColor: const Color(0xFF1e3a5f),
        selectedItemColor: const Color(0xFFFF9500),
        unselectedItemColor: Colors.white70,
      ),
    );
  }

  Widget _buildStripeNotConnectedScreen() {
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
                'To accept card payments with Tap to Pay, you need to enable card payments in your profile first.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton.icon(
                onPressed: () {
                  // Navigate to profile settings (you'll need to implement this)
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Go to Profile > Enable Card Payments'),
                    ),
                  );
                },
                icon: const Icon(Icons.settings),
                label: const Text('Enable Card Payments'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1e3a5f),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 16,
                  ),
                  textStyle: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
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
