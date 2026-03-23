import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'urbangaragesale';
    
    try {
      // Construct service account from environment variables
      let credentials = undefined;
      
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
          credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
          console.log('Using service account from FIREBASE_SERVICE_ACCOUNT_JSON');
        } catch (e) {
          console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
        }
      }
      
      // If not found, try to construct from individual env vars
      if (!credentials && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        credentials = {
          type: 'service_account',
          project_id: projectId,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY,
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
        };
        console.log('Using service account from individual environment variables');
      }
      
      // Initialize with or without explicit credentials
      const options = {
        projectId: projectId,
      };
      
      if (credentials) {
        options.credential = admin.credential.cert(credentials);
        console.log('Using explicit service account credentials');
      } else {
        console.warn('No explicit credentials found, using Application Default Credentials');
      }
      
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
