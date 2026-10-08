// GET /api/urbanPayment - health check and endpoint listing.
// Each endpoint lives in its own file under api/urbanPayment/ (Vercel routes those directly).
import { applyCors, getTrustedOrigin } from './_shared/security.js';

export default (req, res) => {
  applyCors(res, getTrustedOrigin(req.headers.origin), 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/urbanPayment/createPaymentIntent',
      'POST /api/urbanPayment/recordSale',
      'POST /api/urbanPayment/recordTapToPaySale',
      'POST /api/urbanPayment/initializeTapToPayReader',
      'POST /api/urbanPayment/enableStripeConnect',
      'POST /api/urbanPayment/verifyStripeConnectStatus',
      'POST /api/urbanPayment/initiateStripeOAuth',
      'POST /api/urbanPayment/handleStripeOAuthCallback',
    ],
  });
};
