// Verify the actual Stripe Connect account status
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
          console.log('✓ Using dev token parsing for userId:', userId);
        } catch (decodeError) {
          throw new Error(`Token verification failed: ${tokenError.message}`);
        }
      } else {
        throw tokenError;
      }
    }

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
    if (isFullyEnabled && userData.stripeConnectSetup?.status === 'pending') {
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
    console.error('Verify Stripe status error:', error);
    return res.status(500).json({
      error: 'Failed to verify card payments status',
      message: error.message,
    });
  }
};
