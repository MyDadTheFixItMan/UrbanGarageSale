// Reset card payments for testing
import { getFirebaseAdmin } from './api/firebase-admin.js';

async function resetCardPayments(userId) {
  try {
    if (!userId) {
      throw new Error('No userId provided');
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    await db.collection('users').doc(userId).update({
      stripeConnectId: admin.firestore.FieldValue.delete(),
      cardPaymentsEnabled: false,
      stripeConnectSetup: admin.firestore.FieldValue.delete(),
    });

    console.log(`✅ Card payments reset for user: ${userId}`);
  } catch (error) {
    console.error('❌ Error resetting card payments:', error.message);
  }
}

// Get user ID from command line argument
const userId = process.argv[2];
if (!userId) {
  console.log('Usage: node reset-card-payments.js <userId>');
  console.log('\nExample: node reset-card-payments.js "abc123def456"');
  process.exit(1);
}

resetCardPayments(userId);
