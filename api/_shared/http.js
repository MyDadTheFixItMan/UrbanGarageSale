// Shared request helpers for the Vercel / Express API handlers.
import { getFirebaseAdmin } from './firebase-admin.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Works both on Vercel (req.body pre-parsed) and Express (express.json() already
// consumed the stream). Only falls back to reading the raw stream when neither did.
export async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        return req.body ? JSON.parse(req.body) : {};
      } catch {
        throw new HttpError(400, 'Invalid JSON in request body');
      }
    }
    return req.body;
  }

  const raw = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, 'Invalid JSON in request body');
  }
}

// Verifies the Firebase ID token in the Authorization header and returns the decoded token.
// checkRevoked = true so disabling a user or revoking their sessions takes effect immediately.
export async function requireUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing authorization token');
  }

  await requireAppCheck(req);
  try {
    const admin = getFirebaseAdmin();
    return await admin.auth().verifyIdToken(authHeader.substring(7), true);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
}

// App Check: the website sends a token proving the request came from the real site.
// A token that is present but invalid is always refused. A missing token is refused only once
// APP_CHECK_ENFORCE=true, because the mobile app does not send App Check tokens yet.
async function requireAppCheck(req) {
  const token = req.headers['x-firebase-appcheck'];
  if (!token) {
    if (process.env.APP_CHECK_ENFORCE === 'true') {
      throw new HttpError(401, 'App verification failed. Please refresh the page and try again.');
    }
    return;
  }
  try {
    await getFirebaseAdmin().appCheck().verifyToken(token);
  } catch {
    throw new HttpError(401, 'App verification failed. Please refresh the page and try again.');
  }
}

// For listing and payment actions: the account must have 2FA on (claim set by the server)
// AND this session must have passed the SMS step. Firebase records the second factor in the
// signed ID token (firebase.sign_in_second_factor), so it can't be added by the client.
export function requireSecondFactor(decoded) {
  if (decoded.two_fa_enabled !== true || !decoded.firebase?.sign_in_second_factor) {
    throw new HttpError(403, 'Two-factor authentication is required. Turn on 2FA in your Profile, then sign in again with your SMS code.');
  }
  return decoded;
}

// Stripe's minimum charge for AUD is A$0.50.
export const MIN_AUD_AMOUNT = 0.5;
export const MAX_AUD_AMOUNT = 10000;

// Parses a dollar amount and returns it rounded to cents. Rejects NaN, negatives and out-of-range values.
export function parseAudAmount(value, { min = MIN_AUD_AMOUNT, max = MAX_AUD_AMOUNT } = {}) {
  const amount = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new HttpError(400, 'Amount must be a number');
  }
  const rounded = Math.round(amount * 100) / 100;
  if (rounded < min || rounded > max) {
    throw new HttpError(400, `Amount must be between A$${min.toFixed(2)} and A$${max.toFixed(2)}`);
  }
  return rounded;
}

export function toCents(amount) {
  return Math.round(amount * 100);
}

export function cleanText(value, maxLength, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || fallback;
}

const ERROR_REPORT_URL = 'https://us-central1-urbangaragesale.cloudfunctions.net/reportClientError';

// Forwards an unexpected server error to Error Reporting (via the reportClientError function).
// Waits at most 2 seconds so reporting can never hold up or break the response.
async function reportServerError(error, context) {
  if (process.env.NODE_ENV !== 'production') return;
  try {
    await fetch(ERROR_REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'urban-pay-api',
        message: `${context}: ${error?.message || error}`,
        stack: `${context}: ${error?.stack || error}`,
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Reporting failures are ignored; the error is still in the platform logs
  }
}

// Sends HttpErrors with their message; hides internal error details from clients.
// Unexpected errors are logged and reported to Error Reporting.
export async function sendError(res, error, context = 'Request failed') {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(`${context}:`, error);
  await reportServerError(error, context);
  return res.status(500).json({ error: context });
}
