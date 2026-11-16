const test = require('node:test');
const assert = require('node:assert/strict');
const {
    CODE_ALPHABET,
    newFreeListingCode,
    normaliseFreeListingCode,
    freeListingCodeProblem,
    freeListingCodeRequest,
    freeListingCodeEmailHtml,
} = require('../lib/freeListingCodes');
const { emailText } = require('../lib/helpers');

const TODAY = '2026-11-16';

test('new codes look like FREE-XXXX-XXXX and avoid characters that are easy to misread', () => {
    for (let i = 0; i < 200; i++) {
        const code = newFreeListingCode();
        assert.match(code, /^FREE-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
        assert.doesNotMatch(code.slice(5), /[01OILS5]/);
    }
    assert.equal(newFreeListingCode(() => 0), `FREE-${CODE_ALPHABET[0].repeat(4)}-${CODE_ALPHABET[0].repeat(4)}`);
});

test('new codes are random', () => {
    const codes = new Set(Array.from({ length: 500 }, () => newFreeListingCode()));
    assert.equal(codes.size, 500);
});

test('normaliseFreeListingCode accepts any case, spacing and dashes, with or without FREE', () => {
    for (const typed of ['FREE-7KQ3-MZ2P', 'free-7kq3-mz2p', ' FREE 7KQ3 MZ2P ', 'free7kq3mz2p', '7KQ3-MZ2P', '7kq3mz2p']) {
        assert.equal(normaliseFreeListingCode(typed), 'FREE-7KQ3-MZ2P', typed);
    }
    // A code whose own characters start with FREE is still read correctly either way.
    assert.equal(normaliseFreeListingCode('FREE-FREE-AB23'), 'FREE-FREE-AB23');
    assert.equal(normaliseFreeListingCode('FREEAB23'), 'FREE-FREE-AB23');
});

test("normaliseFreeListingCode refuses anything that can't be a code", () => {
    for (const typed of ['', 'FREE', 'FREE-7KQ3-MZ2', 'FREE-7KQ3-MZ2PX', 'FREE-7KQ0-MZ2P', 'FREE-7KQ3-MZ2P/x', 'x'.repeat(100), null, 42, undefined]) {
        assert.equal(normaliseFreeListingCode(typed), null, String(typed));
    }
});

test('freeListingCodeProblem allows an unused code up to and including its last day', () => {
    assert.equal(freeListingCodeProblem({ status: 'unused', expires_on: TODAY }, TODAY), null);
    assert.equal(freeListingCodeProblem({ status: 'unused', expires_on: '2027-01-01' }, TODAY), null);
    assert.equal(freeListingCodeProblem({ status: 'unused' }, TODAY), null);
});

test('freeListingCodeProblem says why a code is refused', () => {
    assert.match(freeListingCodeProblem(null, TODAY), /isn't valid/);
    assert.match(freeListingCodeProblem({ status: 'used', expires_on: '2027-01-01' }, TODAY), /already been used/);
    assert.match(freeListingCodeProblem({ status: 'cancelled', expires_on: '2027-01-01' }, TODAY), /cancelled/);
    assert.match(freeListingCodeProblem({ status: 'unused', expires_on: '2026-11-15' }, TODAY), /expired/);
    assert.match(freeListingCodeProblem({ status: 'something-else' }, TODAY), /isn't valid/);
});

test('freeListingCodeRequest trims the form and treats blanks as not given', () => {
    assert.deepEqual(
        freeListingCodeRequest({ name: '  Sam Lee ', email: ' sam@example.com ', note: ' Thanks! ', expiresOn: '2027-02-14' }, TODAY),
        { name: 'Sam Lee', email: 'sam@example.com', note: 'Thanks!', expiresOn: '2027-02-14' },
    );
    assert.deepEqual(
        freeListingCodeRequest({ name: '', email: '   ', expiresOn: '2027-02-14' }, TODAY),
        { name: null, email: null, note: null, expiresOn: '2027-02-14' },
    );
    assert.equal(freeListingCodeRequest({ name: 'x'.repeat(300), expiresOn: TODAY }, TODAY).name.length, 100);
});

test('freeListingCodeRequest refuses a bad email or expiry date', () => {
    assert.match(freeListingCodeRequest({ email: 'not-an-email', expiresOn: '2027-02-14' }, TODAY).error, /valid email/);
    assert.match(freeListingCodeRequest({ expiresOn: '' }, TODAY).error, /last day/);
    assert.match(freeListingCodeRequest({ expiresOn: '14/02/2027' }, TODAY).error, /last day/);
    assert.match(freeListingCodeRequest({ expiresOn: '2026-11-15' }, TODAY).error, /past/);
    assert.match(freeListingCodeRequest({ expiresOn: '2027-11-18' }, TODAY).error, /within a year/);
    assert.equal(freeListingCodeRequest({ expiresOn: '2027-11-17' }, TODAY).error, undefined);
    assert.match(freeListingCodeRequest(undefined, TODAY).error, /last day/);
});

test('the code email shows the code, how to use it and the last day, and escapes what the admin typed', () => {
    const html = freeListingCodeEmailHtml({
        code: 'FREE-7KQ3-MZ2P',
        name: '<b>Sam</b>',
        note: 'Thanks for <helping>',
        expiresOn: '2027-02-14',
        siteUrl: 'https://example.com/',
    });
    assert.match(html, /FREE-7KQ3-MZ2P/);
    assert.match(html, /Hi &lt;b&gt;Sam&lt;\/b&gt;/);
    assert.match(html, /Thanks for &lt;helping&gt;/);
    assert.doesNotMatch(html, /<b>Sam<\/b>/);
    assert.match(html, /14 February 2027/);
    assert.match(html, /href="https:\/\/example\.com\/CreateListing"/);
    assert.match(emailText(html), /Have a free listing code\?/);
});

test('the code email works without a name or note', () => {
    const html = freeListingCodeEmailHtml({ code: 'FREE-7KQ3-MZ2P', name: null, note: null, expiresOn: '2027-02-14' });
    assert.match(html, /Hi there,/);
    assert.doesNotMatch(html, /A note from us/);
});
