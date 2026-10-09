// Pure helpers for the auth client: no Firebase SDK imports, so they can be unit tested directly.

// E.164 format; Australian numbers like 0412 345 678 or +61 0412... become +61412345678.
export function normalizePhone(phone) {
  let cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (/^04\d{8}$/.test(cleaned)) cleaned = '+61' + cleaned.slice(1);
  cleaned = cleaned.replace(/^\+610/, '+61');
  if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    throw new Error('Please enter a valid mobile number, e.g. 0412 345 678');
  }
  return cleaned;
}

export function smsErrorMessage(error) {
  switch (error.code) {
    case 'auth/too-many-requests': return 'Too many SMS requests. Please wait a few minutes and try again.';
    case 'auth/invalid-phone-number': return 'That mobile number is not valid.';
    case 'auth/captcha-check-failed': return 'Security check failed. Please refresh the page and try again.';
    case 'auth/network-request-failed': return 'Network error. Please check your connection and try again.';
    case 'auth/unverified-email': return 'Please verify your email address first.';
    case 'auth/second-factor-already-in-use': return 'That mobile number is already enrolled on this account.';
    default: return `Could not send the SMS code: ${error.message}`;
  }
}

export function signUpErrorMessage(error) {
  switch (error.code) {
    case 'auth/email-already-in-use': return 'This email is already registered. Please sign in or use a different email.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Password is too weak. Use at least 12 characters with letters and numbers.';
    case 'auth/password-does-not-meet-requirements': return 'Password must be at least 12 characters and include letters and numbers.';
    case 'auth/operation-not-allowed': return 'Email/password sign up is not enabled. Contact support.';
    default: return `Sign up failed: ${error.message}`;
  }
}

// Message for a failed Google / Facebook / Apple popup sign-in.
export function popupSignInErrorMessage(error, providerName) {
  switch (error.code) {
    case 'auth/popup-closed-by-user': return 'Sign in was cancelled';
    case 'auth/popup-blocked': return 'Sign in popup was blocked. Please allow popups for this site.';
    default: return `${providerName} sign in failed: ${error.message}`;
  }
}

export function verificationCodeErrorMessage(error, fallbackPrefix) {
  switch (error.code) {
    case 'auth/invalid-verification-code': return 'That code is incorrect. Please check the SMS and try again.';
    case 'auth/code-expired': return 'That code has expired. Please request a new one.';
    default: return `${fallbackPrefix}: ${error.message}`;
  }
}
