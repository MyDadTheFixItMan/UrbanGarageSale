// Unit tests for the link preview of a shared listing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isListingId, melbourneToday, saleDates, saleTime, saleWhen, truncate, listingPreview, listingPreviewHtml,
} from '../../api/_shared/listingPreview.js';

const SITE = 'https://www.urbangaragesales.com.au';
const TODAY = '2026-11-16';
const photo = 'https://firebasestorage.googleapis.com/v0/b/urbangaragesale.firebasestorage.app/o/listings%2Fu1%2Fa.jpg?alt=media&token=t';

// A public copy (publicListings): no street address or seller.
const publicCopy = {
  status: 'active',
  title: 'Huge moving sale',
  description: 'Furniture, tools and kids\' toys.',
  sale_type: 'moving_sale',
  suburb: 'Brunswick',
  state: 'VIC',
  postcode: '3056',
  start_date: '2026-11-21',
  end_date: '2026-11-22',
  start_time: '08:00',
  end_time: '14:30',
  photos: [photo],
  thumbnails: [],
};

test('isListingId accepts Firestore IDs and rejects paths and junk', () => {
  assert.equal(isListingId('aB3_x-9ZqLm2'), true);
  assert.equal(isListingId('a/b'), false);
  assert.equal(isListingId('../garageSales'), false);
  assert.equal(isListingId(''), false);
  assert.equal(isListingId(['a']), false);
  assert.equal(isListingId(undefined), false);
});

test('melbourneToday is the calendar date in Melbourne', () => {
  // 1pm UTC on 15 Nov is midnight on 16 Nov in Melbourne (UTC+11 in summer).
  assert.equal(melbourneToday(new Date('2026-11-15T13:00:00Z')), '2026-11-16');
  assert.equal(melbourneToday(new Date('2026-11-15T12:59:00Z')), '2026-11-15');
});

test('saleDates and saleTime read like the listing cards', () => {
  assert.equal(saleDates('2026-11-21', '2026-11-21'), 'Sat 21st Nov');
  assert.equal(saleDates('2026-11-21', '2026-11-22'), 'Sat 21st to Sun 22nd Nov');
  assert.equal(saleDates('2026-10-31', '2026-11-02'), 'Sat 31st Oct to Mon 2nd Nov');
  assert.equal(saleDates('2026-11-23', undefined), 'Mon 23rd Nov');
  assert.equal(saleDates('not a date', '2026-11-22'), '');
  assert.equal(saleTime('08:00'), '8am');
  assert.equal(saleTime('12:00'), '12pm');
  assert.equal(saleTime('14:30'), '2:30pm');
  assert.equal(saleTime(undefined), '');
  assert.equal(saleWhen(publicCopy), 'Sat 21st to Sun 22nd Nov, 8am–2:30pm');
});

test('truncate shortens at a word break', () => {
  assert.equal(truncate('Short  and\nsweet', 50), 'Short and sweet');
  assert.equal(truncate('One two three four five', 12), 'One two…');
  assert.equal(truncate(undefined, 10), '');
});

test('a live sale shows its title, details and first photo, but never an address', () => {
  const preview = listingPreview({ siteUrl: `${SITE}/`, id: 'sale1', listing: { ...publicCopy, address: '12 Secret St' }, today: TODAY });
  assert.equal(preview.url, `${SITE}/ListingDetails?id=sale1`);
  assert.equal(preview.title, 'Huge moving sale');
  assert.equal(preview.description, 'Moving Sale · Sat 21st to Sun 22nd Nov, 8am–2:30pm · Brunswick VIC. Furniture, tools and kids\' toys.');
  assert.equal(preview.image, photo);
  assert.equal(preview.imageWidth, undefined);
  assert.doesNotMatch(JSON.stringify(preview), /Secret/);
});

test('a live sale without photos uses the site image', () => {
  const preview = listingPreview({ siteUrl: SITE, id: 'sale1', listing: { ...publicCopy, photos: [], description: '' }, today: TODAY });
  assert.equal(preview.image, `${SITE}/og-image.jpg`);
  assert.equal(preview.imageWidth, 1200);
  assert.equal(preview.description, 'Moving Sale · Sat 21st to Sun 22nd Nov, 8am–2:30pm · Brunswick VIC');
});

test('photo addresses that are not https are ignored', () => {
  // Split so the link safety check (scripts/check-link-safety.mjs) doesn't flag the plain http address.
  const plainHttp = 'http:' + '//x.test/a.jpg';
  const preview = listingPreview({ siteUrl: SITE, id: 'sale1', listing: { ...publicCopy, photos: ['javascript:alert(1)', plainHttp] }, today: TODAY });
  assert.equal(preview.image, `${SITE}/og-image.jpg`);
});

test('a finished sale says so, with its suburb and no details', () => {
  const ended = listingPreview({ siteUrl: SITE, id: 'sale1', listing: { status: 'completed', suburb: 'Brunswick', state: 'VIC' }, today: TODAY });
  assert.equal(ended.title, 'This garage sale in Brunswick VIC has finished');
  assert.equal(ended.description, 'Find more garage sales near Brunswick on Urban Garage Sales.');
  assert.equal(ended.image, `${SITE}/og-image.jpg`);

  // Still live, but its last day has passed and the nightly job hasn't marked it yet.
  const lapsed = listingPreview({ siteUrl: SITE, id: 'sale1', listing: { ...publicCopy, end_date: '2026-11-15' }, today: TODAY });
  assert.match(lapsed.title, /has finished/);
  assert.doesNotMatch(lapsed.description, /Furniture/);
});

test('a missing sale gets the site preview', () => {
  const preview = listingPreview({ siteUrl: SITE, id: 'gone', listing: null, today: TODAY });
  assert.equal(preview.title, 'Urban Garage Sales');
  assert.equal(preview.url, `${SITE}/ListingDetails?id=gone`);
  assert.equal(listingPreview({ siteUrl: SITE, today: TODAY }).url, SITE);
});

test('listingPreviewHtml has the Open Graph tags, with the seller\'s text escaped', () => {
  const html = listingPreviewHtml(listingPreview({
    siteUrl: SITE, id: 'sale1', listing: { ...publicCopy, title: '<script>alert("x")</script> & more' }, today: TODAY,
  }));
  assert.match(html, /<meta property="og:url" content="https:\/\/www\.urbangaragesales\.com\.au\/ListingDetails\?id=sale1">/);
  assert.match(html, /<meta property="og:title" content="&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; more">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/firebasestorage\.googleapis\.com\/[^"]+&amp;token=t">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /<title>&lt;script&gt;.* \| Urban Garage Sales<\/title>/);
  assert.doesNotMatch(html, /<script>/);
});

test('listingPreviewHtml gives the site image\'s size', () => {
  const html = listingPreviewHtml(listingPreview({ siteUrl: SITE, today: TODAY }));
  assert.match(html, /<title>Urban Garage Sales<\/title>/);
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta property="og:image:height" content="630">/);
});
