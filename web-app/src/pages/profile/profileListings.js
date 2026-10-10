// Pure helpers for the profile page's listings. No React or Firebase, so they are unit tested directly.
import { isBefore, parseISO, startOfDay } from 'date-fns';
import { passwordProblem } from '@/lib/password';

export const isUnpaidDraft = (listing) => listing.status === 'draft' || listing.status === 'pending_payment';

const isLiveStatus = (listing) => listing.status === 'active' || listing.status === 'pending_approval';
const PAID = ['paid', 'completed', 'free'];

function hasEnded(listing, today) {
    return Boolean(listing.end_date) && isBefore(parseISO(listing.end_date), startOfDay(today));
}

// Splits a seller's listings into the profile tabs.
// Active: approved or awaiting approval, paid (or free), with an end date that has not passed.
export function groupProfileListings(listings, today = new Date()) {
    return {
        active: listings.filter((l) => isLiveStatus(l) && l.end_date && !hasEnded(l, today) && PAID.includes(l.payment_status)),
        drafts: listings.filter(isUnpaidDraft),
        past: listings.filter((l) => l.status === 'completed' || (isLiveStatus(l) && hasEnded(l, today))),
    };
}

// Which actions the listing card offers for a listing.
export function listingActions(listing) {
    const viewable = ['active', 'pending_approval', 'completed', 'rejected'].includes(listing.status);
    return {
        view: viewable,
        edit: isUnpaidDraft(listing) || listing.status === 'active',
        pay: isUnpaidDraft(listing),
        print: isLiveStatus(listing),
    };
}

// Returns the first problem with the change-password form, or null if it can be submitted.
export function changePasswordProblem({ currentPassword, newPassword, confirmPassword }) {
    if (!currentPassword) return 'Please enter your current password';
    if (!newPassword) return 'Please enter a new password';
    const problem = passwordProblem(newPassword);
    if (problem) return problem;
    if (newPassword !== confirmPassword) return 'New passwords do not match';
    return null;
}
