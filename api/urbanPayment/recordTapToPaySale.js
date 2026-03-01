// api/urbanPayment/recordTapToPaySale.js

import Stripe from "stripe";
import admin from 'firebase-admin';
import { getFirebaseAdmin, verifyToken } from '../firebase-admin.js';

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

    const idToken = authHeader.substring(7);
    const sellerId = await verifyToken(idToken);

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

    // Save to Firestore using Admin SDK
    const adminInstance = getFirebaseAdmin();
    const db = adminInstance.firestore();
    const transactionFee = amount * 0.029 + 0.30;
    const netEarnings = amount - transactionFee;
    const timestamp = adminInstance.firestore.Timestamp.now();

    const saleRecord = {
      sellerId: sellerId,
      amount: amount,
      description: description,
      paymentIntentId: paymentIntentId,
      paymentMethod: 'tap_to_pay',
      status: 'completed',
      currency: currency.toUpperCase(),
      timestamp: timestamp,
      transactionFee: Math.round(transactionFee * 100) / 100,
      netEarnings: Math.round(netEarnings * 100) / 100,
    };

    // 1. Record the sale
    const docRef = await db.collection('sales').add(saleRecord);

    // 2. Update seller stats - increment totalEarnings and totalSales
    // Use set() with merge: true to create or update the document
    const statsRef = db.collection('sellerStats').doc(sellerId);
    await statsRef.set({
      sellerId: sellerId,
      totalEarnings: adminInstance.firestore.FieldValue.increment(amount),
      totalSales: adminInstance.firestore.FieldValue.increment(1),
      lastUpdated: timestamp,
    }, { merge: true });

    return res.status(200).json({
      success: true,
      message: 'Tap to Pay sale recorded successfully',
      saleId: docRef.id,
      saleData: {
        amount,
        description,
        paymentIntentId,
        paymentMethod: 'tap_to_pay',
        status: 'completed',
        currency: currency.toUpperCase(),
        timestamp: new Date().toISOString(),
        transactionFee: transactionFee.toFixed(2),
        netEarnings: netEarnings.toFixed(2),
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
