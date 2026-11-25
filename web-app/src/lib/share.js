// Sharing a listing: its link, the words that go with it, and links that start a share on
// Facebook, WhatsApp or email. Only what the public listing page shows is used, never the street
// address. Pure helpers apart from openShareSheet and copyText, so they are unit tested directly.
import { saleDatesLabel, formatTimeAU } from '@/lib/format';
import { SALE_TYPE_LABELS } from '@/lib/listings';

// How a link was shared. It goes in the link's utm_source (with utm_medium=share), so visits from
// shared links show up in analytics, split by how they were shared.
export const SHARE_CHANNELS = Object.freeze({
    SHARE_SHEET: 'share_sheet',
    COPY_LINK: 'copy_link',
    FACEBOOK: 'facebook',
    WHATSAPP: 'whatsapp',
    EMAIL: 'email',
    POST_TEXT: 'post_text',
});

/**
 * The listing's page, tagged with how it was shared.
 * @param {string} origin the site's address, e.g. https://www.urbangaragesales.com.au
 * @param {string} listingId
 * @param {string} [channel] one of SHARE_CHANNELS
 */
export function listingShareUrl(origin, listingId, channel) {
    const url = new URL('/ListingDetails', origin);
    url.searchParams.set('id', listingId);
    if (channel) {
        url.searchParams.set('utm_source', channel);
        url.searchParams.set('utm_medium', 'share');
    }
    return url.toString();
}

// "Garage Sale", "Moving Sale". Badges say just "Multi-Family", but in a sentence it needs "Sale".
export function saleTypeName(listing) {
    const label = SALE_TYPE_LABELS[listing?.sale_type] || SALE_TYPE_LABELS.garage_sale;
    return /(sale|auction)$/i.test(label) ? label : `${label} Sale`;
}

// "Brunswick VIC"
export const salePlace = (listing) => [listing?.suburb, listing?.state].filter(Boolean).join(' ');

// "Sat 21st Nov · 8am–2pm"
export function saleWhenText(listing) {
    const days = saleDatesLabel(listing?.start_date, listing?.end_date);
    const hours = listing?.start_time && listing?.end_time
        ? `${formatTimeAU(listing.start_time)}–${formatTimeAU(listing.end_time)}`
        : '';
    return [days, hours].filter(Boolean).join(' · ');
}

// "Moving Sale in Brunswick VIC"
function saleHeadline(listing) {
    const place = salePlace(listing);
    return place ? `${saleTypeName(listing)} in ${place}` : saleTypeName(listing);
}

// One line to go with the link: "Moving Sale in Brunswick VIC · Sat 21st Nov · 8am–2pm".
export function listingShareText(listing) {
    return [saleHeadline(listing), saleWhenText(listing)].filter(Boolean).join(' · ');
}

// What the device's share sheet is given. Apps that take a title get the listing's.
export function shareSheetData(listing, url) {
    return { title: listing?.title || saleHeadline(listing), text: listingShareText(listing), url };
}

// Ready-made words for a post in a Facebook group, on Instagram or anywhere else.
export function listingPostText(listing, url) {
    const lines = [`🏷️ ${saleHeadline(listing)}`];
    const when = saleWhenText(listing);
    if (when) lines.push(`📅 ${when}`);
    if (listing?.title) lines.push(listing.title);
    lines.push('', `Photos, map and details: ${url}`);
    return lines.join('\n');
}

export const facebookShareUrl = (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

export function whatsAppShareUrl(listing, url) {
    const lines = [listing?.title, listingShareText(listing), url].filter(Boolean);
    return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function emailShareUrl(listing, url) {
    const subject = listing?.title ? `${listing.title} – ${saleHeadline(listing)}` : saleHeadline(listing);
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(listingPostText(listing, url))}`;
}

// A file name for the listing's flyer: "garage-sale-brunswick.jpg".
export function flyerFileName(listing) {
    const words = `${saleTypeName(listing)} ${listing?.suburb || ''}`.toLowerCase().match(/[a-z0-9]+/g) || ['garage', 'sale'];
    return `${words.join('-')}.jpg`;
}

/**
 * Opens the device's share sheet (the Web Share API, on phones and some computers).
 * Resolves to 'shared', 'cancelled' (the person closed it) or 'unavailable' (no share sheet, or the
 * browser refused), so the caller can offer another way.
 * @param {ShareData} data
 * @returns {Promise<'shared' | 'cancelled' | 'unavailable'>}
 */
export async function openShareSheet(data) {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return 'unavailable';
    if (data.files && !navigator.canShare?.(data)) return 'unavailable';
    try {
        await navigator.share(data);
        return 'shared';
    } catch (error) {
        return error?.name === 'AbortError' ? 'cancelled' : 'unavailable';
    }
}

// Copies text to the clipboard. Resolves to false if the browser wouldn't.
export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
