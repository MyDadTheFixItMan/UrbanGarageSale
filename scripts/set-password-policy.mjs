#!/usr/bin/env node
/**
 * Admin script: makes Firebase Authentication enforce the same password rule as the website
 * (web-app/src/lib/password.js), so a weak password can't be set by calling Firebase directly.
 *
 *  - At least 12 characters and at least one number (Firebase can't express "at least one
 *    letter of either case"; the website checks that part).
 *  - Existing users can still sign in with an older, shorter password (forceUpgradeOnSignin
 *    is off); the rule applies when an account is created or a password is changed or reset.
 *
 * Usage (needs an admin service account via GOOGLE_APPLICATION_CREDENTIALS):
 *   node scripts/set-password-policy.mjs           # show the current policy
 *   node scripts/set-password-policy.mjs --apply   # enforce the policy
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Must match MIN_PASSWORD_LENGTH in web-app/src/lib/password.js.
const MIN_PASSWORD_LENGTH = 12;

const apply = process.argv.includes('--apply');
initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID || 'urbangaragesale',
});
const configManager = getAuth().projectConfigManager();

const current = await configManager.getProjectConfig();
console.log('Current password policy:', JSON.stringify(current.passwordPolicyConfig ?? 'none', null, 2));

if (!apply) {
  console.log('Dry run only. Re-run with --apply to enforce the policy.');
  process.exit(0);
}

const updated = await configManager.updateProjectConfig({
  passwordPolicyConfig: {
    enforcementState: 'ENFORCE',
    forceUpgradeOnSignin: false,
    constraints: { minLength: MIN_PASSWORD_LENGTH, requireNumeric: true },
  },
});
console.log('Password policy now:', JSON.stringify(updated.passwordPolicyConfig, null, 2));
