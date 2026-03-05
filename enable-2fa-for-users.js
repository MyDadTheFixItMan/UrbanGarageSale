#!/usr/bin/env node
/**
 * Admin script to enable 2FA for all users
 * Usage: node enable-2fa-for-users.js
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID || 'urbangaragesa-43f04',
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
};

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
  });
  console.log('✅ Firebase Admin SDK initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  console.log('\nThis script requires Firebase Admin credentials in your .env file:');
  console.log('  FIREBASE_PROJECT_ID');
  console.log('  FIREBASE_PRIVATE_KEY');
  console.log('  FIREBASE_CLIENT_EMAIL');
  console.log('\nYou can also enable 2FA manually in the Firebase Console:');
  console.log('1. Go to Firebase Console > Firestore > users collection');
  console.log('2. Open each user document');
  console.log('3. Set two_fa_enabled to true');
  process.exit(1);
}

async function enableTwoFAForAllUsers() {
  try {
    const db = admin.firestore();
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    if (snapshot.empty) {
      console.log('❌ No users found in Firestore');
      return;
    }

    console.log(`\n📋 Found ${snapshot.size} user(s). Enabling 2FA for all...\n`);

    let updatedCount = 0;
    const updates = [];

    for (const doc of snapshot.docs) {
      const userId = doc.id;
      const userData = doc.data();
      const is2FAEnabled = userData.two_fa_enabled || false;

      console.log(`📝 User: ${userData.email || userId}`);
      console.log(`   Current 2FA status: ${is2FAEnabled ? '✅ Enabled' : '❌ Disabled'}`);

      if (!is2FAEnabled) {
        updates.push(
          usersRef.doc(userId).update({
            two_fa_enabled: true,
            updated_at: new Date(),
          })
        );
        console.log(`   → Setting 2FA to enabled`);
        updatedCount++;
      } else {
        console.log(`   → Already enabled (no change)`);
      }
      console.log();
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`✅ Successfully enabled 2FA for ${updatedCount} user(s)`);
    } else {
      console.log('✅ All users already have 2FA enabled');
    }

  } catch (error) {
    console.error('❌ Error updating users:', error.message);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

enableTwoFAForAllUsers();
