// Per-user rate limiting for API handlers: a fixed one-minute window counted in Firestore,
// so the limit holds across every serverless instance. Counters are deleted automatically
// by a Firestore TTL policy on `expiresAt` (see firestore.indexes.json).
import { getFirebaseAdmin } from './firebase-admin.js';
import { HttpError } from './http.js';

export async function rateLimit(uid, action, perMinute) {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const windowId = Math.floor(Date.now() / 60000);
  const ref = db.collection('rateLimits').doc(`${action}_${uid}_${windowId}`);

  const count = await db.runTransaction(async (tx) => {
    const n = ((await tx.get(ref)).data()?.n ?? 0) + 1;
    tx.set(ref, { n, expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 120000) });
    return n;
  });

  if (count > perMinute) {
    throw new HttpError(429, 'Too many requests. Please wait a minute and try again.');
  }
}
