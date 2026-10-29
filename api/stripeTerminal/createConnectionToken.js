// Create a Stripe Terminal connection token for the Urban Pay mobile app.
import { getStripe } from '../_shared/stripe.js';
import { applyCors, getTrustedOrigin } from '../_shared/security.js';
import { requireUser, requireSecondFactor, sendError } from '../_shared/http.js';
import { rateLimit } from '../_shared/rateLimit.js';

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
    await rateLimit(uid, 'createConnectionToken', 30);
    const connectionToken = await getStripe().terminal.connectionTokens.create();
    return res.status(200).json({ success: true, secret: connectionToken.secret });
  } catch (error) {
    return sendError(res, error, 'Failed to create connection token');
  }
};
