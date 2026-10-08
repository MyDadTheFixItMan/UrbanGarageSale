// Writes an Urban Pay sale and updates seller / per-garage-sale stats in one transaction.
import { getFirebaseAdmin } from './firebase-admin.js';
import { HttpError } from './http.js';

// If saleDocId is given the write is idempotent: recording the same sale twice returns the
// existing record and leaves the stats untouched.
export async function writeSaleWithStats({ saleDocId, sale }) {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const { FieldValue, Timestamp } = admin.firestore;

  const saleRef = saleDocId ? db.collection('sales').doc(saleDocId) : db.collection('sales').doc();
  const sellerStatsRef = db.collection('sellerStats').doc(sale.sellerId);
  const saleStatsRef = sale.garageSaleId ? db.collection('saleStats').doc(sale.garageSaleId) : null;

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(saleRef);
    if (existing.exists) {
      return { saleId: saleRef.id, duplicate: true, sale: existing.data() };
    }

    const now = Timestamp.now();
    const record = { ...sale, createdAt: now };
    tx.set(saleRef, record);

    const increments = {
      sellerId: sale.sellerId,
      totalEarnings: FieldValue.increment(sale.amount),
      completedEarnings: FieldValue.increment(sale.amount),
      totalSales: FieldValue.increment(1),
      completedSales: FieldValue.increment(1),
      lastSaleDate: now,
    };
    tx.set(sellerStatsRef, increments, { merge: true });
    if (saleStatsRef) {
      tx.set(saleStatsRef, { ...increments, garageSaleId: sale.garageSaleId }, { merge: true });
    }

    return { saleId: saleRef.id, duplicate: false, sale: record };
  });
}

// Confirms the garage sale exists and belongs to the seller (when one is supplied).
export async function assertOwnsGarageSale(sellerId, garageSaleId) {
  if (!garageSaleId) return;
  const db = getFirebaseAdmin().firestore();
  const snap = await db.collection('garageSales').doc(garageSaleId).get();
  if (!snap.exists || snap.data().user_id !== sellerId) {
    throw new HttpError(403, 'That garage sale does not belong to you');
  }
}
