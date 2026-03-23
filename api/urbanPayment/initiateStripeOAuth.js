// Initiate Stripe OAuth flow for linking existing accounts
import { getFirebaseAdmin, verifyToken } from '../firebase-admin.js';

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

    // Get Stripe Client ID from environment
    const stripeClientId = process.env.STRIPE_CLIENT_ID;
    if (!stripeClientId) {
      return res.status(500).json({ error: 'Stripe OAuth not configured' });
    }

    // Get the redirect URI from request body, use base URL for Stripe
    const body = req.body || {};
    const redirectUri = body.redirectUri || `${process.env.FRONTEND_URL || 'http://localhost:5173'}`;

    // Generate a state token for security (CSRF protection)
    const stateToken = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
    
    // Save state token to Firestore temporarily (expires in 10 minutes)
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    await db.collection('oauth_states').doc(stateToken).set({
      userId: userId,
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000)),
    });

    // Build Stripe OAuth URL with proper security isolation
    const stripeOAuthUrl = new URL('https://connect.stripe.com/oauth/authorize');
    stripeOAuthUrl.searchParams.append('response_type', 'code');
    stripeOAuthUrl.searchParams.append('client_id', stripeClientId);
    stripeOAuthUrl.searchParams.append('scope', 'read_write');
    stripeOAuthUrl.searchParams.append('state', stateToken);
    // Force fresh authentication session
    stripeOAuthUrl.searchParams.append('always_prompt', 'true');
    // Log out any existing Stripe session - CRITICAL for security
    stripeOAuthUrl.searchParams.append('stripe_user[business_type]', 'individual');
    // Add timestamp to prevent caching
    stripeOAuthUrl.searchParams.append('t', Date.now().toString());
    stripeOAuthUrl.searchParams.append('redirect_uri', redirectUri);

    console.log('✓ OAuth URL with fresh session parameters:', stripeOAuthUrl.toString().substring(0, 100) + '...');

    console.log('✓ OAuth URL generated for user:', userId);

    return res.status(200).json({
      success: true,
      oauthUrl: stripeOAuthUrl.toString(),
    });
  } catch (error) {
    console.error('OAuth initiation error:', error);
    return res.status(500).json({
      error: 'Failed to initiate Stripe OAuth',
      message: error.message,
    });
  }
};
