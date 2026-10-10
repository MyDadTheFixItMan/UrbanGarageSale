// Verify the actual Stripe Connect account status
import Stripe from 'stripe';
import { getFirebaseAdmin } from '../_shared/firebase-admin.js';
import { requireUser, sendError } from '../_shared/http.js';
import { applyCors, getTrustedOrigin } from '../_shared/security.js';
import { rateLimit } from '../_shared/rateLimit.js';

const getStripe = async () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(stripeSecretKey);
};


export default async (req, res) => {
  applyCors(res, getTrustedOrigin(req.headers.origin, process.env.FRONTEND_URL || 'http://localhost:5174'), 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uid: userId } = await requireUser(req);
    await rateLimit(userId, 'verifyStripeConnectStatus', 30);

    // Get user's Stripe Connect ID from Firestore
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.stripeConnectId) {
      return res.status(400).json({ 
        error: 'No Stripe Connect account found',
        cardPaymentsEnabled: false 
      });
    }

    // Check actual Stripe account status
    const stripe = await getStripe();
    const account = await stripe.accounts.retrieve(userData.stripeConnectId);

    console.log(`✓ Stripe account status for ${userData.stripeConnectId}:`, {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirements: account.requirements?.currently_due?.length || 0
    });

    // Account is fully enabled when BOTH charges_enabled AND payouts_enabled
    const isFullyEnabled = account.charges_enabled && account.payouts_enabled;
    const hasRequirements = account.requirements?.currently_due?.length > 0;

    // If fully enabled and was marked as pending, update Firestore
    if (isFullyEnabled && userData.cardPaymentsEnabled !== true) {
      console.log('✓ Account completed onboarding, updating Firestore...');
      await db.collection('users').doc(userId).update({
        cardPaymentsEnabled: true,
        stripeConnectSetup: {
          status: 'active',
          completedAt: admin.firestore.Timestamp.now(),
          accountId: userData.stripeConnectId,
        },
      });
    }

    // If NOT enabled, ensure Firestore reflects this
    if (!isFullyEnabled && userData.cardPaymentsEnabled === true) {
      console.log('✓ Account not fully enabled, clearing cardPaymentsEnabled...');
      await db.collection('users').doc(userId).update({
        cardPaymentsEnabled: false,
        stripeConnectSetup: {
          status: 'pending_requirements',
          createdAt: userData.stripeConnectSetup?.createdAt || admin.firestore.Timestamp.now(),
          accountId: userData.stripeConnectId,
          requirementsDue: account.requirements?.currently_due || [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      stripeConnectId: userData.stripeConnectId,
      cardPaymentsEnabled: isFullyEnabled,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirementsDue: account.requirements?.currently_due || [],
      hasRequirements: hasRequirements,
      status: isFullyEnabled ? 'active' : hasRequirements ? 'pending_requirements' : 'pending',
    });
  } catch (error) {
    return sendError(res, error, 'Failed to verify card payments status');
  }
};
