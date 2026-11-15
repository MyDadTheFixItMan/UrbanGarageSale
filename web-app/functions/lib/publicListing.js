// The copy of a live listing that visitors who aren't signed in can read (publicListings/{saleId}).
// Only signed-in users may read garageSales, which hold the street address and exact coordinates
// (firestore.rules). This copy keeps the suburb and moves the pin to the middle of a grid square
// about 2 km across, so the house can't be picked out but suburb searches and distances still work.
const { geohashForLocation } = require('geofire-common');

// Everything a listing card, map pin and listing page show, except the address and seller.
const PUBLIC_FIELDS = [
    'title', 'description', 'suburb', 'postcode', 'state', 'start_date', 'end_date',
    'start_time', 'end_time', 'sale_type', 'photos', 'thumbnails', 'status', 'created_at',
];

const GRID_DEGREES = 0.02;

// The middle of the grid square `value` falls in, to 4 decimal places.
function toGrid(value) {
    const middle = Math.floor(value / GRID_DEGREES) * GRID_DEGREES + GRID_DEGREES / 2;
    return Number(middle.toFixed(4));
}

// The public copy of a listing, or null if the listing isn't live (and so mustn't be public).
function publicListing(listing) {
    if (listing?.status !== 'active') return null;
    const copy = {};
    for (const field of PUBLIC_FIELDS) {
        if (listing[field] !== undefined) copy[field] = listing[field];
    }
    const lat = Number(listing.latitude);
    const lng = Number(listing.longitude);
    if (listing.latitude != null && listing.longitude != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        copy.latitude = toGrid(lat);
        copy.longitude = toGrid(lng);
        copy.geohash = geohashForLocation([copy.latitude, copy.longitude]);
    }
    copy.approximate_location = true;
    return copy;
}

module.exports = { publicListing, toGrid, GRID_DEGREES };
