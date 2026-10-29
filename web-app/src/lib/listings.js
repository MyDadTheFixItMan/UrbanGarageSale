// The listing data model shared by the pages and the Firebase layer. firestore.rules and the
// Cloud Functions use the same values.
//
// Field naming: listings (garageSales), payments, users and savedListings use snake_case
// (user_id, garage_sale_id, created_at). Urban Pay's sales, sellerStats and saleStats use
// camelCase (sellerId, garageSaleId, createdAt) because the mobile app and API read them that
// way. New fields follow the convention of the collection they are added to.

export const LISTING_STATUS = Object.freeze({
    DRAFT: 'draft',
    PENDING_PAYMENT: 'pending_payment',
    PENDING_APPROVAL: 'pending_approval',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    REJECTED: 'rejected',
});

export const PAYMENT_STATUS = Object.freeze({
    PENDING: 'pending',
    PAID: 'paid',
    COMPLETED: 'completed',
    FREE: 'free',
    REFUNDED: 'refunded',
});

const PAID_STATUSES = [PAYMENT_STATUS.PAID, PAYMENT_STATUS.COMPLETED, PAYMENT_STATUS.FREE];

export const isPaid = (paymentStatus) => PAID_STATUSES.includes(paymentStatus);

// Approved, or paid and awaiting approval.
export const isLiveStatus = (listing) =>
    listing.status === LISTING_STATUS.ACTIVE || listing.status === LISTING_STATUS.PENDING_APPROVAL;

export const isUnpaidDraft = (listing) =>
    listing.status === LISTING_STATUS.DRAFT || listing.status === LISTING_STATUS.PENDING_PAYMENT;

// Mirrors isPaidOrApproved() in firestore.rules.
export const isPaidOrApproved = (listing) => isLiveStatus(listing) || isPaid(listing.payment_status);

// The image to show for a listing in lists and on the map: the cover photo's thumbnail when
// there is one, otherwise the full-size cover photo.
export const coverImage = (listing) => listing?.thumbnails?.[0] || listing?.photos?.[0] || null;
