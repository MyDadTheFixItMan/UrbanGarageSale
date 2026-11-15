// Pure data helpers for the admin dashboard. No React or Firebase, so they are unit tested directly.
// Totals and charts come from Firestore aggregation queries (firebase.entities.AdminStats); these
// helpers only shape the page of records currently loaded.
import { parseISO, isBefore, isAfter, startOfDay, format, addDays } from 'date-fns';

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

// ---------- Free listing periods ----------
// The Settings tab edits them as { ALL: period, VIC: period, ... } with period = { active, start,
// end } (dates as YYYY-MM-DD). ALL is the period for all of Australia, stored on the settings
// document itself; each state's is stored in free_listing_states under its code. isFreeListing()
// in firestore.rules reads the same fields.
export const ALL_STATES_PERIOD = 'ALL';

// A stored date (YYYY-MM-DD, or a Firestore Timestamp from older settings) for a date input.
function dateInputValue(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const date = toDate(value);
    return date && !Number.isNaN(date.getTime()) ? format(date, 'yyyy-MM-dd') : '';
}

function editablePeriod(stored) {
    return {
        active: stored?.is_active === true,
        start: dateInputValue(stored?.free_listing_start),
        end: dateInputValue(stored?.free_listing_end),
    };
}

function storedPeriod({ active, start, end }) {
    return { is_active: active, free_listing_start: start, free_listing_end: end };
}

/**
 * @param {any} settings the appSettings/default document
 * @param {string[]} states state codes, e.g. ['NSW', 'VIC']
 */
export function freePeriodsFromSettings(settings, states) {
    return Object.fromEntries([
        [ALL_STATES_PERIOD, editablePeriod(settings)],
        ...states.map((state) => [state, editablePeriod(settings?.free_listing_states?.[state])]),
    ]);
}

// The settings fields to save. Every state is written, so switching one off sticks.
/**
 * @param {Record<string, { active: boolean, start: string, end: string }>} periods
 * @param {string[]} states
 */
export function freePeriodsToSettings(periods, states) {
    return {
        ...storedPeriod(periods[ALL_STATES_PERIOD]),
        free_listing_states: Object.fromEntries(states.map((state) => [state, storedPeriod(periods[state])])),
    };
}

// What's wrong with a period that is switched on, or null. Reads after the period's name,
// e.g. "Victoria needs a start and an end date".
export function freePeriodProblem({ active, start, end }) {
    if (!active) return null;
    if (!start || !end) return 'needs a start and an end date';
    if (end < start) return 'ends before it starts';
    return null;
}

// ---------- Free listing codes ----------
// How a code shows on the Settings tab: 'unused', 'used', 'cancelled', or 'expired' for an unused
// code whose last day (expires_on, YYYY-MM-DD) has passed.
export function freeCodeStatus(code, today = new Date()) {
    if (code?.status === 'unused' && code.expires_on && code.expires_on < format(today, 'yyyy-MM-dd')) return 'expired';
    return code?.status || 'unused';
}

// The expiry date a new code starts with: 90 days from today.
export function defaultFreeCodeExpiry(today = new Date()) {
    return format(addDays(today, 90), 'yyyy-MM-dd');
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
