const test = require('node:test');
const assert = require('node:assert/strict');
const { geohashForLocation } = require('geofire-common');
const { publicListing, toGrid, GRID_DEGREES } = require('../lib/publicListing');

const listing = {
    title: 'Big family garage sale',
    description: 'Furniture and toys.',
    address: '12 Example St, Ocean Grove VIC 3226',
    suburb: 'Ocean Grove',
    postcode: '3226',
    state: 'VIC',
    latitude: -38.26431,
    longitude: 144.52187,
    geohash: geohashForLocation([-38.26431, 144.52187]),
    start_date: '2026-12-05',
    end_date: '2026-12-06',
    start_time: '08:00',
    end_time: '14:00',
    sale_type: 'garage_sale',
    photos: ['p1'],
    thumbnails: ['t1'],
    status: 'active',
    payment_status: 'paid',
    user_id: 'seller-1',
    draft_expires_at: null,
};

test('the public copy has no street address, seller or payment details', () => {
    const copy = publicListing(listing);
    for (const field of ['address', 'user_id', 'payment_status', 'draft_expires_at']) {
        assert.equal(field in copy, false, field);
    }
    assert.equal(copy.suburb, 'Ocean Grove');
    assert.equal(copy.title, listing.title);
    assert.deepEqual(copy.photos, ['p1']);
    assert.equal(copy.approximate_location, true);
});

test('the public pin is the middle of a grid square, not the house', () => {
    const copy = publicListing(listing);
    assert.notEqual(copy.latitude, listing.latitude);
    assert.ok(Math.abs(copy.latitude - listing.latitude) <= GRID_DEGREES / 2);
    assert.ok(Math.abs(copy.longitude - listing.longitude) <= GRID_DEGREES / 2);
    assert.equal(copy.geohash, geohashForLocation([copy.latitude, copy.longitude]));
    assert.notEqual(copy.geohash, listing.geohash);
    // Neighbouring houses get the same pin.
    const nextDoor = publicListing({ ...listing, latitude: -38.2645, longitude: 144.5221 });
    assert.equal(nextDoor.latitude, copy.latitude);
    assert.equal(nextDoor.longitude, copy.longitude);
    assert.equal(toGrid(-38.26431), -38.27);
});

test('only live listings have a public copy', () => {
    for (const status of ['draft', 'pending_payment', 'pending_approval', 'completed', 'rejected', undefined]) {
        assert.equal(publicListing({ ...listing, status }), null, String(status));
    }
    assert.equal(publicListing(undefined), null);
});

test('a listing without coordinates has none in its copy', () => {
    const copy = publicListing({ ...listing, latitude: null, longitude: null, geohash: undefined });
    assert.equal('latitude' in copy, false);
    assert.equal('geohash' in copy, false);
});
