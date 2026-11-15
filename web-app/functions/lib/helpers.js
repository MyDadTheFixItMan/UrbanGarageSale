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

// The house style for every email Urban Garage Sale sends. The colours are the website's
// (web-app/tailwind.config.js); white text only goes on orangeDark or darker, as on the site.
const EMAIL_COLOURS = {
    navy: '#1e3a5f',
    orange: '#f97316',
    orangeDark: '#c2410c',
    teal: '#0d9488',
    cream: '#f5f1e8',
    text: '#334155',
    muted: '#64748b',
    line: '#e2e8f0',
};
const EMAIL_FONT = "'Nunito', 'Segoe UI', Arial, Helvetica, sans-serif";
// Shown in every email's footer and used as the reply-to address.
const SUPPORT_EMAIL = 'admin@urbangaragesales.com.au';
const DEFAULT_SITE_URL = 'https://urbangaragesales.com.au';
const EMAIL_SELLER_NOTE = 'You received this email because you listed a sale on Urban Garage Sale.';
const EMAIL_CONTACT_NOTE = 'You received this email because you sent us a message through Urban Garage Sale.';
const EMAIL_ADMIN_NOTE = 'You received this email because you are an Urban Garage Sale admin.';

// The website address links point at, without a trailing slash.
function siteBase(siteUrl) {
    return String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

function emailParagraph(html) {
    return `<p style="margin:0 0 16px;">${html}</p>`;
}

// A bulleted list. Items are HTML, so escape anything typed by a user first.
function emailList(items) {
    return `<ul style="margin:0 0 16px;padding-left:22px;">${items.map((item) => `<li style="margin:0 0 6px;">${item}</li>`).join('')}</ul>`;
}

// A labelled block of typed text. The text is escaped and its line breaks are kept.
function emailBox(label, text, colour) {
    return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
                    <tr><td style="background:${EMAIL_COLOURS.cream};border-left:4px solid ${colour};border-radius:4px;padding:14px 16px;">
                        <p style="margin:0 0 6px;font-weight:bold;color:${EMAIL_COLOURS.navy};">${label}</p>
                        <p style="margin:0;white-space:pre-line;">${escapeHtml(text)}</p>
                    </td></tr>
                </table>`;
}

// The call-to-action button. A table cell rather than a styled link, so Outlook draws it too.
function emailButton(label, url) {
    return `
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
                    <tr><td align="center" bgcolor="${EMAIL_COLOURS.orangeDark}" style="border-radius:8px;">
                        <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${EMAIL_FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
                    </td></tr>
                </table>`;
}

function emailLink(label, url) {
    return `<a href="${escapeHtml(url)}" target="_blank" style="color:${EMAIL_COLOURS.teal};font-weight:bold;text-decoration:underline;">${label}</a>`;
}

// The branded wrapper around every email: logo, heading, the email's own message, an optional
// button, a sign-off and the shared footer. Built from tables with inline styles, because many
// mail apps (Outlook especially) ignore layout CSS and style blocks. The logo's alt text is
// styled, so the name still shows where images are blocked. The preheader is the preview line
// mail apps show next to the subject; it is hidden in the email itself.
function emailLayout({ siteUrl, preheader, heading, body, button, signoff = true, note }) {
    const site = siteBase(siteUrl);
    const c = EMAIL_COLOURS;
    const footerLinks = [
        emailLink('Find a sale', site),
        emailLink('List your sale', `${site}/CreateListing`),
        emailLink('Contact us', `${site}/Contact`),
    ].join(' &nbsp;·&nbsp; ');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${heading}</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap" rel="stylesheet">
<style>
    @media (max-width: 620px) {
        .ugs-pad { padding-left: 20px !important; padding-right: 20px !important; }
        .ugs-heading { font-size: 22px !important; }
    }
</style>
</head>
<body style="margin:0;padding:0;background:${c.cream};">
<!--preheader--><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader ? escapeHtml(preheader) : ''}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div><!--/preheader-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.cream}" style="background:${c.cream};">
    <tr><td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:${EMAIL_FONT};">
            <tr><td height="6" bgcolor="${c.orange}" style="height:6px;line-height:6px;font-size:0;background:${c.orange};background-image:linear-gradient(90deg, ${c.orange}, ${c.teal});">&nbsp;</td></tr>
            <tr><td class="ugs-pad" style="padding:24px 32px 8px;">
                <a href="${escapeHtml(site)}" target="_blank" style="text-decoration:none;"><img src="${escapeHtml(site)}/email-logo.png" width="170" height="78" alt="Urban Garage Sale" style="display:block;border:0;width:170px;height:78px;font-family:${EMAIL_FONT};font-size:24px;font-weight:bold;color:${c.orangeDark};"></a>
            </td></tr>
            <tr><td class="ugs-pad" style="padding:16px 32px 8px;color:${c.text};font-size:16px;line-height:1.6;">
                <h1 class="ugs-heading" style="margin:0 0 16px;color:${c.navy};font-size:26px;line-height:1.25;font-weight:800;">${heading}</h1>
                ${body}
                ${button ? emailButton(button.label, button.url) : ''}
                ${signoff ? emailParagraph('Cheers,<br><strong>The Urban Garage Sale team</strong>') : ''}
            </td></tr>
            <tr><td class="ugs-pad" style="padding:20px 32px 24px;border-top:1px solid ${c.line};background:#fbfaf7;color:${c.muted};font-size:13px;line-height:1.6;">
                <p style="margin:0 0 10px;">${footerLinks}</p>
                <p style="margin:0 0 10px;"><strong style="color:${c.navy};">Urban Garage Sale</strong> · Find unique treasures in your neighbourhood.</p>
                <p style="margin:0;">${note ? `${note} ` : ''}Questions? Email ${emailLink(SUPPORT_EMAIL, `mailto:${SUPPORT_EMAIL}`)} or read our ${emailLink('privacy policy', `${site}/Privacy`)}.</p>
            </td></tr>
        </table>
    </td></tr>
</table>
</body>
</html>`;
}

// The plain-text copy sent alongside the HTML. Spam filters favour emails that have one, and
// some people read mail as text only. Links keep their address after the label.
function emailText(html) {
    const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
    return String(html)
        .replace(/<head[\s\S]*?<\/head>/i, '')
        .replace(/<!--preheader-->[\s\S]*?<!--\/preheader-->/, '')
        .replace(/<img [^>]*alt="([^"]*)"[^>]*>/g, '$1')
        .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (match, href, label) => {
            const text = label.replace(/<[^>]+>/g, '');
            const url = href.replace(/^mailto:/, '');
            return text === url ? text : `${text} (${url})`;
        })
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li[^>]*>/gi, '- ')
        .replace(/<\/(p|h1|li|tr|ul)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => entities[entity])
        .replace(/&#847;|&zwnj;/g, '')
        .split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

const listingName = (title) => `<strong>${escapeHtml(title || 'your listing')}</strong>`;

function approvalEmailHtml({ title, saleId, siteUrl }) {
    const site = siteBase(siteUrl);
    return emailLayout({
        siteUrl,
        preheader: 'Your listing has been approved and buyers can now find it.',
        heading: 'Your garage sale is live!',
        body: [
            emailParagraph(`Great news! ${listingName(title)} has been approved and is now live on Urban Garage Sale, so buyers near you can find it.`),
            emailParagraph('<strong>A few tips for a great sale:</strong>'),
            emailList([
                'Share your listing with friends, family and local community groups.',
                'Put up signs on the day so passers-by can find you.',
                'Price items clearly and have some change ready.',
            ]),
        ].join('\n'),
        button: { label: 'View your listing', url: saleId ? `${site}/ListingDetails?id=${encodeURIComponent(saleId)}` : `${site}/Profile` },
        note: EMAIL_SELLER_NOTE,
    });
}

// The email telling a seller their listing was rejected. Title and reason are escaped.
function rejectionEmailHtml({ title, reason, refunded, siteUrl }) {
    const refundLine = refunded > 0
        ? emailParagraph(`Your listing fee of <strong>A$${refunded.toFixed(2)}</strong> has been refunded to the card you paid with. Refunds usually appear within 5–10 business days.`)
        : '';
    return emailLayout({
        siteUrl,
        preheader: "Here's why, and how to list your sale again.",
        heading: "Your listing wasn't approved",
        body: [
            emailParagraph(`Unfortunately ${listingName(title)} wasn't approved, so it won't appear on Urban Garage Sale.`),
            emailBox('Reason', reason, EMAIL_COLOURS.orange),
            refundLine,
            emailParagraph("You're welcome to create a new listing with these changes. We'd love to help you have a great sale."),
        ].join('\n'),
        button: { label: 'Create a new listing', url: `${siteBase(siteUrl)}/CreateListing` },
        note: EMAIL_SELLER_NOTE,
    });
}

function editRefusedEmailHtml({ title, reason, siteUrl }) {
    return emailLayout({
        siteUrl,
        preheader: 'Your listing is still live, exactly as it was before.',
        heading: "Your changes weren't approved",
        body: [
            emailParagraph(`The changes you made to ${listingName(title)} weren't approved. Don't worry: your listing is still live, exactly as it was before you changed it.`),
            emailBox('Reason', reason, EMAIL_COLOURS.orange),
            emailParagraph('You can edit your listing from your profile and send new changes for approval.'),
        ].join('\n'),
        button: { label: 'Go to my listings', url: `${siteBase(siteUrl)}/Profile` },
        note: EMAIL_SELLER_NOTE,
    });
}

function contactResponseEmailHtml({ userName, originalMessage, responseMessage, siteUrl }) {
    return emailLayout({
        siteUrl,
        preheader: 'Our team has replied to your message.',
        heading: "We've replied to your message",
        body: [
            emailParagraph(`Hi ${escapeHtml(userName || 'there')},`),
            emailParagraph('Thanks for getting in touch with Urban Garage Sale. Here is our reply.'),
            emailBox('Our reply', responseMessage, EMAIL_COLOURS.teal),
            emailBox('Your message', originalMessage, EMAIL_COLOURS.line),
            emailParagraph('If you have any more questions, send us another message through our Contact page.'),
        ].join('\n'),
        button: { label: 'Find sales near you', url: siteBase(siteUrl) },
        note: EMAIL_CONTACT_NOTE,
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

// The Storage paths `before` used that none of `stillUsed` do: what's safe to delete once a listing
// or an edit to one stops using them. Like listingPhotoPaths, only the seller's own folder counts.
function unusedPhotoPaths(before, ...stillUsed) {
    const keep = new Set(stillUsed.flatMap(listingPhotoPaths));
    return listingPhotoPaths(before).filter((path) => !keep.has(path));
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
    unusedPhotoPaths,
    melbourneDate,
    UNPAID_STATUSES,
    DRAFT_LIFETIME_MS,
    isUnpaidListing,
    isExpiredDraft,
    refundablePayments,
    EMAIL_COLOURS,
    EMAIL_ADMIN_NOTE,
    SUPPORT_EMAIL,
    emailLayout,
    emailParagraph,
    emailList,
    emailText,
    approvalEmailHtml,
    rejectionEmailHtml,
    contactResponseEmailHtml,
    editRefusedEmailHtml,
};
