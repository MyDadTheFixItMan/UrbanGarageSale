// Development API server for Urban Garage Sale
// Serves API functions locally on port 3000
// Run with: node API/server.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config({ path: './API/.env' });
dotenv.config({ path: './.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('   Headers:', Object.keys(req.headers).join(', '));
  console.log('   Body:', JSON.stringify(req.body).substring(0, 200));
  
  // Log response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    console.log(`   Response: ${res.statusCode} (${duration}ms)`);
    console.log('   Data:', JSON.stringify(data).substring(0, 200));
    return originalJson.call(this, data);
  };
  
  next();
});

// Import API handlers
let createStripeCheckoutHandler;
let enableStripeConnectHandler;
let linkExistingStripeAccountHandler;
let verifyStripeConnectStatusHandler;
let initiateStripeOAuthHandler;
let handleStripeOAuthCallbackHandler;

// Load handlers asynchronously
(async () => {
  try {
    console.log('Loading createStripeCheckout handler...');
    const module = await import('./urbanPayment/createStripeCheckout.js');
    createStripeCheckoutHandler = module.default;
    console.log('✅ createStripeCheckout handler loaded');
  } catch (err) {
    console.error('❌ Could not load createStripeCheckout handler:', err.message);
    console.error('   Stack:', err.stack);
  }

  try {
    console.log('Loading enableStripeConnect handler...');
    const module = await import('./urbanPayment/enableStripeConnect.js');
    enableStripeConnectHandler = module.default;
    console.log('✅ enableStripeConnect handler loaded');
  } catch (err) {
    console.error('❌ Could not load enableStripeConnect handler:', err.message);
    console.error('   Stack:', err.stack);
  }

  try {
    console.log('Loading linkExistingStripeAccount handler...');
    const module = await import('./urbanPayment/linkExistingStripeAccount.js');
    linkExistingStripeAccountHandler = module.default;
    console.log('✅ linkExistingStripeAccount handler loaded');
  } catch (err) {
    console.error('❌ Could not load linkExistingStripeAccount handler:', err.message);
    console.error('   Stack:', err.stack);
  }

  try {
    console.log('Loading verifyStripeConnectStatus handler...');
    const module = await import('./urbanPayment/verifyStripeConnectStatus.js');
    verifyStripeConnectStatusHandler = module.default;
    console.log('✅ verifyStripeConnectStatus handler loaded');
  } catch (err) {
    console.error('❌ Could not load verifyStripeConnectStatus handler:', err.message);
    console.error('   Stack:', err.stack);
  }

  try {
    console.log('Loading initiateStripeOAuth handler...');
    const module = await import('./urbanPayment/initiateStripeOAuth.js');
    initiateStripeOAuthHandler = module.default;
    console.log('✅ initiateStripeOAuth handler loaded');
  } catch (err) {
    console.error('❌ Could not load initiateStripeOAuth handler:', err.message);
    console.error('   Stack:', err.stack);
  }

  try {
    console.log('Loading handleStripeOAuthCallback handler...');
    const module = await import('./urbanPayment/handleStripeOAuthCallback.js');
    handleStripeOAuthCallbackHandler = module.default;
    console.log('✅ handleStripeOAuthCallback handler loaded');
  } catch (err) {
    console.error('❌ Could not load handleStripeOAuthCallback handler:', err.message);
    console.error('   Stack:', err.stack);
  }
})();

// CORS preflight handlers for all routes
app.options('*', cors());

// API Routes - Always register routes, check handler at request time
app.post('/createStripeCheckout', async (req, res) => {
  if (!createStripeCheckoutHandler) {
    return res.status(503).json({ error: 'Handler not loaded yet, try again' });
  }
  console.log('🔗 POST /createStripeCheckout route handler called');
  try {
    await createStripeCheckoutHandler(req, res);
  } catch (err) {
    console.error('❌ Handler error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/enableStripeConnect', async (req, res) => {
  if (!enableStripeConnectHandler) {
    return res.status(503).json({ error: 'Handler not loaded yet, try again' });
  }
  console.log('🔗 POST /enableStripeConnect route handler called');
  try {
    await enableStripeConnectHandler(req, res);
  } catch (err) {
    console.error('❌ Handler error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/linkExistingStripeAccount', async (req, res) => {
  if (!linkExistingStripeAccountHandler) {
    return res.status(503).json({ error: 'Handler not loaded yet, try again' });
  }
  console.log('🔗 POST /linkExistingStripeAccount route handler called');
  try {
    await linkExistingStripeAccountHandler(req, res);
  } catch (err) {
    console.error('❌ Handler error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/verifyStripeConnectStatus', async (req, res) => {
  if (!verifyStripeConnectStatusHandler) {
    return res.status(503).json({ error: 'Handler not loaded yet, try again' });
  }
  console.log('🔗 POST /verifyStripeConnectStatus route handler called');
  try {
    await verifyStripeConnectStatusHandler(req, res);
  } catch (err) {
    console.error('❌ Handler error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/initiateStripeOAuth', async (req, res) => {
  if (!initiateStripeOAuthHandler) {
    return res.status(503).json({ error: 'Handler not loaded yet, try again' });
  }
  console.log('🔗 POST /initiateStripeOAuth route handler called');
  try {
    await initiateStripeOAuthHandler(req, res);
  } catch (err) {
    console.error('❌ Handler error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/handleStripeOAuthCallback', async (req, res) => {
  if (!handleStripeOAuthCallbackHandler) {
    return res.status(503).json({ error: 'Handler not loaded yet, try again' });
  }
  console.log('🔗 POST /handleStripeOAuthCallback route handler called');
  try {
    await handleStripeOAuthCallbackHandler(req, res);
  } catch (err) {
    console.error('❌ Handler error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('🏥 Health check');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    stripe: process.env.STRIPE_SECRET_KEY ? '✅ configured' : '❌ not configured',
    firebase: process.env.FIREBASE_PROJECT_ID ? '✅ configured' : '❌ not configured',
  });
});

// 404 handler
app.use((req, res) => {
  console.log('❌ 404 - Endpoint not found');
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  console.error('   Stack:', err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Urban Garage Sale API Server running on http://localhost:${PORT}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📌 Environment:`);
  console.log(`   Node Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Firebase: ${process.env.FIREBASE_PROJECT_ID || 'NOT SET'}`);
  console.log(`   Stripe: ${process.env.STRIPE_SECRET_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5174'}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📚 Available endpoints:`);
  console.log(`   POST /createStripeCheckout`);
  console.log(`   POST /enableStripeConnect`);
  console.log(`   POST /linkExistingStripeAccount`);
  console.log(`   GET  /health`);
  console.log(`${'='.repeat(60)}\n`);
});
