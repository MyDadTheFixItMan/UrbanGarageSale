const defaultDevOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000',
];

function getConfiguredOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getAllowedOrigins() {
  const configuredOrigins = getConfiguredOrigins();
  if (process.env.NODE_ENV === 'production') {
    return configuredOrigins;
  }
  return [...new Set([...configuredOrigins, ...defaultDevOrigins])];
}

export function getTrustedOrigin(originHeader, fallback = process.env.FRONTEND_URL || 'http://localhost:5174') {
  const allowedOrigins = getAllowedOrigins();
  if (originHeader && allowedOrigins.includes(originHeader)) {
    return originHeader;
  }
  return fallback;
}

export function applyCors(res, origin, methods = 'POST, OPTIONS') {
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
}