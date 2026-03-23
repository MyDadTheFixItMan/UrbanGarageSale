// Handle Stripe OAuth callback
import Stripe from 'stripe';
import { getFirebaseAdmin, verifyToken } from '../firebase-admin.js';

const getStripe = async () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(stripeSecretKey);
};

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
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
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const idToken = authHeader.substring(7);
    
    // Verify user
    let userId;
    try {
      userId = await verifyToken(idToken);
    } catch (tokenError) {
      // Development fallback
      if (process.env.NODE_ENV !== 'production') {
        try {
          const parts = idToken.split('.');
          if (parts.length !== 3) throw new Error('Invalid token format');
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          userId = payload.uid || payload.sub;
          if (!userId) throw new Error('No uid in token');
        } catch (decodeError) {
          throw new Error(`Token verification failed: ${tokenError.message}`);
        }
      } else {
        throw tokenError;
      }
    }

    // Get authorization code from request
    const body = req.body || {};
    const { code, state } = body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code missing' });
    }

    if (!state) {
      return res.status(400).json({ error: 'State token missing' });
    }

    // Verify state token
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const stateDoc = await db.collection('oauth_states').doc(state).get();

    if (!stateDoc.exists) {
      return res.status(401).json({ error: 'Invalid or expired state token' });
    }

    const stateData = stateDoc.data();
    if (stateData.userId !== userId) {
      return res.status(401).json({ error: 'State token user mismatch' });
    }

    // Clean up state token
    await db.collection('oauth_states').doc(state).delete();

    // Exchange authorization code for access token
    const stripe = await getStripe();
    const stripeClientId = process.env.STRIPE_CLIENT_ID;
    const stripeClientSecret = process.env.STRIPE_SECRET_KEY;

    if (!stripeClientId) {
      throw new Error('STRIPE_CLIENT_ID not configured');
    }

    console.log('✓ Exchanging OAuth code for credentials...');
    
    // Make request to Stripe OAuth token endpoint
    const tokenResponse = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code: code,
    });

    console.log('✓ OAuth token obtained, stripe account:', tokenResponse.stripe_user_id);

    // Get account details
    const account = await stripe.accounts.retrieve(tokenResponse.stripe_user_id);

    console.log('✓ Account details retrieved:', {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });

    // Save to Firestore
    await db.collection('users').doc(userId).update({
      stripeConnectId: tokenResponse.stripe_user_id,
      stripeAccountType: 'linked',
      stripeBusinessName: account.business_profile?.name || 'Stripe Account',
      stripeBusinessType: account.type,
      stripeCountry: account.country,
      stripeEmail: account.email,
      cardPaymentsEnabled: account.charges_enabled && account.payouts_enabled,
      stripeConnectSetup: {
        status: account.charges_enabled && account.payouts_enabled ? 'active' : 'pending_requirements',
        linkedAt: admin.firestore.Timestamp.now(),
        accountId: tokenResponse.stripe_user_id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      },
    });

    console.log('✓ Account linked to user:', userId);

    return res.status(200).json({
      success: true,
      message: 'Stripe account linked successfully',
      stripeConnectId: tokenResponse.stripe_user_id,
      cardPaymentsEnabled: account.charges_enabled && account.payouts_enabled,
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(500).json({
      error: 'Failed to complete OAuth',
      message: error.message,
    });
  }
};
