// One password rule for sign-up, change password and reset password.
// Firebase Authentication enforces the same policy server-side (Identity Platform password policy).
export const MIN_PASSWORD_LENGTH = 12;

// Returns a message describing what is wrong with the password, or null if it is acceptable.
export function passwordProblem(password) {
    const value = String(password || '');
    if (value.length < MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
        return 'Password must contain both letters and numbers';
    }
    return null;
}
