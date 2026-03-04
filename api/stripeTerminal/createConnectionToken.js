// API endpoint to create Stripe Terminal connection token
import Stripe from 'stripe';
import admin from 'firebase-admin';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const projectId = process.env.FIREBASE_PROJECT_ID || "urbangaragesale";

// Initialize Firebase Admin
function getFirebaseAdmin() {
  if (!admin.apps.length) {
    try {
      let credentials = undefined;
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
          credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        } catch (e) {
          console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON');
        }
      }
      
      const options = { projectId };
      if (credentials) {
        options.credential = admin.credential.cert(credentials);
      }
      
      admin.initializeApp(options);
      console.log('✓ Firebase Admin initialized');
    } catch (error) {
      console.error('Firebase Admin init error:', error.message);
      throw error;
    }
  }
  return admin;
}

// Verify token and extract user ID
async function extractUserIdFromToken(idToken) {
  try {
    const adminApp = getFirebaseAdmin();
    const decodedToken = await adminApp.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    if (!uid || typeof uid !== 'string' || uid.length > 128) {
      throw new Error(`Invalid UID format: ${uid}`);
    }
    
    console.log('✓ Token verified, UID:', uid);
    return uid;
  } catch (error) {
    console.error('Token verification error:', error.message);
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

export default async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("=== Create Connection Token Request ===");
    
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing auth header");
      return res.status(401).json({ error: "Missing authorization header" });
    }

    // Verify user is authenticated
    const idToken = authHeader.substring(7);
    await extractUserIdFromToken(idToken);

    if (!stripeSecretKey) {
      throw new Error("Stripe API key not configured");
    }

    // Create Stripe instance
    const stripe = new Stripe(stripeSecretKey);

    // Create connection token for Terminal
    const connectionToken = await stripe.terminalConnections.createConnectionToken({});

    console.log('✓ Connection token created:', connectionToken.secret.substring(0, 20) + '...');

    return res.status(200).json({
      success: true,
      secret: connectionToken.secret,
    });
    
  } catch (error) {
    console.error("Fatal error:", error.message);
    console.error("Stack:", error.stack);
    return res.status(500).json({
      error: error.message || "Failed to create connection token",
      type: error.constructor?.name,
    });
  }
};
