// Australian (en-AU) formatting helpers so dates and money render the same for every visitor,
// regardless of their browser's locale.

export const AU_LOCALE = 'en-AU';

const audFormatter = new Intl.NumberFormat(AU_LOCALE, { style: 'currency', currency: 'AUD' });

// e.g. 12.5 -> "$12.50". Pass { withCode: true } for "A$12.50" where currency could be ambiguous.
export function formatAud(amount, { withCode = false } = {}) {
    const value = Number(amount);
    const text = audFormatter.format(Number.isFinite(value) ? value : 0);
    return withCode ? `A${text}` : text;
}

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate(); // Firestore Timestamp
    if (value instanceof Date) return value;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        // Date-only strings are local calendar dates, not UTC midnight.
        const [y, m, d] = value.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

// e.g. "5/10/2026"
export function formatDateAU(value, fallback = '') {
    const date = toDate(value);
    return date ? date.toLocaleDateString(AU_LOCALE) : fallback;
}

// e.g. "5/10/2026, 2:30 pm"
export function formatDateTimeAU(value, fallback = '') {
    const date = toDate(value);
    return date
        ? date.toLocaleString(AU_LOCALE, { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : fallback;
}

// date-fns patterns in Australian day-month order.
export const AU_DATE = 'd MMM yyyy';
export const AU_DATE_TIME = 'd MMM yyyy, h:mm a';
export const AU_DAY_MONTH = 'd MMM';
export const AU_WEEKDAY_DATE = 'EEEE d MMMM';
