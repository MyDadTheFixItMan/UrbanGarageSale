// Confirms the seller is signed in and able to take card payments before the
// mobile app starts Tap to Pay. Reader registration itself happens on the device.
import { getFirestore } from '../_shared/firebase-admin.js';
import { applyCors, getTrustedOrigin } from '../_shared/security.js';
import { HttpError, requireUser, requireSecondFactor, sendError } from '../_shared/http.js';

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
    const user = (await getFirestore().collection('users').doc(uid).get()).data() || {};

    if (!user.stripeConnectId || user.cardPaymentsEnabled !== true) {
      throw new HttpError(403, 'Card payments are not enabled for this account. Complete Stripe setup in your Profile first.');
    }

    return res.status(200).json({
      success: true,
      sellerId: uid,
      message: 'Ready to accept Tap to Pay payments.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return sendError(res, error, 'Failed to initialize reader');
  }
}
