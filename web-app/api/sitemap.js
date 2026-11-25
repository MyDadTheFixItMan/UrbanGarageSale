// /sitemap.xml (vercel.json): the public pages, every upcoming sale and every suburb with one,
// for Google Search Console. Built from the public listing copies (src/lib/seo/render.js).
import { sitemapXml } from '../src/lib/seo/render.js';
import { listPublicListings } from './_lib/publicListings.js';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).send('Method not allowed');
    }
    try {
        const listings = await listPublicListings();
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).send(sitemapXml(listings));
    } catch (error) {
        console.error('sitemap: could not read listings', error);
        res.setHeader('Retry-After', '600');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(503).send('Sitemap unavailable, try again later');
    }
}
