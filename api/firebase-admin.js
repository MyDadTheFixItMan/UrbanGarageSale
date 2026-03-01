import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'urbangaragesale';
    
    try {
      // Try to get service account from environment variable first
      let credentials = undefined;
      
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
          credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
          console.log('Using service account from FIREBASE_SERVICE_ACCOUNT_JSON');
        } catch (e) {
          console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
        }
      }
      
      // Initialize with or without explicit credentials
      const options = {
        projectId: projectId,
      };
      
      if (credentials) {
        options.credential = admin.credential.cert(credentials);
      }
      // If no credentials provided, Admin SDK will use Application Default Credentials
      // (including credentials available to Vercel, Google Cloud, etc.)
      
      admin.initializeApp(options);
      console.log('Firebase Admin initialized with project:', projectId);
    } catch (error) {
      console.error('Firebase Admin initialization error:', error.message);
      throw error;
    }
  }
  
  return admin;
}

// Verify Firebase ID token
export async function verifyToken(idToken) {
  try {
    const admin = getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    console.error("Token verification failed:", error);
    throw new Error("Invalid or expired token");
  }
}

// Get Firestore database reference
export function getFirestore() {
  const admin = getFirebaseAdmin();
  return admin.firestore();
}
