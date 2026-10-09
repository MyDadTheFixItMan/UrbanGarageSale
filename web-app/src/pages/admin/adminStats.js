// Pure data helpers for the admin dashboard. No React or Firebase, so they are unit tested directly.
// Totals and charts come from Firestore aggregation queries (firebase.entities.AdminStats); these
// helpers only shape the page of records currently loaded.
import { parseISO, isBefore, isAfter, startOfDay } from 'date-fns';

// Firestore Timestamp, Date or ISO string -> Date (null if none of those).
export function toDate(value) {
    if (value instanceof Date) return value;
    if (value?.toDate) return value.toDate();
    if (typeof value === 'string') return parseISO(value);
    return null;
}

// Users without a name never finished sign-up; they are hidden and offered for clean-up.
export function splitUsersByProfile(users) {
    const hasName = (u) => Boolean(u.full_name && u.full_name.trim() !== '');
    return {
        complete: users.filter(hasName),
        incomplete: users.filter((u) => !hasName(u)),
    };
}

// Australian postcodes are four digits; the user search only queries complete ones.
export function isFullPostcode(value) {
    return /^\d{4}$/.test(value);
}

// Pairs each payment with its listing and payer.
export function matchPayments(payments, listings, users) {
    const matched = {};
    for (const payment of payments) {
        matched[payment.id] = {
            sale: listings.find((s) => s.id === payment.garage_sale_id),
            user: users.find((u) => u.id === payment.user_id || (payment.user_email && u.email === payment.user_email)),
        };
    }
    return matched;
}

const DATE_FILTER_DAYS = { week: 7, month: 30 };

// Start of the "Date Paid" filter window, or null for all dates.
export function paymentsSince(dateFilter, now = new Date()) {
    if (dateFilter === 'today') return startOfDay(now);
    if (!DATE_FILTER_DAYS[dateFilter]) return null;
    const since = new Date(now);
    since.setDate(since.getDate() - DATE_FILTER_DAYS[dateFilter]);
    return since;
}

// Suburb/state filters apply to the payments' listings, so they run on the loaded payments.
export function filterPayments(payments, matched, { suburb = 'all', state = 'all' } = {}) {
    return payments.filter((payment) => {
        const sale = matched[payment.id]?.sale;
        if (suburb !== 'all' && sale?.suburb !== suburb) return false;
        if (state !== 'all' && sale?.state !== state) return false;
        return true;
    });
}

// Distinct non-empty values of a listing field across the payments' listings.
export function paymentListingValues(payments, matched, field) {
    return [...new Set(payments.map((p) => matched[p.id]?.sale?.[field]).filter(Boolean))];
}

export function isFreePeriodActive({ active, start, end }, today = new Date()) {
    if (!active || !start || !end) return false;
    const day = startOfDay(today);
    return !isBefore(day, startOfDay(parseISO(start))) && !isAfter(day, startOfDay(parseISO(end)));
}

export function nextPromoSequence(promotions) {
    return promotions.length > 0 ? Math.max(...promotions.map((p) => p.sequence || 0)) + 1 : 1;
}

// Moves the promotion at `index` up (-1) or down (+1) and renumbers all of them 1..n.
// Returns only the { id, sequence } updates that actually change something.
export function reorderPromotions(promotions, index, direction) {
    const target = index + direction;
    if (target < 0 || target >= promotions.length) return [];
    const order = [...promotions];
    [order[index], order[target]] = [order[target], order[index]];
    return order
        .map((p, i) => ({ id: p.id, sequence: i + 1, previous: p.sequence }))
        .filter((u) => u.sequence !== u.previous)
        .map(({ id, sequence }) => ({ id, sequence }));
}

export function filterMessages(messages, filter) {
    if (filter === 'waiting') return messages.filter((m) => !m.response);
    if (filter === 'closed') return messages.filter((m) => m.response);
    return messages;
}
