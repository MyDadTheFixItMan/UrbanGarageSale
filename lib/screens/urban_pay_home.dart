// lib/screens/urban_pay_home.dart

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'urban_pay_dashboard.dart';
import 'tap_to_pay_reader.dart';

class UrbanPayHome extends StatefulWidget {
  const UrbanPayHome({super.key});

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
}
