// Create Payment Intent endpoint for Vercel
const projectId = process.env.FIREBASE_PROJECT_ID || "";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";

let stripe = null;
const getStripe = async () => {
  if (!stripe && stripeSecretKey) {
    try {
      const StripeModule = await import("stripe");
      const Stripe = StripeModule.default;
      stripe = new Stripe(stripeSecretKey);
    } catch (error) {
      console.error("Failed to initialize Stripe:", error.message);
    }
  }
  return stripe;
};

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

async function createPaymentIntent(userId, amount, description, currency = "aud") {
  const stripe = await getStripe();
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
    if (!body.amount) {
      return res.status(400).json({ error: "Missing amount field" });
    }

    const userId = authHeader.substring(7); // Remove "Bearer " prefix
    const result = await createPaymentIntent(
      userId,
      body.amount,
      body.description || "Urban Pay Sale",
      body.currency || "aud"
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Payment Intent Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to create payment intent",
      type: error.constructor?.name || "Unknown",
    });
  }
};
