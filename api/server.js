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
try {
  console.log('Loading createStripeCheckout handler...');
  const module = await import('./urbanPayment/createStripeCheckout.js');
  createStripeCheckoutHandler = module.default;
  console.log('✅ createStripeCheckout handler loaded');
} catch (err) {
  console.error('❌ Could not load createStripeCheckout handler:', err.message);
  console.error('   Stack:', err.stack);
}

// API Routes
if (createStripeCheckoutHandler) {
  app.post('/createStripeCheckout', async (req, res) => {
    console.log('🔗 POST /createStripeCheckout route handler called');
    try {
      await createStripeCheckoutHandler(req, res);
    } catch (err) {
      console.error('❌ Handler error:', err);
      res.status(500).json({ error: err.message });
    }
  });
} else {
  console.warn('⚠️  createStripeCheckout handler not loaded - endpoint will not work');
}

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
  console.log(`   GET  /health`);
  console.log(`${'='.repeat(60)}\n`);
});
