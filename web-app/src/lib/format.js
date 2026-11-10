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

// e.g. "08:00" -> "8am", "13:30" -> "1:30pm". Anything else is returned as it is.
export function formatTimeAU(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(value ?? '');
    if (!match) return value ?? '';
    const hours = Number(match[1]);
    const suffix = hours < 12 ? 'am' : 'pm';
    const hour = hours % 12 || 12;
    return match[2] === '00' ? `${hour}${suffix}` : `${hour}:${match[2]}${suffix}`;
}

// The day a sale is on, as buyers think of it: "Today" (including multi-day sales already
// running), "Tomorrow", a weekday within the next week ("Sat"), otherwise "Sat 27 Apr".
export function saleDayLabel(start, end, now = new Date()) {
    const startDate = toDate(start);
    if (!startDate) return '';
    const endDate = toDate(end) ?? startDate;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Rounded so a daylight-saving change doesn't shift the count.
    const daysAway = (date) =>
        Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - today) / 86_400_000);

    const startsIn = daysAway(startDate);
    if (startsIn <= 0 && daysAway(endDate) >= 0) return 'Today';
    if (startsIn === 1) return 'Tomorrow';
    const weekday = startDate.toLocaleDateString(AU_LOCALE, { weekday: 'short' });
    if (startsIn > 1 && startsIn < 7) return weekday;
    return `${weekday} ${startDate.toLocaleDateString(AU_LOCALE, { day: 'numeric', month: 'short' })}`;
}

// e.g. "Today · 8am–3pm" for listing cards.
export function saleWhenLabel(sale, now = new Date()) {
    const day = saleDayLabel(sale.start_date, sale.end_date, now);
    const hours = sale.start_time && sale.end_time
        ? `${formatTimeAU(sale.start_time)}–${formatTimeAU(sale.end_time)}`
        : '';
    return [day, hours].filter(Boolean).join(' · ');
}

// e.g. 0.43 -> "0.4 km away", 9.97 -> "10 km away", 23.6 -> "24 km away".
export function formatDistanceKm(km) {
    if (!Number.isFinite(km)) return '';
    const tenths = Math.round(km * 10) / 10;
    return `${tenths < 10 ? tenths.toFixed(1) : Math.round(km)} km away`;
}
