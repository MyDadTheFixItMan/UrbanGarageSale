const test = require('node:test');
const assert = require('node:assert/strict');
const {
    INDEXNOW_KEY, INDEXNOW_ENDPOINT, SITE_URL, changedPages, pagesOf, submitToIndexNow, indexNowFailureEmailHtml,
} = require('../lib/indexNow');
const { publicListing } = require('../lib/publicListing');

const live = {
    title: 'Big family garage sale',
    suburb: 'Ocean Grove',
    state: 'VIC',
    start_date: '2026-12-05',
    end_date: '2026-12-06',
    status: 'active',
    latitude: -38.26431,
    longitude: 144.52187,
    address: '12 Example St, Ocean Grove VIC 3226',
    payment_status: 'paid',
};
const copy = (over = {}) => publicListing({ ...live, ...over });

const SALE = `${SITE_URL}/sale/ocean-grove-vic/abc123`;
const SUBURB = `${SITE_URL}/garage-sales/vic/ocean-grove`;

test('a listing going live sends its sale page and suburb page', () => {
    assert.deepEqual(changedPages(null, copy(), 'abc123'), [SALE, SUBURB]);
});

test('a listing ending or being deleted sends the same pages, so they drop out of results', () => {
    assert.deepEqual(changedPages(copy(), null, 'abc123'), [SALE, SUBURB]);
});

test('a change the public can\'t see sends nothing', () => {
    // payment and the exact address aren't in the public copy; a move within the grid square
    // leaves the pin where it was
    assert.deepEqual(changedPages(copy(), copy({ payment_status: 'refunded', latitude: -38.2644 }), 'abc123'), []);
    assert.deepEqual(changedPages(null, null, 'abc123'), []);
});

test('a visible edit resends the pages', () => {
    assert.deepEqual(changedPages(copy(), copy({ title: 'Even bigger sale' }), 'abc123'), [SALE, SUBURB]);
});

test('moving suburb sends the old and new pages', () => {
    assert.deepEqual(changedPages(copy(), copy({ suburb: 'Barwon Heads' }), 'abc123'), [
        SALE, SUBURB, `${SITE_URL}/sale/barwon-heads-vic/abc123`, `${SITE_URL}/garage-sales/vic/barwon-heads`,
    ]);
});

test('a listing without a usable suburb or state has no pages', () => {
    assert.deepEqual(pagesOf(copy({ state: 'Victoria' }), 'abc123'), []);
    assert.deepEqual(pagesOf(copy({ suburb: '' }), 'abc123'), []);
});

test('submits the host, key, key file and addresses', async () => {
    let call;
    const status = await submitToIndexNow([SALE], {
        fetchImpl: async (url, init) => { call = { url, init }; return { status: 202 }; },
    });
    assert.equal(status, 202);
    assert.equal(call.url, INDEXNOW_ENDPOINT);
    assert.equal(call.init.method, 'POST');
    assert.deepEqual(JSON.parse(call.init.body), {
        host: 'www.urbangaragesales.com.au',
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: [SALE],
    });
});

test('nothing to send makes no request', async () => {
    let called = false;
    assert.equal(await submitToIndexNow([], { fetchImpl: async () => { called = true; } }), null);
    assert.equal(called, false);
});

test('a refusal throws with the reason', async () => {
    await assert.rejects(submitToIndexNow([SALE], { fetchImpl: async () => ({ status: 403 }) }), /HTTP 403: key not valid/);
    await assert.rejects(submitToIndexNow([SALE], { fetchImpl: async () => ({ status: 500 }) }), /HTTP 500$/);
});

test('the key file in the website holds exactly the key', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const file = path.join(__dirname, '..', '..', 'public', `${INDEXNOW_KEY}.txt`);
    assert.equal(fs.readFileSync(file, 'utf8'), INDEXNOW_KEY);
    assert.match(INDEXNOW_KEY, /^[a-f0-9]{32}$/);
});

test('the failure email escapes what it shows', () => {
    const html = indexNowFailureEmailHtml({ saleId: 'abc123', urls: [SALE], error: 'HTTP 400 <bad>' });
    assert.match(html, /IndexNow submission failed/);
    assert.match(html, /abc123/);
    assert.match(html, /HTTP 400 &lt;bad&gt;/);
    assert.ok(html.includes(SALE));
});
