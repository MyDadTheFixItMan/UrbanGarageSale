// lib/config/api_config.dart

/// Base URL of the Urban Pay API (the Vercel project "urban-garage-sale"), without a trailing
/// slash. Override per build, e.g. for a staging API:
///   flutter run --dart-define=API_BASE_URL=https://staging-api.example.com/api
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://urban-garage-sale.vercel.app/api',
);
