import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:urban_garage_sale/screens/sign_in_screen.dart';

void main() {
  testWidgets('Sign-in screen asks for email and password first', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(home: SignInScreen()));

    expect(find.widgetWithText(TextField, 'Email'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Password'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
    // The SMS code step only appears after Firebase asks for the second factor.
    expect(find.widgetWithText(TextField, 'SMS code'), findsNothing);
  });
}
