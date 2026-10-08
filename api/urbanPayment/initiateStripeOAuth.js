// Initiate Stripe OAuth flow for linking existing accounts
import crypto from 'crypto';
import { getFirebaseAdmin } from '../_shared/firebase-admin.js';
import { requireUser, requireSecondFactor, sendError } from '../_shared/http.js';
import { applyCors, getTrustedOrigin } from '../_shared/security.js';


export default async (req, res) => {
  applyCors(res, getTrustedOrigin(req.headers.origin, process.env.FRONTEND_URL || 'http://localhost:5173'), 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uid: userId } = requireSecondFactor(await requireUser(req));

    // Get Stripe Client ID from environment
    const stripeClientId = process.env.STRIPE_CLIENT_ID;
    if (!stripeClientId) {
      return res.status(500).json({ error: 'Stripe OAuth not configured' });
    }

    // Stripe only accepts redirect URIs registered in Connect settings (exact match), so use the
    // canonical site address (FRONTEND_URL) rather than whichever host the browser is on.
    // The web app forwards the return from the home page to Profile, which completes the link.
    const redirectUri = process.env.FRONTEND_URL || getTrustedOrigin(req.headers.origin, 'http://localhost:5173');

    // Generate a state token for security (CSRF protection)
    const stateToken = crypto.randomBytes(32).toString('hex');
    
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
    // Pre-select individual (not company) on Stripe's sign-up form
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
    return sendError(res, error, 'Failed to initiate Stripe OAuth');
  }
};
