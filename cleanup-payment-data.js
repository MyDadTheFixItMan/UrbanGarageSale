import 'dotenv/config';
import { getFirebaseAdmin } from './api/_shared/firebase-admin.js';

async function deleteCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  let deleted = 0;

  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    deleted++;
    opsInBatch++;

    if (opsInBatch >= 450) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  const verify = await db.collection(collectionName).get();
  return {
    collection: collectionName,
    scanned: snapshot.size,
    deleted,
    remaining: verify.size,
  };
}

async function scrubUserPaymentFields(db, admin) {
  const userSnapshot = await db.collection('users').get();

  const fieldsToDelete = [
    'stripeConnectId',
    'stripeAccountType',
    'stripeBusinessName',
    'stripeBusinessType',
    'stripeCountry',
    'stripeEmail',
    'stripeConnectSetup',
    'linkedAt',
  ];

  let usersUpdated = 0;

  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of userSnapshot.docs) {
    const update = { cardPaymentsEnabled: false };
    for (const field of fieldsToDelete) {
      update[field] = admin.firestore.FieldValue.delete();
    }

    batch.update(doc.ref, update);
    usersUpdated++;
    opsInBatch++;

    if (opsInBatch >= 450) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  return {
    usersScanned: userSnapshot.size,
    usersUpdated,
  };
}

async function scrubListingPaymentFields(db, admin) {
  const listingSnapshot = await db.collection('garageSales').get();
  let listingsUpdated = 0;

  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of listingSnapshot.docs) {
    batch.update(doc.ref, {
      payment_status: admin.firestore.FieldValue.delete(),
      paymentStatus: admin.firestore.FieldValue.delete(),
    });

    listingsUpdated++;
    opsInBatch++;

    if (opsInBatch >= 450) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  return {
    listingsScanned: listingSnapshot.size,
    listingsUpdated,
  };
}

async function cleanupPaymentData() {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();

  const collectionsToDelete = ['payments', 'sales', 'sellerStats'];
  const deletedCollections = [];

  for (const collectionName of collectionsToDelete) {
    deletedCollections.push(await deleteCollection(db, collectionName));
  }

  const userCleanup = await scrubUserPaymentFields(db, admin);
  const listingCleanup = await scrubListingPaymentFields(db, admin);

  const verify = {
    paymentsRemaining: (await db.collection('payments').get()).size,
    salesRemaining: (await db.collection('sales').get()).size,
    sellerStatsRemaining: (await db.collection('sellerStats').get()).size,
  };

  console.log(JSON.stringify({
    deletedCollections,
    userCleanup,
    listingCleanup,
    verify,
  }, null, 2));
}

cleanupPaymentData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to cleanup payment data:', error.message);
    process.exit(1);
  });
