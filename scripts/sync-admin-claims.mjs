#!/usr/bin/env node
/**
 * Admin script: keeps the `admin` custom claim (checked by firestore.rules and the Cloud
 * Functions) in line with users/{uid}.role, and recovers admin access when no admin can sign in.
 *
 *  - users/{uid}.role == 'admin' and no claim  -> claim set
 *  - claim set but role isn't 'admin'           -> claim removed and sessions revoked
 *  - --grant <email>: makes that account an admin (claim + role), e.g. after the only admin
 *    lost their phone. The account still needs 2FA enrolled to use admin features; to replace
 *    a lost phone, first remove the old factor with --reset-2fa <email>, then sign in and
 *    enrol the new number from the Profile page.
 *
 * Every change is written to the auditLog collection.
 *
 * Usage (needs an admin service account via GOOGLE_APPLICATION_CREDENTIALS):
 *   node scripts/sync-admin-claims.mjs                          # dry run
 *   node scripts/sync-admin-claims.mjs --apply                  # sync claims with roles
 *   node scripts/sync-admin-claims.mjs --apply --grant a@b.com  # make an account an admin
 *   node scripts/sync-admin-claims.mjs --apply --reset-2fa a@b.com
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const argAfter = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : null);
const grantEmail = argAfter('--grant');
const resetEmail = argAfter('--reset-2fa');

initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID || 'urbangaragesale',
});
const auth = getAuth();
const db = getFirestore();
const prefix = apply ? '' : '[dry run] ';
const audit = (action, details) =>
  db.collection('auditLog').add({ action, by: 'scripts/sync-admin-claims', ...details, at: FieldValue.serverTimestamp() });

if (resetEmail) {
  const user = await auth.getUserByEmail(resetEmail);
  console.log(`${prefix}${user.uid}: remove ${user.multiFactor?.enrolledFactors?.length ?? 0} second factor(s)`);
  if (apply) {
    await auth.updateUser(user.uid, { multiFactor: { enrolledFactors: null } });
    await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), two_fa_enabled: false });
    await db.collection('users').doc(user.uid).set({ two_fa_enabled: false }, { merge: true });
    await auth.revokeRefreshTokens(user.uid);
    await audit('reset2fa', { userId: user.uid });
  }
}

if (grantEmail) {
  const user = await auth.getUserByEmail(grantEmail);
  console.log(`${prefix}${user.uid}: grant admin`);
  if (apply) {
    await db.collection('users').doc(user.uid).set({ role: 'admin' }, { merge: true });
    await audit('setUserRole', { userId: user.uid, role: 'admin' });
  }
}

const adminIds = new Set();
(await db.collection('users').where('role', '==', 'admin').get()).docs.forEach((d) => adminIds.add(d.id));
if (grantEmail && !apply) adminIds.add((await auth.getUserByEmail(grantEmail)).uid);

const counts = { granted: 0, removed: 0, unchanged: 0 };
let pageToken;
do {
  const page = await auth.listUsers(1000, pageToken);
  for (const user of page.users) {
    const shouldBeAdmin = adminIds.has(user.uid);
    const isAdmin = user.customClaims?.admin === true;
    if (shouldBeAdmin === isAdmin) {
      counts.unchanged++;
      continue;
    }
    counts[shouldBeAdmin ? 'granted' : 'removed']++;
    console.log(`${prefix}${user.uid} (${user.email}): set admin claim = ${shouldBeAdmin}`);
    if (apply) {
      await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: shouldBeAdmin });
      if (!shouldBeAdmin) await auth.revokeRefreshTokens(user.uid);
      await audit('syncAdminClaim', { userId: user.uid, admin: shouldBeAdmin });
    }
  }
  pageToken = page.pageToken;
} while (pageToken);

console.log(JSON.stringify(counts));
console.log('Admins must sign out and in again (with their SMS code) to pick up a new claim.');
if (!apply) console.log('Dry run only. Re-run with --apply to make changes.');
