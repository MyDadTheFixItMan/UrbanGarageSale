// Pure helpers for the log in / sign up page. No React or Firebase, so they are unit tested directly.
import { passwordProblem } from '@/lib/password';

// Urban Garage Sale is an Australian service, so phone numbers start with +61.
export const PHONE_PREFIX = '+61 ';
export const PHONE_PLACEHOLDER = '+61 412 345 678';

// Turns a typed phone number into E.164 (the format Firebase needs).
// Returns { phone } or { problem }.
export function normalizePhone(raw) {
    let phone = String(raw || '').replace(/[\s\-()]/g, '');
    if (phone === '+61' || phone.length < 10) {
        return { problem: 'Please enter a complete phone number (minimum 10 digits)' };
    }
    // Australians often keep the leading 0: +61 0412... -> +61 412...
    phone = phone.replace(/^\+610/, '+61');
    if (!/^\+[1-9]\d{1,14}$/.test(phone)) {
        return { problem: 'Please enter a valid phone number with country code (e.g., +61 412 345 678)' };
    }
    return { phone };
}

// Returns the first problem with the sign-up form, or null if it can be submitted.
export function signUpProblem({ fullName, address, email, phone, password, confirmPassword }) {
    if (!fullName || !address || !email || !phone || !password || !confirmPassword) {
        return 'Please fill in all fields';
    }
    if (password !== confirmPassword) return 'Passwords do not match';
    return passwordProblem(password) || normalizePhone(phone).problem || null;
}

// Postcode and state from the chosen address, or read from typed text like "... VIC 3053".
export function postcodeAndState(address, postcode, state) {
    if (postcode && state) return { postcode, state };
    const match = String(address || '').match(/\b([A-Z]{2,3})\s+(\d{4})\b/);
    return match ? { state: match[1], postcode: match[2] } : { postcode, state };
}

// A readable message for a failed Google / Facebook / Apple sign-in. `action` is 'Sign in' or 'Sign up'.
export function oauthErrorMessage(error, action, provider) {
    const message = error?.message || '';
    if (message.includes('popup-closed')) return `${action} was cancelled`;
    if (message.includes('popup-blocked')) return `${action} popup was blocked. Please allow popups for this site.`;
    return message || `Failed to ${action.toLowerCase()} with ${provider}`;
}

// The profile created the first time someone signs in with Google / Facebook / Apple.
export function profileFromOAuthUser(user, now = new Date()) {
    return {
        email: user.email,
        full_name: user.displayName || String(user.email || '').split('@')[0],
        phone_verified: false,
        created_date: now.toISOString(),
        role: 'user',
    };
}
