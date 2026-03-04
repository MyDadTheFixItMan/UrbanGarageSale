// Record Cash Sale - Uses Firestore REST API so no Admin SDK credentials needed
const projectId = 'urban-garage-sale-2024';
const databaseId = '(default)';

// Verify Firebase ID token via Firebase REST API
async function verifyTokenAndGetUID(idToken) {
  try {
    const response = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyDKjEhQMGLKuThIhQN7rfRlqgJZSNg4pNw',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!response.ok) {
      throw new Error('Invalid token');
    }

    const data = await response.json();
    if (!data.users || !data.users[0]) {
      throw new Error('No user found');
    }

    const uid = data.users[0].localId;
    console.log(`✓ Token verified, UID: ${uid}`);
    return uid;
  } catch (error) {
    console.error('Token verification failed:', error.message);
    throw new Error('Invalid or expired authentication token');
  }
}

// Record sale to Firestore using REST API with user's ID token
async function recordSale(userId, amount, description, paymentMethod, idToken) {
  try {
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

    // Extract and verify user ID from token
    const userId = await verifyTokenAndGetUID(idToken);

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
