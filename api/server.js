// Local development server for the Vercel API functions in this folder.
// Serves each handler at the same path Vercel does (e.g. /api/urbanPayment/recordSale).
// Run with: npm run dev:api

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
];

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));

// Route path -> handler module (relative to this folder)
const routes = {
  '/api/setUserClaims': './setUserClaims.ts',
  '/api/stripeTerminal/createConnectionToken': './stripeTerminal/createConnectionToken.js',
  '/api/urbanPayment/createPaymentIntent': './urbanPayment/createPaymentIntent.js',
  '/api/urbanPayment/recordSale': './urbanPayment/recordSale.js',
  '/api/urbanPayment/recordTapToPaySale': './urbanPayment/recordTapToPaySale.js',
  '/api/urbanPayment/initializeTapToPayReader': './urbanPayment/initializeTapToPayReader.js',
  '/api/urbanPayment/enableStripeConnect': './urbanPayment/enableStripeConnect.js',
  '/api/urbanPayment/verifyStripeConnectStatus': './urbanPayment/verifyStripeConnectStatus.js',
  '/api/urbanPayment/initiateStripeOAuth': './urbanPayment/initiateStripeOAuth.js',
  '/api/urbanPayment/handleStripeOAuthCallback': './urbanPayment/handleStripeOAuthCallback.js',
};

for (const [route, modulePath] of Object.entries(routes)) {
  app.all(route, async (req, res) => {
    try {
      const { default: handler } = await import(pathToFileURL(join(__dirname, modulePath)).href);
      await handler(req, res);
    } catch (err) {
      console.error(`${route} failed:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

app.listen(PORT, () => {
  console.log(`Urban Garage Sale API running at http://localhost:${PORT}`);
  console.log('Routes:\n  ' + Object.keys(routes).join('\n  '));
});
