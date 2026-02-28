// Initialize environment variables
const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || "";
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

// Lazy import Stripe to avoid errors if key is missing
let stripe: any = null;
const getStripe = async () => {
  if (!stripe && stripeKey) {
    const Stripe = (await import("https://esm.sh/stripe@13.0.0")).default;
    stripe = new Stripe(stripeKey);
  }
  return stripe;
};
const firebaseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

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

// Helper to make authenticated Firestore requests
async function firestoreRequest(
  method: string,
  path: string,
  idToken: string,
  body?: Record<string, unknown>
) {
  const url = `${firebaseUrl}/${path}`;
  
  const response = await fetch(url, {
    method: method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Firestore error: ${response.statusText}`);
  }

  return await response.json();
}

// Create Payment Intent for Urban Pay
const createPaymentIntent = async (req: PaymentRequest): Promise<PaymentResponse> => {
  try {
    const stripe = await getStripe();
    if (!stripe) {
      throw new Error("Stripe not configured - missing STRIPE_SECRET_KEY");
    }
    
    const sellerId = req.userId;

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(req.amount * 100), // Convert to cents
      currency: req.currency || "aud",
      description: `Urban Pay Sale - ${req.description}`,
      metadata: {
        sellerId: sellerId,
        saleDescription: req.description,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret || "",
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error("Payment intent creation error:", error);
    throw error;
  }
};

// Record Sale in Firestore via REST API
const recordSale = async (
  sellerId: string,
  amount: number,
  description: string,
  paymentMethod: "card" | "cash",
  idToken: string,
  paymentIntentId?: string
) => {
  try {
    const timestamp = new Date().toISOString();
    
    // Add sale document
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

    const saleResponse = await firestoreRequest(
      "POST",
      "sales",
      idToken,
      saleData
    );

    // Update seller stats (simplified - just log for now)
    console.log("Sale recorded:", saleResponse);

    return {
      saleId: saleResponse.name?.split("/").pop() || "unknown",
      success: true,
    };
  } catch (error) {
    console.error("Error recording sale:", error);
    throw error;
  }
};

// Handle incoming requests - Vercel Deno handler
export default async (req: Request): Promise<Response> => {
  // CORS headers
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // GET /api/urbanPayment (health check / info)
    if (req.method === "GET" && pathname.endsWith("/urbanPayment")) {
      return new Response(
        JSON.stringify({
          status: "ok",
          project: projectId,
          timestamp: new Date().toISOString(),
          version: "1.0.0",
          endpoints: [
            "/api/urbanPayment/createPaymentIntent",
            "/api/urbanPayment/recordSale",
          ],
        }),
        { status: 200, headers }
      );
    }

    // POST /api/urbanPayment/createPaymentIntent
    if (req.method === "POST" && pathname.includes("createPaymentIntent")) {
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

    // POST /api/urbanPayment/recordSale
    if (req.method === "POST" && pathname.includes("recordSale")) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Missing authorization token" }),
          { status: 401, headers }
        );
      }

      const idToken = authHeader.substring(7);
      const body = await req.json();
      const sellerId = body.sellerId || idToken; // Use provided sellerId or fallback
      
      const result = await recordSale(
        sellerId,
        body.amount,
        body.description || "Sale",
        body.paymentMethod || "card",
        idToken,
        body.paymentIntentId
      );

      return new Response(JSON.stringify(result), { status: 200, headers });
    }

    return new Response(
      JSON.stringify({
        error: "Endpoint not found",
        path: pathname,
        method: req.method,
        availableEndpoints: [
          "GET /api/urbanPayment",
          "POST /api/urbanPayment/createPaymentIntent",
          "POST /api/urbanPayment/recordSale",
        ],
      }),
      { status: 404, headers }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
        type: error instanceof Error ? error.constructor.name : "Unknown",
      }),
      { status: 500, headers: new Headers({ "Content-Type": "application/json" }) }
    );
  }
};
