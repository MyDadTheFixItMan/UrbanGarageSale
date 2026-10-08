// Record a cash sale (self-reported by the seller) using the Admin SDK.
import { applyCors, getTrustedOrigin } from '../_shared/security.js';
import {
  HttpError, readJsonBody, requireUser, requireSecondFactor, parseAudAmount, cleanText, sendError,
} from '../_shared/http.js';
import { writeSaleWithStats, assertOwnsGarageSale } from '../_shared/sales.js';

export default async (req, res) => {
  applyCors(res, getTrustedOrigin(req.headers.origin), 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decoded = requireSecondFactor(await requireUser(req));
    const body = await readJsonBody(req);

    // Card sales must go through recordTapToPaySale so Stripe can confirm them.
    if (body.paymentMethod && body.paymentMethod !== 'cash') {
      throw new HttpError(400, 'Only cash sales can be recorded here');
    }

    // Cash sales can be small, so allow anything from 5c.
    const amount = parseAudAmount(body.amount, { min: 0.05 });
    const description = cleanText(body.description, 100);
    if (!description) {
      throw new HttpError(400, 'Description is required');
    }
    const garageSaleId = cleanText(body.garageSaleId, 128);
    await assertOwnsGarageSale(decoded.uid, garageSaleId);

    const { saleId } = await writeSaleWithStats({
      sale: {
        sellerId: decoded.uid,
        garageSaleId,
        amount,
        currency: 'AUD',
        description,
        paymentMethod: 'cash',
        status: 'completed',
      },
    });

    return res.status(200).json({
      success: true,
      saleId,
      amount,
      status: 'completed',
      message: 'Cash sale recorded successfully',
    });
  } catch (error) {
    return sendError(res, error, 'Failed to record cash sale');
  }
};

