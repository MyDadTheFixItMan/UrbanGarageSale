// Pure helpers for the Cloud Functions: no Firebase or Stripe, so they are unit tested directly
// (functions/test/helpers.test.js).

// Firestore document IDs taken from a request: letters, digits, _ and - only, so a value such as
// "a/b" can never address a document in another collection.
const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/;

function isDocId(value) {
    return typeof value === 'string' && DOC_ID.test(value);
}

const ROLES = ['user', 'admin'];

function isRole(value) {
    return ROLES.includes(value);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// The email telling a seller their listing was rejected. Title and reason are escaped.
function rejectionEmailHtml({ title, reason, refunded, footer }) {
    const refundLine = refunded > 0
        ? `<p>Your listing fee of A$${refunded.toFixed(2)} has been refunded to the card you paid with. Refunds usually appear within 5–10 business days.</p>`
        : '';
    return `
            <h2>Your listing wasn't approved</h2>
            <p>Your garage sale listing "<strong>${escapeHtml(title || 'your listing')}</strong>" wasn't approved, so it won't appear on Urban Garage Sale.</p>
            <p><strong>Reason:</strong></p>
            <p style="white-space: pre-line;">${escapeHtml(reason)}</p>
            ${refundLine}
            <p>You're welcome to create a new listing with these changes. If you have any questions, contact support@urbangaragesales.com.au.</p>
            <hr>
            <p><small>You received this email because you listed a garage sale on Urban Garage Sale.<br>${footer}</small></p>
        `;
}

// The Storage object path inside a Firebase download URL
// (https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded path>?alt=media&token=…),
// or null for anything else. Only paths under listings/ are returned, so a crafted URL can't
// point the cleanup at other files.
function storagePathFromUrl(url) {
    if (typeof url !== 'string') return null;
    const match = url.match(/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?#]+)/);
    if (!match) return null;
    let path;
    try {
        path = decodeURIComponent(match[1]);
    } catch {
        return null;
    }
    return path.startsWith('listings/') && !path.includes('..') ? path : null;
}

// Every Storage path a listing's photos and thumbnails occupy.
function listingPhotoPaths(listing) {
    const urls = [...(listing?.photos || []), ...(listing?.thumbnails || [])];
    return [...new Set(urls.map(storagePathFromUrl).filter(Boolean))];
}

// Calendar date (YYYY-MM-DD) in Melbourne, the format listings store start_date/end_date in.
function melbourneDate(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(date);
}

// Listings that were never paid for: saved drafts, and publishes abandoned at Stripe Checkout.
const UNPAID_STATUSES = ['draft', 'pending_payment'];
// Longer than a Stripe Checkout session stays open (24 hours), so a listing can't be deleted
// while its seller is paying.
const DRAFT_LIFETIME_MS = 2 * 24 * 60 * 60 * 1000;

// An unpaid listing is due for deletion once its expiry has passed. Listings saved before
// draft_expires_at was set on them are kept for the same lifetime from when they were created.
function isExpiredDraft(listing, now = Date.now(), lifetimeMs = DRAFT_LIFETIME_MS) {
    if (!UNPAID_STATUSES.includes(listing?.status)) return false;
    if (listing.draft_expires_at) {
        const expires = Date.parse(listing.draft_expires_at);
        return Number.isFinite(expires) && expires < now;
    }
    const created = listing.created_at?.toMillis?.() ?? Date.parse(listing.created_at);
    return Number.isFinite(created) && created + lifetimeMs < now;
}

// Listing-fee payments that a rejection should refund: completed Stripe payments with a
// PaymentIntent that haven't been refunded yet.
function refundablePayments(payments) {
    return payments.filter((p) => p.payment_method === 'stripe' && p.status === 'completed' &&
        typeof p.transaction_id === 'string' && p.transaction_id.startsWith('pi_'));
}

module.exports = {
    isDocId,
    isRole,
    escapeHtml,
    storagePathFromUrl,
    listingPhotoPaths,
    melbourneDate,
    UNPAID_STATUSES,
    DRAFT_LIFETIME_MS,
    isExpiredDraft,
    refundablePayments,
    rejectionEmailHtml,
};
