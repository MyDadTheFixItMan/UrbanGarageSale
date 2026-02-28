import Stripe from "https://esm.sh/stripe@13.0.0";
import { initializeApp, cert } from "https://esm.sh/firebase-admin@12.0.0/app";
import { getFirestore } from "https://esm.sh/firebase-admin@12.0.0/firestore";
import { getAuth } from "https://esm.sh/firebase-admin@12.0.0/auth";

// Initialize Firebase
const firebaseConfig = {
  projectId: Deno.env.get("FIREBASE_PROJECT_ID"),
};

const app = initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = getFirestore(app);
const auth = getAuth(app);
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "");

interface PaymentRequest {
  userId: string;
  amount: number;
  description: string;
  currency: string;
}

interface PaymentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

// Create Payment Intent for Urban Pay
const createPaymentIntent = async (req: PaymentRequest): Promise<PaymentResponse> => {
  try {
    // Verify user is authenticated
    const decodedToken = await auth.verifyIdToken(
      req.userId as string
    );
    
    const sellerId = decodedToken.uid;

    // Get seller's Stripe account (should be stored in Firestore users collection)
    const sellerDoc = await db.collection("users").doc(sellerId).get();
    const sellerData = sellerDoc.data();

    if (!sellerData?.stripeAccountId) {
      throw new Error("Seller Stripe account not connected");
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(req.amount * 100), // Convert to cents
        currency: req.currency || "aud",
        description: `Urban Pay Sale - ${req.description}`,
        metadata: {
          sellerId: sellerId,
          saleDescription: req.description,
        },
      },
      {
        stripeAccount: sellerData.stripeAccountId,
      }
    );

    return {
      clientSecret: paymentIntent.client_secret || "",
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error("Payment intent creation error:", error);
    throw error;
  }
};

// Record Sale in Firestore
const recordSale = async (
  sellerId: string,
  amount: number,
  description: string,
  paymentMethod: "card" | "cash",
  paymentIntentId?: string
) => {
  try {
    const saleData = {
      sellerId: sellerId,
      amount: amount,
      description: description,
      paymentMethod: paymentMethod,
      paymentIntentId: paymentIntentId || null,
      timestamp: new Date().toISOString(),
      status: paymentMethod === "card" ? "completed" : "recorded",
    };

    // Add sale to sales collection
    const saleRef = await db.collection("sales").add(saleData);

    // Update seller's sales statistics
    const statsRef = db.collection("sellerStats").doc(sellerId);
    const statsDoc = await statsRef.get();

    if (statsDoc.exists) {
      await statsRef.update({
        totalSales: (statsDoc.data()?.totalSales || 0) + amount,
        transactionCount: (statsDoc.data()?.transactionCount || 0) + 1,
        lastSaleTime: new Date().toISOString(),
      });
    } else {
      await statsRef.set({
        sellerId: sellerId,
        totalSales: amount,
        transactionCount: 1,
        firstSaleTime: new Date().toISOString(),
        lastSaleTime: new Date().toISOString(),
      });
    }

    return {
      saleId: saleRef.id,
      success: true,
    };
  } catch (error) {
    console.error("Error recording sale:", error);
    throw error;
  }
};

// Handle incoming requests
Deno.serve(async (req: Request) => {
  // CORS headers
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // POST /urbanPayment/createPaymentIntent
    if (req.method === "POST" && pathname === "/urbanPayment/createPaymentIntent") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Missing authorization token" }),
          { status: 401, headers }
        );
      }

      const body = await req.json();
      const result = await createPaymentIntent({
        userId: authHeader.substring(7), // Remove "Bearer " prefix
        amount: body.amount,
        description: body.description || "Urban Pay Sale",
        currency: body.currency || "aud",
      });

      return new Response(JSON.stringify(result), { status: 200, headers });
    }

    // POST /urbanPayment/recordSale
    if (req.method === "POST" && pathname === "/urbanPayment/recordSale") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Missing authorization token" }),
          { status: 401, headers }
        );
      }

      const body = await req.json();
      const sellerId = authHeader.substring(7);
      
      const result = await recordSale(
        sellerId,
        body.amount,
        body.description || "Sale",
        body.paymentMethod || "card",
        body.paymentIntentId
      );

      return new Response(JSON.stringify(result), { status: 200, headers });
    }

    // GET /urbanPayment/stats/:sellerId
    if (req.method === "GET" && pathname.startsWith("/urbanPayment/stats/")) {
      const sellerId = pathname.replace("/urbanPayment/stats/", "");
      const authHeader = req.headers.get("Authorization");
      
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Missing authorization token" }),
          { status: 401, headers }
        );
      }

      const statsDoc = await db.collection("sellerStats").doc(sellerId).get();
      const stats = statsDoc.exists
        ? statsDoc.data()
        : {
            sellerId: sellerId,
            totalSales: 0,
            transactionCount: 0,
            firstSaleTime: null,
            lastSaleTime: null,
          };

      return new Response(JSON.stringify(stats), { status: 200, headers });
    }

    // GET /urbanPayment/sales/:sellerId
    if (req.method === "GET" && pathname.startsWith("/urbanPayment/sales/")) {
      const sellerId = pathname.replace("/urbanPayment/sales/", "");
      const authHeader = req.headers.get("Authorization");
      
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Missing authorization token" }),
          { status: 401, headers }
        );
      }

      const snapshot = await db
        .collection("sales")
        .where("sellerId", "==", sellerId)
        .orderBy("timestamp", "desc")
        .limit(100)
        .get();

      const sales = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return new Response(JSON.stringify({ sales }), { status: 200, headers });
    }

    return new Response(
      JSON.stringify({ error: "Endpoint not found" }),
      { status: 404, headers }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: new Headers({ "Content-Type": "application/json" }) }
    );
  }
});
