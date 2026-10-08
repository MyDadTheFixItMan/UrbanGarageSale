#!/usr/bin/env node
// Removes the seller email (`created_by`) from existing garage sale listings.
// Listings are publicly readable, so they must not contain personal email addresses.
//
// Usage (needs an admin service account via GOOGLE_APPLICATION_CREDENTIALS):
//   node scripts/strip-listing-emails.mjs            # dry run: reports what would change
//   node scripts/strip-listing-emails.mjs --apply    # removes the field
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const apply = process.argv.includes('--apply');
initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID || 'urbangaragesale',
});
const db = getFirestore();

const snapshot = await db.collection('garageSales').get();
const withEmail = snapshot.docs.filter((doc) => doc.get('created_by') !== undefined);
const missingOwner = withEmail.filter((doc) => !doc.get('user_id'));

console.log(`${snapshot.size} listings, ${withEmail.length} contain a seller email.`);
if (missingOwner.length) {
  console.log(`Skipping ${missingOwner.length} listing(s) with no user_id (review these by hand):`);
  missingOwner.forEach((doc) => console.log(`  ${doc.id}`));
}

const toFix = withEmail.filter((doc) => doc.get('user_id'));
if (!apply) {
  console.log(`Dry run: would remove created_by from ${toFix.length} listing(s). Re-run with --apply.`);
  process.exit(0);
}

for (let i = 0; i < toFix.length; i += 400) {
  const batch = db.batch();
  toFix.slice(i, i + 400).forEach((doc) => batch.update(doc.ref, { created_by: FieldValue.delete() }));
  await batch.commit();
}
console.log(`Removed created_by from ${toFix.length} listing(s).`);
