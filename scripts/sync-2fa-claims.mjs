#!/usr/bin/env node
/**
 * Admin script: brings every account's 2FA flag in line with Firebase multi-factor enrolment.
 *
 *  - Account has an SMS second factor enrolled  -> two_fa_enabled claim + profile field = true
 *  - Account has no second factor enrolled       -> claim + profile field = false
 *    (these users turn 2FA on again from their Profile)
 *  - With --unlink-phone: removes the "sign in with phone number" method that the old sign-up
 *    flow attached. It let anyone with access to the SIM sign in without the password.
 *
 * Usage (needs an admin service account via GOOGLE_APPLICATION_CREDENTIALS):
 *   node scripts/sync-2fa-claims.mjs                         # dry run
 *   node scripts/sync-2fa-claims.mjs --apply                 # update claims and profiles
 *   node scripts/sync-2fa-claims.mjs --apply --unlink-phone  # also remove phone sign-in
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const apply = process.argv.includes('--apply');
const unlinkPhone = process.argv.includes('--unlink-phone');
initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID || 'urbangaragesale',
});
const auth = getAuth();
const db = getFirestore();

const counts = { enabled: 0, disabled: 0, phoneUnlinked: 0, unchanged: 0 };
let pageToken;
do {
  const page = await auth.listUsers(1000, pageToken);
  for (const user of page.users) {
    const enrolled = (user.multiFactor?.enrolledFactors?.length ?? 0) > 0;
    const claim = user.customClaims?.two_fa_enabled === true;
    const hasPhoneSignIn = user.providerData.some((p) => p.providerId === 'phone');
    let changed = false;

    if (enrolled !== claim) {
      changed = true;
      counts[enrolled ? 'enabled' : 'disabled']++;
      console.log(`${apply ? '' : '[dry run] '}${user.uid}: set two_fa_enabled = ${enrolled}`);
      if (apply) {
        await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), two_fa_enabled: enrolled });
        await db.collection('users').doc(user.uid).set({ two_fa_enabled: enrolled }, { merge: true });
      }
    }

    if (unlinkPhone && hasPhoneSignIn) {
      changed = true;
      counts.phoneUnlinked++;
      console.log(`${apply ? '' : '[dry run] '}${user.uid}: remove phone-number sign-in`);
      if (apply) {
        await auth.updateUser(user.uid, { providersToUnlink: ['phone'] });
      }
    }

    if (!changed) counts.unchanged++;
  }
  pageToken = page.pageToken;
} while (pageToken);

console.log(JSON.stringify(counts));
if (!apply) console.log('Dry run only. Re-run with --apply to make changes.');
