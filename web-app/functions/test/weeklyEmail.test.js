const test = require('node:test');
const assert = require('node:assert/strict');
const { emailText } = require('../lib/helpers');
const {
    WEEKLY_MAX_SALES, addDays, userArea, wantsWeeklyEmail, salesThisWeek, salesNear, newUnsubscribeToken,
    tokenMatches, looksLikeToken, saleWhen, saleTypeLabel, weeklySalesEmailHtml, unsubscribePageHtml,
} = require('../lib/weeklyEmail');

// Melbourne CBD, and points roughly 10 km and 40 km east of it.
const CBD = [-37.8136, 144.9631];
const listing = (overrides = {}) => ({
    id: 'sale1', title: 'Big clear-out', suburb: 'Richmond', sale_type: 'garage_sale', status: 'active',
    start_date: '2026-11-28', end_date: '2026-11-28', start_time: '08:00', end_time: '13:30',
    latitude: -37.8136, longitude: 145.0763, ...overrides,
});

test('addDays crosses month and year ends', () => {
    assert.equal(addDays('2026-11-27', 6), '2026-12-03');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('userArea needs two numeric coordinates in range', () => {
    assert.deepEqual(userArea({ area_lat: -37.81, area_lng: 144.96 }), [-37.81, 144.96]);
    assert.equal(userArea({ area_lat: '-37.81', area_lng: 144.96 }), null);
    assert.equal(userArea({ area_lat: -37.81 }), null);
    assert.equal(userArea({ area_lat: 120, area_lng: 144.96 }), null);
    assert.equal(userArea(undefined), null);
});

test('the weekly email is on unless the user turned it off', () => {
    assert.equal(wantsWeeklyEmail({}), true);
    assert.equal(wantsWeeklyEmail({ weekly_email: true }), true);
    assert.equal(wantsWeeklyEmail({ weekly_email: false }), false);
});

test('salesThisWeek keeps live sales on from Friday to the next Thursday', () => {
    const today = '2026-11-27'; // a Friday
    const sales = [
        listing({ id: 'on-now', start_date: '2026-11-26', end_date: '2026-11-27' }),
        listing({ id: 'thursday', start_date: '2026-12-03', end_date: '2026-12-03' }),
        listing({ id: 'next-friday', start_date: '2026-12-04', end_date: '2026-12-04' }),
        listing({ id: 'ended', start_date: '2026-11-25', end_date: '2026-11-26' }),
        listing({ id: 'pending', status: 'pending_approval' }),
        listing({ id: 'no-dates', start_date: undefined }),
    ];
    assert.deepEqual(salesThisWeek(sales, today).map((s) => s.id), ['on-now', 'thursday']);
});

test('salesNear keeps sales within 25 km, soonest then nearest', () => {
    const sales = [
        listing({ id: 'far', longitude: 145.4167 }),
        listing({ id: 'sunday-near', start_date: '2026-11-30', longitude: 144.9700 }),
        listing({ id: 'saturday-10km' }),
        listing({ id: 'saturday-1km', longitude: 144.9750 }),
        listing({ id: 'no-location', latitude: undefined }),
    ];
    const near = salesNear(sales, CBD);
    assert.deepEqual(near.map((s) => s.id), ['saturday-1km', 'saturday-10km', 'sunday-near']);
    assert.ok(near[1].distance_km > 9 && near[1].distance_km < 11);
});

test('unsubscribe tokens are random, url-safe and compared exactly', () => {
    const token = newUnsubscribeToken();
    assert.ok(looksLikeToken(token));
    assert.notEqual(token, newUnsubscribeToken());
    assert.equal(tokenMatches(token, token), true);
    assert.equal(tokenMatches(token, `${token.slice(0, -1)}${token.endsWith('x') ? 'y' : 'x'}`), false);
    assert.equal(tokenMatches(token, token.slice(1)), false);
    assert.equal(tokenMatches(undefined, token), false);
    assert.equal(tokenMatches('', ''), false);
    assert.equal(looksLikeToken('short'), false);
    assert.equal(looksLikeToken('a/b'.repeat(10)), false);
});

test('saleWhen shows the days and times', () => {
    assert.equal(saleWhen(listing()), 'Sat 28 Nov, 8am – 1:30pm');
    assert.equal(saleWhen(listing({ end_date: '2026-11-29', start_time: '', end_time: '' })), 'Sat 28 Nov – Sun 29 Nov');
});

test('saleTypeLabel turns the stored type into words', () => {
    assert.equal(saleTypeLabel('car_boot_sale'), 'Car Boot Sale');
    assert.equal(saleTypeLabel(undefined), 'Garage Sale');
});

test('the weekly email lists the sales in the house style and escapes typed text', () => {
    const sales = salesNear([listing({ title: '<b>Tools & toys</b>', thumbnails: ['https://firebasestorage.googleapis.com/v0/b/x/o/t.jpg'] })], CBD);
    const html = weeklySalesEmailHtml({
        fullName: 'Sam Smith', suburb: 'Fitzroy', sales, siteUrl: 'https://urbangaragesales.com.au/',
        unsubscribeUrl: 'https://example.test/unsub?u=a&t=b',
    });
    assert.match(html, /email-logo\.png/);
    assert.match(html, /Garage sales near Fitzroy this week/);
    assert.match(html, /Hi Sam,/);
    assert.match(html, /&lt;b&gt;Tools &amp; toys&lt;\/b&gt;/);
    assert.doesNotMatch(html, /<b>Tools/);
    assert.match(html, /ListingDetails\?id=sale1/);
    assert.match(html, /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/x\/o\/t\.jpg/);
    assert.match(html, /href="https:\/\/example\.test\/unsub\?u=a&amp;t=b"/);
    assert.match(html, /10 km away/);
    const text = emailText(html);
    assert.match(text, /Unsubscribe from these weekly emails \(https:\/\/example\.test\/unsub\?u=a&t=b\)/);
});

test('the weekly email shows at most WEEKLY_MAX_SALES and says how many more', () => {
    const sales = salesNear(Array.from({ length: WEEKLY_MAX_SALES + 3 }, (_, i) => listing({ id: `s${i}` })), CBD);
    const html = weeklySalesEmailHtml({ fullName: '', suburb: '', sales, siteUrl: '', unsubscribeUrl: 'https://example.test/u' });
    // A card without a photo links to its listing once, from the title.
    assert.equal(html.match(/ListingDetails\?id=/g).length, WEEKLY_MAX_SALES);
    assert.match(html, new RegExp(`That's ${WEEKLY_MAX_SALES} of the ${WEEKLY_MAX_SALES + 3} sales`));
});

test('a photo from anywhere but Firebase Storage is left out', () => {
    const sales = salesNear([listing({ photos: ['https://evil.test/x.jpg'] })], CBD);
    const html = weeklySalesEmailHtml({ fullName: 'A', suburb: 'B', sales, siteUrl: '', unsubscribeUrl: 'https://example.test/u' });
    assert.doesNotMatch(html, /evil\.test/);
});

test('the unsubscribe page asks first, then confirms', () => {
    const confirm = unsubscribePageHtml({ state: 'confirm', actionUrl: 'https://example.test/u?u=a&t=b', siteUrl: '' });
    assert.match(confirm, /<form method="post" action="https:\/\/example\.test\/u\?u=a&amp;t=b"/);
    assert.match(unsubscribePageHtml({ state: 'done', siteUrl: '' }), /You're unsubscribed/);
    assert.match(unsubscribePageHtml({ state: 'invalid', siteUrl: '' }), /This link doesn't work/);
});
