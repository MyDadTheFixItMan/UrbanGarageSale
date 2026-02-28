// Urban Pay API - Node.js handler for Vercel
// This replaces the Deno version for better Vercel compatibility

const projectId = process.env.FIREBASE_PROJECT_ID || "";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";

// Initialize Stripe (lazy load to avoid errors if key is missing)
let stripe = null;
const getStripe = () => {
  if (!stripe && stripeSecretKey) {
    const Stripe = require("stripe");
    stripe = new Stripe(stripeSecretKey);
  }
  return stripe;
};

// Helper function to parse request body
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
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

// Create Payment Intent with Stripe
async function createPaymentIntent(userId, amount, description, currency = "aud") {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe not configured - missing STRIPE_SECRET_KEY");
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: currency,
    description: `Urban Pay Sale - ${description}`,
    metadata: {
      sellerId: userId,
      saleDescription: description,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret || "",
    paymentIntentId: paymentIntent.id,
  };
}

// Record Sale to Firestore via REST API
async function recordSale(sellerId, amount, description, paymentMethod, idToken, paymentIntentId) {
  const timestamp = new Date().toISOString();
  const firebaseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  const saleData = {
    fields: {
      sellerId: { stringValue: sellerId },
      amount: { doubleValue: amount },
      description: { stringValue: description },
      paymentMethod: { stringValue: paymentMethod },
      paymentIntentId: paymentIntentId ? { stringValue: paymentIntentId } : { nullValue: null },
      timestamp: { timestampValue: timestamp },
      status: { stringValue: paymentMethod === "card" ? "completed" : "recorded" },
    },
  };

  try {
    const response = await fetch(`${firebaseUrl}/sales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(saleData),
    });

    if (!response.ok) {
      throw new Error(`Firestore error: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      saleId: result.name?.split("/").pop() || "unknown",
      success: true,
    };
  } catch (error) {
    console.error("Error recording sale:", error);
    throw error;
  }
}

// Set CORS headers
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");
}

// Main handler
export default async (req, res) => {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

    // GET /api/urbanPayment - Health check and endpoint listing
    if (req.method === "GET" && pathname.endsWith("/urbanPayment")) {
      return res.status(200).json({
        status: "ok",
        project: projectId,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        endpoints: [
          "GET /api/urbanPayment",
          "POST /api/urbanPayment/createPaymentIntent",
          "POST /api/urbanPayment/recordSale",
        ],
      });
    }

    // POST /api/urbanPayment/createPaymentIntent
    if (req.method === "POST" && pathname.includes("createPaymentIntent")) {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization token" });
      }

      const body = await getBody(req);
      const result = await createPaymentIntent(
        authHeader.substring(7), // Remove "Bearer " prefix
        body.amount,
        body.description || "Urban Pay Sale",
        body.currency || "aud"
      );

      return res.status(200).json(result);
    }

    // POST /api/urbanPayment/recordSale
    if (req.method === "POST" && pathname.includes("recordSale")) {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization token" });
      }

      const body = await getBody(req);
      const idToken = authHeader.substring(7);
      const result = await recordSale(
        body.sellerId || idToken,
        body.amount,
        body.description || "Sale",
        body.paymentMethod || "card",
        idToken,
        body.paymentIntentId
      );

      return res.status(200).json(result);
    }

    return res.status(404).json({
      error: "Endpoint not found",
      path: pathname,
      method: req.method,
      availableEndpoints: [
        "GET /api/urbanPayment",
        "POST /api/urbanPayment/createPaymentIntent",
        "POST /api/urbanPayment/recordSale",
      ],
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      type: error.constructor?.name || "Unknown",
    });
  }
};
