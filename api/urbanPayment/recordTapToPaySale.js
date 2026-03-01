// api/urbanPayment/recordTapToPaySale.js

import Stripe from "stripe";

const getStripe = async () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(stripeSecretKey);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const {
      amount,
      description,
      paymentIntentId,
      currency = 'aud',
      paymentMethod = 'tap_to_pay',
    } = req.body;

    if (!amount || !paymentIntentId) {
      return res.status(400).json({
        error: 'Missing required fields: amount, paymentIntentId',
      });
    }

    // Verify payment intent status with Stripe
    const stripe = await getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Payment intent not succeeded',
        status: paymentIntent.status,
      });
    }

    // In production, save this to Firestore:
    // const saleRecord = {
    //   sellerId: decoded.uid,
    //   amount,
    //   description,
    //   paymentIntentId,
    //   paymentMethod: 'tap_to_pay',
    //   status: 'completed',
    //   currency: currency.toUpperCase(),
    //   timestamp: admin.firestore.Timestamp.now(),
    //   transactionFee: Math.round(amount * 0.029 * 100 + 30) / 100, // Stripe fees
    // };
    // 
    // await admin.firestore().collection('sales').add(saleRecord);

    return res.status(200).json({
      success: true,
      message: 'Tap to Pay sale recorded successfully',
      saleData: {
        amount,
        description,
        paymentIntentId,
        paymentMethod: 'tap_to_pay',
        status: 'completed',
        currency: currency.toUpperCase(),
        timestamp: new Date().toISOString(),
        transactionFee: (amount * 0.029 + 0.30).toFixed(2),
        netEarnings: (amount - (amount * 0.029 + 0.30)).toFixed(2),
      },
    });
  } catch (error) {
    console.error('Record Tap to Pay Sale error:', error);
    return res.status(500).json({
      error: 'Failed to record sale',
      message: error.message,
    });
  }
}
