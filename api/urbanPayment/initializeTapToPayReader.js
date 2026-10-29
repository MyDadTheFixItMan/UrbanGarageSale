// Prepares Tap to Pay for one of the seller's garage sales. Returns what the mobile app needs to
// connect the phone as a Stripe Terminal reader: the garage sale's Terminal location and the
// seller's connected account (payments are made on behalf of it). The reader itself is
// discovered and connected on the device.
import { getFirestore } from '../_shared/firebase-admin.js';
import { applyCors, getTrustedOrigin } from '../_shared/security.js';
import { HttpError, readJsonBody, requireUser, requireSecondFactor, isDocId, sendError } from '../_shared/http.js';
import { rateLimit } from '../_shared/rateLimit.js';
import { getOrCreateTerminalLocation } from '../_shared/terminal.js';

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
    await rateLimit(uid, 'initializeTapToPayReader', 30);
    const { garageSaleId } = await readJsonBody(req);
    if (!isDocId(garageSaleId)) {
      throw new HttpError(400, 'Choose the garage sale you are taking payments for');
    }

    const db = getFirestore();
    const user = (await db.collection('users').doc(uid).get()).data() || {};
    if (!user.stripeConnectId || user.cardPaymentsEnabled !== true) {
      throw new HttpError(403, 'Card payments are not enabled for this account. Complete Stripe setup in your Profile first.');
    }

    const listing = (await db.collection('garageSales').doc(garageSaleId).get()).data();
    if (!listing || listing.user_id !== uid) {
      throw new HttpError(403, 'That garage sale does not belong to you');
    }
    if (listing.status !== 'active') {
      throw new HttpError(409, 'Tap to Pay is available once your garage sale listing is approved and live.');
    }

    const locationId = await getOrCreateTerminalLocation(garageSaleId, listing);

    return res.status(200).json({
      success: true,
      locationId,
      onBehalfOf: user.stripeConnectId,
      merchantDisplayName: (listing.title || 'Garage sale').slice(0, 40),
    });
  } catch (error) {
    return sendError(res, error, 'Failed to prepare Tap to Pay');
  }
}
