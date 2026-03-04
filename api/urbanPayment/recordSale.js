// Record Cash Sale - Uses Firestore REST API so no Admin SDK credentials needed
const projectId = 'urban-garage-sale-2024';
const databaseId = '(default)';

// Decode JWT token to extract UID (without needing external API calls)
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    // Decode the payload (middle part)
    const payload = parts[1];
    const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
    const claims = JSON.parse(decodedPayload);

    if (!claims.sub || typeof claims.sub !== 'string') {
      throw new Error('No sub (user ID) in token');
    }

    console.log(`✓ Token decoded, UID: ${claims.sub}`);
    return claims.sub;
  } catch (error) {
    console.error('JWT decode failed:', error.message);
    throw new Error('Invalid or expired authentication token');
  }
}

// Record sale to Firestore using REST API with user's ID token
async function recordSale(userId, amount, description, paymentMethod, idToken) {
  try {
    // Step 0: Check if user has 2FA enabled (required for sales)
    console.log('[recordSale] Checking 2FA status...');
    const userCheckResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/${userId}?access_token=${idToken}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (userCheckResponse.ok) {
      const userDoc = await userCheckResponse.json();
      const fields = userDoc.fields || {};
      const has2FA = fields.two_fa_enabled?.booleanValue === true;
      
      if (!has2FA) {
        throw new Error('Two-Factor Authentication is required to record sales. Please enable 2FA in your Profile.');
      }
      console.log('✓ 2FA verified');
    } else {
      // Could not verify 2FA, but continue (user might not have doc yet or API issue)
      console.warn('[recordSale] Could not verify 2FA status');
    }

    // Step 1: Create the sale document
    console.log('[recordSale] Creating sale document...');
    const salePayload = {
      fields: {
        sellerId: { stringValue: userId },
        amount: { doubleValue: parseFloat(amount) },
        description: { stringValue: description.trim() },
        paymentMethod: { stringValue: paymentMethod },
        status: { stringValue: 'completed' },
        createdAt: { stringValue: new Date().toISOString() },
      },
    };

    const saleResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/sales?access_token=${idToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload),
      }
    );

    if (!saleResponse.ok) {
      const error = await saleResponse.json();
      console.error('Sale creation error:', error);
      throw new Error(`Failed to create sale: ${error.error?.message || saleResponse.status}`);
    }

    const saleResult = await saleResponse.json();
    const saleId = saleResult.name.split('/').pop();
    console.log(`✓ Sale recorded: ${saleId}`);

    // Step 2: Update seller stats
    console.log('[recordSale] Updating seller stats...');
    
    // First try to get existing stats
    const statsGetResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/sellerStats/${userId}?access_token=${idToken}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    let statsPayload;
    let statsFetchSuccess = false;

    if (statsGetResponse.ok) {
      // Stats exist - increment existing values
      const existingStats = await statsGetResponse.json();
      const fields = existingStats.fields || {};
      
      const currentEarnings = parseFloat(fields.totalEarnings?.doubleValue || 0);
      const currentCompleted = parseFloat(fields.completedEarnings?.doubleValue || 0);
      const currentSales = parseInt(fields.totalSales?.integerValue || 0);
      const currentCompletedSales = parseInt(fields.completedSales?.integerValue || 0);

      statsPayload = {
        fields: {
          ...fields,
          totalEarnings: { doubleValue: currentEarnings + parseFloat(amount) },
          completedEarnings: { doubleValue: currentCompleted + parseFloat(amount) },
          totalSales: { integerValue: String(currentSales + 1) },
          completedSales: { integerValue: String(currentCompletedSales + 1) },
          lastSaleDate: { stringValue: new Date().toISOString() },
        },
      };
      statsFetchSuccess = true;
    } else {
      // Stats don't exist - create new
      statsPayload = {
        fields: {
          totalEarnings: { doubleValue: parseFloat(amount) },
          completedEarnings: { doubleValue: parseFloat(amount) },
          pendingEarnings: { doubleValue: 0 },
          totalSales: { integerValue: '1' },
          completedSales: { integerValue: '1' },
          pendingSales: { integerValue: '0' },
          lastSaleDate: { stringValue: new Date().toISOString() },
        },
      };
    }

    const statsResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/sellerStats/${userId}?access_token=${idToken}`,
      {
        method: statsFetchSuccess ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statsPayload),
      }
    );

    if (!statsResponse.ok) {
      const error = await statsResponse.json();
      console.error('Stats update error:', error);
      // Don't throw - sale was already recorded
      console.warn('Failed to update stats but sale was recorded');
    } else {
      console.log('✓ Seller stats updated');
    }

    return { saleId, success: true };
  } catch (error) {
    console.error('Error recording sale:', error.message);
    throw error;
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

    // Extract user ID from token by decoding JWT
    const userId = decodeJWT(idToken);

    // Record the sale (pass idToken for Firestore REST API auth)
    const result = await recordSale(
      userId,
      body.amount,
      body.description,
      body.paymentMethod || 'cash',
      idToken
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
