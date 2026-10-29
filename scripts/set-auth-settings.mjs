#!/usr/bin/env node
/**
 * Admin script: Firebase Authentication settings that the website relies on.
 *
 *  - Password policy, matching web-app/src/lib/password.js, so a weak password can't be set by
 *    calling Firebase directly: at least 12 characters and at least one number (Firebase can't
 *    express "at least one letter of either case"; the website checks that part). Existing
 *    users can still sign in with an older, shorter password (forceUpgradeOnSignin is off);
 *    the rule applies when an account is created or a password is changed or reset.
 *  - Email enumeration protection: sign-in and password-reset responses no longer reveal
 *    whether an email address has an account (audit SEC-11).
 *
 * Usage (needs an admin service account via GOOGLE_APPLICATION_CREDENTIALS):
 *   node scripts/set-auth-settings.mjs           # show the current settings
 *   node scripts/set-auth-settings.mjs --apply   # apply them
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

const show = (label, config) => {
  console.log(`${label} password policy:`, JSON.stringify(config.passwordPolicyConfig ?? 'none', null, 2));
  console.log(`${label} email privacy:`, JSON.stringify(config.emailPrivacyConfig ?? 'default (off)', null, 2));
};

show('Current', await configManager.getProjectConfig());

if (!apply) {
  console.log('Dry run only. Re-run with --apply to apply the settings.');
  process.exit(0);
}

const updated = await configManager.updateProjectConfig({
  passwordPolicyConfig: {
    enforcementState: 'ENFORCE',
    forceUpgradeOnSignin: false,
    constraints: { minLength: MIN_PASSWORD_LENGTH, requireNumeric: true },
  },
  emailPrivacyConfig: { enableImprovedEmailPrivacy: true },
});
show('New', updated);
