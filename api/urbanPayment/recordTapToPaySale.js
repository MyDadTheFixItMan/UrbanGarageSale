// Record a completed card (Tap to Pay / Payment Sheet) sale.
// The amount and status come from Stripe, never from the client, and a PaymentIntent
// can only be recorded once, by the seller it was created for.
import Stripe from 'stripe';
import { applyCors, getTrustedOrigin } from '../_shared/security.js';
import { HttpError, readJsonBody, requireUser, requireSecondFactor, cleanText, sendError } from '../_shared/http.js';
import { writeSaleWithStats, assertOwnsGarageSale } from '../_shared/sales.js';

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

export default async function handler(req, res) {
  applyCors(res, getTrustedOrigin(req.headers.origin), 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uid } = requireSecondFactor(await requireUser(req));
    const body = await readJsonBody(req);

    const paymentIntentId = cleanText(body.paymentIntentId, 255);
    if (!paymentIntentId.startsWith('pi_')) {
      throw new HttpError(400, 'A valid paymentIntentId is required');
    }

    const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.metadata?.sellerId !== uid) {
      throw new HttpError(403, 'This payment does not belong to your account');
    }
    if (paymentIntent.status !== 'succeeded') {
      throw new HttpError(409, `Payment has not completed (status: ${paymentIntent.status})`);
    }

    const garageSaleId = paymentIntent.metadata?.garageSaleId || '';
    await assertOwnsGarageSale(uid, garageSaleId);

    const amount = paymentIntent.amount_received / 100;
    const applicationFee = (paymentIntent.application_fee_amount || 0) / 100;

    const { saleId, duplicate } = await writeSaleWithStats({
      saleDocId: paymentIntent.id,
      sale: {
        sellerId: uid,
        garageSaleId,
        amount,
        currency: paymentIntent.currency.toUpperCase(),
        description: cleanText(body.description, 100, paymentIntent.metadata?.saleDescription || 'Card Payment'),
        paymentIntentId: paymentIntent.id,
        paymentMethod: body.paymentMethod === 'card' ? 'card' : 'tap_to_pay',
        status: 'completed',
        applicationFee,
        netEarnings: Math.round((amount - applicationFee) * 100) / 100,
      },
    });

    return res.status(200).json({
      success: true,
      duplicate,
      message: duplicate ? 'This payment was already recorded' : 'Card payment recorded',
      saleId,
      paymentStatus: paymentIntent.status,
      saleData: {
        amount,
        currency: 'AUD',
        applicationFee: applicationFee.toFixed(2),
        netEarnings: (amount - applicationFee).toFixed(2),
      },
    });
  } catch (error) {
    return sendError(res, error, 'Failed to record sale');
  }
}
