// Runs the real auth client against a mocked Firebase Auth SDK and API, covering the
// two-factor sign-in and enrolment flows.

jest.mock('firebase/auth', () => {
  const PhoneAuthProvider = jest.fn().mockImplementation(() => ({ verifyPhoneNumber: PhoneAuthProvider.verifyPhoneNumber }));
  PhoneAuthProvider.verifyPhoneNumber = jest.fn();
  PhoneAuthProvider.credential = jest.fn((id, code) => ({ id, code }));
  const provider = () => jest.fn().mockImplementation(() => ({ addScope: jest.fn() }));
  return {
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    sendEmailVerification: jest.fn(async () => {}),
    signInWithPopup: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    verifyPasswordResetCode: jest.fn(),
    confirmPasswordReset: jest.fn(),
    updatePassword: jest.fn(),
    reauthenticateWithCredential: jest.fn(),
    EmailAuthProvider: { credential: jest.fn() },
    GoogleAuthProvider: provider(),
    FacebookAuthProvider: provider(),
    OAuthProvider: provider(),
    RecaptchaVerifier: jest.fn().mockImplementation(() => ({ clear: jest.fn() })),
    getMultiFactorResolver: jest.fn(),
    multiFactor: jest.fn(),
    PhoneMultiFactorGenerator: { FACTOR_ID: 'phone', assertion: jest.fn((credential) => ({ credential })) },
    PhoneAuthProvider,
  };
});
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn() }));
jest.mock('@/api/firebase/app', () => ({ auth: { currentUser: null }, db: {}, isDevelopment: true }));
jest.mock('@/lib/api-base', () => ({ API_BASE_URL: 'https://api.test', apiFetch: jest.fn() }));

import * as sdk from 'firebase/auth';
import { auth } from '@/api/firebase/app';
import { apiFetch } from '@/lib/api-base';
import { firebaseAuth } from '@/api/firebase/auth';

const authError = (code, message = code) => Object.assign(new Error(message), { code });
const jsonResponse = (ok, body, status = ok ? 200 : 400) => ({ ok, status, json: async () => body });

function signedInUser({ emailVerified = true, claims = {} } = {}) {
  return {
    uid: 'user-1',
    email: 'seller@example.com',
    emailVerified,
    reload: jest.fn(async () => {}),
    getIdToken: jest.fn(async () => 'id-token'),
    getIdTokenResult: jest.fn(async () => ({ claims })),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  auth.currentUser = null;
  document.body.innerHTML = '<div id="recaptcha-container"></div>';
});

describe('password sign-in', () => {
  it('returns the user on success', async () => {
    sdk.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'user-1' } });
    await expect(firebaseAuth.login('a@b.c', 'pw')).resolves.toEqual({ uid: 'user-1' });
  });

  it('asks for the SMS code when the account has 2FA, then completes sign-in with it', async () => {
    const resolver = {
      hints: [{ factorId: 'phone', phoneNumber: '+61******678' }],
      session: 'mfa-session',
      resolveSignIn: jest.fn(async () => ({ user: { uid: 'user-1' } })),
    };
    sdk.signInWithEmailAndPassword.mockRejectedValue(authError('auth/multi-factor-auth-required'));
    sdk.getMultiFactorResolver.mockReturnValue(resolver);
    sdk.PhoneAuthProvider.verifyPhoneNumber.mockResolvedValue('verification-id');

    const error = await firebaseAuth.login('a@b.c', 'pw').catch((e) => e);
    expect(error.mfaRequired).toBe(true);
    expect(error.phoneHint).toBe('+61******678');

    await firebaseAuth.sendMfaSignInCode('recaptcha-container');
    expect(sdk.PhoneAuthProvider.verifyPhoneNumber).toHaveBeenCalledWith(
      { multiFactorHint: resolver.hints[0], session: 'mfa-session' }, expect.anything()
    );

    await expect(firebaseAuth.completeMfaSignIn(' 123456 ')).resolves.toEqual({ uid: 'user-1' });
    expect(sdk.PhoneAuthProvider.credential).toHaveBeenCalledWith('verification-id', '123456');

    // The pending sign-in is cleared, so the code cannot be replayed.
    await expect(firebaseAuth.completeMfaSignIn('123456')).rejects.toThrow('sign-in session expired');
  });

  it('explains a wrong SMS code', async () => {
    const resolver = { hints: [{ factorId: 'phone' }], session: 's', resolveSignIn: jest.fn().mockRejectedValue(authError('auth/invalid-verification-code')) };
    sdk.signInWithEmailAndPassword.mockRejectedValue(authError('auth/multi-factor-auth-required'));
    sdk.getMultiFactorResolver.mockReturnValue(resolver);
    sdk.PhoneAuthProvider.verifyPhoneNumber.mockResolvedValue('verification-id');
    await firebaseAuth.login('a@b.c', 'pw').catch(() => {});
    await firebaseAuth.sendMfaSignInCode('recaptcha-container');
    await expect(firebaseAuth.completeMfaSignIn('000000')).rejects.toThrow('That code is incorrect');
  });
});

describe('sign-up and social sign-in', () => {
  it('sends a verification email after sign-up (needed before 2FA can be enrolled)', async () => {
    const user = { uid: 'new' };
    sdk.createUserWithEmailAndPassword.mockResolvedValue({ user });
    await firebaseAuth.signUp('a@b.c', 'long-password-123');
    expect(sdk.sendEmailVerification).toHaveBeenCalledWith(user);
  });

  it('turns sign-up errors into readable messages', async () => {
    sdk.createUserWithEmailAndPassword.mockRejectedValue(authError('auth/email-already-in-use'));
    await expect(firebaseAuth.signUp('a@b.c', 'pw')).rejects.toThrow('already registered');
  });

  it('reports a cancelled Google popup plainly', async () => {
    sdk.signInWithPopup.mockRejectedValue(authError('auth/popup-closed-by-user'));
    await expect(firebaseAuth.signInWithGoogle()).rejects.toThrow('Sign in was cancelled');
  });

  it('applies the 2FA requirement to social sign-in too', async () => {
    sdk.signInWithPopup.mockRejectedValue(authError('auth/multi-factor-auth-required'));
    sdk.getMultiFactorResolver.mockReturnValue({ hints: [{ factorId: 'phone', phoneNumber: '+61***' }] });
    await expect(firebaseAuth.signInWithApple()).rejects.toMatchObject({ mfaRequired: true });
  });
});

describe('2FA enrolment', () => {
  it('requires a verified email before sending a code', async () => {
    auth.currentUser = signedInUser({ emailVerified: false });
    await expect(firebaseAuth.startMfaEnrollment('0412 345 678', 'recaptcha-container'))
      .rejects.toMatchObject({ emailNotVerified: true });
    expect(sdk.PhoneAuthProvider.verifyPhoneNumber).not.toHaveBeenCalled();
  });

  it('rejects an invalid mobile number before contacting Firebase', async () => {
    auth.currentUser = signedInUser();
    await expect(firebaseAuth.startMfaEnrollment('12345', 'recaptcha-container')).rejects.toThrow('valid mobile number');
    expect(sdk.PhoneAuthProvider.verifyPhoneNumber).not.toHaveBeenCalled();
  });

  it('enrols the phone, sets the 2FA claim through the API and refreshes the token', async () => {
    const user = signedInUser({ claims: { two_fa_enabled: true, firebase: { sign_in_second_factor: 'phone' } } });
    auth.currentUser = user;
    const mfa = { getSession: jest.fn(async () => 'session'), enroll: jest.fn(async () => {}) };
    sdk.multiFactor.mockReturnValue(mfa);
    sdk.PhoneAuthProvider.verifyPhoneNumber.mockResolvedValue('enrol-verification-id');
    apiFetch.mockResolvedValue(jsonResponse(true, {}));

    await firebaseAuth.startMfaEnrollment('0412 345 678', 'recaptcha-container');
    expect(sdk.PhoneAuthProvider.verifyPhoneNumber).toHaveBeenCalledWith({ phoneNumber: '+61412345678', session: 'session' }, expect.anything());

    await expect(firebaseAuth.finishMfaEnrollment('654321')).resolves.toEqual({ signInAgain: false });
    expect(mfa.enroll).toHaveBeenCalledWith({ credential: { id: 'enrol-verification-id', code: '654321' } }, 'Mobile');
    expect(apiFetch).toHaveBeenCalledWith('https://api.test/api/setUserClaims', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer id-token' }),
      body: JSON.stringify({ action: 'enable' }),
    }));
    expect(user.getIdToken).toHaveBeenLastCalledWith(true);
  });

  it('tells the user to sign in again when this session did not pass 2FA', async () => {
    auth.currentUser = signedInUser({ claims: { two_fa_enabled: true } });
    sdk.multiFactor.mockReturnValue({ getSession: jest.fn(), enroll: jest.fn(async () => {}) });
    sdk.PhoneAuthProvider.verifyPhoneNumber.mockResolvedValue('id');
    apiFetch.mockResolvedValue(jsonResponse(true, {}));
    await firebaseAuth.startMfaEnrollment('0412345678', 'recaptcha-container');
    await expect(firebaseAuth.finishMfaEnrollment('1')).resolves.toEqual({ signInAgain: true });
  });

  it('surfaces the server error if the 2FA claim cannot be set', async () => {
    auth.currentUser = signedInUser();
    sdk.multiFactor.mockReturnValue({ getSession: jest.fn(), enroll: jest.fn(async () => {}) });
    sdk.PhoneAuthProvider.verifyPhoneNumber.mockResolvedValue('id');
    apiFetch.mockResolvedValue(jsonResponse(false, { error: 'Claims service unavailable' }, 503));
    await firebaseAuth.startMfaEnrollment('0412345678', 'recaptcha-container');
    await expect(firebaseAuth.finishMfaEnrollment('1')).rejects.toThrow('Claims service unavailable');
  });
});

describe('disable2FA', () => {
  it('removes every enrolled factor and clears the claim', async () => {
    auth.currentUser = signedInUser();
    const factors = [{ uid: 'f1' }, { uid: 'f2' }];
    const mfa = { enrolledFactors: factors, unenroll: jest.fn(async () => {}) };
    sdk.multiFactor.mockReturnValue(mfa);
    apiFetch.mockResolvedValue(jsonResponse(true, {}));

    await firebaseAuth.disable2FA();
    expect(mfa.unenroll.mock.calls.map((c) => c[0])).toEqual(factors);
    expect(apiFetch.mock.calls[0][1].body).toBe(JSON.stringify({ action: 'disable' }));
  });

  it('asks for a fresh sign-in when Firebase requires one', async () => {
    auth.currentUser = signedInUser();
    sdk.multiFactor.mockReturnValue({ enrolledFactors: [{}], unenroll: jest.fn().mockRejectedValue(authError('auth/requires-recent-login')) });
    await expect(firebaseAuth.disable2FA()).rejects.toThrow('sign out and sign in again');
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe('hasSecondFactorSession', () => {
  it.each([
    [{ two_fa_enabled: true, firebase: { sign_in_second_factor: 'phone' } }, true],
    [{ two_fa_enabled: true }, false],
    [{ firebase: { sign_in_second_factor: 'phone' } }, false],
  ])('claims %j -> %s', async (claims, expected) => {
    auth.currentUser = signedInUser({ claims });
    await expect(firebaseAuth.hasSecondFactorSession()).resolves.toBe(expected);
  });

  it('is false when signed out', async () => {
    await expect(firebaseAuth.hasSecondFactorSession()).resolves.toBe(false);
  });
});
