// Create a card PaymentIntent for an Urban Pay sale.
// Funds are routed to the seller's connected Stripe account (destination charge),
// so the platform never holds the seller's sale proceeds. The card fee (see _shared/fees.js) is
// taken from the seller's payout as an application fee, so Stripe's processing cost isn't the platform's.
import { getStripe } from '../_shared/stripe.js';
import { getFirestore } from '../_shared/firebase-admin.js';
import { applyCors, getTrustedOrigin } from '../_shared/security.js';
import { rateLimit } from '../_shared/rateLimit.js';
import { getLiveGarageSale } from '../_shared/sales.js';
import { cardFeeCents } from '../_shared/fees.js';
import {
  HttpError, readJsonBody, requireUser, requireSecondFactor, parseAudAmount, toCents, cleanText, sendError,
  MAX_CARD_AUD_AMOUNT,
} from '../_shared/http.js';

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
    await rateLimit(uid, 'createPaymentIntent', 2);
    const body = await readJsonBody(req);

    const amount = parseAudAmount(body.amount, { max: MAX_CARD_AUD_AMOUNT });
    const description = cleanText(body.description, 100, 'Urban Pay Sale');
    const garageSaleId = cleanText(body.garageSaleId, 128);
    // Checked before charging: recordTapToPaySale refuses sales for someone else's garage sale,
    // so an unchecked ID would take the customer's money and then fail to record the sale.
    await getLiveGarageSale(uid, garageSaleId);
    // Card-present (Terminal / Tap to Pay) intents need an explicit payment method type.
    const channel = body.channel === 'terminal' || body.channel === 'tap_to_pay' ? body.channel : 'online';
    const cardPresent = channel !== 'online';
    const amountCents = toCents(amount);
    const feeCents = cardFeeCents(amountCents, channel);

    const userDoc = await getFirestore().collection('users').doc(uid).get();
    const user = userDoc.data() || {};
    if (!user.stripeConnectId || user.cardPaymentsEnabled !== true) {
      throw new HttpError(403, 'Card payments are not enabled for this account. Complete Stripe setup in your Profile first.');
    }

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: amountCents,
      currency: 'aud',
      description: `Urban Pay Sale - ${description}`,
      ...(cardPresent
        ? { payment_method_types: ['card_present'], capture_method: 'automatic' }
        : { automatic_payment_methods: { enabled: true } }),
      application_fee_amount: feeCents,
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
      cardFee: feeCents / 100,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to create payment');
  }
};
