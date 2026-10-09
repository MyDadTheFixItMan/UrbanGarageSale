import { getFirebaseAdmin } from './_shared/firebase-admin.js';
import { applyCors, getTrustedOrigin } from './_shared/security.js';
import { HttpError, readJsonBody, requireUser, sendError } from './_shared/http.js';
import { rateLimit } from './_shared/rateLimit.js';

/**
 * Turns two-factor authentication on or off for the signed-in user.
 *
 * 2FA can only be enabled once the user has enrolled an SMS second factor with Firebase
 * multi-factor auth, which Firebase then enforces at every sign-in.
 * The server sets both the `two_fa_enabled` custom claim (used by Firestore rules) and the
 * matching field on the user's profile; clients cannot write either directly.
 */
const setUserClaimsHandler = async (req: any, res: any) => {
  applyCors(res, getTrustedOrigin(req.headers.origin), 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uid } = await requireUser(req);
    await rateLimit(uid, 'setUserClaims', 10);
    const { action } = await readJsonBody(req);

    if (action !== 'enable' && action !== 'disable') {
      throw new HttpError(400, 'Invalid action. Use "enable" or "disable"');
    }

    const admin = getFirebaseAdmin();
    const userRecord = await admin.auth().getUser(uid);
    const enable = action === 'enable';

    // The claim mirrors Firebase's own MFA enrolment, which Firebase enforces at every sign-in.
    const enrolledFactors = userRecord.multiFactor?.enrolledFactors ?? [];
    if (enable && enrolledFactors.length === 0) {
      throw new HttpError(412, 'Enrol your mobile number for two-factor sign-in before enabling 2FA.');
    }
    if (!enable && enrolledFactors.length > 0) {
      throw new HttpError(409, 'Remove the enrolled second factor before turning 2FA off.');
    }

    // Merge so other custom claims on the account are preserved.
    await admin.auth().setCustomUserClaims(uid, {
      ...(userRecord.customClaims || {}),
      two_fa_enabled: enable,
    });

    const now = new Date().toISOString();
    await admin.firestore().collection('users').doc(uid).set(
      enable
        ? { two_fa_enabled: true, two_fa_enabled_date: now, phone_verified: true }
        : { two_fa_enabled: false, two_fa_disabled_date: now },
      { merge: true },
    );

    return res.status(200).json({
      success: true,
      message: 'Custom claims updated successfully',
      claims: { two_fa_enabled: enable },
    });
  } catch (error) {
    return sendError(res, error, 'Failed to update two-factor authentication');
  }
};

export default setUserClaimsHandler;
