// Firebase Admin setup for the API, using the modular firebase-admin API (v12+; v14 removed
// the old namespaced `admin.auth()` / `admin.firestore()` exports).
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { getFirestore as getAdminFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID || 'urbangaragesale';

function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
    } catch (e) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
  }
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    return cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  }
  return applicationDefault();
}

function getApp() {
  return getApps()[0] || initializeApp({ projectId, credential: loadCredential() });
}

// Returns an object with the same shape the handlers use:
// admin.auth(), admin.appCheck(), admin.firestore(), admin.firestore.FieldValue, admin.firestore.Timestamp
export function getFirebaseAdmin() {
  const app = getApp();
  const firestore = () => getAdminFirestore(app);
  firestore.FieldValue = FieldValue;
  firestore.Timestamp = Timestamp;
  return { auth: () => getAuth(app), appCheck: () => getAppCheck(app), firestore };
}

// Verify Firebase ID token and return the uid. Revoked tokens are rejected too.
export async function verifyToken(idToken) {
  try {
    const decoded = await getAuth(getApp()).verifyIdToken(idToken, true);
    return decoded.uid;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export function getFirestore() {
  return getAdminFirestore(getApp());
}
