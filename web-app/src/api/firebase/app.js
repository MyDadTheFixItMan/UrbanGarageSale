import { initializeApp } from 'firebase/app';
import { getAuth, initializeRecaptchaConfig } from 'firebase/auth';
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

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Cloud Functions run in Sydney, next to the Firestore database in Melbourne.
export const FUNCTIONS_REGION = 'australia-southeast1';
export const functions = getFunctions(app, FUNCTIONS_REGION);

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

// Firebase Auth's reCAPTCHA Enterprise (it guards password sign-in and SMS codes when turned on
// for the project) loads first, with Auth's own key. App Check uses a second key on the same
// script. If App Check loaded the script first, Auth's key was never set up, so Auth waited
// forever for its token and 2FA sign-in hung at "Sending code" (2026-11-08).
const ENTERPRISE_SCRIPT = 'script[src*="recaptcha/enterprise.js"]';

function enterpriseScriptReady(timeoutMs = 10000) {
  return /** @type {Promise<void>} */ (new Promise((resolve) => {
    const started = Date.now();
    (function check() {
      const loading = document.querySelector(ENTERPRISE_SCRIPT);
      if (!loading || /** @type {any} */ (window).grecaptcha?.enterprise || Date.now() - started > timeoutMs) {
        resolve();
        return;
      }
      setTimeout(check, 100);
    })();
  }));
}

// Google's reCAPTCHA script is ~350 KB, so it isn't fetched while the page is first drawing.
// It starts when the browser goes idle after the page has loaded, or straight away when something
// needs it first (sign-in, an SMS code, or an API call that sends an App Check token). The order
// never changes: Auth's reCAPTCHA settings first, App Check after (see above).
const canUseRecaptcha = typeof window !== 'undefined' && !isDevelopment;
/** @type {Promise<void> | null} */
let recaptchaStarted = null;
function startAuthRecaptcha() {
  if (!recaptchaStarted) {
    recaptchaStarted = canUseRecaptcha
      ? initializeRecaptchaConfig(auth).then(() => enterpriseScriptReady(), () => {})
      : Promise.resolve();
  }
  return recaptchaStarted;
}

// Resolves once Auth's reCAPTCHA settings are known (and its script loaded, if the project uses
// it). Never rejects: without it Auth still works, it just fetches the settings itself.
// Awaiting it starts the loading if it hasn't started yet.
/** @type {PromiseLike<void>} */
export const authRecaptchaReady = {
  then: (onFulfilled, onRejected) => startAuthRecaptcha().then(onFulfilled, onRejected),
};

// App Check: proves requests come from this website (reCAPTCHA Enterprise, invisible to users).
// Firestore, Storage and callable functions attach the token automatically; calls to our own
// API add it with appCheckHeaders(). Off until VITE_APPCHECK_SITE_KEY is set.
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
/** @type {Promise<import('firebase/app-check').AppCheck | null> | null} */
let appCheckStarted = null;
function startAppCheck() {
  if (!appCheckStarted) {
    appCheckStarted = appCheckSiteKey && typeof window !== 'undefined'
      ? startAuthRecaptcha().then(() => initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      }))
      : startAuthRecaptcha().then(() => null);
  }
  return appCheckStarted;
}

if (typeof window !== 'undefined' && (canUseRecaptcha || appCheckSiteKey)) {
  const whenIdle = () => {
    const w = /** @type {any} */ (window);
    if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(() => startAppCheck(), { timeout: 3000 });
    else setTimeout(() => startAppCheck(), 1500);
  };
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
}

export async function appCheckHeaders() {
  try {
    const appCheck = await startAppCheck();
    if (!appCheck) return {};
    const { token } = await getToken(appCheck);
    return { 'X-Firebase-AppCheck': token };
  } catch {
    return {};
  }
}
