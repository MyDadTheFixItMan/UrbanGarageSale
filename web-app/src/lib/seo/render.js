// The pages search engines read. The website builds its pages in the browser, so the HTML it
// sends is the same near-empty shell for every address. api/page.js fills that shell in on the
// server instead: each page's own title, description, canonical address and a readable copy of
// its content (replaced by the real page once the app loads), plus Event structured data for
// sales and a real 404 for addresses that don't exist. api/sitemap.js lists the pages.
// Pure helpers (no network), so they are unit tested directly (__tests__/render.test.js).
// Only public listing copies (publicListings) are used, which have no street address.
import { saleDatesLabel, formatTimeAU } from '../format.js';
import {
    PAGE_META, SITE_NAME, SITE_URL, STATES, documentTitle, salePath, saleTitle, saleTypeName,
    slugify, stateFromSlug, suburbNameFromSlug, suburbPath, suburbTitle,
} from './site.js';

const DEFAULT_IMAGE = { url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630 };

// Firestore document IDs only, so a value such as "a/b" can never address another document.
const LISTING_ID = /^[A-Za-z0-9_-]{1,128}$/;
export const isListingId = (value) => typeof value === 'string' && LISTING_ID.test(value);

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Inside <script type="application/ld+json">: "<" is escaped so text can't close the tag.
const jsonForScript = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

// Shortens text to `max` characters at a word break, with an ellipsis.
export function truncate(text, max) {
    const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max - 1);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:–-]+$/, '')}…`;
}

// Today in Melbourne as YYYY-MM-DD, the date the nightly job uses to end sales.
export function melbourneToday(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(now);
}

const isCalendarDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');
const lastDay = (listing) => (isCalendarDate(listing?.end_date) ? listing.end_date : listing?.start_date);

// A live sale that hasn't finished yet. Public copies are deleted when a sale ends, but the
// nightly job runs once a day, so a sale that ended yesterday may still have one this morning.
export function isUpcomingSale(listing, today = melbourneToday()) {
    return listing?.status === 'active' && isCalendarDate(lastDay(listing)) && lastDay(listing) >= today;
}

const isHttpsUrl = (value) => {
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
};

const salePhoto = (listing) => [...(listing?.photos ?? []), ...(listing?.thumbnails ?? [])].find(isHttpsUrl);

// "Sat 21st Nov · 8am–2pm"
export function saleWhen(listing) {
    const hours = listing?.start_time && listing?.end_time
        ? `${formatTimeAU(listing.start_time)}–${formatTimeAU(listing.end_time)}`
        : '';
    return [saleDatesLabel(listing?.start_date, listing?.end_date), hours].filter(Boolean).join(' · ');
}

const place = (listing) => [listing?.suburb, listing?.state].filter(Boolean).join(' ');

// "Moving Sale · Sat 21st Nov · 8am–2pm · Coburg VIC. Furniture, tools and …"
export function saleDescription(listing, max = 160) {
    const facts = [saleTypeName(listing), saleWhen(listing), place(listing)].filter(Boolean).join(' · ');
    return truncate(listing?.description ? `${facts}. ${listing.description}` : facts, max);
}

// The UTC offset ("+11:00") in a time zone at a local date and time, daylight saving included.
export function utcOffset(date, time, timeZone) {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = (/^\d{1,2}:\d{2}/.test(time ?? '') ? time : '00:00').split(':').map(Number);
    const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
        .formatToParts(guess)
        .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
    const match = /GMT([+-]\d{2}):?(\d{2})?/.exec(name);
    return match ? `${match[1]}:${match[2] ?? '00'}` : '+00:00';
}

function isoDateTime(date, time, timeZone) {
    if (!isCalendarDate(date)) return undefined;
    if (!/^\d{1,2}:\d{2}/.test(time ?? '')) return date;
    const [hh, mm] = time.split(':');
    return `${date}T${hh.padStart(2, '0')}:${mm.slice(0, 2)}:00${utcOffset(date, time, timeZone)}`;
}

// schema.org Event, which lets Google show a sale's date and suburb in search results. The
// location is the suburb only: the street address is only shown to signed-in visitors.
export function saleEventJsonLd(listing, id) {
    const state = String(listing.state ?? '').toUpperCase();
    const timeZone = STATES[state]?.timeZone ?? 'Australia/Melbourne';
    const url = `${SITE_URL}${salePath(listing, id)}`;
    const photo = salePhoto(listing);
    return {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: truncate(listing.title || saleTypeName(listing), 150),
        description: truncate(listing.description || saleDescription(listing), 500),
        startDate: isoDateTime(listing.start_date, listing.start_time, timeZone),
        endDate: isoDateTime(lastDay(listing), listing.end_time, timeZone),
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        isAccessibleForFree: true,
        url,
        image: [photo || DEFAULT_IMAGE.url],
        location: {
            '@type': 'Place',
            name: place(listing),
            address: {
                '@type': 'PostalAddress',
                addressLocality: listing.suburb,
                addressRegion: state,
                ...(listing.postcode ? { postalCode: String(listing.postcode) } : {}),
                addressCountry: 'AU',
            },
        },
        organizer: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    };
}

/**
 * What an address is. `pathname` is as requested (case matters: /About moves to /about).
 * @returns {{ type: 'static', page: string } | { type: 'redirect', location: string }
 *   | { type: 'sale', id: string, placeSlug: string } | { type: 'listingDetails', id?: string }
 *   | { type: 'suburb', state: string, suburbSlug: string } | { type: 'notFound' }}
 */
export function resolveRoute(pathname, search = '') {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    const query = new URLSearchParams(search);
    const keepQuery = search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : '';

    if (path === '/' || path === '') return { type: 'static', page: 'Home' };

    const sale = /^\/sale\/([a-z0-9-]+)\/([A-Za-z0-9_-]{1,128})$/i.exec(path);
    if (sale) return { type: 'sale', placeSlug: sale[1].toLowerCase(), id: sale[2] };

    const suburb = /^\/garage-sales\/([a-z]{2,3})\/([a-z0-9-]+)$/i.exec(path);
    if (suburb && stateFromSlug(suburb[1])) {
        const canonical = suburbPath(suburb[2], suburb[1]);
        if (canonical !== path) return { type: 'redirect', location: canonical + keepQuery };
        return { type: 'suburb', state: stateFromSlug(suburb[1]), suburbSlug: suburb[2] };
    }

    // The app's pages match whatever the case (React Router), so /about and /About both work.
    // Public pages have one lowercase address; the others are left as they are.
    const pageName = Object.keys(PAGE_META).find((name) => `/${name}`.toLowerCase() === path.toLowerCase()
        || PAGE_META[name].path.toLowerCase() === path.toLowerCase());
    if (pageName) {
        const meta = PAGE_META[pageName];
        if (meta.index && path !== meta.path) return { type: 'redirect', location: meta.path + keepQuery };
        if (pageName === 'ListingDetails') {
            const id = query.get('id');
            return { type: 'listingDetails', ...(isListingId(id) ? { id } : {}) };
        }
        return { type: 'static', page: pageName };
    }
    return { type: 'notFound' };
}

const NAV_LINKS = ['Home', 'About', 'Contact', 'Privacy', 'Terms'];

function navHtml() {
    const links = NAV_LINKS.map((name) => `<a href="${PAGE_META[name].path}" class="underline">${escapeHtml(name)}</a>`);
    return `<nav class="mt-8 flex flex-wrap gap-4 text-sm">${links.join('')}</nav>`;
}

const wrap = (inner) => `<main class="max-w-3xl mx-auto px-4 py-10 text-slate-700">${inner}${navHtml()}</main>`;

// The tags in the <head> that differ from page to page.
export function headHtml({ title, description, canonical, index = true, image = DEFAULT_IMAGE, ogType = 'website', jsonLd = [] }) {
    const e = escapeHtml;
    const fullTitle = documentTitle(title);
    const size = image.width && image.height
        ? `\n    <meta property="og:image:width" content="${e(image.width)}" />\n    <meta property="og:image:height" content="${e(image.height)}" />`
        : '';
    const tags = [
        `<title>${e(fullTitle)}</title>`,
        `<meta name="description" content="${e(description)}" />`,
        canonical ? `<link rel="canonical" href="${e(canonical)}" />` : '',
        index ? '' : '<meta name="robots" content="noindex" />',
        `<meta property="og:type" content="${e(ogType)}" />`,
        `<meta property="og:title" content="${e(title === PAGE_META.Home.title ? SITE_NAME : title)}" />`,
        `<meta property="og:description" content="${e(description)}" />`,
        canonical ? `<meta property="og:url" content="${e(canonical)}" />` : '',
        `<meta property="og:image" content="${e(image.url)}" />${size}`,
        `<meta property="og:image:alt" content="${e(image.alt || SITE_NAME)}" />`,
        '<meta name="twitter:card" content="summary_large_image" />',
        ...jsonLd.map((data) => `<script type="application/ld+json">${jsonForScript(data)}</script>`),
    ];
    return tags.filter(Boolean).map((tag) => `    ${tag}`).join('\n');
}

const HEAD_BLOCK = /<!--seo:head-->[\s\S]*?<!--\/seo:head-->/;
const BODY_BLOCK = /<!--seo:body-->[\s\S]*?<!--\/seo:body-->/;

// Puts a page's head tags and content into the website's index.html (between its seo markers).
export function fillShell(shell, { head, body }) {
    if (!HEAD_BLOCK.test(shell) || !BODY_BLOCK.test(shell)) throw new Error('index.html has no seo markers');
    return shell
        .replace(HEAD_BLOCK, () => `<!--seo:head-->\n${head}\n    <!--/seo:head-->`)
        .replace(BODY_BLOCK, () => `<!--seo:body-->${body}<!--/seo:body-->`);
}

export function staticPage(pageName) {
    const meta = PAGE_META[pageName];
    const description = meta.description ?? PAGE_META.Home.description;
    return {
        status: 200,
        head: headHtml({ title: meta.title, description, canonical: meta.index ? `${SITE_URL}${meta.path}` : undefined, index: meta.index }),
        body: wrap(`<h1 class="text-2xl font-bold text-navy-dark">${escapeHtml(meta.heading ?? meta.title)}</h1><p class="mt-3">${escapeHtml(description)}</p>`),
    };
}

export function notFoundPage() {
    return {
        status: 404,
        head: headHtml({ title: 'Page not found', description: 'This page does not exist.', index: false }),
        body: wrap('<h1 class="text-2xl font-bold text-navy-dark">Page not found</h1><p class="mt-3">This page does not exist. <a href="/" class="underline">Find garage sales near you</a>.</p>'),
    };
}

function saleListItem(listing) {
    return `<li class="mt-3"><a href="${escapeHtml(salePath(listing, listing.id))}" class="font-semibold underline">${escapeHtml(listing.title || saleTypeName(listing))}</a>`
        + `<br><span class="text-sm">${escapeHtml([saleTypeName(listing), saleWhen(listing)].filter(Boolean).join(' · '))}</span></li>`;
}

/**
 * A sale's page. `listing` is its public copy (or null when it has none: never approved,
 * finished or deleted). `placeSlug` is the suburb part of the address that was asked for.
 * @returns {{ status: number, head: string, body: string } | { status: 301, location: string }}
 */
export function salePage({ id, listing, placeSlug, today = melbourneToday() }) {
    if (!listing || !isUpcomingSale(listing, today) || !salePath(listing, id)) {
        // Finished or never public. The app still loads, so a seller can see their own listing.
        const state = /-([a-z]{2,3})$/.exec(placeSlug ?? '')?.[1];
        const suburbSlug = placeSlug?.replace(/-[a-z]{2,3}$/, '');
        const more = state && stateFromSlug(state) && suburbSlug
            ? `<a href="${escapeHtml(suburbPath(suburbSlug, state))}" class="underline">Find more garage sales in ${escapeHtml(suburbNameFromSlug(suburbSlug))}</a>`
            : '<a href="/" class="underline">Find garage sales near you</a>';
        return {
            status: 404,
            head: headHtml({ title: 'This sale has finished', description: 'This garage sale has finished or is no longer listed.', index: false }),
            body: wrap(`<h1 class="text-2xl font-bold text-navy-dark">This sale has finished</h1><p class="mt-3">This garage sale has finished or is no longer listed. ${more}.</p>`),
        };
    }

    const path = salePath(listing, id);
    if (placeSlug !== undefined && `/sale/${placeSlug}/${encodeURIComponent(id)}` !== path) {
        return { status: 301, location: path };
    }
    const title = saleTitle(listing);
    const photo = salePhoto(listing);
    const description = saleDescription(listing);
    const moreLink = suburbPath(listing.suburb, listing.state);
    return {
        status: 200,
        head: headHtml({
            title,
            description,
            canonical: `${SITE_URL}${path}`,
            image: photo ? { url: photo, alt: truncate(listing.title || saleTypeName(listing), 100) } : DEFAULT_IMAGE,
            jsonLd: [saleEventJsonLd(listing, id)],
        }),
        body: wrap(
            `<h1 class="text-2xl font-bold text-navy-dark">${escapeHtml(listing.title || saleTypeName(listing))}</h1>`
            + `<p class="mt-3 font-semibold">${escapeHtml([saleTypeName(listing), saleWhen(listing), place(listing)].filter(Boolean).join(' · '))}</p>`
            + (listing.description ? `<p class="mt-3 whitespace-pre-line">${escapeHtml(truncate(listing.description, 2000))}</p>` : '')
            + `<p class="mt-6"><a href="${escapeHtml(moreLink)}" class="underline">More garage sales in ${escapeHtml(listing.suburb)}</a></p>`,
        ),
    };
}

const byStartDate = (a, b) => String(a.start_date).localeCompare(String(b.start_date)) || String(a.id).localeCompare(String(b.id));

/**
 * A suburb's page: its upcoming sales and links to other suburbs in the state with sales.
 * `listings` are the state's public listing copies, each with its `id`.
 */
export function suburbPage({ state, suburbSlug, listings, today = melbourneToday() }) {
    const upcoming = listings.filter((listing) => isUpcomingSale(listing, today) && salePath(listing, listing.id));
    const here = upcoming.filter((listing) => slugify(listing.suburb) === suburbSlug).sort(byStartDate);
    const suburb = here[0]?.suburb ?? suburbNameFromSlug(suburbSlug);
    const title = suburbTitle(suburb, state);
    const canonical = `${SITE_URL}${suburbPath(suburbSlug, state)}`;

    const others = new Map();
    for (const listing of upcoming) {
        const slug = slugify(listing.suburb);
        if (slug !== suburbSlug && !others.has(slug)) others.set(slug, listing.suburb);
    }
    const otherLinks = [...others.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .slice(0, 50)
        .map(([slug, name]) => `<li><a href="${escapeHtml(suburbPath(slug, state))}" class="underline">${escapeHtml(name)}</a></li>`);

    const description = here.length
        ? `${here.length} garage ${here.length === 1 ? 'sale' : 'sales'} coming up in ${suburb}, ${state}: dates, times and what's for sale. Find yard sales, moving sales and more on ${SITE_NAME}.`
        : `Find garage sales, yard sales and moving sales in ${suburb}, ${state}, or list your own on ${SITE_NAME}.`;

    const jsonLd = here.length
        ? [{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: title,
            itemListElement: here.map((listing, index) => ({ '@type': 'ListItem', position: index + 1, url: `${SITE_URL}${salePath(listing, listing.id)}` })),
        }]
        : [];

    return {
        status: 200,
        head: headHtml({ title, description, canonical, index: here.length > 0, jsonLd }),
        body: wrap(
            `<h1 class="text-2xl font-bold text-navy-dark">${escapeHtml(title)}</h1>`
            + (here.length
                ? `<ul class="mt-4">${here.map(saleListItem).join('')}</ul>`
                : `<p class="mt-3">There are no garage sales listed in ${escapeHtml(suburb)} right now.</p>`)
            + (otherLinks.length ? `<h2 class="mt-8 text-lg font-bold">Garage sales near ${escapeHtml(suburb)} in ${escapeHtml(STATES[state].name)}</h2><ul class="mt-2 columns-2">${otherLinks.join('')}</ul>` : ''),
        ),
    };
}

/**
 * The old listing page (/ListingDetails?id=…), which emails, posters and shared links use. It
 * points search engines at the sale's own page, and stays out of results when there isn't one.
 */
export function listingDetailsPage({ id, listing, today = melbourneToday() }) {
    if (id && listing && isUpcomingSale(listing, today) && salePath(listing, id)) {
        const page = salePage({ id, listing, today });
        return { ...page, status: 200 };
    }
    return {
        status: 200,
        head: headHtml({ title: PAGE_META.ListingDetails.title, description: PAGE_META.Home.description, index: false }),
        body: wrap('<h1 class="text-2xl font-bold text-navy-dark">Garage sale</h1>'),
    };
}

/**
 * sitemap.xml: the public pages, every upcoming sale and every suburb with one.
 * `listings` are public listing copies, each with its `id`.
 */
export function sitemapXml(listings, today = melbourneToday()) {
    const urls = Object.values(PAGE_META).filter((meta) => meta.index).map((meta) => `${SITE_URL}${meta.path}`);
    const suburbs = new Set();
    for (const listing of [...listings].sort(byStartDate)) {
        const path = isUpcomingSale(listing, today) && salePath(listing, listing.id);
        if (!path) continue;
        urls.push(`${SITE_URL}${path}`);
        suburbs.add(`${SITE_URL}${suburbPath(listing.suburb, listing.state)}`);
    }
    urls.push(...[...suburbs].sort());
    const entries = urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
