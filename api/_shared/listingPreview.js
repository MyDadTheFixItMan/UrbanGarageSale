// The link preview (Open Graph tags) for a shared listing: the photo, title and details that
// Facebook, WhatsApp, iMessage and other apps show under a link. Their preview bots don't run
// JavaScript, so they can't read the website's listing pages, and web-app/vercel.json sends them
// to api/listingPreview.js instead. Pure helpers: no Firebase, so they are unit tested directly
// (tests/api/listingPreview.test.js).

const SITE_NAME = 'Urban Garage Sale';

// The site's own share image (web-app/public/og-image.jpg), for sales without a photo and for
// sales that have finished.
const DEFAULT_IMAGE = { path: '/og-image.jpg', width: 1200, height: 630 };

// Must match SALE_TYPES in web-app/src/pages/createListing/listingForm.js.
const SALE_TYPE_LABELS = {
  garage_sale: 'Garage Sale',
  yard_sale: 'Yard Sale',
  estate_sale: 'Estate Sale',
  moving_sale: 'Moving Sale',
  multi_family: 'Multi-Family Sale',
  clearing_sale: 'Clearing Sale',
  auction: 'Auction',
  street_sale: 'Street Sale',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Firestore document IDs only, so a value such as "a/b" can never address another document.
const LISTING_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function isListingId(value) {
  return typeof value === 'string' && LISTING_ID.test(value);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Today in Melbourne as YYYY-MM-DD, the date the nightly job uses to end sales.
export function melbourneToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(now);
}

// Listings store their days as YYYY-MM-DD calendar dates. Read in UTC, so the server's time zone
// can't move them to the day before.
function calendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
}

function ordinal(day) {
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][day % 10] ?? 'th';
  return `${day}${suffix}`;
}

const dayLabel = (date) => `${WEEKDAYS[date.getUTCDay()]} ${ordinal(date.getUTCDate())}`;
const monthLabel = (date) => MONTHS[date.getUTCMonth()];

// The sale's days, as the website shows them on listing cards: "Sat 21st Nov", or
// "Sat 21st to Sun 22nd Nov" (the month only repeats when the sale runs into the next one).
export function saleDates(start, end) {
  const first = calendarDate(start);
  if (!first) return '';
  const last = calendarDate(end);
  if (!last || last <= first) return `${dayLabel(first)} ${monthLabel(first)}`;
  const sameMonth = first.getUTCMonth() === last.getUTCMonth() && first.getUTCFullYear() === last.getUTCFullYear();
  return `${dayLabel(first)}${sameMonth ? '' : ` ${monthLabel(first)}`} to ${dayLabel(last)} ${monthLabel(last)}`;
}

// "08:00" -> "8am", "13:30" -> "1:30pm".
export function saleTime(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? '');
  if (!match) return '';
  const hours = Number(match[1]);
  const hour = hours % 12 || 12;
  const suffix = hours < 12 ? 'am' : 'pm';
  return match[2] === '00' ? `${hour}${suffix}` : `${hour}:${match[2]}${suffix}`;
}

// "Sat 21st Nov, 8am–2pm"
export function saleWhen(listing) {
  const hours = listing.start_time && listing.end_time ? `${saleTime(listing.start_time)}–${saleTime(listing.end_time)}` : '';
  return [saleDates(listing.start_date, listing.end_date), hours].filter(Boolean).join(', ');
}

// Shortens text to `max` characters at a word break, with an ellipsis.
export function truncate(text, max) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:–-]+$/, '')}…`;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * What a shared link's preview says.
 * `listing` is the sale's public copy (publicListings), `{ status: 'completed', suburb, state }`
 * for a sale that has finished, or null when the sale can't be shown (missing, never approved).
 * The public copy has no street address, so the preview never shows one.
 * @param {{ siteUrl: string, id?: string, listing?: any, today?: string }} options
 */
export function listingPreview({ siteUrl, id, listing, today = melbourneToday() }) {
  const site = String(siteUrl).replace(/\/+$/, '');
  const url = id ? `${site}/ListingDetails?id=${encodeURIComponent(id)}` : site;
  const defaultImage = { image: `${site}${DEFAULT_IMAGE.path}`, imageWidth: DEFAULT_IMAGE.width, imageHeight: DEFAULT_IMAGE.height, imageAlt: SITE_NAME };
  const place = [listing?.suburb, listing?.state].filter(Boolean).join(' ');

  const finished = listing && (listing.status === 'completed' || (listing.status === 'active' && listing.end_date && listing.end_date < today));
  if (finished) {
    return {
      url,
      title: place ? `This garage sale in ${place} has finished` : 'This garage sale has finished',
      description: `Find more garage sales near ${listing.suburb || 'you'} on Urban Garage Sale.`,
      ...defaultImage,
    };
  }

  if (listing?.status === 'active') {
    const saleType = SALE_TYPE_LABELS[listing.sale_type] || 'Garage Sale';
    const facts = [saleType, saleWhen(listing), place].filter(Boolean).join(' · ');
    const photo = [...(listing.photos ?? []), ...(listing.thumbnails ?? [])].find(isHttpsUrl);
    const description = listing.description ? `${facts}. ${listing.description}` : facts;
    return {
      url,
      title: truncate(listing.title || [saleType, place && `in ${place}`].filter(Boolean).join(' '), 100),
      description: truncate(description, 200),
      ...(photo ? { image: photo, imageAlt: truncate(listing.title || saleType, 100) } : defaultImage),
    };
  }

  return {
    url,
    title: SITE_NAME,
    description: 'Find garage sales, yard sales and moving sales near you, or list your own.',
    ...defaultImage,
  };
}

// The page the preview bots read: Open Graph and X (Twitter) tags, plus a line of text and a link
// for anyone who opens it in a browser.
export function listingPreviewHtml(preview) {
  const e = escapeHtml;
  const pageTitle = preview.title === SITE_NAME ? SITE_NAME : `${preview.title} | ${SITE_NAME}`;
  const imageSize = preview.imageWidth && preview.imageHeight
    ? `\n<meta property="og:image:width" content="${e(preview.imageWidth)}">\n<meta property="og:image:height" content="${e(preview.imageHeight)}">`
    : '';
  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(pageTitle)}</title>
<meta name="description" content="${e(preview.description)}">
<link rel="canonical" href="${e(preview.url)}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_AU">
<meta property="og:url" content="${e(preview.url)}">
<meta property="og:title" content="${e(preview.title)}">
<meta property="og:description" content="${e(preview.description)}">
<meta property="og:image" content="${e(preview.image)}">${imageSize}
<meta property="og:image:alt" content="${e(preview.imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(preview.title)}">
<meta name="twitter:description" content="${e(preview.description)}">
<meta name="twitter:image" content="${e(preview.image)}">
</head>
<body>
<h1>${e(preview.title)}</h1>
<p>${e(preview.description)}</p>
<p><a href="${e(preview.url)}">Open on ${SITE_NAME}</a></p>
</body>
</html>
`;
}
