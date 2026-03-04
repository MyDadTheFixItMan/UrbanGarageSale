// Create Payment Intent endpoint for Vercel
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

let stripe = null;
const getStripe = async () => {
  if (!stripe) {
    if (!stripeSecretKey) {
      throw new Error("Stripe not configured - missing STRIPE_SECRET_KEY");
    }
    stripe = new Stripe(stripeSecretKey);
  }
  return stripe;
};

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
    console.log("=== Card Payment Request ===");
    
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing auth header");
      return res.status(401).json({ error: "Missing authorization header" });
    }

    // Parse request body
    let body = {};
    try {
      const bodyStr = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => data += chunk);
        req.on("end", () => resolve(data));
        req.on("error", reject);
      });
      body = bodyStr ? JSON.parse(bodyStr) : {};
    } catch (e) {
      console.error("Invalid JSON:", e.message);
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { amount, description, currency = "aud" } = body;
    if (!amount) {
      return res.status(400).json({ error: "Missing amount field" });
    }

    console.log("Amount:", amount, "Description:", description);

    // Extract and verify user ID from token
    const idToken = authHeader.substring(7);
    let userId;
    
    try {
      userId = await extractUserIdFromToken(idToken);
    } catch (tokenError) {
      console.error("Token error:", tokenError.message);
      return res.status(401).json({ error: tokenError.message });
    }

    console.log("Creating payment intent for user:", userId);

    // Create Stripe payment intent
    const stripe = await getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency,
      description: `Urban Pay Sale - ${description?.substring(0, 50)}`,
      metadata: {
        sellerId: userId,
        saleDescription: description?.substring(0, 50) || "Urban Pay Sale",
      },
    });

    console.log("✓ Payment intent created:", paymentIntent.id);

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
    
  } catch (error) {
    console.error("Fatal error:", error.message);
    console.error("Stack:", error.stack);
    return res.status(500).json({
      error: error.message || "Internal server error",
      type: error.constructor?.name,
    });
  }
};
