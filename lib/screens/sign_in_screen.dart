// lib/screens/sign_in_screen.dart
//
// Email/password sign-in with Firebase multi-factor auth. For accounts with 2FA, Firebase
// does not complete sign-in until the SMS code is confirmed, so there is no session to use
// before the second factor. Sellers enrol 2FA from their Profile on the website.

import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _codeController = TextEditingController();

  MultiFactorResolver? _resolver;
  String? _verificationId;
  String _phoneHint = '';
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
      // No 2FA on this account: the auth state stream moves to the Urban Pay screen.
    } on FirebaseAuthMultiFactorException catch (e) {
      _resolver = e.resolver;
      await _sendCode();
    } on FirebaseAuthException catch (e) {
      setState(() => _error = _authMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sendCode() async {
    final resolver = _resolver;
    if (resolver == null) return;

    final hint = resolver.hints.whereType<PhoneMultiFactorInfo>().firstOrNull;
    if (hint == null) {
      setState(() => _error = 'No mobile number is enrolled for 2FA on this account.');
      return;
    }

    final codeSent = Completer<void>();
    await FirebaseAuth.instance.verifyPhoneNumber(
      multiFactorSession: resolver.session,
      multiFactorInfo: hint,
      verificationCompleted: (_) {},
      verificationFailed: (e) {
        if (!codeSent.isCompleted) codeSent.completeError(e);
      },
      codeSent: (verificationId, _) {
        _verificationId = verificationId;
        if (!codeSent.isCompleted) codeSent.complete();
      },
      codeAutoRetrievalTimeout: (_) {},
    );

    try {
      await codeSent.future;
      setState(() => _phoneHint = hint.phoneNumber);
    } on FirebaseAuthException catch (e) {
      setState(() => _error = _authMessage(e));
    }
  }

  Future<void> _confirmCode() async {
    final resolver = _resolver;
    final verificationId = _verificationId;
    final code = _codeController.text.trim();
    if (resolver == null || verificationId == null) return;
    if (code.length != 6) {
      setState(() => _error = 'Please enter the 6-digit code');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final credential = PhoneAuthProvider.credential(verificationId: verificationId, smsCode: code);
      await resolver.resolveSignIn(PhoneMultiFactorGenerator.getAssertion(credential));
      // Signed in with both factors: the auth state stream moves to the Urban Pay screen.
    } on FirebaseAuthException catch (e) {
      setState(() => _error = _authMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _restart() {
    setState(() {
      _resolver = null;
      _verificationId = null;
      _phoneHint = '';
      _error = null;
      _codeController.clear();
    });
  }

  String _authMessage(FirebaseAuthException e) {
    switch (e.code) {
      case 'invalid-credential':
      case 'wrong-password':
      case 'user-not-found':
        return 'Incorrect email or password.';
      case 'invalid-verification-code':
        return 'That code is incorrect. Please check the SMS and try again.';
      case 'session-expired':
      case 'code-expired':
        return 'That code has expired. Please sign in again.';
      case 'too-many-requests':
        return 'Too many attempts. Please wait a few minutes and try again.';
      case 'user-disabled':
        return 'This account has been disabled.';
      default:
        return e.message ?? 'Sign in failed.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final awaitingCode = _verificationId != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Urban Pay — Sign in')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            if (!awaitingCode) ...[
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(labelText: 'Email'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordController,
                obscureText: true,
                autofillHints: const [AutofillHints.password],
                decoration: const InputDecoration(labelText: 'Password'),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : _signIn,
                child: _loading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Sign in'),
              ),
            ] else ...[
              Text('Enter the code we sent to $_phoneHint'),
              const SizedBox(height: 12),
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                autofillHints: const [AutofillHints.oneTimeCode],
                decoration: const InputDecoration(labelText: 'SMS code'),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _loading ? null : _confirmCode,
                child: _loading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Verify'),
              ),
              TextButton(onPressed: _loading ? null : _sendCode, child: const Text('Resend code')),
              TextButton(onPressed: _loading ? null : _restart, child: const Text('Back')),
            ],
          ],
        ),
      ),
    );
  }
}
