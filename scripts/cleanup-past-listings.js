import 'dotenv/config';
import { getFirebaseAdmin } from '../api/_shared/firebase-admin.js';

function toDate(value) {
  if (!value) return null;

  // Firestore Timestamp-like object
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d?.getTime?.()) ? null : d;
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function cleanupPastListings() {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const snapshot = await db.collection('garageSales').get();

  let deleted = 0;
  let invalidDate = 0;
  let total = snapshot.size;

  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const endDate = toDate(data.end_date);

    if (!endDate) {
      invalidDate++;
      continue;
    }

    // Treat listing as past if end_date is before today.
    endDate.setHours(0, 0, 0, 0);
    if (endDate < today) {
      batch.delete(doc.ref);
      deleted++;
      opsInBatch++;

      if (opsInBatch >= 450) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  // Verify no past docs remain.
  const verifySnapshot = await db.collection('garageSales').get();
  let remainingPast = 0;

  for (const doc of verifySnapshot.docs) {
    const endDate = toDate(doc.data().end_date);
    if (!endDate) continue;
    endDate.setHours(0, 0, 0, 0);
    if (endDate < today) remainingPast++;
  }

  console.log(JSON.stringify({
    collection: 'garageSales',
    totalScanned: total,
    deletedPastListings: deleted,
    invalidDateDocsSkipped: invalidDate,
    remainingTotal: verifySnapshot.size,
    remainingPastListings: remainingPast,
  }, null, 2));
}

cleanupPastListings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to cleanup past listings:', error.message);
    process.exit(1);
  });
