import 'dotenv/config';
import { getFirebaseAdmin } from './api/_shared/firebase-admin.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { userIds: [], dryRun: false };

  for (const arg of args) {
    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }

    if (arg.startsWith('--userIds=')) {
      const raw = arg.slice('--userIds='.length);
      out.userIds.push(...raw.split(',').map((s) => s.trim()).filter(Boolean));
      continue;
    }

    out.userIds.push(arg.trim());
  }

  out.userIds = [...new Set(out.userIds.filter(Boolean))];
  return out;
}

async function cleanupSelectedUsersStripeFields() {
  const { userIds, dryRun } = parseArgs(process.argv);

  if (userIds.length === 0) {
    console.error('Usage: node cleanup-selected-users-stripe-fields.js --userIds=<id1,id2> [--dry-run]');
    console.error('Or:    node cleanup-selected-users-stripe-fields.js <id1> <id2> [--dry-run]');
    process.exit(1);
  }

  const admin = getFirebaseAdmin();
  const db = admin.firestore();

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

  const userRefs = userIds.map((id) => db.collection('users').doc(id));
  const userDocs = await Promise.all(userRefs.map((ref) => ref.get()));

  let updated = 0;
  let found = userDocs.filter((doc) => doc.exists).length;

  if (!dryRun) {
    let batch = db.batch();
    let opsInBatch = 0;

    for (const doc of userDocs) {
      if (!doc.exists) continue;
      const update = { cardPaymentsEnabled: false };
      for (const field of fieldsToDelete) {
        update[field] = admin.firestore.FieldValue.delete();
      }

      batch.update(doc.ref, update);
      updated++;
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
  }

  const verifyDocs = await Promise.all(userRefs.map((ref) => ref.get()));

  let usersStillWithStripeData = 0;
  for (const doc of verifyDocs) {
    if (!doc.exists) continue;
    const data = doc.data();
    if (
      data.stripeConnectId ||
      data.stripeAccountType ||
      data.stripeBusinessName ||
      data.stripeBusinessType ||
      data.stripeCountry ||
      data.stripeEmail ||
      data.stripeConnectSetup ||
      data.linkedAt ||
      data.cardPaymentsEnabled === true
    ) {
      usersStillWithStripeData++;
    }
  }

  const notFound = verifyDocs.filter((doc) => !doc.exists).map((doc) => doc.id);

  console.log(JSON.stringify({
    dryRun,
    requestedUserIds: userIds,
    foundUsers: found,
    updatedUsers: dryRun ? 0 : updated,
    notFoundUserIds: notFound,
    usersStillWithStripeData,
  }, null, 2));
}

cleanupSelectedUsersStripeFields().catch((error) => {
  console.error('Failed to clean selected user Stripe fields:', error.message);
  process.exit(1);
});
