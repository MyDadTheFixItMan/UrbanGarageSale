const test = require('node:test');
const assert = require('node:assert/strict');
const {
    isDocId, isRole, escapeHtml, storagePathFromUrl, listingPhotoPaths, isExpiredDraft, refundablePayments,
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
        photos: [photoUrl('listings/u1/a.jpg'), photoUrl('listings/u1/b.jpg')],
        thumbnails: [photoUrl('listings/u1/thumb_a.jpg'), photoUrl('listings/u1/a.jpg'), 'not a url'],
    };
    assert.deepEqual(listingPhotoPaths(listing).sort(), ['listings/u1/a.jpg', 'listings/u1/b.jpg', 'listings/u1/thumb_a.jpg']);
    assert.deepEqual(listingPhotoPaths({}), []);
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

test('refundablePayments picks completed Stripe payments with a PaymentIntent', () => {
    const payments = [
        { id: '1', payment_method: 'stripe', status: 'completed', transaction_id: 'pi_123' },
        { id: '2', payment_method: 'stripe', status: 'refunded', transaction_id: 'pi_456' },
        { id: '3', payment_method: 'free_period', status: 'completed', amount: 0 },
        { id: '4', payment_method: 'stripe', status: 'completed', transaction_id: null },
    ];
    assert.deepEqual(refundablePayments(payments).map((p) => p.id), ['1']);
});
