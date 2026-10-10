import {
  normalizePhone,
  smsErrorMessage,
  signUpErrorMessage,
  popupSignInErrorMessage,
  verificationCodeErrorMessage,
} from '@/api/firebase/authMessages';

describe('normalizePhone', () => {
  it.each([
    ['0412 345 678', '+61412345678'],
    ['0412-345-678', '+61412345678'],
    ['(04) 1234 5678', '+61412345678'],
    ['+61 412 345 678', '+61412345678'],
    ['+61 0412 345 678', '+61412345678'],
    ['+64 21 123 4567', '+64211234567'],
  ])('converts %s to E.164 %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', null, '12345', '0412 345', 'not a phone', '+0412345678'])('rejects %p', (input) => {
    expect(() => normalizePhone(input)).toThrow('Please enter a valid mobile number');
  });
});

describe('auth error messages', () => {
  it('maps SMS errors to plain-English messages and keeps unknown details', () => {
    expect(smsErrorMessage({ code: 'auth/too-many-requests' })).toMatch(/wait a few minutes/);
    expect(smsErrorMessage({ code: 'auth/second-factor-already-in-use' })).toMatch(/already enrolled/);
    expect(smsErrorMessage({ code: 'auth/other', message: 'boom' })).toBe('Could not send the SMS code: boom');
  });

  it('explains sign-up failures, including the password policy', () => {
    expect(signUpErrorMessage({ code: 'auth/email-already-in-use' })).toMatch(/already registered/);
    expect(signUpErrorMessage({ code: 'auth/password-does-not-meet-requirements' })).toMatch(/12 characters/);
    expect(signUpErrorMessage({ code: 'x', message: 'nope' })).toBe('Sign up failed: nope');
  });

  it('names the provider when a popup sign-in fails for an unexpected reason', () => {
    expect(popupSignInErrorMessage({ code: 'auth/popup-closed-by-user' }, 'Google')).toBe('Sign in was cancelled');
    expect(popupSignInErrorMessage({ code: 'auth/popup-blocked' }, 'Apple')).toMatch(/allow popups/);
    expect(popupSignInErrorMessage({ code: 'x', message: 'bad' }, 'Facebook')).toBe('Facebook sign in failed: bad');
  });

  it('distinguishes wrong and expired SMS codes', () => {
    expect(verificationCodeErrorMessage({ code: 'auth/invalid-verification-code' }, 'X')).toMatch(/incorrect/);
    expect(verificationCodeErrorMessage({ code: 'auth/code-expired' }, 'X')).toMatch(/expired/);
    expect(verificationCodeErrorMessage({ code: 'x', message: 'm' }, 'Could not turn on 2FA')).toBe('Could not turn on 2FA: m');
  });
});
