// GET /api/listingPreview?id=… : the link preview for a shared listing (_shared/listingPreview.js).
// web-app/vercel.json rewrites requests for /ListingDetails?id=… from link-preview bots (Facebook,
// WhatsApp, iMessage, X, LinkedIn, Slack and others) to here; people still get the website.
// Reads only the public copy of a listing, which has no street address, and for a sale that has
// finished, its suburb.
import { getFirestore } from './_shared/firebase-admin.js';
import { getTrustedOrigin } from './_shared/security.js';
import { isListingId, listingPreview, listingPreviewHtml } from './_shared/listingPreview.js';

const DEFAULT_SITE_URL = 'https://www.urbangaragesales.com.au';

// The address the link was shared with (Vercel passes the visitor's host on as x-forwarded-host),
// if it's one of the site's own addresses.
function siteUrlFor(req) {
  const fallback = process.env.FRONTEND_URL || DEFAULT_SITE_URL;
  const host = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  return host ? getTrustedOrigin(`https://${host}`, fallback) : fallback;
}

async function findListing(id) {
  const db = getFirestore();
  const publicCopy = await db.collection('publicListings').doc(id).get();
  if (publicCopy.exists) return publicCopy.data();

  // The public copy is deleted when a sale ends, but where it was is still worth showing.
  // Nothing about sales that were never approved is shown.
  const sale = await db.collection('garageSales').doc(id).get();
  const data = sale.exists ? sale.data() : null;
  return data?.status === 'completed' ? { status: 'completed', suburb: data.suburb, state: data.state } : null;
}

export default async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = isListingId(req.query?.id) ? req.query.id : undefined;
  let listing = null;
  if (id) {
    try {
      listing = await findListing(id);
    } catch (error) {
      // A preview without the sale's details is still better than no preview.
      console.error('listingPreview: could not read listing', id, error);
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(listingPreviewHtml(listingPreview({ siteUrl: siteUrlFor(req), id, listing })));
};
