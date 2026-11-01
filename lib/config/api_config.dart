// lib/config/api_config.dart

/// Base URL of the Urban Pay API (the Vercel project "urban-garage-sale"), without a trailing
/// slash. Override per build, e.g. for a staging API:
///   flutter run --dart-define=API_BASE_URL=https://staging-api.example.com/api
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: productionApiBaseUrl,
);

/// The live API, which test (staging) builds must never call.
const String productionApiBaseUrl = 'https://urban-garage-sale.vercel.app/api';

/// Vercel "Protection Bypass for Automation" secret, for test builds that call a preview
/// deployment (Vercel Authentication blocks the app otherwise). Never set it for release builds.
const String vercelProtectionBypass = String.fromEnvironment('VERCEL_PROTECTION_BYPASS');
