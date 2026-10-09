import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken } from 'firebase/app-check';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// App Check: proves requests come from this website (reCAPTCHA Enterprise, invisible to users).
// Firestore, Storage and callable functions attach the token automatically; calls to our own
// API add it with appCheckHeaders(). Off until VITE_APPCHECK_SITE_KEY is set.
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
export const appCheck = appCheckSiteKey && typeof window !== 'undefined'
  ? initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true })
  : null;

export async function appCheckHeaders() {
  if (!appCheck) return {};
  try {
    const { token } = await getToken(appCheck);
    return { 'X-Firebase-AppCheck': token };
  } catch {
    return {};
  }
}
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Configure app verification for Phone Authentication
// For development: disable app verification to allow testing
// For production: enable verification when reCAPTCHA is fully configured
export const isDevelopment = import.meta.env.MODE === 'development' || !import.meta.env.PROD;
if (isDevelopment) {
  auth.settings.appVerificationDisabledForTesting = true;
  console.log('✓ Phone Auth: Development mode - app verification disabled for testing');
} else {
  auth.settings.appVerificationDisabledForTesting = false;
  console.log('✓ Phone Auth: Production mode - app verification enabled');
}
