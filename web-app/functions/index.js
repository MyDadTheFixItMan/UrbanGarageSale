// Cloud Functions (2nd gen) in australia-southeast1 (Sydney), next to the Firestore database in
// Melbourne. Callables take (request) with request.data and request.auth.
const { setGlobalOptions } = require('firebase-functions/v2');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const Stripe = require('stripe');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const sgMail = require('@sendgrid/mail');
const {
    isDocId, isRole, escapeHtml, listingPhotoPaths, melbourneDate, isExpiredDraft, refundablePayments,
} = require('./lib/helpers');

const REGION = 'australia-southeast1';
const TIME_ZONE = 'Australia/Melbourne';
setGlobalOptions({ region: REGION, maxInstances: 10 });

initializeApp();
const db = getFirestore();
const auth = getAuth();

// Secrets live in Google Secret Manager (firebase functions:secrets:set NAME) and are only
// exposed to the functions that declare them.
//
// App Check: callables refuse requests without a valid App Check token when
// ENFORCE_APP_CHECK=true in functions/.env (read at deploy time). Turn on only after the
// website (and the mobile app, if it calls these) sends tokens.
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === 'true';
const callable = (secrets, handler) => onCall({ secrets, enforceAppCheck: ENFORCE_APP_CHECK }, handler);

let stripe = null;
function getStripe() {
    if (!stripe) {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new HttpsError('failed-precondition', 'Payments are not configured');
        }
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return stripe;
}

// Returns false (and sends nothing) when SendGrid isn't configured.
async function sendEmail(message) {
    if (!process.env.SENDGRID_API_KEY) return false;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send(message);
    return true;
}

// Listing fee in cents (AUD). Must match LISTING_FEE_AUD in web-app/src/lib/pricing.js.
const LISTING_FEE_CENTS = 1000;
// Public URL of the web app, used for Stripe redirects and email links (e.g. https://urbangaragesales.com.au).
const APP_URL = process.env.APP_URL;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'notification@urbangaragesales.com.au';
const BUSINESS_FOOTER = 'Urban Garage Sale · urbangaragesales.com.au · support@urbangaragesales.com.au';

// Per-user rate limit (fixed one-minute window counted in Firestore, so it holds across
// instances). Counters expire through the TTL policy on rateLimits.expiresAt.
async function rateLimit(uid, action, perMinute) {
    const windowId = Math.floor(Date.now() / 60000);
    const ref = db.collection('rateLimits').doc(`${action}_${uid}_${windowId}`);
    const count = await db.runTransaction(async (tx) => {
        const n = ((await tx.get(ref)).data()?.n ?? 0) + 1;
        tx.set(ref, { n, expiresAt: Timestamp.fromMillis(Date.now() + 120000) });
        return n;
    });
    if (count > perMinute) {
        throw new HttpsError('resource-exhausted', 'Too many requests. Please wait a minute and try again.');
    }
}

function requireAuth(request) {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    return request.auth;
}

// Admin actions need the `admin` custom claim (set only by setUserRole or
// scripts/sync-admin-claims.mjs) and a session that passed the SMS second factor.
function requireAdmin(request) {
    const { uid, token } = requireAuth(request);
    if (!token?.firebase?.sign_in_second_factor) {
        throw new HttpsError('permission-denied', 'Sign in with two-factor authentication to use admin features');
    }
    if (token.admin !== true) {
        throw new HttpsError('permission-denied', 'Admin access required');
    }
    return uid;
}

function requireDocId(value, name) {
    if (!isDocId(value)) {
        throw new HttpsError('invalid-argument', `A valid ${name} is required`);
    }
    return value;
}

// Append-only record of admin actions. Clients can't read or write auditLog (firestore.rules).
function audit(action, by, details) {
    return db.collection('auditLog').add({ action, by, ...details, at: FieldValue.serverTimestamp() });
}

async function getOwnedListing(saleId, uid) {
    requireDocId(saleId, 'sale ID');
    const snap = await db.collection('garageSales').doc(saleId).get();
    if (!snap.exists || snap.data().user_id !== uid) {
        throw new HttpsError('permission-denied', 'Listing not found');
    }
    return snap;
}

// Deletes Storage files, ignoring ones that are already gone.
async function deleteStorageFiles(paths) {
    const bucket = getStorage().bucket();
    await Promise.all(paths.map((path) => bucket.file(path).delete({ ignoreNotFound: true })));
}

// Marks a listing paid from a completed Checkout session. Idempotent: the payment record
// is keyed by the Checkout session ID, so verifying twice (or via webhook) changes nothing.
async function recordListingPayment(session) {
    const saleId = session.metadata?.sale_id;
    const userId = session.metadata?.user_id;
    if (!isDocId(saleId) || !userId || session.payment_status !== 'paid') {
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

// ---------------------------------------------------------------------------
// Listing fees
// ---------------------------------------------------------------------------

// Create Stripe Checkout for the listing fee
exports.createStripeCheckout = callable(['STRIPE_SECRET_KEY'], async (request) => {
    const { uid } = requireAuth(request);
    await rateLimit(uid, 'createStripeCheckout', 10);
    const listing = await getOwnedListing(request.data?.saleId, uid);
    const listingData = listing.data();

    if (!APP_URL) {
        throw new HttpsError('failed-precondition', 'APP_URL is not configured');
    }
    if (listingData.payment_status === 'paid' || listingData.payment_status === 'completed') {
        throw new HttpsError('failed-precondition', 'This listing has already been paid for');
    }

    try {
        const user = await auth.getUser(uid);
        const session = await getStripe().checkout.sessions.create({
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
        logger.error('Stripe checkout error', error);
        throw new HttpsError('internal', 'Failed to create checkout session');
    }
});

// Verify a completed Checkout session when the seller returns from Stripe
exports.verifyStripePayment = callable(['STRIPE_SECRET_KEY'], async (request) => {
    const { uid } = requireAuth(request);
    await rateLimit(uid, 'verifyStripePayment', 20);
    const { sessionId, saleId } = request.data || {};

    if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]{1,250}$/.test(sessionId) || !isDocId(saleId)) {
        throw new HttpsError('invalid-argument', 'Missing sessionId or saleId');
    }

    let session;
    try {
        session = await getStripe().checkout.sessions.retrieve(sessionId);
    } catch {
        throw new HttpsError('not-found', 'Payment session not found');
    }

    // The session must have been created for this listing by this user.
    if (session.metadata?.sale_id !== saleId || session.metadata?.user_id !== uid) {
        throw new HttpsError('permission-denied', 'This payment does not match the listing');
    }
    if (session.payment_status !== 'paid') {
        return { success: false, message: 'Payment not completed' };
    }

    await recordListingPayment(session);
    return { success: true };
});

// Stripe webhook: records listing payments even if the seller closes the browser before
// returning to the site. Configure in Stripe for `checkout.session.completed`.
exports.stripeWebhook = onRequest({ secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] }, async (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
        res.status(503).send('Webhook not configured');
        return;
    }

    let event;
    try {
        event = getStripe().webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], secret);
    } catch {
        res.status(400).send('Invalid signature');
        return;
    }

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        await recordListingPayment(event.data.object);
    }
    res.json({ received: true });
});

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

// Send listing-approved email (admin only)
exports.sendApprovalEmail = callable(['SENDGRID_API_KEY'], async (request) => {
    const adminUid = requireAdmin(request);
    await rateLimit(adminUid, 'sendApprovalEmail', 60);

    const saleId = requireDocId(request.data?.saleId, 'sale ID');
    const listing = await db.collection('garageSales').doc(saleId).get();
    if (!listing.exists || !listing.data().user_id) {
        throw new HttpsError('not-found', 'Listing not found');
    }
    // Listings don't store the seller's email (they are public); look it up from their account.
    const { user_id: sellerId, title } = listing.data();
    const userEmail = (await auth.getUser(sellerId).catch(() => null))?.email;
    if (!userEmail) {
        throw new HttpsError('not-found', 'Seller has no email address');
    }

    const safeTitle = escapeHtml(title || 'your listing');
    const sent = await sendEmail({
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
    if (!sent) {
        logger.warn(`Email not sent (SendGrid not configured). Approval for listing ${saleId}`);
        return { success: true, message: 'Email service not configured' };
    }
    return { success: true, message: 'Approval notification sent' };
});

// Reject a listing and refund its listing fee (admin only). The Terms promise a refund when a
// listing is rejected. Refunds use an idempotency key per payment, so retrying is safe.
exports.rejectListing = callable(['STRIPE_SECRET_KEY'], async (request) => {
    const adminUid = requireAdmin(request);
    await rateLimit(adminUid, 'rejectListing', 30);

    const saleId = requireDocId(request.data?.saleId, 'sale ID');
    const reason = typeof request.data?.reason === 'string' ? request.data.reason.trim().slice(0, 1000) : '';
    if (!reason) {
        throw new HttpsError('invalid-argument', 'A reason is required');
    }

    const listingRef = db.collection('garageSales').doc(saleId);
    const listing = await listingRef.get();
    if (!listing.exists) {
        throw new HttpsError('not-found', 'Listing not found');
    }
    if (listing.data().status !== 'pending_approval') {
        throw new HttpsError('failed-precondition', 'Only listings awaiting approval can be rejected');
    }

    const paymentSnap = await db.collection('payments').where('garage_sale_id', '==', saleId).get();
    const payments = paymentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const refunds = [];
    for (const payment of refundablePayments(payments)) {
        const refund = await getStripe().refunds.create(
            { payment_intent: payment.transaction_id, reason: 'requested_by_customer', metadata: { sale_id: saleId } },
            { idempotencyKey: `listing-refund-${payment.id}` },
        );
        await db.collection('payments').doc(payment.id).update({
            status: 'refunded',
            refund_id: refund.id,
            refunded_at: FieldValue.serverTimestamp(),
        });
        refunds.push({ paymentId: payment.id, refundId: refund.id, amount: payment.amount });
    }

    await listingRef.update({
        status: 'rejected',
        rejection_reason: reason,
        ...(refunds.length ? { payment_status: 'refunded' } : {}),
    });
    await audit('rejectListing', adminUid, { saleId, reason, refunds });
    return { success: true, refunded: refunds.reduce((total, r) => total + (r.amount || 0), 0) };
});

// Make a user an admin or a regular user (admin only). The role is a custom claim, which
// firestore.rules and requireAdmin() check without reading Firestore; users/{uid}.role mirrors
// it for display. Demoting revokes the user's sessions so they sign in again without the claim
// (an ID token already issued keeps working in Firestore rules until it expires, within an hour).
exports.setUserRole = callable([], async (request) => {
    const adminUid = requireAdmin(request);
    await rateLimit(adminUid, 'setUserRole', 20);

    const userId = requireDocId(request.data?.userId, 'user ID');
    const role = request.data?.role;
    if (!isRole(role)) {
        throw new HttpsError('invalid-argument', 'Role must be "user" or "admin"');
    }
    if (userId === adminUid && role !== 'admin') {
        throw new HttpsError('failed-precondition', 'You cannot remove your own admin access');
    }

    let user;
    try {
        user = await auth.getUser(userId);
    } catch {
        throw new HttpsError('not-found', 'User not found');
    }
    await auth.setCustomUserClaims(userId, { ...(user.customClaims || {}), admin: role === 'admin' });
    if (role !== 'admin') {
        await auth.revokeRefreshTokens(userId);
    }
    await db.collection('users').doc(userId).set({ role }, { merge: true });
    await audit('setUserRole', adminUid, { userId, role });
    return { success: true };
});

// Email a reply to a contact-form message (admin only)
exports.sendContactResponseEmail = callable(['SENDGRID_API_KEY'], async (request) => {
    const adminUid = requireAdmin(request);
    await rateLimit(adminUid, 'sendContactResponseEmail', 30);

    const { userEmail, userName, originalMessage, responseMessage } = request.data || {};
    if (typeof userEmail !== 'string' || !userEmail.includes('@') || typeof responseMessage !== 'string' || !responseMessage.trim()) {
        throw new HttpsError('invalid-argument', 'userEmail and responseMessage are required');
    }

    const sent = await sendEmail({
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
    return { success: true, message: sent ? 'Response email sent' : 'Email service not configured' };
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

// Delete a user and their personal information (admin only), including their listing photos.
// Payment records are kept for tax record-keeping but de-identified (APP 11.2 allows
// retention where required by law).
exports.deleteUser = callable([], async (request) => {
    const adminUid = requireAdmin(request);
    await rateLimit(adminUid, 'deleteUser', 10);
    const userId = requireDocId(request.data?.userId, 'user ID');

    if (userId === adminUid) {
        throw new HttpsError('failed-precondition', 'You cannot delete your own account here');
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
    await deleteQueryInBatches(db.collection('contactMessages').where('user_id', '==', userId));
    await deleteQueryInBatches(db.collection('terminalLocations').where('sellerId', '==', userId));
    if (email) {
        await deleteQueryInBatches(db.collection('contactMessages').where('email', '==', email));
    }
    // Listing photos live under listings/<uid>/ (storage.rules).
    await getStorage().bucket().deleteFiles({ prefix: `listings/${userId}/` });

    const payments = await db.collection('payments').where('user_id', '==', userId).get();
    const batch = db.batch();
    payments.docs.forEach((doc) => batch.update(doc.ref, { user_id: 'deleted-user', user_email: null }));
    batch.delete(db.collection('sellerStats').doc(userId));
    batch.delete(db.collection('contactRateLimits').doc(userId));
    batch.delete(db.collection('users').doc(userId));
    await batch.commit();

    await audit('deleteUser', adminUid, { userId });
    logger.info(`User ${userId} and personal data deleted by admin ${adminUid}`);
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
    logger.write({
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
exports.reportClientError = onRequest({ maxInstances: 3 }, (req, res) => {
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

    const text = (value, max) => String(value ?? '').slice(0, max);

    // Content-Security-Policy violation reports (report-uri and report-to). Logged as warnings,
    // not errors: browser extensions trigger many of these, so they must not send alert emails.
    const contentType = req.get('content-type') || '';
    if (contentType.includes('csp-report') || contentType.includes('reports+json')) {
        let reports = [];
        try { reports = [].concat(JSON.parse(req.rawBody.toString('utf8'))); } catch { /* malformed */ }
        for (const entry of reports.slice(0, 10)) {
            const r = entry?.['csp-report'] || entry?.body || {};
            logger.warn('CSP violation', {
                directive: text(r['effective-directive'] || r.effectiveDirective || r['violated-directive'], 100),
                blocked: text(r['blocked-uri'] || r.blockedURL, 300),
                page: text(r['document-uri'] || r.documentURL, 300),
                source: text(r['source-file'] || r.sourceFile, 300),
            });
        }
        res.status(204).send('');
        return;
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
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
exports.healthCheck = onSchedule({ schedule: 'every 10 minutes', timeZone: TIME_ZONE }, async () => {
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
});

// ---------------------------------------------------------------------------
// Listings housekeeping and admin analytics
// ---------------------------------------------------------------------------

// Once a sale's end date has passed it is marked completed, so it drops out of public search
// and admin counts. Runs just after midnight Melbourne time (end_date is a YYYY-MM-DD string).
// Drafts are left to cleanupExpiredDrafts.
exports.expireListings = onSchedule({ schedule: 'every day 00:15', timeZone: TIME_ZONE }, async () => {
    const query = db.collection('garageSales')
        .where('status', 'in', ['active', 'pending_approval', 'pending_payment'])
        .where('end_date', '<', melbourneDate());

    // Updated listings leave the query, so each pass reads the next batch.
    let expired = 0;
    for (;;) {
        const snap = await query.limit(400).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.update(doc.ref, { status: 'completed' }));
        await batch.commit();
        expired += snap.size;
    }
    logger.info(`Marked ${expired} ended listing(s) completed`);
});

// Drafts are kept for two days, as the listing form tells sellers (APP 11.2: don't keep
// personal information longer than needed). Deletes expired drafts and their photos.
exports.cleanupExpiredDrafts = onSchedule({ schedule: 'every day 01:00', timeZone: TIME_ZONE }, async () => {
    const now = Date.now();
    const snap = await db.collection('garageSales').where('status', '==', 'draft').get();
    const expired = snap.docs.filter((doc) => isExpiredDraft(doc.data(), now));

    for (const doc of expired) {
        await deleteStorageFiles(listingPhotoPaths(doc.data()));
        await doc.ref.delete();
    }
    logger.info(`Deleted ${expired.length} expired draft(s)`);
});

// Top 10 postcodes by number of listings (optionally within one state) for the admin
// dashboard. Only the postcode field is read, and only counts are returned.
exports.adminTopPostcodes = callable([], async (request) => {
    const adminUid = requireAdmin(request);
    await rateLimit(adminUid, 'adminTopPostcodes', 20);
    const state = typeof request.data?.state === 'string' && request.data.state ? request.data.state : null;

    let query = db.collection('garageSales');
    if (state) query = query.where('state', '==', state);
    const snap = await query.select('postcode').get();

    const counts = {};
    snap.docs.forEach((doc) => {
        const postcode = doc.get('postcode') || 'Unknown';
        counts[postcode] = (counts[postcode] || 0) + 1;
    });
    const postcodes = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));
    return { postcodes };
});
