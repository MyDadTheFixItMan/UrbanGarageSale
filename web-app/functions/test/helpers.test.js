const test = require('node:test');
const assert = require('node:assert/strict');
const {
    isDocId, isRole, escapeHtml, storagePathFromUrl, listingPhotoPaths, unusedPhotoPaths, isUnpaidListing, isExpiredDraft, refundablePayments,
    approvalEmailHtml,
    rejectionEmailHtml,
    editRefusedEmailHtml,
    contactResponseEmailHtml,
    emailText,
} = require('../lib/helpers');

const photoUrl = (path) =>
    `https://firebasestorage.googleapis.com/v0/b/urbangaragesale.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media&token=abc`;

test('isDocId accepts Firestore auto IDs and rejects paths and junk', () => {
    assert.equal(isDocId('aB3_x-9ZqLm2'), true);
    assert.equal(isDocId('a/b'), false);
    assert.equal(isDocId('../users'), false);
    assert.equal(isDocId(''), false);
    assert.equal(isDocId('x'.repeat(129)), false);
    assert.equal(isDocId(42), false);
    assert.equal(isDocId(undefined), false);
});

test('isRole allows only user and admin', () => {
    assert.equal(isRole('user'), true);
    assert.equal(isRole('admin'), true);
    assert.equal(isRole('owner'), false);
    assert.equal(isRole(undefined), false);
});

test('escapeHtml escapes markup characters', () => {
    assert.equal(escapeHtml('<b>"Tom" & \'Jo\'</b>'), '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jo&#39;&lt;/b&gt;');
    assert.equal(escapeHtml(null), '');
});

test('storagePathFromUrl returns listing paths only', () => {
    assert.equal(storagePathFromUrl(photoUrl('listings/u1/photo 1.jpg')), 'listings/u1/photo 1.jpg');
    assert.equal(storagePathFromUrl(photoUrl('other/u1/a.jpg')), null);
    assert.equal(storagePathFromUrl(photoUrl('listings/../secrets/a.jpg')), null);
    assert.equal(storagePathFromUrl('https://example.com/v0/b/x/o/listings%2Fa.jpg'), null);
    assert.equal(storagePathFromUrl(null), null);
});

test('listingPhotoPaths covers photos and thumbnails without duplicates', () => {
    const listing = {
        user_id: 'u1',
        photos: [photoUrl('listings/u1/a.jpg'), photoUrl('listings/u1/b.jpg')],
        thumbnails: [photoUrl('listings/u1/thumb_a.jpg'), photoUrl('listings/u1/a.jpg'), 'not a url'],
    };
    assert.deepEqual(listingPhotoPaths(listing).sort(), ['listings/u1/a.jpg', 'listings/u1/b.jpg', 'listings/u1/thumb_a.jpg']);
    assert.deepEqual(listingPhotoPaths({}), []);
});

test('unusedPhotoPaths keeps any photo something else still uses', () => {
    const listing = { user_id: 'u1', photos: [photoUrl('listings/u1/old.jpg'), photoUrl('listings/u1/kept.jpg')], thumbnails: [] };
    const approved = { user_id: 'u1', photos: [photoUrl('listings/u1/kept.jpg'), photoUrl('listings/u1/new.jpg')], thumbnails: [] };
    assert.deepEqual(unusedPhotoPaths(listing, approved), ['listings/u1/old.jpg']);
    assert.deepEqual(unusedPhotoPaths(approved, listing), ['listings/u1/new.jpg']);
    assert.deepEqual(unusedPhotoPaths(listing, listing), []);
    assert.deepEqual(unusedPhotoPaths(listing), ['listings/u1/old.jpg', 'listings/u1/kept.jpg']);
});

test("unusedPhotoPaths never offers another seller's files for deletion", () => {
    const edit = { user_id: 'u1', photos: [photoUrl('listings/victim/a.jpg')], thumbnails: [] };
    assert.deepEqual(unusedPhotoPaths(edit, { user_id: 'u1', photos: [] }), []);
});

test("listingPhotoPaths never returns another seller's files", () => {
    const victim = photoUrl('listings/victim/a.jpg');
    assert.deepEqual(listingPhotoPaths({ user_id: 'mallory', photos: [victim], thumbnails: [victim] }), []);
    assert.deepEqual(listingPhotoPaths({ photos: [victim] }), []);
    assert.deepEqual(listingPhotoPaths({ user_id: 'victi', photos: [victim] }), []);
    assert.deepEqual(listingPhotoPaths({ user_id: 'mallory', photos: [photoUrl('listings/mallory/../victim/a.jpg')] }), []);
});

test('isUnpaidListing is true only for unpaid drafts and abandoned payments', () => {
    assert.equal(isUnpaidListing({ status: 'draft', payment_status: 'pending' }), true);
    assert.equal(isUnpaidListing({ status: 'pending_payment' }), true);
    assert.equal(isUnpaidListing({ status: 'draft', payment_status: 'paid' }), false);
    for (const status of ['pending_approval', 'active', 'rejected', 'completed']) {
        assert.equal(isUnpaidListing({ status, payment_status: 'pending' }), false, status);
    }
    assert.equal(isUnpaidListing(undefined), false);
});

test('isExpiredDraft uses draft_expires_at, falling back to created_at', () => {
    const now = Date.parse('2026-10-15T00:00:00Z');
    const day = 24 * 60 * 60 * 1000;
    assert.equal(isExpiredDraft({ status: 'draft', draft_expires_at: '2026-10-14T00:00:00Z' }, now), true);
    assert.equal(isExpiredDraft({ status: 'draft', draft_expires_at: '2026-10-16T00:00:00Z' }, now), false);
    assert.equal(isExpiredDraft({ status: 'active', draft_expires_at: '2026-10-14T00:00:00Z' }, now), false);
    assert.equal(isExpiredDraft({ status: 'draft', created_at: { toMillis: () => now - 3 * day } }, now), true);
    assert.equal(isExpiredDraft({ status: 'draft', created_at: { toMillis: () => now - day } }, now), false);
    assert.equal(isExpiredDraft({ status: 'draft' }, now), false);
});

test('isExpiredDraft falls back to created_at when draft_expires_at is unreadable', () => {
    const now = Date.parse('2026-10-15T00:00:00Z');
    const day = 24 * 60 * 60 * 1000;
    assert.equal(isExpiredDraft({ status: 'draft', draft_expires_at: 'never', created_at: { toMillis: () => now - 3 * day } }, now), true);
    assert.equal(isExpiredDraft({ status: 'draft', draft_expires_at: 'never', created_at: { toMillis: () => now - day } }, now), false);
});

test('isExpiredDraft covers abandoned payments but never paid listings', () => {
    const now = Date.parse('2026-10-15T00:00:00Z');
    const day = 24 * 60 * 60 * 1000;
    assert.equal(isExpiredDraft({ status: 'pending_payment', draft_expires_at: '2026-10-14T00:00:00Z' }, now), true);
    assert.equal(isExpiredDraft({ status: 'pending_payment', draft_expires_at: '2026-10-16T00:00:00Z' }, now), false);
    assert.equal(isExpiredDraft({ status: 'pending_payment', draft_expires_at: null, created_at: { toMillis: () => now - 3 * day } }, now), true);
    assert.equal(isExpiredDraft({ status: 'pending_approval', draft_expires_at: '2026-10-14T00:00:00Z' }, now), false);
});

test('refundablePayments picks completed Stripe payments with a PaymentIntent', () => {
    const payments = [
        { id: '1', payment_method: 'stripe', status: 'completed', transaction_id: 'pi_123' },
        { id: '2', payment_method: 'stripe', status: 'refunded', transaction_id: 'pi_456' },
        { id: '3', payment_method: 'free_period', status: 'completed', amount: 0 },
        { id: '4', payment_method: 'stripe', status: 'completed', transaction_id: null },
    ];
    assert.deepEqual(refundablePayments(payments).map((p) => p.id), ['1']);
});

test('editRefusedEmailHtml says the listing is still live and escapes what was typed', () => {
    const html = editRefusedEmailHtml({ title: '<b>Sale</b>', reason: 'Photos show <prices>' });
    assert.match(html, /still live/);
    assert.match(html, /Photos show &lt;prices&gt;/);
    assert.doesNotMatch(html, /<b>Sale<\/b>/);
});

test('rejectionEmailHtml gives the reason and escapes what the seller or admin typed', () => {
    const html = rejectionEmailHtml({ title: '<b>Sale</b>', reason: 'Photos show <prices>', refunded: 0 });
    assert.match(html, /&lt;b&gt;Sale&lt;\/b&gt;/);
    assert.match(html, /Photos show &lt;prices&gt;/);
});

test('rejectionEmailHtml only mentions a refund when there was one', () => {
    const email = (refunded) => rejectionEmailHtml({ title: 'Sale', reason: 'No', refunded });
    assert.match(email(10), /A\$10\.00<\/strong> has been refunded/);
    assert.doesNotMatch(email(0), /refund/i);
});

test('rejectionEmailHtml tells the seller a free listing code they used works again', () => {
    const html = rejectionEmailHtml({ title: 'Sale', reason: 'No', refunded: 0, freeCode: 'FREE-7KQ3-MZ2P' });
    assert.match(html, /free listing code <strong>FREE-7KQ3-MZ2P<\/strong> can be used again/);
    assert.doesNotMatch(rejectionEmailHtml({ title: 'Sale', reason: 'No', refunded: 0 }), /listing code/);
});

test('approvalEmailHtml names the listing and escapes its title', () => {
    const html = approvalEmailHtml({ title: '<b>Sale</b>', saleId: 'abc123', siteUrl: 'https://example.com/' });
    assert.match(html, /has been approved/);
    // Opens the listing with its share options showing.
    assert.match(html, /href="https:\/\/example\.com\/ListingDetails\?id=abc123&amp;share=1"[^>]*>View and share your listing</);
    assert.match(html, /&lt;b&gt;Sale&lt;\/b&gt;/);
    assert.doesNotMatch(html, /<b>Sale<\/b>/);
});

test('contactResponseEmailHtml escapes the name and both messages', () => {
    const html = contactResponseEmailHtml({ userName: '<i>Sam</i>', originalMessage: 'Is <x> ok?', responseMessage: 'Yes & <y>' });
    assert.match(html, /Hi &lt;i&gt;Sam&lt;\/i&gt;/);
    assert.match(html, /Is &lt;x&gt; ok\?/);
    assert.match(html, /Yes &amp; &lt;y&gt;/);
});

test('every email has the same logo, button, footer and plain-text copy', () => {
    const emails = [
        approvalEmailHtml({ title: 'Sale', saleId: 's1', siteUrl: 'https://example.com' }),
        rejectionEmailHtml({ title: 'Sale', reason: 'No', refunded: 0, siteUrl: 'https://example.com' }),
        editRefusedEmailHtml({ title: 'Sale', reason: 'No', siteUrl: 'https://example.com' }),
        contactResponseEmailHtml({ responseMessage: 'Yes', siteUrl: 'https://example.com' }),
    ];
    for (const html of emails) {
        assert.match(html, /<img src="https:\/\/www\.urbangaragesales\.com\.au\/email-logo\.png"[^>]*alt="Urban Garage Sales"/);
        assert.match(html, /bgcolor="#c2410c"/);
        assert.match(html, /href="https:\/\/example\.com\/Privacy"/);
        assert.match(html, /admin@urbangaragesales\.com\.au/);
        assert.doesNotMatch(html, /support@/);
        const text = emailText(html);
        assert.doesNotMatch(text, /<|&nbsp;|&amp;/);
        assert.match(text, /The Urban Garage Sales team/);
    }
});

test('emailText keeps link addresses and drops the hidden preview line', () => {
    const text = emailText(approvalEmailHtml({ title: "Tom & Sue's sale", saleId: 's1', siteUrl: 'https://example.com' }));
    assert.match(text, /^Urban Garage Sales \(https:\/\/example\.com\)\n\nYour garage sale is live!/);
    assert.match(text, /Tom & Sue's sale/);
    assert.match(text, /View and share your listing \(https:\/\/example\.com\/ListingDetails\?id=s1&share=1\)/);
    assert.match(text, /- Share it in local buy, swap and sell groups/);
    assert.doesNotMatch(text, /buyers can now find it\./);
});

test('storagePathFromUrl with a bucket refuses URLs into any other bucket', () => {
    const url = (bucket) => `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/listings%2Fu1%2Fa.jpg?alt=media`;
    assert.equal(storagePathFromUrl(url('site.firebasestorage.app'), 'site.firebasestorage.app'), 'listings/u1/a.jpg');
    assert.equal(storagePathFromUrl(url('attacker.appspot.com'), 'site.firebasestorage.app'), null);
});
