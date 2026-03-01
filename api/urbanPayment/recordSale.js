// Record Sale endpoint for Vercel
import admin from 'firebase-admin';
import { getFirebaseAdmin, verifyToken } from '../firebase-admin.js';

async function getBody(req) {
  if (req.method === "GET") return null;
  
  let body = "";
  return new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error("Invalid JSON in request body"));
      }
    });
    req.on("error", reject);
  });
}

// Record Sale to Firestore via Admin SDK
async function recordSale(sellerId, amount, description, paymentMethod, idToken, paymentIntentId) {
  // Verify that the idToken belongs to the sellerId
  const userId = await verifyToken(idToken);
  if (userId !== sellerId) {
    throw new Error("Token does not match seller ID");
  }

  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const timestamp = admin.firestore.Timestamp.now();

  const saleData = {
    sellerId: sellerId,
    amount: amount,
    description: description,
    paymentMethod: paymentMethod,
    paymentIntentId: paymentIntentId || null,
    timestamp: timestamp,
    status: paymentMethod === "card" ? "completed" : "recorded",
  };

  try {
    // 1. Record the sale
    const docRef = await db.collection("sales").add(saleData);

    // 2. Update seller stats - increment totalEarnings and totalSales
    const statsRef = db.collection("sellerStats").doc(sellerId);
    await statsRef.update({
      totalEarnings: admin.firestore.FieldValue.increment(amount),
      totalSales: admin.firestore.FieldValue.increment(1),
      lastUpdated: timestamp,
    }).catch(async (error) => {
      // If document doesn't exist, create it
      if (error.code === 'not-found') {
        await statsRef.set({
          sellerId: sellerId,
          totalEarnings: amount,
          totalSales: 1,
          lastUpdated: timestamp,
        });
      } else {
        throw error;
      }
    });

    return {
      saleId: docRef.id,
      success: true,
    };
  } catch (error) {
    console.error("Error recording sale to Firestore:", error.message);
    throw new Error(`Firestore write failed: ${error.message}`);
  }
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");
}

export default async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const body = await getBody(req);
    if (!body.amount || !body.sellerId) {
      return res.status(400).json({ error: "Missing amount or sellerId" });
    }

    const idToken = authHeader.substring(7);
    const result = await recordSale(
      body.sellerId,
      body.amount,
      body.description || "Sale",
      body.paymentMethod || "card",
      idToken,
      body.paymentIntentId
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Record Sale Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to record sale",
      type: error.constructor?.name || "Unknown",
    });
  }
};
