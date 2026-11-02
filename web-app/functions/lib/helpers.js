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

const EMAIL_ORANGE = '#FF9500';
const EMAIL_TEAL = '#17A2A2';
const EMAIL_NAVY = '#1e3a5f';
const EMAIL_SELLER_NOTE = 'You received this email because you listed a garage sale on Urban Garage Sale.';

function emailParagraph(html) {
    return `<p style="margin:0 0 16px;">${html}</p>`;
}

// A labelled block of typed text. The text is escaped and its line breaks are kept.
function emailBox(label, text, colour) {
    return `
                <div style="background:#f7f5f0;border-left:4px solid ${colour};padding:14px 16px;margin:0 0 16px;">
                    <p style="margin:0 0 6px;font-weight:bold;">${label}</p>
                    <p style="margin:0;white-space:pre-line;">${escapeHtml(text)}</p>
                </div>`;
}

// The branded wrapper around every email. The name is text, not an image, because many mail
// apps block images. All styles are inline, because many mail apps drop style blocks.
function emailLayout({ heading, body, note, footer }) {
    return `
        <div style="background:#f4f4f5;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
            <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
                <div style="background:${EMAIL_NAVY};border-bottom:4px solid ${EMAIL_ORANGE};padding:18px 24px;font-size:20px;font-weight:bold;">
                    <span style="color:${EMAIL_ORANGE};">Urban</span> <span style="color:#ffffff;">Garage Sale</span>
                </div>
                <div style="padding:24px;color:#27272a;font-size:15px;line-height:1.5;">
                    <h1 style="margin:0 0 16px;color:${EMAIL_NAVY};font-size:22px;line-height:1.3;">${heading}</h1>
                    ${body}
                </div>
                <div style="padding:16px 24px;background:#fafafa;color:#71717a;font-size:12px;line-height:1.5;">
                    ${note ? `${note}<br>` : ''}${footer}
                </div>
            </div>
        </div>
    `;
}

function approvalEmailHtml({ title, footer }) {
    return emailLayout({
        heading: 'Your listing has been approved!',
        body: [
            emailParagraph(`Great news! Your garage sale listing "<strong>${escapeHtml(title || 'your listing')}</strong>" is now live on Urban Garage Sale.`),
            emailParagraph('You can view and manage it from your profile on Urban Garage Sale.'),
        ].join('\n'),
        note: EMAIL_SELLER_NOTE,
        footer,
    });
}

// The email telling a seller their listing was rejected. Title and reason are escaped.
function rejectionEmailHtml({ title, reason, refunded, footer }) {
    const refundLine = refunded > 0
        ? emailParagraph(`Your listing fee of A$${refunded.toFixed(2)} has been refunded to the card you paid with. Refunds usually appear within 5–10 business days.`)
        : '';
    return emailLayout({
        heading: "Your listing wasn't approved",
        body: [
            emailParagraph(`Your garage sale listing "<strong>${escapeHtml(title || 'your listing')}</strong>" wasn't approved, so it won't appear on Urban Garage Sale.`),
            emailBox('Reason', reason, EMAIL_ORANGE),
            refundLine,
            emailParagraph("You're welcome to create a new listing with these changes. If you have any questions, contact support@urbangaragesales.com.au."),
        ].join('\n'),
        note: EMAIL_SELLER_NOTE,
        footer,
    });
}

function editRefusedEmailHtml({ title, reason, footer }) {
    return emailLayout({
        heading: "Your changes weren't approved",
        body: [
            emailParagraph(`The changes you made to your garage sale listing "<strong>${escapeHtml(title || 'your listing')}</strong>" weren't approved. Your listing is still live, exactly as it was before you changed it.`),
            emailBox('Reason', reason, EMAIL_ORANGE),
            emailParagraph('You can edit your listing from your profile and send new changes for approval. If you have any questions, contact support@urbangaragesales.com.au.'),
        ].join('\n'),
        note: EMAIL_SELLER_NOTE,
        footer,
    });
}

function contactResponseEmailHtml({ userName, originalMessage, responseMessage, footer }) {
    return emailLayout({
        heading: 'We have replied to your message',
        body: [
            emailParagraph(`Hi ${escapeHtml(userName || 'there')},`),
            emailParagraph('Thank you for contacting Urban Garage Sale. Our team has responded to your message.'),
            emailBox('Your message', originalMessage, EMAIL_ORANGE),
            emailBox('Our response', responseMessage, EMAIL_TEAL),
        ].join('\n'),
        footer,
    });
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

// Every Storage path a listing's photos and thumbnails occupy. Only the seller's own folder
// counts: sellers write these URLs themselves, and the cleanup deletes with admin rights.
function listingPhotoPaths(listing) {
    if (!listing?.user_id) return [];
    const urls = [...(listing.photos || []), ...(listing.thumbnails || [])];
    const ownFolder = `listings/${listing.user_id}/`;
    return [...new Set(urls.map(storagePathFromUrl).filter((path) => path?.startsWith(ownFolder)))];
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

// A listing that can still be paid for. Anything else has been paid, approved, rejected or ended,
// and a payment must not change it.
function isUnpaidListing(listing) {
    return UNPAID_STATUSES.includes(listing?.status) && (listing.payment_status ?? 'pending') === 'pending';
}

// An unpaid listing is due for deletion once its expiry has passed. Listings with no readable
// draft_expires_at are kept for the same lifetime from when they were created.
function isExpiredDraft(listing, now = Date.now(), lifetimeMs = DRAFT_LIFETIME_MS) {
    if (!UNPAID_STATUSES.includes(listing?.status)) return false;
    const expires = Date.parse(listing.draft_expires_at ?? '');
    if (Number.isFinite(expires)) return expires < now;
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
    isUnpaidListing,
    isExpiredDraft,
    refundablePayments,
    approvalEmailHtml,
    rejectionEmailHtml,
    contactResponseEmailHtml,
    editRefusedEmailHtml,
};
