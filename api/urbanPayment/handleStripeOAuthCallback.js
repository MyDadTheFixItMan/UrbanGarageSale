// Handle Stripe OAuth callback
import { getStripe } from '../_shared/stripe.js';
import { getFirebaseAdmin } from '../_shared/firebase-admin.js';
import { readJsonBody, requireUser, requireSecondFactor, sendError } from '../_shared/http.js';
import { applyCors, getTrustedOrigin } from '../_shared/security.js';
import { rateLimit } from '../_shared/rateLimit.js';

export default async (req, res) => {
  applyCors(res, getTrustedOrigin(req.headers.origin, process.env.FRONTEND_URL || 'http://localhost:5174'), 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uid: userId } = requireSecondFactor(await requireUser(req));
    await rateLimit(userId, 'handleStripeOAuthCallback', 10);

    const { code, state } = await readJsonBody(req);

    if (typeof code !== 'string' || !code || code.length > 255) {
      return res.status(400).json({ error: 'Authorization code missing' });
    }

    // State tokens are 32 random bytes in hex (initiateStripeOAuth).
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)) {
      return res.status(400).json({ error: 'State token missing or invalid' });
    }

    // Verify state token
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    // State tokens are single use (read and deleted in one transaction, so two requests can't
    // both use one) and expire after 10 minutes.
    const stateRef = db.collection('oauth_states').doc(state);
    const stateData = await db.runTransaction(async (tx) => {
      const snap = await tx.get(stateRef);
      if (snap.exists) tx.delete(stateRef);
      return snap.exists ? snap.data() : null;
    });

    if (!stateData) {
      return res.status(401).json({ error: 'Invalid or expired state token' });
    }
    if (stateData.userId !== userId) {
      return res.status(401).json({ error: 'State token user mismatch' });
    }
    if (stateData.expiresAt && stateData.expiresAt.toMillis() < Date.now()) {
      return res.status(401).json({ error: 'Link expired. Please try connecting Stripe again.' });
    }

    // Exchange authorization code for access token
    const stripe = getStripe();
    if (!process.env.STRIPE_CLIENT_ID) {
      throw new Error('STRIPE_CLIENT_ID not configured');
    }

    const tokenResponse = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });
    const account = await stripe.accounts.retrieve(tokenResponse.stripe_user_id);

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

    return res.status(200).json({
      success: true,
      message: 'Stripe account linked successfully',
      stripeConnectId: tokenResponse.stripe_user_id,
      cardPaymentsEnabled: account.charges_enabled && account.payouts_enabled,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to complete OAuth');
  }
};
