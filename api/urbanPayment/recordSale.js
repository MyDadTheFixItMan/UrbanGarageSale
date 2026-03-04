// Record Cash Sale - Simple endpoint to log cash payments to Firestore
import admin from 'firebase-admin';

// Initialize Firebase Admin inline
let adminApp = null;
const getFirebaseAdmin = () => {
  if (!adminApp) {
    if (admin.apps.length === 0) {
      adminApp = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'urban-garage-sale-2024',
      });
    } else {
      adminApp = admin.app();
    }
  }
  return adminApp;
};

// Verify Firebase ID token and extract UID
async function extractUserIdFromToken(idToken) {
  const adminApp = getFirebaseAdmin();
  try {
    const decodedToken = await adminApp.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    if (!uid || typeof uid !== 'string' || uid.length > 128) {
      throw new Error(`Invalid UID format: ${uid}`);
    }
    
    return uid;
  } catch (error) {
    console.error('Token verification failed:', error.message);
    throw new Error('Invalid or expired authentication token');
  }
}

async function recordSale(userId, amount, description, paymentMethod) {
  const adminApp = getFirebaseAdmin();
  const db = adminApp.firestore();

  const saleData = {
    sellerId: userId,
    amount: parseFloat(amount),
    description: description.trim(),
    paymentMethod: paymentMethod,
    status: 'completed', // Cash sales are immediately completed
    createdAt: new Date().toISOString(),
  };

  try {
    // Add sale to sales collection
    const docRef = await db.collection('sales').add(saleData);

    // Update seller stats
    const statsRef = db.collection('sellerStats').doc(userId);
    const statsDoc = await statsRef.get();

    if (statsDoc.exists) {
      // Update existing stats
      await statsRef.update({
        totalEarnings: admin.firestore.FieldValue.increment(amount),
        completedEarnings: admin.firestore.FieldValue.increment(amount),
        totalSales: admin.firestore.FieldValue.increment(1),
        completedSales: admin.firestore.FieldValue.increment(1),
        lastSaleDate: new Date().toISOString(),
      });
    } else {
      // Create new stats document
      await statsRef.set({
        totalEarnings: amount,
        completedEarnings: amount,
        pendingEarnings: 0,
        totalSales: 1,
        completedSales: 1,
        pendingSales: 0,
        lastSaleDate: new Date().toISOString(),
      });
    }

    return {
      saleId: docRef.id,
      success: true,
    };
  } catch (error) {
    console.error('Firestore write failed:', error.message);
    throw new Error(`Failed to record sale: ${error.message}`);
  }
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
}

async function getBody(req) {
  if (req.method === 'GET') return null;
  
  let body = '';
  return new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON in request body'));
      }
    });
    req.on('error', reject);
  });
}

export default async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization' });
    }

    const idToken = authHeader.substring(7);

    // Parse request body
    const body = await getBody(req);
    if (!body.amount || !body.description) {
      return res.status(400).json({ error: 'Missing amount or description' });
    }

    // Extract and verify user ID from token
    const userId = await extractUserIdFromToken(idToken);

    // Record the sale
    const result = await recordSale(
      userId,
      body.amount,
      body.description,
      body.paymentMethod || 'cash'
    );

    return res.status(200).json({
      success: true,
      saleId: result.saleId,
      amount: body.amount,
      status: 'completed',
      message: 'Cash sale recorded successfully',
    });
  } catch (error) {
    console.error('Record Sale Error:', error);
    
    if (error.message.includes('Invalid or expired')) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(500).json({
      error: error.message || 'Failed to record cash sale',
    });
  }
};
