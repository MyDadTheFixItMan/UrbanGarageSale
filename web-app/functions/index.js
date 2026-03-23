const functions = require('firebase-functions');
const Stripe = require('stripe');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

admin.initializeApp();

// Get Stripe API key from environment
let stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('❌ WARNING: STRIPE_SECRET_KEY not set in environment'); 
  console.error('Set via: firebase functions:config:set stripe.secret_key="sk_test_..."');
}

const stripe = new Stripe(stripeSecretKey);

// Initialize SendGrid
const sendgridApiKey = process.env.SENDGRID_API_KEY;
if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
  console.log('✓ SendGrid initialized');
} else {
  console.warn('⚠️ SENDGRID_API_KEY not set. Email sending will be disabled.');
  console.warn('Set via: set SENDGRID_API_KEY=... or firebase functions:config:set sendgrid.api_key="..."');
}

// Create Stripe Checkout
exports.createStripeCheckout = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { saleId, saleTitle } = data;

    if (!saleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Sale ID is required');
    }

    try {
        // Get user data
        const user = await admin.auth().getUser(context.auth.uid);
        
        // For onCall functions, use a reasonable default for origin
        const origin = process.env.APP_URL || 'http://localhost:5174';

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'aud',
                        product_data: {
                            name: saleTitle || 'Garage Sale Listing',
                            description: 'List your garage sale on UrbanGarageSale',
                        },
                        unit_amount: 1000, // $10 AUD in cents
                    },
                    quantity: 1,
                },
            ],
            customer_email: user.email,
            success_url: `${origin}/Payment?id=${saleId}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/CreateListing?edit=${saleId}`,
            metadata: {
                sale_id: saleId,
                user_email: user.email,
            },
            payment_intent_data: {
                metadata: {
                    sale_id: saleId,
                    sale_title: saleTitle || 'Garage Sale Listing',
                },
            },
        });

        return { url: session.url };
    } catch (error) {
        console.error('Stripe checkout error:', error);
        
        // Format Stripe errors nicely
        if (error.type) {
            throw new functions.https.HttpsError('internal', `Stripe error: ${error.message}`);
        }
        throw new functions.https.HttpsError('internal', error.message || 'Failed to create checkout session');
    }
});

// Verify Stripe Payment
exports.verifyStripePayment = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { sessionId, saleId } = data;

    if (!sessionId || !saleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing sessionId or saleId');
    }

    try {
        const user = await admin.auth().getUser(context.auth.uid);

        // Retrieve the checkout session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            throw new functions.https.HttpsError('failed-precondition', 'Payment not completed');
        }

        // Create payment record in Firestore
        await admin.firestore().collection('payments').add({
            garage_sale_id: saleId,
            user_email: user.email,
            amount: 10,
            status: 'completed',
            payment_method: 'stripe',
            transaction_id: session.payment_intent,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update sale status
        await admin.firestore().collection('garageSales').doc(saleId).update({
            status: 'pending_approval',
            payment_status: 'paid',
        });

        return { success: true };
    } catch (error) {
        console.error('Payment verification error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to verify payment');
    }
});

// Send Approval Email
exports.sendApprovalEmail = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { saleId, userEmail, saleTitle } = data;

    if (!saleId || !userEmail) {
        throw new functions.https.HttpsError('invalid-argument', 'saleId and userEmail are required');
    }

    try {
        // If SendGrid is configured, send real email
        if (sendgridApiKey) {
            const emailContent = `
                <h2>Your listing has been approved!</h2>
                <p>Great news! Your garage sale listing "<strong>${saleTitle}</strong>" has been approved and is now live on UrbanGarageSale.</p>
                <p>You can view your listing and manage it from your profile dashboard.</p>
                <p>Happy selling!</p>
                <hr>
                <p><small>This is an automated message from UrbanGarageSale. Please do not reply to this email.</small></p>
            `;

            const msg = {
                to: userEmail,
                from: process.env.SENDGRID_FROM_EMAIL || 'noreply@urbangaragesale.com.au',
                subject: `Your listing "${saleTitle}" has been approved!`,
                html: emailContent,
            };

            await sgMail.send(msg);
            console.log(`✓ Approval email sent to ${userEmail} for sale: ${saleTitle} (ID: ${saleId})`);
        } else {
            // Fallback: just log if SendGrid not configured
            console.log(`⚠️ Email not sent (SendGrid not configured). Would send to ${userEmail}: ${saleTitle}`);
        }

        return { success: true, message: 'Approval notification sent' };
    } catch (error) {
        console.error('Approval email error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to send approval email');
    }
});
