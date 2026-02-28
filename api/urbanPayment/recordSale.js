// Record Sale endpoint for Vercel
const projectId = process.env.FIREBASE_PROJECT_ID ||  "";

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
        "Authorization": `Bearer ${idToken}`,
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
