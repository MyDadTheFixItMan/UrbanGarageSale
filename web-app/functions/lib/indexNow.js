// IndexNow (https://www.indexnow.org): tells Bing, and through it DuckDuckGo and others, the
// moment a sale page appears, changes or goes away, instead of waiting for them to re-read the
// sitemap. Google doesn't use IndexNow; it reads /sitemap.xml.
//
// The key isn't a secret. Search engines check it by fetching
// https://www.urbangaragesales.com.au/<key>.txt (web-app/public/<key>.txt), which must contain
// exactly the key. Change both together.
const { emailLayout, emailParagraph, emailList, escapeHtml } = require('./helpers');

const INDEXNOW_KEY = 'b2a25ef8878f9a2a01b291923f6ecc7a'; // gitleaks:allow (public by design, see above)
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
// Must match SITE_URL in web-app/src/lib/seo/site.js (test/indexNow.test.js checks).
const SITE_URL = 'https://www.urbangaragesales.com.au';
const HOST = new URL(SITE_URL).host;

const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];

// Copies of slugify, suburbPath and salePath in web-app/src/lib/seo/site.js, which is an ES
// module the functions can't require. test/indexNow.test.js checks they give the same addresses.
function slugify(text) {
    return String(text ?? '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function placeOf(listing) {
    const state = String(listing?.state ?? '').toUpperCase();
    return listing?.suburb && STATES.includes(state) ? { suburb: String(listing.suburb), state } : null;
}

function suburbPath(suburb, state) {
    return `/garage-sales/${String(state).toLowerCase()}/${slugify(suburb)}`;
}

function salePath(listing, id) {
    const place = placeOf(listing);
    if (!place || !id) return null;
    return `/sale/${slugify(place.suburb)}-${place.state.toLowerCase()}/${encodeURIComponent(id)}`;
}

// The public pages of one public listing copy (lib/publicListing.js): its sale page and its
// suburb page. None if the copy is null (the listing isn't live) or has no usable suburb.
function pagesOf(copy, id) {
    const place = copy && placeOf(copy);
    if (!place) return [];
    return [salePath(copy, id), suburbPath(place.suburb, place.state)].map((path) => `${SITE_URL}${path}`);
}

// The addresses to tell search engines about when a listing's public copy goes from `before` to
// `after` (either may be null). Nothing if what the public sees hasn't changed, e.g. a payment
// field or the exact address moving within the same grid square. When it has, both the old and
// new pages: a page that went away needs re-reading too, so it drops out of search results.
function changedPages(before, after, id) {
    if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) return [];
    return [...new Set([...pagesOf(before, id), ...pagesOf(after, id)])];
}

// Sends the addresses to IndexNow. 200 and 202 mean accepted (202: key check still pending).
// Anything else throws, with IndexNow's reason, so the caller can report it.
async function submitToIndexNow(urlList, { fetchImpl = fetch } = {}) {
    if (!urlList.length) return null;
    const res = await fetchImpl(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList }),
        signal: AbortSignal.timeout(15000),
    });
    if (res.status === 200 || res.status === 202) return res.status;
    const reasons = {
        400: 'bad request',
        403: 'key not valid (is the key file reachable, or is the site still behind the firewall?)',
        422: 'the addresses don\'t belong to the host, or the key doesn\'t match',
        429: 'too many requests',
    };
    throw new Error(`IndexNow answered HTTP ${res.status}${reasons[res.status] ? `: ${reasons[res.status]}` : ''}`);
}

// The email to the admin when a submission fails. Search engines still find the page through
// the sitemap, so nothing is lost; this is so a broken submission doesn't go unnoticed.
function indexNowFailureEmailHtml({ saleId, urls, error }) {
    return emailLayout({
        siteUrl: SITE_URL,
        preheader: 'Bing wasn\'t told about a listing change.',
        heading: 'IndexNow submission failed',
        body: [
            emailParagraph(`Bing (and DuckDuckGo) weren't told about a change to listing <strong>${escapeHtml(saleId)}</strong>. They will still find it through the sitemap, just more slowly.`),
            emailParagraph(`<strong>Error:</strong> ${escapeHtml(error)}`),
            emailParagraph('The pages that weren\'t sent:'),
            emailList(urls.map((url) => escapeHtml(url))),
            emailParagraph('If this keeps happening, check that the key file opens in a browser and look at Bing Webmaster Tools → IndexNow.'),
        ].join(''),
        signoff: false,
    });
}

module.exports = {
    INDEXNOW_KEY,
    INDEXNOW_ENDPOINT,
    SITE_URL,
    slugify,
    suburbPath,
    salePath,
    pagesOf,
    changedPages,
    submitToIndexNow,
    indexNowFailureEmailHtml,
};
