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
    
    // For local development without full Firebase setup, extract uid from token
    let userId;
    try {
      userId = await verifyToken(idToken);
    } catch (tokenError) {
      console.warn('Token verification failed:', tokenError.message);
      
      // Development fallback: decode token to get uid (less secure, local only)
      if (process.env.NODE_ENV !== 'production') {
        try {
          const parts = idToken.split('.');
          if (parts.length !== 3) throw new Error('Invalid token format');
          
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          userId = payload.uid || payload.sub;
          
          if (!userId) throw new Error('No uid in token');
          console.log('✓ Using development mode token parsing for userId:', userId);
        } catch (decodeError) {
          throw new Error(`Token verification failed: ${tokenError.message}`);
        }
      } else {
        throw tokenError;
      }
    }

    console.log('✓ userId verified:', userId);
    // Express already parsed JSON, use req.body directly
    const body = req.body;
    console.log('✓ Creating Stripe account for email:', body.email);

    // Get Stripe instance and Firebase admin
    const stripe = await getStripe();
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Always create a fresh Stripe Connect account with correct URL
    // (Previous accounts created before the fix need to be replaced)
    console.log('✓ Creating new Stripe account with correct URL for email:', body.email);
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'AU',
      email: body.email || `seller-${userId}@urbangaragesale.com.au`,
      business_type: 'individual',
      individual: {
        email: body.email,
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
        support_url: 'https://urbangaragesale.com.au/support',
        url: 'https://urbangaragesale.com.au',
      },
      settings: {
        payouts: {
          schedule: {
            delay_days: 2,
            interval: 'daily',
          },
        },
      },
    });

    console.log('✓ Stripe account ready:', account.id);

    // Get origin for URLs
    const origin = req.headers.origin || 'https://urban-garage-sale.vercel.app';
    const returnPath = '/profile?tab=payments&success=true';
    const refreshPath = '/profile?tab=payments';

    // Run Firestore update and account link creation in parallel
    const [_, link] = await Promise.all([
      // Update Firestore with Stripe Connect ID
      db.collection('users').doc(userId).update({
        stripeConnectId: account.id,
        stripeAccountType: 'created',
        stripeConnectSetup: {
          status: 'pending',
          createdAt: admin.firestore.Timestamp.now(),
          accountId: account.id,
        },
      }),
      // Create onboarding link for seller
      stripe.accountLinks.create({
        account: account.id,
        type: 'account_onboarding',
        refresh_url: body.refreshUrl || `${origin}${refreshPath}`,
        return_url: body.returnUrl || `${origin}${returnPath}`,
      }),
    ]);

    console.log('✓ Ready, returning onboarding URL');

    return res.status(200).json({
      success: true,
      message: 'Stripe Connect initialized',
      stripeConnectId: account.id,
      onboardingUrl: link.url,
    });
  } catch (error) {
    console.error('Enable Stripe error:', error);
    return res.status(500).json({
      error: 'Failed to enable card payments',
      message: error.message,
    });
  }
};
