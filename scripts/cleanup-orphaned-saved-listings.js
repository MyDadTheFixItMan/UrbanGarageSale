// Removes favourites (savedListings) whose listing is gone or no longer live: deleted, ended,
// rejected or unpublished. The removeEndedFavourites Cloud Function does this as listings stop
// being live; this clears ones left from before it existed.
//
//   node scripts/cleanup-orphaned-saved-listings.js          dry run: counts what it would delete
//   node scripts/cleanup-orphaned-saved-listings.js --go     deletes them
import 'dotenv/config';
import { getFirebaseAdmin } from '../api/_shared/firebase-admin.js';

const GO = process.argv.includes('--go');

async function cleanupOrphanedSavedListings() {
  const db = getFirebaseAdmin().firestore();

  const saved = (await db.collection('savedListings').get()).docs;
  const saleIds = [...new Set(saved.map((doc) => doc.data().garage_sale_id).filter(Boolean))];
  const sales = saleIds.length ? await db.getAll(...saleIds.map((id) => db.collection('garageSales').doc(id))) : [];
  const liveIds = new Set(sales.filter((s) => s.exists && s.data().status === 'active').map((s) => s.id));

  // A record without a listing ID is treated as orphaned too.
  const orphans = saved.filter((doc) => !liveIds.has(doc.data().garage_sale_id));
  const reasons = {};
  for (const doc of orphans) {
    const sale = sales.find((s) => s.id === doc.data().garage_sale_id);
    const reason = !doc.data().garage_sale_id ? 'no listing ID' : sale?.exists ? sale.data().status || 'no status' : 'listing deleted';
    reasons[reason] = (reasons[reason] || 0) + 1;
  }

  console.log(JSON.stringify({ project: process.env.FIREBASE_PROJECT_ID || 'urbangaragesale', totalSaved: saved.length, orphaned: orphans.length, reasons }, null, 2));
  if (!GO) {
    console.log('Dry run: nothing deleted. Add --go to delete.');
    return;
  }

  for (let i = 0; i < orphans.length; i += 400) {
    const batch = db.batch();
    orphans.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  const remaining = await db.collection('savedListings').count().get();
  console.log(`Deleted ${orphans.length}. ${remaining.data().count} favourite(s) remain.`);
}

cleanupOrphanedSavedListings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to clean up orphaned saved listings:', error.message);
    process.exit(1);
  });
