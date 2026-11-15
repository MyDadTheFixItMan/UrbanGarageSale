#!/usr/bin/env node
/**
 * Admin script: rebuilds publicListings, the copies of live listings (no street address,
 * approximate pin) that visitors who aren't signed in read. The syncPublicListing Cloud Function
 * keeps them up to date as listings change; run this once after first deploying it, so listings
 * that were already live get a copy, and any time the copies may have drifted.
 *
 *  - every active listing          -> its copy written (web-app/functions/lib/publicListing.js)
 *  - a copy with no active listing -> deleted
 *
 * Usage (needs an admin service account via GOOGLE_APPLICATION_CREDENTIALS, and
 * `npm install` run in web-app/functions):
 *   node scripts/sync-public-listings.mjs           # dry run
 *   node scripts/sync-public-listings.mjs --apply   # write and delete copies
 *   FIREBASE_PROJECT_ID=urbangaragesale-staging node scripts/sync-public-listings.mjs --apply
 */
import { createRequire } from 'node:module';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const require = createRequire(import.meta.url);
const { publicListing } = require('../web-app/functions/lib/publicListing.js');

const apply = process.argv.includes('--apply');
const projectId = process.env.FIREBASE_PROJECT_ID || 'urbangaragesale';
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const prefix = apply ? '' : '[dry run] ';

const live = await db.collection('garageSales').where('status', '==', 'active').get();
const copies = await db.collection('publicListings').get();
const liveIds = new Set(live.docs.map((doc) => doc.id));
const stale = copies.docs.filter((doc) => !liveIds.has(doc.id));

console.log(`${prefix}${projectId}: write ${live.size} copies, delete ${stale.length} stale ones`);
if (apply) {
  // A batch holds at most 500 writes.
  const writes = [
    ...live.docs.map((doc) => (batch) => batch.set(db.collection('publicListings').doc(doc.id), publicListing(doc.data()))),
    ...stale.map((doc) => (batch) => batch.delete(doc.ref)),
  ];
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach((write) => write(batch));
    await batch.commit();
  }
  console.log('Done');
}
