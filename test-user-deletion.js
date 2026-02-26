#!/usr/bin/env node

/**
 * User Deletion Test Script
 * 
 * This script helps test the user deletion flow end-to-end
 * 
 * Usage:
 *   node test-user-deletion.js --userId USER_ID --token ID_TOKEN
 * 
 * To get your ID token, open browser console (F12) and run:
 *   const token = await firebase.auth.currentUser.getIdToken();
 *   console.log('Token:', token);
 *   console.log('User ID:', firebase.auth.currentUser.uid);
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const userId = args[args.indexOf('--userId') + 1] || '';
const token = args[args.indexOf('--token') + 1] || '';

if (!userId || !token) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║            User Deletion Test Script                           ║
╚════════════════════════════════════════════════════════════════╝

This script tests the user deletion flow.

REQUIREMENTS:
1. Node.js server running: node API/server.js
2. You must be logged in as an ADMIN user
3. You need your Firebase ID token

HOW TO GET YOUR CREDENTIALS:
1. Open browser on http://localhost:5173 (web app)
2. Make sure you're logged in as an admin
3. Open Developer Tools (F12)
4. Go to Console tab
5. Run these commands:
   
   const token = await firebase.auth.currentUser.getIdToken();
   const userId = firebase.auth.currentUser.uid;
   console.log('Copy these values:');
   console.log('Token:', token);
   console.log('User ID:', userId);

USAGE:
   node test-user-deletion.js --userId [USER_ID] --token [TOKEN]

EXAMPLE:
   node test-user-deletion.js --userId 1a2b3c4d5e6f7g --token "eyJhbGciOiJSUzI1..."

WHAT THIS SCRIPT DOES:
1. Checks if the user exists before deletion
2. Calls the /deleteUser endpoint
3. Checks if the user still exists after deletion
4. Reports the results

OUTPUT:
- 🟢 GREEN = Success
- 🔴 RED = Failed
- 🔵 BLUE = Info
- ⚠️  YELLOW = Warning
  `);
  process.exit(1);
}

const BASE_URL = 'http://localhost:3000';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(type, message) {
  const timestamp = new Date().toLocaleTimeString();
  let prefix = '';
  
  switch(type) {
    case 'success':
      prefix = `${colors.green}✓${colors.reset}`;
      break;
    case 'error':
      prefix = `${colors.red}✗${colors.reset}`;
      break;
    case 'info':
      prefix = `${colors.blue}ℹ${colors.reset}`;
      break;
    case 'warning':
      prefix = `${colors.yellow}⚠${colors.reset}`;
      break;
    case 'heading':
      console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`);
      return;
    default:
      prefix = '•';
  }
  
  console.log(`${colors.bright}[${timestamp}]${colors.reset} ${prefix} ${message}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkUserExists(userId) {
  try {
    const response = await fetch(`${BASE_URL}/checkUserExists?userId=${userId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    log('error', `Failed to check user: ${error.message}`);
    return null;
  }
}

async function deleteUser(userId, token) {
  try {
    log('info', 'Sending delete request to API...');
    const response = await fetch(`${BASE_URL}/deleteUser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ userId }),
    });

    const data = await response.json();
    
    if (response.ok) {
      log('success', `API response: ${data.message}`);
      return true;
    } else {
      log('error', `API error: ${data.error}`);
      return false;
    }
  } catch (error) {
    log('error', `Failed to delete user: ${error.message}`);
    return false;
  }
}

async function runTest() {
  log('heading', '═══════════════════════════════════════════════════════════');
  log('heading', '              USER DELETION TEST');
  log('heading', '═══════════════════════════════════════════════════════════');

  log('info', `User ID: ${userId}`);
  log('info', `Token: ${token.substring(0, 20)}...${token.substring(token.length - 20)}`);

  log('heading', '─ STEP 1: Check Initial State ─');
  const beforeCheck = await checkUserExists(userId);
  
  if (!beforeCheck) {
    log('error', 'Failed to check user existence. Is the server running?');
    process.exit(1);
  }

  log('info', `Firestore: ${beforeCheck.exists.firestore ? '✓ EXISTS' : '✗ NOT FOUND'}`);
  log('info', `Firebase Auth: ${beforeCheck.exists.auth ? '✓ EXISTS' : '✗ NOT FOUND'}`);
  
  if (beforeCheck.firestoreData) {
    log('info', `User email: ${beforeCheck.firestoreData.email}`);
    log('info', `User name: ${beforeCheck.firestoreData.full_name || '(none)'}`);
  }

  log('heading', '─ STEP 2: Delete User ─');
  const deleteSuccess = await deleteUser(userId, token);

  if (!deleteSuccess) {
    log('error', 'Deletion failed. Check server logs for details.');
    process.exit(1);
  }

  log('info', 'Waiting a moment for deletion to complete...');
  await sleep(2000);

  log('heading', '─ STEP 3: Check Final State ─');
  const afterCheck = await checkUserExists(userId);
  
  if (!afterCheck) {
    log('error', 'Failed to verify deletion status. Is the server running?');
    process.exit(1);
  }

  log('info', `Firestore: ${afterCheck.exists.firestore ? '✗ STILL EXISTS' : '✓ DELETED'}`);
  log('info', `Firebase Auth: ${afterCheck.exists.auth ? '✗ STILL EXISTS' : '✓ DELETED'}`);

  log('heading', '═══════════════════════════════════════════════════════════');
  
  if (!afterCheck.exists.firestore && !afterCheck.exists.auth) {
    log('success', 'USER SUCCESSFULLY DELETED ✓');
    log('info', 'The user has been completely removed from both Firestore and Firebase Auth.');
  } else if (!afterCheck.exists.firestore && afterCheck.exists.auth) {
    log('warning', 'PARTIAL DELETION');
    log('info', 'User is still in Firebase Auth but not in Firestore.');
    log('info', 'This might indicate a migration state or partial failure.');
  } else if (afterCheck.exists.firestore && !afterCheck.exists.auth) {
    log('warning', 'PARTIAL DELETION');
    log('info', 'User is still in Firestore but not in Firebase Auth.');
    log('info', 'The frontend query might still show this user.');
  } else {
    log('error', 'DELETION FAILED ✗');
    log('error', 'User still exists in both systems.');
    log('info', 'Check server logs to see what went wrong.');
  }

  log('heading', '═══════════════════════════════════════════════════════════');

  // Additional troubleshooting info
  console.log(`\n${colors.bright}Troubleshooting Tips:${colors.reset}`);
  console.log('1. Check if API server is running: node API/server.js');
  console.log('2. Verify you are logged in as an admin user');
  console.log('3. Check server console for any error messages');
  console.log('4. Check Firebase Admin SDK credentials in server.js');
  console.log('5. Try with a different test user to isolate the issue');
}

// Run the test
runTest().catch(error => {
  log('error', `Unexpected error: ${error.message}`);
  process.exit(1);
});
