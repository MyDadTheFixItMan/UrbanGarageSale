// Every page address that isn't a file (vercel.json sends them here): the website's index.html
// with that page's title, description, canonical address, structured data and a readable copy
// of its content filled in, and the right status (404 for addresses that don't exist, 301 from
// /About to /about). People get the same app as before; search engines get real pages.
// The pages themselves are built in src/lib/seo/render.js.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    fillShell, listingDetailsPage, notFoundPage, resolveRoute, salePage, staticPage, suburbPage,
} from '../src/lib/seo/render.js';
import { getPublicListing, listPublicListings } from './_lib/publicListings.js';

// index.html as built (vercel.json includes dist/index.html with this function).
let shell;
const loadShell = () => (shell ??= readFileSync(join(process.cwd(), 'dist', 'index.html'), 'utf8'));

const SITE_HOSTS = new Set(['www.urbangaragesales.com.au', 'urbangaragesales.com.au']);

// Cached at Vercel's edge for a few minutes, so a busy page doesn't read Firestore every time
// and a listing's changes still show up soon.
const CACHE = {
    static: 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    data: 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
};

async function buildPage(route) {
    switch (route.type) {
        case 'static':
            return { ...staticPage(route.page), cache: CACHE.static };
        case 'sale': {
            const listing = await getPublicListing(route.id);
            return { ...salePage({ id: route.id, listing, placeSlug: route.placeSlug }), cache: CACHE.data };
        }
        case 'listingDetails': {
            const listing = route.id ? await getPublicListing(route.id) : null;
            return { ...listingDetailsPage({ id: route.id, listing }), cache: CACHE.data };
        }
        case 'suburb': {
            const listings = await listPublicListings({ state: route.state });
            return { ...suburbPage({ state: route.state, suburbSlug: route.suburbSlug, listings }), cache: CACHE.data };
        }
        default:
            return { ...notFoundPage(), cache: CACHE.static };
    }
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).send('Method not allowed');
    }

    const url = new URL(req.url, 'https://www.urbangaragesales.com.au');
    // vercel.json passes the address that was asked for as ?path=; the rest of the query is the
    // visitor's own.
    const pathname = url.searchParams.get('path') || '/';
    url.searchParams.delete('path');

    // A build file that doesn't exist (an old one, after a new version went live). vercel.json
    // lets browsers keep /assets/ files for a year, so say clearly that this answer mustn't be kept.
    if (pathname.startsWith('/assets/')) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(404).send('Not found');
    }

    const route = resolveRoute(pathname.startsWith('/') ? pathname : `/${pathname}`, url.search);

    if (route.type === 'redirect') {
        res.setHeader('Cache-Control', CACHE.static);
        return res.redirect(301, route.location);
    }

    let page;
    try {
        page = await buildPage(route);
    } catch (error) {
        // Firestore couldn't be read. Search engines are told to come back later; people still
        // get the app, which loads the listing itself.
        console.error('page: could not build', pathname, error);
        page = { ...staticPage('Home'), status: 503, cache: 'no-store' };
        res.setHeader('Retry-After', '300');
    }

    if (page.status === 301) {
        res.setHeader('Cache-Control', CACHE.data);
        return res.redirect(301, page.location);
    }

    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
    if (!SITE_HOSTS.has(host)) res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', page.cache);
    return res.status(page.status).send(fillShell(loadShell(), page));
}
