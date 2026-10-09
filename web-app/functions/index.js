// 1st-gen function API (onCall(data, context)); the package root is the 2nd-gen API since v6.
const functions = require('firebase-functions/v1');
const Stripe = require('stripe');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const sgMail = require('@sendgrid/mail');

initializeApp();
const db = getFirestore();
const auth = getAuth();

// Secrets live in Google Secret Manager (firebase functions:secrets:set NAME) and are only
// exposed to the functions that declare them with withSecrets() below.
const withSecrets = (...names) => functions.runWith({ secrets: names });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeSecretKey || 'sk_missing');

const sendgridApiKey = process.env.SENDGRID_API_KEY;
if (sendgridApiKey) {
    sgMail.setApiKey(sendgridApiKey);
}

// Listing fee in cents (AUD). Must match LISTING_FEE_AUD in web-app/src/lib/pricing.js.
const LISTING_FEE_CENTS = 1000;
// Public URL of the web app, used for Stripe redirects and email links (e.g. https://urbangaragesales.com.au).
const APP_URL = process.env.APP_URL;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'notification@urbangaragesales.com.au';
const BUSINESS_FOOTER = 'Urban Garage Sale · urbangaragesales.com.au · support@urbangaragesales.com.au';

function requireAuth(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    return context.auth;
}

// Admin actions need a session that passed the SMS second factor, not just a password.
async function requireAdmin(context) {
    const { uid, token } = requireAuth(context);
    if (!token?.firebase?.sign_in_second_factor) {
        throw new functions.https.HttpsError('permission-denied', 'Sign in with two-factor authentication to use admin features');
    }
    const snap = await db.collection('users').doc(uid).get();
    if (snap.data()?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    return uid;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function getOwnedListing(saleId, uid) {
    if (typeof saleId !== 'string' || !saleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Sale ID is required');
    }
    const snap = await db.collection('garageSales').doc(saleId).get();
    if (!snap.exists || snap.data().user_id !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Listing not found');
    }
    return snap;
}

// Marks a listing paid from a completed Checkout session. Idempotent: the payment record
// is keyed by the Checkout session ID, so verifying twice (or via webhook) changes nothing.
async function recordListingPayment(session) {
    const saleId = session.metadata?.sale_id;
    const userId = session.metadata?.user_id;
    if (!saleId || !userId || session.payment_status !== 'paid') {
        return false;
    }

    const paymentRef = db.collection('payments').doc(session.id);
    const listingRef = db.collection('garageSales').doc(saleId);

    await db.runTransaction(async (tx) => {
        const [payment, listing] = await Promise.all([tx.get(paymentRef), tx.get(listingRef)]);
        if (payment.exists) return;

        tx.set(paymentRef, {
            garage_sale_id: saleId,
            user_id: userId,
            user_email: session.customer_details?.email || session.customer_email || null,
            amount: (session.amount_total || 0) / 100,
            currency: (session.currency || 'aud').toUpperCase(),
            status: 'completed',
            payment_method: 'stripe',
            transaction_id: session.payment_intent,
            checkout_session_id: session.id,
            created_at: FieldValue.serverTimestamp(),
        });

        if (listing.exists && listing.data().user_id === userId) {
            tx.update(listingRef, { status: 'pending_approval', payment_status: 'paid' });
        }
    });
    return true;
}

// Create Stripe Checkout for the listing fee
exports.createStripeCheckout = withSecrets('STRIPE_SECRET_KEY').https.onCall(async (data, context) => {
    const { uid } = requireAuth(context);
    const listing = await getOwnedListing(data?.saleId, uid);
    const listingData = listing.data();

    if (!APP_URL) {
        throw new functions.https.HttpsError('failed-precondition', 'APP_URL is not configured');
    }
    if (listingData.payment_status === 'paid' || listingData.payment_status === 'completed') {
        throw new functions.https.HttpsError('failed-precondition', 'This listing has already been paid for');
    }

    try {
        const user = await auth.getUser(uid);
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'aud',
                        product_data: {
                            name: `Garage sale listing: ${(listingData.title || 'Untitled').slice(0, 80)}`,
                            description: 'Publish your garage sale on Urban Garage Sale',
                        },
                        unit_amount: LISTING_FEE_CENTS,
                    },
                    quantity: 1,
                },
            ],
            customer_email: user.email,
            client_reference_id: listing.id,
            success_url: `${APP_URL}/Payment?id=${listing.id}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${APP_URL}/CreateListing?edit=${listing.id}`,
            metadata: { sale_id: listing.id, user_id: uid },
            payment_intent_data: {
                metadata: { sale_id: listing.id, user_id: uid },
            },
        });

        return { url: session.url };
    } catch (error) {
        console.error('Stripe checkout error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create checkout session');
    }
});

// Verify a completed Checkout session when the seller returns from Stripe
exports.verifyStripePayment = withSecrets('STRIPE_SECRET_KEY').https.onCall(async (data, context) => {
    const { uid } = requireAuth(context);
    const { sessionId, saleId } = data || {};

    if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_') || typeof saleId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Missing sessionId or saleId');
    }

    let session;
    try {
        session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
        throw new functions.https.HttpsError('not-found', 'Payment session not found');
    }

    // The session must have been created for this listing by this user.
    if (session.metadata?.sale_id !== saleId || session.metadata?.user_id !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'This payment does not match the listing');
    }
    if (session.payment_status !== 'paid') {
        return { success: false, message: 'Payment not completed' };
    }

    await recordListingPayment(session);
    return { success: true };
});

// Stripe webhook: records listing payments even if the seller closes the browser before
// returning to the site. Configure in Stripe for `checkout.session.completed`.
exports.stripeWebhook = withSecrets('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET').https.onRequest(async (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
        res.status(503).send('Webhook not configured');
        return;
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], secret);
    } catch (error) {
        res.status(400).send('Invalid signature');
        return;
    }

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        await recordListingPayment(event.data.object);
    }
    res.json({ received: true });
});

// Send listing-approved email (admin only)
exports.sendApprovalEmail = withSecrets('SENDGRID_API_KEY').https.onCall(async (data, context) => {
    await requireAdmin(context);

    const saleId = data?.saleId;
    if (typeof saleId !== 'string' || !saleId) {
        throw new functions.https.HttpsError('invalid-argument', 'saleId is required');
    }
    const listing = await db.collection('garageSales').doc(saleId).get();
    if (!listing.exists || !listing.data().user_id) {
        throw new functions.https.HttpsError('not-found', 'Listing not found');
    }
    // Listings don't store the seller's email (they are public); look it up from their account.
    const { user_id: sellerId, title } = listing.data();
    const userEmail = (await auth.getUser(sellerId).catch(() => null))?.email;
    if (!userEmail) {
        throw new functions.https.HttpsError('not-found', 'Seller has no email address');
    }

    if (!sendgridApiKey) {
        console.log(`⚠️ Email not sent (SendGrid not configured). Approval for listing ${saleId}`);
        return { success: true, message: 'Email service not configured' };
    }

    const safeTitle = escapeHtml(title || 'your listing');
    await sgMail.send({
        to: userEmail,
        from: FROM_EMAIL,
        subject: 'Your garage sale listing has been approved',
        html: `
            <h2>Your listing has been approved!</h2>
            <p>Great news! Your garage sale listing "<strong>${safeTitle}</strong>" is now live on Urban Garage Sale.</p>
            <p>You can view and manage it from your profile on Urban Garage Sale.</p>
            <hr>
            <p><small>You received this email because you listed a garage sale on Urban Garage Sale.<br>${BUSINESS_FOOTER}</small></p>
        `,
    });
    return { success: true, message: 'Approval notification sent' };
});

// Email a reply to a contact-form message (admin only)
exports.sendContactResponseEmail = withSecrets('SENDGRID_API_KEY').https.onCall(async (data, context) => {
    await requireAdmin(context);

    const { userEmail, userName, originalMessage, responseMessage } = data || {};
    if (typeof userEmail !== 'string' || !userEmail.includes('@') || typeof responseMessage !== 'string' || !responseMessage.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'userEmail and responseMessage are required');
    }

    if (!sendgridApiKey) {
        return { success: true, message: 'Email service not configured' };
    }

    await sgMail.send({
        to: userEmail,
        from: FROM_EMAIL,
        subject: 'Re: Your Urban Garage Sale enquiry',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <p>Hi ${escapeHtml(userName || 'there')},</p>
                <p>Thank you for contacting Urban Garage Sale. Our team has responded to your message.</p>
                <div style="background:#f5f1e8;padding:15px;border-left:4px solid #FF9500;margin:20px 0;">
                    <p style="margin:0 0 8px 0;"><strong>Your message:</strong></p>
                    <p style="margin:0;white-space:pre-wrap;">${escapeHtml(originalMessage)}</p>
                </div>
                <div style="background:#e8f4f8;padding:15px;border-left:4px solid #1e3a5f;margin:20px 0;">
                    <p style="margin:0 0 8px 0;"><strong>Our response:</strong></p>
                    <p style="margin:0;white-space:pre-wrap;">${escapeHtml(responseMessage)}</p>
                </div>
                <p style="font-size:12px;color:#666;">${BUSINESS_FOOTER}</p>
            </div>
        `,
    });
    return { success: true, message: 'Response email sent' };
});

async function deleteQueryInBatches(query) {
    let deleted = 0;
    for (;;) {
        const snap = await query.limit(400).get();
        if (snap.empty) return deleted;
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        deleted += snap.size;
    }
}

// Delete a user and their personal information (admin only).
// Payment records are kept for tax record-keeping but de-identified (APP 11.2 allows
// retention where required by law).
exports.deleteUser = functions.https.onCall(async (data, context) => {
    const adminUid = await requireAdmin(context);
    const userId = data?.userId;

    if (typeof userId !== 'string' || !userId) {
        throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }
    if (userId === adminUid) {
        throw new functions.https.HttpsError('failed-precondition', 'You cannot delete your own account here');
    }

    let email = null;
    try {
        email = (await auth.getUser(userId)).email || null;
        await auth.deleteUser(userId);
    } catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
    }

    const profile = await db.collection('users').doc(userId).get();
    email = email || profile.data()?.email || null;

    await deleteQueryInBatches(db.collection('garageSales').where('user_id', '==', userId));
    await deleteQueryInBatches(db.collection('savedListings').where('user_id', '==', userId));
    await deleteQueryInBatches(db.collection('sales').where('sellerId', '==', userId));
    await deleteQueryInBatches(db.collection('saleStats').where('sellerId', '==', userId));
    if (email) {
        await deleteQueryInBatches(db.collection('contactMessages').where('email', '==', email));
    }

    const payments = await db.collection('payments').where('user_id', '==', userId).get();
    const batch = db.batch();
    payments.docs.forEach((doc) => batch.update(doc.ref, { user_id: 'deleted-user', user_email: null }));
    batch.delete(db.collection('sellerStats').doc(userId));
    batch.delete(db.collection('users').doc(userId));
    await batch.commit();

    console.log(`✓ User ${userId} and personal data deleted by admin ${adminUid}`);
    return { success: true, message: 'User deleted successfully' };
});

// ---------------------------------------------------------------------------
// Monitoring
// Errors are written in Google Cloud Error Reporting's format, so they are grouped there and
// (with notifications on) emailed to the project owners when a new kind of error appears.
// ---------------------------------------------------------------------------

const ERROR_EVENT_TYPE = 'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent';
const REPORT_SOURCES = ['web-app', 'urban-pay-api'];
const REPORT_ORIGINS = ['https://urbangaragesales.com.au', 'https://www.urbangaragesales.com.au'];

function logReportedError(service, message, context = {}) {
    functions.logger.write({
        severity: 'ERROR',
        '@type': ERROR_EVENT_TYPE,
        serviceContext: { service },
        message,
        context,
    });
}

// Crude per-instance flood guard: a public endpoint must not be usable to fill the logs.
let reportWindowStart = 0;
let reportsInWindow = 0;
function reportAllowed() {
    const now = Date.now();
    if (now - reportWindowStart > 60000) {
        reportWindowStart = now;
        reportsInWindow = 0;
    }
    reportsInWindow++;
    return reportsInWindow <= 60;
}

// Receives error reports from the website (browser) and the Urban Pay API (server).
exports.reportClientError = functions.https.onRequest((req, res) => {
    const origin = req.get('origin');
    if (origin && REPORT_ORIGINS.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST' || (req.rawBody && req.rawBody.length > 16384) || !reportAllowed()) {
        res.status(400).send('');
        return;
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
    const text = (value, max) => String(value ?? '').slice(0, max);
    const source = REPORT_SOURCES.includes(body?.source) ? body.source : 'unknown';
    const message = text(body?.stack, 4000) || text(body?.message, 500) || 'Unknown error';

    // Error Reporting needs a stack trace in `message`; an empty reportLocation makes it drop
    // the entry, so the React component trail is appended to the message instead.
    const componentStack = text(body?.componentStack, 2000);
    logReportedError(source, componentStack ? `${message}\n\nReact component stack:${componentStack}` : message, {
        httpRequest: { url: text(body?.url, 300), userAgent: text(body?.userAgent, 300) },
    });
    res.status(204).send('');
});

// Uptime check every 10 minutes: the website loads, the API answers, and the API still refuses
// requests without a login. A failure is logged as an error, which Error Reporting emails out.
exports.healthCheck = functions.pubsub.schedule('every 10 minutes').timeZone('Australia/Melbourne').onRun(async () => {
    const checks = [
        { name: 'Website home page', url: 'https://www.urbangaragesales.com.au/', method: 'GET', expect: 200 },
        { name: 'Urban Pay API health', url: 'https://urban-garage-sale.vercel.app/api/urbanPayment', method: 'GET', expect: 200 },
        { name: 'Urban Pay API refuses anonymous sales', url: 'https://urban-garage-sale.vercel.app/api/urbanPayment/recordSale', method: 'POST', expect: 401 },
    ];

    const failures = [];
    for (const check of checks) {
        try {
            const res = await fetch(check.url, {
                method: check.method,
                headers: { 'Content-Type': 'application/json' },
                body: check.method === 'POST' ? '{}' : undefined,
                signal: AbortSignal.timeout(15000),
            });
            if (res.status !== check.expect) failures.push(`${check.name}: HTTP ${res.status}, expected ${check.expect}`);
        } catch (error) {
            failures.push(`${check.name}: ${error.message}`);
        }
    }

    if (failures.length) {
        const error = new Error(`Health check failed - ${failures.join('; ')}`);
        logReportedError('health-check', error.stack);
    }
    return null;
});
