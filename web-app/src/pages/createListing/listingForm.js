// Pure helpers for the create/edit listing form. No React or Firebase, so they are unit tested directly.
import { LISTING_STATUS, PAYMENT_STATUS, isPaid, isPaidOrApproved } from '@/lib/listings';

export { isPaid, isPaidOrApproved };

export const MAX_PHOTOS = 5;
export const MAX_SALE_DAYS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTO_WIDTH = 2560;
export const MAX_PHOTO_HEIGHT = 1920;
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const DRAFT_LIFETIME_MS = 2 * 24 * 60 * 60 * 1000;

// Once a listing is paid for or approved, these can't change (enforced by firestore.rules).
export const LOCKED_FIELDS = ['start_date', 'end_date', 'start_time', 'end_time', 'address', 'suburb',
    'postcode', 'state', 'latitude', 'longitude', 'geohash'];

export const SALE_TYPES = [
    ['garage_sale', 'Garage Sale'],
    ['yard_sale', 'Yard Sale'],
    ['estate_sale', 'Estate Sale'],
    ['moving_sale', 'Moving Sale'],
    ['multi_family', 'Multi-Family Sale'],
    ['clearing_sale', 'Clearing Sale'],
    ['auction', 'Auction'],
    ['street_sale', 'Street Sale'],
];

export const STATES = [
    ['NSW', 'New South Wales'],
    ['VIC', 'Victoria'],
    ['QLD', 'Queensland'],
    ['SA', 'South Australia'],
    ['WA', 'Western Australia'],
    ['TAS', 'Tasmania'],
    ['ACT', 'Australian Capital Territory'],
    ['NT', 'Northern Territory'],
];

export const EMPTY_FORM = {
    title: '',
    description: '',
    address: '',
    suburb: '',
    postcode: '',
    state: '',
    latitude: null,
    longitude: null,
    start_date: '',
    end_date: '',
    start_time: '08:00',
    end_time: '15:00',
    sale_type: 'garage_sale',
    photos: [],
    thumbnails: [],
};


// thumbnails[i] is the small version of photos[i], or null for photos uploaded before
// thumbnails existed.
export function alignThumbnails(photos, thumbnails = []) {
    return photos.map((_, i) => thumbnails[i] ?? null);
}

// The form's fields filled from a saved listing.
export function formFromListing(listing) {
    const form = {};
    for (const [field, fallback] of Object.entries(EMPTY_FORM)) {
        form[field] = listing[field] ?? fallback;
    }
    form.thumbnails = alignThumbnails(form.photos, listing.thumbnails);
    return form;
}

// Returns the first problem with the form, or null if it can be submitted.
export function listingFormProblem(form) {
    if (!form.title.trim()) return 'Please enter a title';
    if (!form.address.trim()) return 'Please enter an address';
    if (!form.start_date) return 'Please select a start date';
    if (!form.end_date) return 'Please select an end date';

    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    if (end < start) return 'End date must be after start date';
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days > MAX_SALE_DAYS) return `Sales can only run for a maximum of ${MAX_SALE_DAYS} consecutive days`;
    return null;
}

// Free-period dates may be stored as YYYY-MM-DD strings or Firestore Timestamps.
function toDateString(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return date.toISOString().split('T')[0];
}

// True if the admin's free period is on and the sale starts inside it (same test as
// isFreeListing() in firestore.rules, which has the final say).
export function isInFreePeriod(settings, startDate) {
    if (!settings?.is_active || !startDate) return false;
    const from = toDateString(settings.free_listing_start);
    const to = toDateString(settings.free_listing_end);
    return Boolean(from && to) && startDate >= from && startDate <= to;
}

// The listing document to save. Paid listings keep their status; paid or approved listings
// leave their locked fields out, so the update doesn't touch them.
export function buildSaleData(form, { asDraft, isFree, alreadyPaid, locked, coords, now = Date.now() }) {
    /** @type {string} */
    let status = LISTING_STATUS.PENDING_PAYMENT;
    if (asDraft) status = LISTING_STATUS.DRAFT;
    else if (isFree) status = LISTING_STATUS.ACTIVE;

    const data = {
        ...form,
        latitude: coords.lat,
        longitude: coords.lng,
        draft_expires_at: asDraft ? new Date(now + DRAFT_LIFETIME_MS).toISOString() : null,
        ...(alreadyPaid ? {} : { status, payment_status: isFree ? PAYMENT_STATUS.COMPLETED : PAYMENT_STATUS.PENDING }),
    };
    if (locked) {
        LOCKED_FIELDS.forEach((field) => delete data[field]);
    }
    return data;
}

// Returns why a chosen photo can't be uploaded, or null. `dimensions` is { width, height } or null.
export function photoProblem(file, dimensions) {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return `"${file.name}" - Only JPEG, PNG, or WEBP images allowed`;
    if (file.size > MAX_PHOTO_BYTES) return `"${file.name}" exceeds 5MB limit`;
    if (dimensions && (dimensions.width > MAX_PHOTO_WIDTH || dimensions.height > MAX_PHOTO_HEIGHT)) {
        return `"${file.name}" exceeds max resolution (${MAX_PHOTO_WIDTH}×${MAX_PHOTO_HEIGHT}). Current: ${dimensions.width}×${dimensions.height}`;
    }
    return null;
}
