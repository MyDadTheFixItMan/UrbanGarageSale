// Create (or resume) a Stripe Connect Express account for an Australian seller and
// return an onboarding link.
import Stripe from 'stripe';
import { getFirebaseAdmin } from '../_shared/firebase-admin.js';
import { applyCors, getTrustedOrigin } from '../_shared/security.js';
import { HttpError, readJsonBody, requireUser, requireSecondFactor, cleanText, sendError } from '../_shared/http.js';

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

let stripe = null;
function getStripe() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

export default async (req, res) => {
  const origin = getTrustedOrigin(req.headers.origin);
  applyCors(res, origin, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decoded = requireSecondFactor(await requireUser(req));
    const userId = decoded.uid;
    const body = await readJsonBody(req);

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    const existing = (await userRef.get()).data() || {};

    let accountId = existing.stripeAccountType === 'created' ? existing.stripeConnectId : null;

    // Reuse the seller's existing Express account rather than creating a new one each time.
    if (!accountId) {
      const state = cleanText(body.state, 3).toUpperCase();
      const postcode = cleanText(body.postcode, 4);
      if (postcode && !/^\d{4}$/.test(postcode)) {
        throw new HttpError(400, 'Postcode must be 4 digits');
      }
      if (state && !AU_STATES.includes(state)) {
        throw new HttpError(400, 'State must be an Australian state or territory');
      }

      const email = cleanText(body.email, 254) || decoded.email;
      const siteUrl = process.env.APP_URL;

      const account = await getStripe().accounts.create({
        type: 'express',
        country: 'AU',
        email,
        business_type: 'individual',
        individual: {
          email,
          first_name: cleanText(body.firstName, 100) || undefined,
          last_name: cleanText(body.lastName, 100) || undefined,
          address: {
            line1: cleanText(body.address, 200) || undefined,
            city: cleanText(body.city, 100) || undefined,
            state: state || undefined,
            postal_code: postcode || undefined,
            country: 'AU',
          },
        },
        business_profile: {
          product_description: 'Second-hand goods sold at a private garage sale',
          ...(siteUrl ? { url: siteUrl } : {}),
        },
      });
      accountId = account.id;

      await userRef.set({
        stripeConnectId: accountId,
        stripeAccountType: 'created',
        cardPaymentsEnabled: false,
        stripeConnectSetup: {
          status: 'pending',
          createdAt: admin.firestore.Timestamp.now(),
          accountId,
        },
      }, { merge: true });
    }

    const link = await getStripe().accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${origin}/profile?tab=payments`,
      return_url: `${origin}/profile?tab=payments&success=true`,
    });

    return res.status(200).json({
      success: true,
      message: 'Stripe Connect initialized',
      stripeConnectId: accountId,
      onboardingUrl: link.url,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to enable card payments');
  }
};
