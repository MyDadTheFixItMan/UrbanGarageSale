// Link an existing Stripe account to user profile
import Stripe from 'stripe';
import { getFirebaseAdmin, verifyToken } from '../firebase-admin.js';

const getStripe = (apiKey) => {
  if (!apiKey) {
    throw new Error('Stripe API key required');
  }
  return new Stripe(apiKey);
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

export default async function linkExistingStripeAccount(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Missing authorization token' });
      return;
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
          console.log('Using development mode token parsing for userId:', userId);
        } catch (decodeError) {
          res.status(401).json({ message: `Token verification failed: ${tokenError.message}` });
          return;
        }
      } else {
        res.status(401).json({ message: `Token verification failed: ${tokenError.message}` });
        return;
      }
    }

    console.log('✓ userId verified:', userId);
    
    // Parse request body - Express already parsed JSON
    const body = req.body;
    const { stripeAPIKey, email } = body;
    console.log('✓ Request body received');

    if (!stripeAPIKey) {
      res.status(400).json({ message: 'Stripe API key is required' });
      return;
    }

    // Validate Stripe API key and get account details
    console.log('✓ Getting Stripe instance for API key...');
    const stripe = getStripe(stripeAPIKey);

    let stripeAccountDetails;
    try {
      // Try to get the account details and balance to verify the key
      const [account, balance] = await Promise.all([
        stripe.accounts.retrieve(),
        stripe.balance.retrieve(),
      ]);

      stripeAccountDetails = {
        accountId: account.id,
        businessName: account.business_profile?.name || 'Stripe Account',
        businessType: account.type,
        country: account.country,
        email: account.email,
      };
    } catch (stripeError) {
      throw new Error('Invalid Stripe API key or unable to access account. Make sure the key is valid and has the necessary permissions.');
    }

    // Update Firestore user document with Stripe connection details
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    await db
      .collection('users')
      .doc(userId)
      .update({
        stripeConnectId: stripeAccountDetails.accountId,
        stripeAccountType: 'linked',
        stripeBusinessName: stripeAccountDetails.businessName,
        stripeBusinessType: stripeAccountDetails.businessType,
        stripeCountry: stripeAccountDetails.country,
        stripeEmail: stripeAccountDetails.email,
        linkedAt: admin.firestore.FieldValue.serverTimestamp(),
        cardPaymentsEnabled: true,
      });

    return res.status(200).json({
      success: true,
      message: 'Stripe account linked successfully',
      accountId: stripeAccountDetails.accountId,
      businessName: stripeAccountDetails.businessName,
    });
  } catch (error) {
    console.error('Error linking Stripe account:', error);

    return res.status(400).json({
      message: error.message || 'Failed to link Stripe account',
    });
  }
}
