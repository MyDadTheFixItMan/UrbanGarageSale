#!/usr/bin/env node

/**
 * Validation Script for UrbanGarageSale Live Testing Setup
 * Checks that all required files and configurations are in place
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 UrbanGarageSale Live Testing Setup Validation\n');

const checks = [
  {
    name: 'Root package.json',
    file: 'package.json',
    check: (content) => content.includes('stripe') && content.includes('express')
  },
  {
    name: 'API Server',
    file: 'API/server.js',
    check: (content) => content.includes('createStripeCheckout') && content.includes('verifyStripePayment')
  },
  {
    name: 'Web App environment template',
    file: 'web-app/.env.example',
    check: (content) => content.includes('VITE_STRIPE_PUBLIC_KEY')
  },
  {
    name: 'UrbanGarageSale Client configuration',
    file: 'web-app/src/api/firebaseClient.js',
    check: (content) => content.includes('VITE_API_BASE_URL') && !content.includes('mock_session')
  },
  {
    name: 'Documentation - Quick Start',
    file: 'GETTING_STARTED.md',
    check: (content) => content.includes('Quick Start')
  },
  {
    name: 'Documentation - Live Setup',
    file: 'LIVE_TESTING_SETUP.md',
    check: (content) => content.includes('Live Testing Setup')
  },
  {
    name: 'Environment template',
    file: '.env.example',
    check: (content) => content.includes('STRIPE_SECRET_KEY')
  }
];

let passed = 0;
let failed = 0;

checks.forEach(({ name, file, check }) => {
  try {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (check(content)) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`⚠️  ${name} - Content check failed`);
        failed++;
      }
    } else {
      console.log(`❌ ${name} - File not found`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error.message}`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('✨ All checks passed! Ready for live testing.\n');
  console.log('Next steps:');
  console.log('1. Edit .env with your STRIPE_SECRET_KEY');
  console.log('2. Edit web-app/.env.local with your VITE_STRIPE_PUBLIC_KEY');
  console.log('3. Run: npm run dev:api (Terminal 1)');
  console.log('4. Run: npm run dev:web (Terminal 2)\n');
} else {
  console.log('⚠️  Some checks failed. Please review the output above.\n');
}
