#!/usr/bin/env node

/**
 * Local API server for testing
 * Provides mock endpoints for development
 * 
 * Usage: node API/server.js
 * Runs on http://localhost:3000
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import sgMail from '@sendgrid/mail';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
console.log(`📁 Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });
console.log(`🔑 SENDGRID_API_KEY loaded: ${process.env.SENDGRID_API_KEY ? '✓ YES' : '✗ NO'}`);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Stripe safely
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('✓ Stripe initialized');
  } else {
    console.warn('⚠️  Stripe secret key not found - running in mock mode');
  }
} catch (error) {
  console.warn('⚠️  Stripe initialization failed:', error.message);
}

// Initialize Firebase Admin
let db, auth;
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    console.log('✓ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('⚠️  Firebase initialization warning:', error.message);
  }
}

if (admin.apps.length > 0) {
  db = admin.firestore();
  auth = admin.auth();
} else {
  console.warn('⚠️  Firebase not available - running in mock mode');
}

// SendGrid configuration
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✓ SendGrid configured');
} else {
  console.warn('⚠️  SendGrid API key not found - email functionality disabled');
}

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security headers
app.use(helmet());

// Rate limiting - protect against DDoS and brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Create Stripe Checkout Session
 * POST /createStripeCheckout
 */
app.post('/createStripeCheckout', async (req, res) => {
  try {
    const { saleId, saleTitle } = req.body;
    if (!saleId) {
      return res.status(400).json({ error: 'Sale ID is required' });
    }

    // Create Stripe checkout session with dynamic price
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: saleTitle || 'Garage Sale Listing',
              description: 'Publish your garage sale listing',
            },
            unit_amount: 1000, // $10.00 in cents
          },
          quantity: 1,
        },
      ],
      success_url: `${req.get('origin') || 'http://localhost:5173'}/Payment?id=${saleId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.get('origin') || 'http://localhost:5173'}/CreateListing?edit=${saleId}`,
      metadata: {
        urbangaragesale_app_id: process.env.URBANGARAGESALE_APP_ID || 'urbangarageSale-dev',
        sale_id: saleId,
        sale_title: saleTitle || 'Garage Sale Listing',
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify Stripe Payment
 * POST /verifyStripePayment
 */
app.post('/verifyStripePayment', async (req, res) => {
  try {
    const { sessionId, saleId } = req.body;
    if (!sessionId || !saleId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      res.json({
        success: true,
        message: 'Payment verified successfully',
        sessionId: sessionId,
        paymentStatus: session.payment_status,
      });
    } else {
      res.json({
        success: false,
        message: 'Payment not completed',
        sessionId: sessionId,
        paymentStatus: session.payment_status,
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send Listing Approval Email
 * POST /sendApprovalEmail
 */
app.post('/sendApprovalEmail', async (req, res) => {
  try {
    const { userEmail, listingTitle } = req.body;
    
    if (!userEmail || !listingTitle) {
      return res.status(400).json({ error: 'Missing required parameters: userEmail, listingTitle' });
    }

    // Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️  SendGrid API key not configured. Skipping email send.');
      return res.json({
        success: true,
        message: 'Email service not configured (development mode)',
        simulatedEmail: userEmail,
      });
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="en" style="margin:0; padding:0;">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0; padding:0; background:#F7F7F7; font-family:'Segoe UI', Arial, sans-serif;">

    <!-- Outer Container -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F7; padding:20px 0;">
      <tr>
        <td align="center" style="padding:20px;">

          <!-- Email Card -->
          <table width="100%" style="max-width:600px; background:#FFFFFF; border-collapse:collapse; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">

            <!-- Header with branded background -->
            <tr>
              <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a8c 100%); padding:40px 20px; text-align:center;">
                <!-- Logo Badge -->
                <table cellpadding="0" cellspacing="0" style="margin:0 auto 16px; background:#FF6A00; border-radius:8px; border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px 14px; text-align:center;">
                      <span style="font-size:26px; font-weight:bold; color:#FFFFFF;">UGS</span>
                    </td>
                  </tr>
                </table>
                
                <h1 style="margin:0 0 4px 0; color:#FFFFFF; font-size:32px; font-weight:700;">Urban Garage Sale</h1>
                <p style="margin:0; color:rgba(255,255,255,0.85); font-size:13px;">Find & List Garage Sales Locally</p>
              </td>
            </tr>

            <!-- Success Banner -->
            <tr>
              <td style="background: linear-gradient(to right, #FF6A00 0%, #FF8C2F 100%); padding:36px 20px; text-align:center; color:#FFFFFF;">
                <div style="font-size:48px; margin-bottom:12px; line-height:1;">✓</div>
                <h2 style="margin:0 0 6px 0; font-size:28px; font-weight:700;">Listing Approved!</h2>
                <p style="margin:0; font-size:14px; opacity:0.95;">Your garage sale is now live</p>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td style="padding:36px 28px; color:#2C3E50; font-size:15px; line-height:1.65;">
                <p style="margin:0 0 16px 0; font-size:16px;">Hi there,</p>

                <p style="margin:0 0 16px 0;">Great news! Your garage sale listing</p>
                
                <!-- Listing Title Box -->
                <table width="100%" cellpadding="14" cellspacing="0" style="background:#FFF5E6; border-left:4px solid #FF6A00; margin:0 0 16px 0; border-collapse:collapse;">
                  <tr>
                    <td style="color:#FF6A00; font-size:16px; font-weight:600;">
                      "${listingTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 16px 0;">has been <strong>approved and is now live</strong> on Urban Garage Sale! 🎉</p>

                <p style="margin:0 0 20px 0; color:#666666; font-size:14px;">Your listing is now visible to shoppers in your area searching for great garage sales. Start receiving inquiries and build your community.</p>

                <!-- CTA Button -->
                <table cellpadding="0" cellspacing="0" style="margin:28px 0; width:100%; border-collapse:collapse;">
                  <tr>
                    <td align="center">
                      <a href="http://localhost:5173/" 
                         style="background: linear-gradient(to right, #FF6A00, #FF8C2F); color:#FFFFFF; padding:14px 36px; border-radius:6px; text-decoration:none; font-weight:600; font-size:15px; display:inline-block;">
                        View Your Listing →
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Tips Section -->
                <table width="100%" cellpadding="16" cellspacing="0" style="background:#F0F7FF; border-left:4px solid #1e3a5f; margin:24px 0; border-collapse:collapse;">
                  <tr>
                    <td style="color:#1e3a5f;">
                      <p style="margin:0 0 10px 0; font-weight:600; font-size:14px;">💡 Quick Tips:</p>
                      <ul style="margin:0; padding-left:20px; color:#555555; font-size:13px;">
                        <li style="margin-bottom:6px;">Respond quickly to buyer inquiries</li>
                        <li style="margin-bottom:6px;">Post clear photos and descriptions</li>
                        <li style="margin-bottom:0;">Update your listing if details change</li>
                      </ul>
                    </td>
                  </tr>
                </table>

                <p style="margin:20px 0 0 0; color:#666666; font-size:14px;">Thank you for being part of the Urban Garage Sale community. Happy selling!</p>
                <p style="margin:12px 0 0 0; color:#1A1A1A; font-size:15px;">Warm regards,<br><strong>The Urban Garage Sale Team</strong></p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#1e3a5f; padding:28px 20px; text-align:center; color:#FFFFFF; font-size:12px; border-top:2px solid #FF6A00;">
                <p style="margin:0 0 8px 0; font-weight:600; font-size:14px;">Urban Garage Sale</p>
                <p style="margin:0 0 6px 0; color:rgba(255,255,255,0.7); font-size:11px;">© ${new Date().getFullYear()} Urban Garage Sale. All rights reserved.</p>
                <p style="margin:0; color:rgba(255,255,255,0.6); font-size:11px;">Find & list garage sales in your community</p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
</html>
`;

    const msg = {
      to: userEmail,
      from: 'notification@urbangaragesales.com.au',
      subject: `✅ Your listing "${listingTitle}" has been approved!`,
      html: htmlContent,
    };

    console.log('📧 Attempting to send email:', {
      to: userEmail,
      from: 'notification@urbangaragesales.com.au',
      subject: `✅ Your listing "${listingTitle}" has been approved!`,
      timestamp: new Date().toISOString()
    });

    await sgMail.send(msg);
    
    console.log(`✉️  Approval email sent to ${userEmail}`);
    res.json({
      success: true,
      message: 'Approval email sent successfully',
      emailSent: userEmail,
    });
  } catch (error) {
    console.error('Email sending error:', error);
    // Don't fail the approval if email fails
    res.json({
      success: true,
      message: 'Listing approved but email could not be sent',
      error: error.message,
    });
  }
});

/**
 * Delete User (Admin only)
 * POST /deleteUser
 * Body: { userId }
 * Headers: Authorization: Bearer <firebaseIdToken>
 */
app.post('/deleteUser', async (req, res) => {
  try {
    if (!auth || !db) {
      return res.status(503).json({ error: 'Firebase service unavailable' });
    }
    
    const { userId } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - missing token' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    try {
      // Verify token and get current user
      const token = authHeader.substring(7);
      const decodedToken = await auth.verifyIdToken(token);

      // Check if requesting user is admin
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      const requestingUser = userDoc.data();

      if (requestingUser?.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can delete users' });
      }

      // Delete Firebase Auth user
      await auth.deleteUser(userId);

      // Delete Firestore user document
      await db.collection('users').doc(userId).delete();

      console.log(`✓ User ${userId} deleted successfully by admin ${decodedToken.email}`);
      return res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (authError) {
      if (authError.code === 'auth/user-not-found') {
        // User might already be deleted from Auth, try to delete from Firestore
        await db.collection('users').doc(userId).delete();
        return res.json({
          success: true,
          message: 'User removed from database',
        });
      }
      throw authError;
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      error: error.message || 'Failed to delete user',
    });
  }
});

/**
 * Send contact message response email
 */
app.post('/sendContactResponseEmail', async (req, res) => {
  try {
    const { userEmail, userName, originalMessage, responseMessage } = req.body;
    
    if (!userEmail || !responseMessage) {
      return res.status(400).json({ error: 'Missing required parameters: userEmail, responseMessage' });
    }

    // Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️  SendGrid API key not configured. Skipping email send.');
      return res.json({
        success: true,
        message: 'Email service not configured (development mode)',
        simulatedEmail: userEmail,
      });
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1e3a5f; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
          <h1 style="color: white; margin: 0;">📬 You Have a Response!</h1>
        </div>
        <div style="background-color: #f5f1e8; padding: 30px; border-radius: 0 0 5px 5px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Hi ${userName || 'there'},
          </p>
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Thank you for contacting Urban Garage Sale! We've received your message and our team has responded.
          </p>
          
          <div style="background-color: white; padding: 15px; border-left: 4px solid #FF9500; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;"><strong>Your Message:</strong></p>
            <p style="margin: 0; color: #333; font-size: 14px; white-space: pre-wrap;">${originalMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          </div>

          <div style="background-color: #e8f4f8; padding: 15px; border-left: 4px solid #1e3a5f; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; color: #333; font-size: 14px;"><strong>Our Response:</strong></p>
            <p style="margin: 0; color: #333; font-size: 14px; white-space: pre-wrap;">${responseMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          </div>

          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            If you have any follow-up questions, feel free to contact us again.<br>
            <a href="http://localhost:5173" style="color: #FF9500; text-decoration: none;">Visit Urban Garage Sale</a>
          </p>
        </div>
        <div style="text-align: center; padding: 15px; font-size: 12px; color: #999;">
          <p>Urban Garage Sale</p>
        </div>
      </div>
    `;

    const msg = {
      to: userEmail,
      from: 'notification@urbangaragesales.com.au',
      subject: `Re: Your Urban Garage Sale Inquiry`,
      html: htmlContent,
    };

    await sgMail.send(msg);
    
    console.log(`✉️  Contact response email sent to ${userEmail}`);
    res.json({
      success: true,
      message: 'Response email sent successfully',
      emailSent: userEmail,
    });
  } catch (error) {
    console.error('Email sending error:', error);
    // Don't fail the response if email fails
    res.json({
      success: true,
      message: 'Response saved but email could not be sent',
      error: error.message,
    });
  }
});

/**
 * Get Principal Coordinates (Geocode location)
 * POST /getPrincipalCoordinates
 * Converts suburb/postcode to latitude/longitude for search
 * Uses Nominatim (OpenStreetMap) API with Firestore caching
 */
app.post('/getPrincipalCoordinates', async (req, res) => {
  try {
    const { locationQuery, country = 'Australia' } = req.body;
    
    if (!locationQuery) {
      return res.status(400).json({ error: 'Location query is required' });
    }

    console.log(`📍 Geocoding: "${locationQuery}" in ${country}`);

    // Step 1: Check Firestore cache first
    if (db) {
      try {
        const cacheRef = db.collection('postcode_cache').doc(locationQuery.toLowerCase().trim());
        const cachedDoc = await cacheRef.get();
        
        if (cachedDoc.exists) {
          const cached = cachedDoc.data();
          console.log(`✓ Found cached coordinates for "${locationQuery}"`);
          return res.json({
            success: true,
            latitude: cached.latitude,
            longitude: cached.longitude,
            name: cached.name,
            cached: true,
          });
        }
      } catch (cacheError) {
        console.warn('⚠️  Cache lookup error (will continue with API call):', cacheError.message);
      }
    }

    // Step 2: Call Nominatim API (free, no API key needed)
    console.log(`📡 Calling Nominatim API for "${locationQuery}"...`);
    const searchQuery = `${locationQuery}, ${country}`;
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&addressdetails=1&format=json`;
    
    const nominatimResponse = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'UrbanGarageSale/1.0 (+http://localhost:3000)'
      }
    });

    if (!nominatimResponse.ok) {
      console.error(`❌ Nominatim API error: ${nominatimResponse.status}`);
      return res.status(503).json({ error: 'Geocoding service temporarily unavailable' });
    }

    const results = await nominatimResponse.json();
    
    if (!results || results.length === 0) {
      console.log(`✗ No results found for "${locationQuery}"`);
      return res.status(404).json({
        success: false,
        error: `Location "${locationQuery}" not found`,
        suggestion: 'Try a different postcode or suburb name'
      });
    }

    // Use the first result (most relevant)
    const result = results[0];
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);
    const name = result.address?.suburb || result.address?.town || result.address?.village || result.display_name?.split(',')[0] || locationQuery;

    console.log(`✓ Found coordinates via Nominatim: ${name} at lat=${latitude}, lng=${longitude}`);

    // Step 3: Cache the result in Firestore for future use
    if (db) {
      try {
        await db.collection('postcode_cache').doc(locationQuery.toLowerCase().trim()).set({
          query: locationQuery,
          name: name,
          latitude: latitude,
          longitude: longitude,
          cached_at: new Date(),
        }, { merge: true });
        console.log(`💾 Cached coordinates for "${locationQuery}"`);
      } catch (cacheError) {
        console.warn('⚠️  Failed to cache result:', cacheError.message);
        // Don't fail the response if caching fails
      }
    }

    res.json({
      success: true,
      latitude: latitude,
      longitude: longitude,
      name: name,
      cached: false,
    });

  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({
      error: 'Geocoding failed',
      message: error.message,
    });
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n🚀 UrbanGarageSale API Server running at http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /createStripeCheckout        - Create Stripe payment session`);
  console.log(`  POST /verifyStripePayment         - Verify Stripe payment`);
  console.log(`  POST /sendApprovalEmail           - Send listing approval email`);
  console.log(`  POST /sendContactResponseEmail    - Send contact message response email`);
  console.log(`  POST /getPrincipalCoordinates     - Geocode suburb/postcode to coordinates`);
  console.log(`  POST /deleteUser                  - Delete user (admin only)`);
  console.log(`  GET  /health                      - Health check`);
  console.log(`\nStripe Setup:`);
  console.log(`  ✓ Secret Key: ${stripe ? '✓ Configured' : '✗ Missing'}`);
  console.log(`\nEmail Setup:`);
  console.log(`  ✓ Service: ${process.env.SENDGRID_API_KEY ? '✓ Configured' : '✗ Not configured (approval emails will be logged only)'}`);
  console.log(`  ✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});