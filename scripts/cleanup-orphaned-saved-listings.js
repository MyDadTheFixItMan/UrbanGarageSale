import 'dotenv/config';
import { getFirebaseAdmin } from '../api/_shared/firebase-admin.js';

async function cleanupOrphanedSavedListings() {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();

  const [savedSnapshot, salesSnapshot] = await Promise.all([
    db.collection('savedListings').get(),
    db.collection('garageSales').get(),
  ]);

  const existingSaleIds = new Set(salesSnapshot.docs.map((doc) => doc.id));

  let deleted = 0;
  let missingGarageSaleId = 0;
  let totalSaved = savedSnapshot.size;

  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of savedSnapshot.docs) {
    const data = doc.data();
    const saleId = data.garage_sale_id;

    // Invalid record shape is treated as orphaned for consistency.
    if (!saleId) {
      batch.delete(doc.ref);
      missingGarageSaleId++;
      deleted++;
      opsInBatch++;
    } else if (!existingSaleIds.has(saleId)) {
      batch.delete(doc.ref);
      deleted++;
      opsInBatch++;
    }

    if (opsInBatch >= 450) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  const verifySavedSnapshot = await db.collection('savedListings').get();
  let remainingOrphans = 0;

  for (const doc of verifySavedSnapshot.docs) {
    const saleId = doc.data().garage_sale_id;
    if (!saleId || !existingSaleIds.has(saleId)) {
      remainingOrphans++;
    }
  }

  console.log(JSON.stringify({
    collection: 'savedListings',
    totalScanned: totalSaved,
    deletedOrphanedSavedListings: deleted,
    deletedMissingGarageSaleId: missingGarageSaleId,
    remainingTotal: verifySavedSnapshot.size,
    remainingOrphanedSavedListings: remainingOrphans,
  }, null, 2));
}

cleanupOrphanedSavedListings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to cleanup orphaned saved listings:', error.message);
    process.exit(1);
  });
