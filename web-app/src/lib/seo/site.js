// The site's addresses, page titles and descriptions, shared by the website (document titles,
// links) and the server pages that search engines read (api/page.js, api/sitemap.js). Only
// relative imports, no "@/" alias, because the server functions import this file too.
import { SALE_TYPE_LABELS } from '../listings.js';

export const SITE_URL = 'https://www.urbangaragesales.com.au';
export const SITE_NAME = 'Urban Garage Sales';

// Every page of the app. `path` is the address search engines are given (the lowercase ones are
// the public pages; app pages keep the addresses that emails, Stripe and posters already use).
// `index: false` pages are left out of search results.
export const PAGE_META = Object.freeze({
    Home: {
        path: '/',
        title: 'Garage Sales Near You',
        description: 'Find garage sales, yard sales and moving sales near you across Australia, or list your own.',
        heading: 'Find garage sales near you',
        index: true,
    },
    About: {
        path: '/about',
        title: 'About Us',
        description: 'Urban Garage Sales makes it easy to find and promote garage sales, yard sales and moving sales in your local area.',
        heading: 'About Urban Garage Sales',
        index: true,
    },
    Contact: {
        path: '/contact',
        title: 'Contact Us',
        description: 'Get in touch with the Urban Garage Sales team with a question about a listing, your account or the site.',
        heading: 'Contact Urban Garage Sales',
        index: true,
    },
    Privacy: {
        path: '/privacy',
        title: 'Privacy Policy',
        description: 'How Urban Garage Sales collects, uses and protects your personal information.',
        heading: 'Privacy Policy',
        index: true,
    },
    Terms: {
        path: '/terms',
        title: 'Terms of Use',
        description: 'The terms for using Urban Garage Sales to find or list garage sales.',
        heading: 'Terms of Use',
        index: true,
    },
    CreateListing: { path: '/CreateListing', title: 'List Your Sale', index: false },
    SavedListings: { path: '/SavedListings', title: 'Favourites', index: false },
    Login: { path: '/Login', title: 'Sign In', index: false },
    Profile: { path: '/Profile', title: 'My Account', index: false },
    Payment: { path: '/Payment', title: 'Payment', index: false },
    ResetPassword: { path: '/ResetPassword', title: 'Reset Password', index: false },
    AdminDashboard: { path: '/AdminDashboard', title: 'Admin', index: false },
    UrbanPay: { path: '/UrbanPay', title: 'Urban Pay', index: false },
    ListingDetails: { path: '/ListingDetails', title: 'Garage Sale', index: false },
});

// "About Us | Urban Garage Sales". The home page leads with the site's name.
export function documentTitle(title) {
    if (!title) return SITE_NAME;
    return title === PAGE_META.Home.title ? `${SITE_NAME} | ${title}` : `${title} | ${SITE_NAME}`;
}

// The browser tab title for one of the PAGE_META pages, or null for pages that set their own.
export function pageDocumentTitle(pageName) {
    const meta = PAGE_META[pageName];
    return meta ? documentTitle(meta.title) : null;
}

export const STATES = Object.freeze({
    NSW: { name: 'New South Wales', timeZone: 'Australia/Sydney' },
    VIC: { name: 'Victoria', timeZone: 'Australia/Melbourne' },
    QLD: { name: 'Queensland', timeZone: 'Australia/Brisbane' },
    SA: { name: 'South Australia', timeZone: 'Australia/Adelaide' },
    WA: { name: 'Western Australia', timeZone: 'Australia/Perth' },
    TAS: { name: 'Tasmania', timeZone: 'Australia/Hobart' },
    ACT: { name: 'Australian Capital Territory', timeZone: 'Australia/Sydney' },
    NT: { name: 'Northern Territory', timeZone: 'Australia/Darwin' },
});

// "vic" -> "VIC", or null if it isn't a state.
export function stateFromSlug(slug) {
    const code = String(slug ?? '').toUpperCase();
    return Object.hasOwn(STATES, code) ? code : null;
}

// "St Kilda East" -> "st-kilda-east", "O'Connor" -> "oconnor".
export function slugify(text) {
    return String(text ?? '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// "st-kilda-east" -> "St Kilda East", for a suburb page with no sales to take the name from.
export function suburbNameFromSlug(slug) {
    return String(slug ?? '')
        .split('-')
        .filter(Boolean)
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(' ');
}

const placeOf = (listing) => {
    const state = String(listing?.state ?? '').toUpperCase();
    return listing?.suburb && Object.hasOwn(STATES, state) ? { suburb: String(listing.suburb), state } : null;
};

// "/garage-sales/vic/coburg"
export function suburbPath(suburb, state) {
    return `/garage-sales/${String(state).toLowerCase()}/${slugify(suburb)}`;
}

// "/sale/coburg-vic/abc123": the suburb and the listing's ID, never the street address.
export function salePath(listing, id) {
    const place = placeOf(listing);
    if (!place || !id) return null;
    return `/sale/${slugify(place.suburb)}-${place.state.toLowerCase()}/${encodeURIComponent(id)}`;
}

// Where the website links a listing: its sale page while it's live, otherwise the listing page
// that owners and admins use for drafts and listings awaiting approval.
export function listingPath(listing, id = listing?.id) {
    return (listing?.status === 'active' && salePath(listing, id)) || `/ListingDetails?id=${encodeURIComponent(id ?? '')}`;
}

// "Garage Sale", "Moving Sale", "Multi-Family Sale".
export function saleTypeName(listing) {
    const label = SALE_TYPE_LABELS[listing?.sale_type] || SALE_TYPE_LABELS.garage_sale;
    return /(sale|auction)$/i.test(label) ? label : `${label} Sale`;
}

// "Big Moving Sale – Coburg VIC"
export function saleTitle(listing) {
    const place = placeOf(listing);
    const where = place ? `${place.suburb} ${place.state}` : '';
    const name = String(listing?.title ?? '').replace(/\s+/g, ' ').trim() || saleTypeName(listing);
    // "Moving sale in Coburg" already says where; "Moving sale" gets " – Coburg VIC".
    const saysWhere = place && name.toLowerCase().includes(place.suburb.toLowerCase());
    return where && !saysWhere ? `${name} – ${where}` : name;
}

// "Garage Sales in Coburg, VIC"
export function suburbTitle(suburb, state) {
    return `Garage Sales in ${suburb}, ${state}`;
}
