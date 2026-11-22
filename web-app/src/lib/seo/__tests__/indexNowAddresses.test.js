// The Cloud Function that tells Bing about new sale pages (functions/lib/indexNow.js) keeps its
// own copy of the address helpers, because it can't import this ES module. Both must give the
// same addresses, or Bing is sent pages that don't exist.
import { SITE_URL, salePath, slugify, suburbPath } from '../site';

const indexNow = require('../../../../functions/lib/indexNow.js');

const listings = [
    { suburb: 'Ocean Grove', state: 'VIC' },
    { suburb: "O'Connor", state: 'act' },
    { suburb: 'St Kilda East', state: 'VIC' },
    { suburb: 'Mûrrûmbeena', state: 'VIC' },
    { suburb: '  Port  Melbourne ', state: 'VIC' },
    { suburb: 'Nowhere', state: 'Victoria' },
    { suburb: '', state: 'NSW' },
];

describe('IndexNow addresses match the website', () => {
    it('uses the same site address', () => {
        expect(indexNow.SITE_URL).toBe(SITE_URL);
    });

    it.each(listings)('gives the same sale and suburb paths for %o', (listing) => {
        expect(indexNow.slugify(listing.suburb)).toBe(slugify(listing.suburb));
        expect(indexNow.salePath(listing, 'abc-123')).toBe(salePath(listing, 'abc-123'));
        expect(indexNow.suburbPath(listing.suburb, listing.state)).toBe(suburbPath(listing.suburb, listing.state));
    });
});
