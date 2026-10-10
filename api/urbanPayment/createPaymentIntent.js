// Create a card PaymentIntent for an Urban Pay sale.
// Funds are routed to the seller's connected Stripe account (destination charge),
// so the platform never holds the seller's sale proceeds.
import Stripe from 'stripe';
import { getFirestore } from '../_shared/firebase-admin.js';
import { applyCors, getTrustedOrigin } from '../_shared/security.js';
import { rateLimit } from '../_shared/rateLimit.js';
import {
  HttpError, readJsonBody, requireUser, requireSecondFactor, parseAudAmount, toCents, cleanText, sendError,
} from '../_shared/http.js';

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
  applyCors(res, getTrustedOrigin(req.headers.origin), 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uid } = requireSecondFactor(await requireUser(req));
    await rateLimit(uid, 'createPaymentIntent', 30);
    const body = await readJsonBody(req);

    const amount = parseAudAmount(body.amount);
    const description = cleanText(body.description, 100, 'Urban Pay Sale');
    const garageSaleId = cleanText(body.garageSaleId, 128);
    // Card-present (Terminal / Tap to Pay) intents need an explicit payment method type.
    const cardPresent = body.channel === 'terminal' || body.channel === 'tap_to_pay';

    const userDoc = await getFirestore().collection('users').doc(uid).get();
    const user = userDoc.data() || {};
    if (!user.stripeConnectId || user.cardPaymentsEnabled !== true) {
      throw new HttpError(403, 'Card payments are not enabled for this account. Complete Stripe setup in your Profile first.');
    }

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: toCents(amount),
      currency: 'aud',
      description: `Urban Pay Sale - ${description}`,
      ...(cardPresent
        ? { payment_method_types: ['card_present'], capture_method: 'automatic' }
        : { automatic_payment_methods: { enabled: true } }),
      on_behalf_of: user.stripeConnectId,
      transfer_data: { destination: user.stripeConnectId },
      metadata: {
        sellerId: uid,
        garageSaleId,
        saleDescription: description,
      },
    });

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to create payment');
  }
};
