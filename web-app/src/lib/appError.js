// Errors shown to users. `message` is the friendly text for the screen; `code` keeps the
// underlying Firebase/API code (e.g. 'auth/wrong-password') so callers can branch on it
// instead of matching message text, and `cause` keeps the original error for logging.
// `details` adds flags callers check, e.g. { mfaRequired: true, phoneHint }.
export class AppError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, cause?: unknown, details?: Record<string, unknown> }} [options]
   */
  constructor(message, { code = 'app/unknown', cause, details } = {}) {
    super(message);
    this.name = 'AppError';
    /** @type {string} */
    this.code = code;
    /** @type {unknown} */
    this.cause = cause;
    if (details) Object.assign(this, details);
  }
}

// Friendly text for Firebase error codes that can come from any call.
export const SECURITY_CHECK_FAILED = 'The security check on this page stopped working. Please refresh the page and try again.';

const COMMON_MESSAGES = {
  // reCAPTCHA in the browser broke (often a page left open in the background on a phone), so
  // Google refused its token. Reloading the page loads it fresh.
  'auth/invalid-recaptcha-token': SECURITY_CHECK_FAILED,
  'auth/missing-recaptcha-token': SECURITY_CHECK_FAILED,
  'auth/captcha-check-failed': SECURITY_CHECK_FAILED,
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/user-disabled': 'This account has been disabled. Contact support@urbangaragesales.com.au.',
  'auth/requires-recent-login': 'For your security, please sign out and sign in again, then retry.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'permission-denied': 'You do not have permission to do that.',
  'unavailable': 'The service is temporarily unavailable. Please try again.',
  'functions/permission-denied': 'You do not have permission to do that.',
  'functions/resource-exhausted': 'Too many requests. Please wait a minute and try again.',
  'functions/unauthenticated': 'Please sign in and try again.',
  'storage/unauthorized': 'You do not have permission to upload that file.',
  'storage/canceled': 'The upload was cancelled.',
  'storage/quota-exceeded': 'Uploads are unavailable right now. Please try again later.',
};

// Wraps a Firebase (or any) error in an AppError with friendly text. Server-written messages
// from callable functions (HttpsError) are already meant for users, so they are kept.
/**
 * @param {any} error
 * @param {string} [fallback]
 * @returns {AppError}
 */
export function toAppError(error, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof AppError) return error;
  const code = error?.code || 'app/unknown';
  let message = COMMON_MESSAGES[code];
  if (!message && code.startsWith('functions/') && error?.message && code !== 'functions/internal') {
    message = error.message;
  }
  return new AppError(message || fallback, { code, cause: error });
}
