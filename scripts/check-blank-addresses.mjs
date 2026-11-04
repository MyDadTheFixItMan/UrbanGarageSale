#!/usr/bin/env node
/**
 * Admin script, read-only: lists user profiles with a blank suburb, state or postcode. These fill
 * in only when each account's owner saves their profile. Changes nothing.
 *
 * Usage (needs an admin service account via GOOGLE_APPLICATION_CREDENTIALS):
 *   node scripts/check-blank-addresses.mjs
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID || 'urbangaragesale',
});
const db = getFirestore();

const FIELDS = ['suburb', 'state', 'postcode'];
const snapshot = await db.collection('users').select(...FIELDS, 'role').get();
let blank = 0;
for (const doc of snapshot.docs) {
  const data = doc.data();
  const missing = FIELDS.filter((field) => !String(data[field] ?? '').trim());
  if (missing.length) {
    blank++;
    console.log(`${doc.id}${data.role === 'admin' ? ' (admin)' : ''}: blank ${missing.join(', ')}`);
  }
}
console.log(JSON.stringify({ profiles: snapshot.size, withBlanks: blank }));
