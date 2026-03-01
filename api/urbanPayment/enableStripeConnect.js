// Enable Stripe Connect for a seller
import Stripe from 'stripe';
import { getFirebaseAdmin, verifyToken } from '../firebase-admin.js';

const getStripe = async () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(stripeSecretKey);
};

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

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
    const userId = await verifyToken(idToken);

    const body = await getBody(req);

    // Get Stripe instance
    const stripe = await getStripe();

    // Create Stripe Connect account for seller
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'AU',
      email: body.email || `seller-${userId}@urbangaragesale.com`,
      business_type: 'individual',
      individual: {
        email: body.email,
        dob: body.dob ? new Date(body.dob) : undefined,
        first_name: body.firstName,
        last_name: body.lastName,
        address: {
          line1: body.address,
          city: body.city,
          state: body.state,
          postal_code: body.postcode,
          country: 'AU',
        },
      },
      business_profile: {
        product_description: 'Online garage sale marketplace',
        support_url: 'https://urbangaragesale.com/support',
        url: 'https://urbangaragesale.com',
      },
      settings: {
        payouts: {
          schedule: {
            delay_days: 2, // Withdraw funds after 2 days
            interval: 'daily',
          },
        },
      },
    });

    // Save Stripe Connect ID to user's Firestore profile
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    await db
      .collection('users')
      .doc(userId)
      .update({
        stripeConnectId: account.id,
        cardPaymentsEnabled: true,
        stripeConnectSetup: {
          status: 'pending',
          createdAt: admin.firestore.Timestamp.now(),
        },
      });

    // Return onboarding link for seller to complete setup
    const link = await stripe.accountLinks.create({
      account: account.id,
      type: 'account_onboarding',
      refresh_url: body.refreshUrl || 'https://urbangaragesale.com/profile?tab=payments',
      return_url: body.returnUrl || 'https://urbangaragesale.com/profile?tab=payments&success=true',
    });

    return res.status(200).json({
      success: true,
      message: 'Stripe Connect initialized',
      stripeConnectId: account.id,
      onboardingUrl: link.url, // Send user here to complete setup
    });
  } catch (error) {
    console.error('Enable Stripe error:', error);
    return res.status(500).json({
      error: 'Failed to enable card payments',
      message: error.message,
    });
  }
};
