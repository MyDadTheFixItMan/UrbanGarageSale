// lib/screens/urban_pay_home.dart

import 'package:flutter/material.dart';
import 'urban_pay_dashboard.dart';
import 'tap_to_pay_reader.dart';

class UrbanPayHome extends StatefulWidget {
  const UrbanPayHome({Key? key}) : super(key: key);

  @override
  State<UrbanPayHome> createState() => _UrbanPayHomeState();
}

class _UrbanPayHomeState extends State<UrbanPayHome> {
  int _selectedIndex = 0;

  final List<Widget> _screens = [
    const UrbanPayDashboard(),
    const TapToPayReader(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) {
          setState(() {
            _selectedIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.tap_and_play),
            label: 'Tap to Pay',
          ),
        ],
        backgroundColor: const Color(0xFF1e3a5f),
        selectedItemColor: const Color(0xFFFF9500),
        unselectedItemColor: Colors.white70,
      ),
    );
  }
}
