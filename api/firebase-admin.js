import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'urbangaragesale';
    
    // Try to initialize with service account if credentials are available
    // Otherwise use default application credentials
    try {
      admin.initializeApp({
        projectId: projectId,
      });
      console.log('Firebase Admin initialized with project:', projectId);
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
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
