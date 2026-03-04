// api/urbanPayment/recordTapToPaySale.js

import Stripe from "stripe";
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

const getStripe = async () => {
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(stripeSecretKey);
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log("=== Record Tap to Pay Sale Request ===");
    
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("Missing auth header");
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const idToken = authHeader.substring(7);
    const sellerId = await extractUserIdFromToken(idToken);

    const {
      amount,
      description,
      paymentIntentId,
      currency = 'aud',
      paymentMethod = 'tap_to_pay',
    } = req.body;

    if (!amount || !paymentIntentId) {
      console.error('Missing required fields');
      return res.status(400).json({
        error: 'Missing required fields: amount, paymentIntentId',
      });
    }

    console.log("Amount:", amount, "Payment Intent:", paymentIntentId);

    // Verify payment intent status with Stripe
    const stripe = await getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    console.log("Payment Intent Status:", paymentIntent.status);

    if (paymentIntent.status !== 'succeeded') {
      console.error('Payment intent not succeeded, status:', paymentIntent.status);
      return res.status(400).json({
        error: 'Payment intent not succeeded',
        status: paymentIntent.status,
      });
    }

    // Save to Firestore using Admin SDK
    const adminApp = getFirebaseAdmin();
    const db = adminApp.firestore();
    const transactionFee = amount * 0.029 + 0.30;
    const netEarnings = amount - transactionFee;
    const timestamp = adminApp.firestore.Timestamp.now();

    const saleRecord = {
      sellerId: sellerId,
      amount: amount,
      description: description?.substring(0, 100) || 'Card Payment',
      paymentIntentId: paymentIntentId,
      paymentMethod: 'tap_to_pay',
      status: 'completed',
      currency: currency.toUpperCase(),
      timestamp: timestamp,
      transactionFee: Math.round(transactionFee * 100) / 100,
      netEarnings: Math.round(netEarnings * 100) / 100,
    };

    // 1. Record the sale
    console.log("Recording sale...");
    const docRef = await db.collection('sales').add(saleRecord);
    console.log("✓ Sale recorded:", docRef.id);

    // 2. Update seller stats - increment totalEarnings and totalSales
    console.log("Updating seller stats...");
    const statsRef = db.collection('sellerStats').doc(sellerId);
    await statsRef.set({
      sellerId: sellerId,
      totalEarnings: adminApp.firestore.FieldValue.increment(amount),
      totalSales: adminApp.firestore.FieldValue.increment(1),
      lastUpdated: timestamp,
    }, { merge: true });
    console.log("✓ Seller stats updated");

    return res.status(200).json({
      success: true,
      message: 'Tap to Pay sale recorded successfully',
      saleId: docRef.id,
      saleData: {
        amount,
        description,
        paymentIntentId,
        paymentMethod: 'tap_to_pay',
        status: 'completed',
        currency: currency.toUpperCase(),
        timestamp: new Date().toISOString(),
        transactionFee: transactionFee.toFixed(2),
        netEarnings: netEarnings.toFixed(2),
      },
    });
  } catch (error) {
    console.error('Fatal Error - Record Tap to Pay Sale:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({
      error: 'Failed to record sale',
      message: error.message,
      type: error.constructor?.name,
    });
  }
}
