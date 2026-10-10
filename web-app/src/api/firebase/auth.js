import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  RecaptchaVerifier,
  getMultiFactorResolver,
  multiFactor,
  PhoneMultiFactorGenerator,
  sendEmailVerification,
  PhoneAuthProvider,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { API_BASE_URL, apiFetch } from '@/lib/api-base';
import { auth, db, isDevelopment } from './app';
import {
  normalizePhone,
  smsErrorMessage,
  signUpErrorMessage,
  popupSignInErrorMessage,
  verificationCodeErrorMessage
} from './authMessages';

// In-progress multi-factor sign-in / enrolment (kept in memory only, never persisted).
let pendingMfaResolver = null;
let pendingMfaVerificationId = null;
let pendingEnrollmentVerificationId = null;

// Converts Firebase's "second factor required" error into one the login page can act on.
function mfaRequiredError(error) {
  pendingMfaResolver = getMultiFactorResolver(auth, error);
  pendingMfaVerificationId = null;
  const hint = pendingMfaResolver.hints.find((h) => h.factorId === PhoneMultiFactorGenerator.FACTOR_ID);
  const err = new Error('Enter the code we text to your phone to finish signing in.');
  err.mfaRequired = true;
  err.phoneHint = hint?.phoneNumber || '';
  return err;
}

// Asks the API to turn 2FA on or off, then refreshes the ID token so the new claim applies.
async function setTwoFactor(action) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user');
  }

  const token = await user.getIdToken();
  const response = await apiFetch(`${API_BASE_URL}/api/setUserClaims`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to ${action} 2FA (${response.status})`);
  }

  await user.getIdToken(true);
}

// Google / Facebook / Apple sign-in share the same popup flow and error handling.
async function signInWithProvider(provider, providerName) {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    if (error.code === 'auth/multi-factor-auth-required') throw mfaRequiredError(error);
    throw new Error(popupSignInErrorMessage(error, providerName));
  }
}

function clearRecaptchaElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  element.innerHTML = '';
  element.style.display = 'none'; // Keep hidden for invisible reCAPTCHA
}

function clearRecaptchaVerifier() {
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {
      console.log('ℹ Info clearing previous reCAPTCHA:', e.message);
    }
    window.recaptchaVerifier = null;
  }
}

// Authentication functions
export const firebaseAuth = {
  // Login with email and password
  login: async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      if (error.code === 'auth/multi-factor-auth-required') throw mfaRequiredError(error);
      throw new Error(`Login failed: ${error.message}`);
    }
  },

  // Sign up new user
  signUp: async (email, password) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Firebase requires a verified email before 2FA (SMS) can be enrolled.
      await sendEmailVerification(userCredential.user).catch((e) => console.warn('Verification email not sent:', e.message));
      return userCredential.user;
    } catch (error) {
      console.error('Firebase sign up error:', error.code, error.message);
      throw new Error(signUpErrorMessage(error));
    }
  },

  // Logout
  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  },

  signInWithGoogle: () => signInWithProvider(new GoogleAuthProvider(), 'Google'),

  signInWithFacebook: () => {
    const provider = new FacebookAuthProvider();
    provider.addScope('email');
    return signInWithProvider(provider, 'Facebook');
  },

  signInWithApple: () => {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    return signInWithProvider(provider, 'Apple');
  },

  // Get current user
  getCurrentUser: () => {
    return auth.currentUser;
  },

  // Check if authenticated
  isAuthenticated: async () => {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe(); // Immediately unsubscribe after first check
        resolve(!!user);
      });
    });
  },

  // Get current user data
  me: async () => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    try {
      // Get user profile from Firestore
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists()) {
        return {
          id: user.uid,
          email: user.email,
          ...userSnap.data()
        };
      }
    } catch (error) {
      // Don't block app if Firestore is temporarily unavailable
      console.warn('⚠️ Could not fetch user profile from Firestore:', error.message);
    }

    // Return auth user data even if Firestore fails
    // This allows the app to function while Firestore reconnects
    return {
      id: user.uid,
      email: user.email,
      full_name: user.displayName || '',
      role: 'user',
      phone_verified: false
    };
  },

  // Listen to auth state changes
  onAuthStateChanged: (callback) => {
    return onAuthStateChanged(auth, callback);
  },

  // Update user profile
  updateProfile: async (data) => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    if (!data || Object.keys(data).length === 0) {
      console.warn('⚠️ updateProfile called with empty data');
      return;
    }

    try {
      // Use setDoc with merge to create or update
      await setDoc(doc(db, 'users', user.uid), data, { merge: true });
    } catch (error) {
      console.error('❌ Error updating profile:', error.code, error.message);
      throw error;
    }
  },

  // Send password reset email
  resetPassword: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw new Error(`Password reset failed: ${error.message}`);
    }
  },

  // Verify password reset code and confirm new password
  confirmPasswordResetCode: async (code, newPassword) => {
    try {
      // Verify the code is valid and get the email
      const email = await verifyPasswordResetCode(auth, code);
      await confirmPasswordReset(auth, code, newPassword);
      return email;
    } catch (error) {
      if (error.code === 'auth/invalid-action-code' || error.code === 'auth/expired-action-code') {
        throw new Error('Your password reset link has expired. Please request a new one.');
      }
      throw new Error(`Password reset failed: ${error.message}`);
    }
  },

  // Change password (requires current password)
  changePassword: async (currentPassword, newPassword) => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error('No authenticated user');
    }

    try {
      // Reauthenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        throw new Error('Current password is incorrect');
      }
      throw new Error(`Password change failed: ${error.message}`);
    }
  },

  // Initialize reCAPTCHA verifier
  setupRecaptcha: (elementId) => {
    return new Promise((resolve, reject) => {
      const element = document.getElementById(elementId);
      if (!element) {
        reject(new Error(`reCAPTCHA container element with id "${elementId}" not found`));
        return;
      }

      clearRecaptchaElement(element);
      clearRecaptchaVerifier();

      // Wait for DOM to update before creating new verifier
      setTimeout(() => {
        try {
          // Firebase's invisible reCAPTCHA for phone/SMS auth needs no site key of our own.
          // In development with appVerificationDisabledForTesting=true, Firebase skips reCAPTCHA
          // validation but the verifier object is still required.
          const verifier = new RecaptchaVerifier(auth, elementId, {
            size: 'invisible',
            'expired-callback': () => {
              console.log('⚠️ reCAPTCHA expired');
            },
            'error-callback': (error) => {
              console.error('❌ reCAPTCHA error:', error);
            }
          });

          window.recaptchaVerifier = verifier;
          resolve(verifier);
        } catch (error) {
          console.error('❌ Failed to create reCAPTCHA verifier', isDevelopment ? '(dev mode):' : ':', error.message);
          window.recaptchaVerifier = null;
          reject(error);
        }
      }, 100);
    });
  },

  // ---------- Two-factor authentication (Firebase multi-factor auth, SMS) ----------
  // Once a user enrols, Firebase itself refuses to complete sign-in (password or Google /
  // Facebook / Apple) until the SMS code is entered, so the second factor can't be skipped
  // by skipping a screen. Firestore rules and the API additionally require that the
  // current session passed the second factor before any listing or payment action.

  // True if the account has a second factor enrolled.
  is2FAEnabled: async () => {
    const user = auth.currentUser;
    return Boolean(user) && multiFactor(user).enrolledFactors.length > 0;
  },

  // True if this sign-in session completed the SMS second factor.
  hasSecondFactorSession: async () => {
    const user = auth.currentUser;
    if (!user) return false;
    const { claims } = await user.getIdTokenResult();
    return Boolean(claims.firebase?.sign_in_second_factor) && claims.two_fa_enabled === true;
  },

  // Sign-in step 2: text the code to the phone enrolled on the account.
  // Call after login() / signInWith*() threw an error with `mfaRequired: true`.
  sendMfaSignInCode: async (recaptchaElementId) => {
    if (!pendingMfaResolver) {
      throw new Error('Your sign-in session expired. Please sign in again.');
    }
    const hint = pendingMfaResolver.hints.find((h) => h.factorId === PhoneMultiFactorGenerator.FACTOR_ID);
    if (!hint) {
      throw new Error('No phone is enrolled for two-factor sign-in on this account.');
    }
    const verifier = await firebaseAuth.setupRecaptcha(recaptchaElementId);
    try {
      pendingMfaVerificationId = await new PhoneAuthProvider(auth).verifyPhoneNumber(
        { multiFactorHint: hint, session: pendingMfaResolver.session },
        verifier
      );
    } catch (error) {
      throw new Error(smsErrorMessage(error));
    }
  },

  // Sign-in step 3: check the SMS code. Firebase only issues the session after this succeeds.
  completeMfaSignIn: async (code) => {
    if (!pendingMfaResolver || !pendingMfaVerificationId) {
      throw new Error('Your sign-in session expired. Please sign in again.');
    }
    try {
      const credential = PhoneAuthProvider.credential(pendingMfaVerificationId, String(code).trim());
      const result = await pendingMfaResolver.resolveSignIn(PhoneMultiFactorGenerator.assertion(credential));
      pendingMfaResolver = null;
      pendingMfaVerificationId = null;
      return result.user;
    } catch (error) {
      throw new Error(verificationCodeErrorMessage(error, 'Verification failed'));
    }
  },

  // Firebase requires a verified email before a second factor can be enrolled.
  sendVerificationEmail: async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    await sendEmailVerification(user);
  },

  // Enrolment step 1: text a code to the phone number being enrolled.
  startMfaEnrollment: async (phoneNumber, recaptchaElementId) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    await user.reload();
    if (!user.emailVerified) {
      const error = new Error('Please verify your email address first. Check your inbox for the verification link.');
      error.emailNotVerified = true;
      throw error;
    }

    const normalized = normalizePhone(phoneNumber);
    const verifier = await firebaseAuth.setupRecaptcha(recaptchaElementId);
    try {
      const session = await multiFactor(user).getSession();
      pendingEnrollmentVerificationId = await new PhoneAuthProvider(auth).verifyPhoneNumber(
        { phoneNumber: normalized, session },
        verifier
      );
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        throw new Error('For your security, please sign out and sign in again before turning on 2FA.');
      }
      throw new Error(smsErrorMessage(error));
    }
  },

  // Enrolment step 2: confirm the code, enrol the phone, then have the server set the claim.
  // Returns { signInAgain: true } if the user must sign in again to get a 2FA session.
  finishMfaEnrollment: async (code) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    if (!pendingEnrollmentVerificationId) {
      throw new Error('Please request a new code.');
    }

    try {
      const credential = PhoneAuthProvider.credential(pendingEnrollmentVerificationId, String(code).trim());
      await multiFactor(user).enroll(PhoneMultiFactorGenerator.assertion(credential), 'Mobile');
      pendingEnrollmentVerificationId = null;
    } catch (error) {
      throw new Error(verificationCodeErrorMessage(error, 'Could not turn on 2FA'));
    }

    await setTwoFactor('enable');
    return { signInAgain: !(await firebaseAuth.hasSecondFactorSession()) };
  },

  // Removes every enrolled second factor. Firebase may ask for a recent sign-in first.
  disable2FA: async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    try {
      for (const factor of multiFactor(user).enrolledFactors) {
        await multiFactor(user).unenroll(factor);
      }
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        throw new Error('For your security, please sign out and sign in again before turning off 2FA.');
      }
      throw error;
    }
    await setTwoFactor('disable');
  },

  // Clear reCAPTCHA
  clearRecaptcha: () => {
    const element = document.getElementById('recaptcha-container');
    if (element) clearRecaptchaElement(element);
    clearRecaptchaVerifier();
    window.confirmationResult = null;
  },
};
