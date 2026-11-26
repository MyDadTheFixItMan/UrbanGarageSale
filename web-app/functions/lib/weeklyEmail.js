// The weekly "sales near you" email, sent every Friday just after midnight (sendWeeklySalesEmail
// in index.js). Pure functions: no Firebase or SendGrid, so they are unit tested directly
// (functions/test/weeklyEmail.test.js).
const crypto = require('node:crypto');
const { distanceBetween } = require('geofire-common');
const {
    EMAIL_COLOURS, EMAIL_FONT, escapeHtml, siteBase, emailLayout, emailParagraph, emailLink,
} = require('./helpers');

// Sales within this distance of the user's area are included.
const WEEKLY_RADIUS_KM = 25;
// The email lists at most this many sales; the button leads to the rest.
const WEEKLY_MAX_SALES = 12;
// The email covers the sales on from today (Friday) to the Thursday after.
const WEEKLY_DAYS = 7;

// YYYY-MM-DD `days` after the YYYY-MM-DD `date`.
function addDays(date, days) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// The user's area as [lat, lng] (profile fields area_lat/area_lng, set by the website when the
// address is saved), or null if it hasn't been found.
function userArea(user) {
    const lat = user?.area_lat;
    const lng = user?.area_lng;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return [lat, lng];
}

// True if the user wants the weekly email. Everyone gets it until they turn it off.
const wantsWeeklyEmail = (user) => user?.weekly_email !== false;

// Live sales on at some point from `today` to the end of the week (YYYY-MM-DD strings).
function salesThisWeek(listings, today) {
    const lastDay = addDays(today, WEEKLY_DAYS - 1);
    return listings.filter((listing) => listing.status === 'active' &&
        typeof listing.start_date === 'string' && typeof listing.end_date === 'string' &&
        listing.end_date >= today && listing.start_date <= lastDay);
}

// The sales within `radiusKm` of `area`, each with its distance_km, soonest first, then nearest.
function salesNear(listings, area, radiusKm = WEEKLY_RADIUS_KM) {
    return listings
        .filter((listing) => Number.isFinite(listing.latitude) && Number.isFinite(listing.longitude))
        .map((listing) => ({ ...listing, distance_km: distanceBetween(area, [listing.latitude, listing.longitude]) }))
        .filter((listing) => listing.distance_km <= radiusKm)
        .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.distance_km - b.distance_km);
}

// A new unsubscribe token: random, so a link can't be guessed or made from a user ID.
const newUnsubscribeToken = () => crypto.randomBytes(24).toString('base64url');

// True if `given` matches the user's saved token. Compared in constant time.
function tokenMatches(saved, given) {
    if (typeof saved !== 'string' || typeof given !== 'string' || !saved || saved.length !== given.length) return false;
    return crypto.timingSafeEqual(Buffer.from(saved), Buffer.from(given));
}

const looksLikeToken = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value);

// "2026-11-28" -> "Sat 28 Nov".
function shortDate(date) {
    const [y, m, d] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
        .format(new Date(Date.UTC(y, m - 1, d)))
        .replace(',', '');
}

// "08:00" -> "8am", "13:30" -> "1:30pm", as on the website (web-app/src/lib/format.js).
function shortTime(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(value ?? '');
    if (!match) return '';
    const hours = Number(match[1]);
    const hour = hours % 12 || 12;
    const suffix = hours < 12 ? 'am' : 'pm';
    return match[2] === '00' ? `${hour}${suffix}` : `${hour}:${match[2]}${suffix}`;
}

// "Sat 28 Nov, 8am – 2pm" or "Sat 28 Nov – Sun 29 Nov, 8am – 2pm".
function saleWhen(listing) {
    const days = listing.start_date === listing.end_date
        ? shortDate(listing.start_date)
        : `${shortDate(listing.start_date)} – ${shortDate(listing.end_date)}`;
    const times = [shortTime(listing.start_time), shortTime(listing.end_time)].filter(Boolean).join(' – ');
    return times ? `${days}, ${times}` : days;
}

// "garage_sale" -> "Garage Sale".
const saleTypeLabel = (type) => String(type || 'garage_sale').split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

// The cover photo, only if it's one of the site's Firebase Storage files.
function coverPhoto(listing) {
    const url = listing.thumbnails?.[0] || listing.photos?.[0];
    return typeof url === 'string' && url.startsWith('https://firebasestorage.googleapis.com/') ? url : null;
}

function distanceText(km) {
    return km < 1 ? 'under 1 km away' : `${Math.round(km)} km away`;
}

// One sale in the list: photo (if any), title, type, suburb and distance, and when it's on.
// Tables and padded cells rather than margins, so Outlook lays it out too.
function saleCard(listing, site) {
    const c = EMAIL_COLOURS;
    const url = `${site}/ListingDetails?id=${encodeURIComponent(listing.id)}`;
    const photo = coverPhoto(listing);
    const photoCell = photo
        ? `<td width="96" valign="top" style="width:96px;padding:0 14px 0 0;"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(photo)}" width="96" height="96" alt="" style="display:block;border:0;width:96px;height:96px;object-fit:cover;border-radius:8px;"></a></td>`
        : '';
    const place = [listing.suburb, distanceText(listing.distance_km)].filter(Boolean).map(escapeHtml).join(' · ');
    return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:0 0 12px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr><td bgcolor="${c.cream}" style="background:${c.cream};border-left:4px solid ${c.orange};border-radius:8px;padding:12px;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                                    ${photoCell}
                                    <td valign="top" style="font-family:${EMAIL_FONT};font-size:14px;line-height:1.5;color:${c.text};">
                                        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color:${c.navy};font-size:16px;font-weight:bold;text-decoration:none;">${escapeHtml(listing.title || 'Garage sale')}</a><br>
                                        <span style="color:${c.teal};font-weight:bold;">${escapeHtml(saleTypeLabel(listing.sale_type))}</span><br>
                                        ${place}<br>
                                        <strong style="color:${c.navy};">${escapeHtml(saleWhen(listing))}</strong>
                                    </td>
                                </tr></table>
                            </td></tr>
                        </table>
                    </td></tr>
                </table>`;
}

const firstName = (fullName) => String(fullName || '').trim().split(/\s+/)[0] || 'there';

// The weekly email. `sales` come from salesNear; only the first WEEKLY_MAX_SALES are listed.
function weeklySalesEmailHtml({ fullName, suburb, sales, siteUrl, unsubscribeUrl }) {
    const site = siteBase(siteUrl);
    const count = sales.length;
    const shown = sales.slice(0, WEEKLY_MAX_SALES);
    const area = suburb ? escapeHtml(suburb) : 'you';
    const salesWord = count === 1 ? 'sale' : 'sales';
    const more = count > shown.length
        ? emailParagraph(`That's ${shown.length} of the ${count} ${salesWord} near ${area}. See them all on the map.`)
        : '';
    return emailLayout({
        siteUrl,
        preheader: `${count} garage ${salesWord} within ${WEEKLY_RADIUS_KM} km of ${suburb || 'you'} this week.`,
        heading: `Garage sales near ${area} this week`,
        body: [
            emailParagraph(`Hi ${escapeHtml(firstName(fullName))},`),
            emailParagraph(`Here ${count === 1 ? 'is the <strong>1</strong> sale' : `are the <strong>${count}</strong> sales`} on within ${WEEKLY_RADIUS_KM} km of ${area} from today to next Thursday. Happy treasure hunting!`),
            ...shown.map((listing) => saleCard(listing, site)),
            more,
        ].join('\n'),
        button: { label: 'Find more sales near you', url: site },
        note: `You received this email because you have an Urban Garage Sales account. ${emailLink('Unsubscribe from these weekly emails', unsubscribeUrl)}, or turn them off on your ${emailLink('profile', `${site}/Profile`)}.`,
    });
}

// The page the unsubscribe link opens, in the same look as the emails. `state` is 'confirm'
// (a button that posts to `actionUrl`), 'done' or 'invalid'.
function unsubscribePageHtml({ state, actionUrl, siteUrl }) {
    const site = siteBase(siteUrl);
    const c = EMAIL_COLOURS;
    const pages = {
        confirm: {
            heading: 'Unsubscribe from weekly emails?',
            body: [
                emailParagraph("You'll stop getting our Friday email of garage sales near you. Emails about your own listings still come as usual."),
                `<form method="post" action="${escapeHtml(actionUrl)}" style="margin:8px 0 28px;"><button type="submit" style="padding:14px 32px;border:0;border-radius:8px;background:${c.orangeDark};color:#ffffff;font-family:${EMAIL_FONT};font-size:17px;font-weight:bold;cursor:pointer;">Unsubscribe</button></form>`,
            ].join('\n'),
        },
        done: {
            heading: "You're unsubscribed",
            body: emailParagraph(`We won't send you the weekly sales email any more. Changed your mind? Turn it back on any time on your ${emailLink('profile', `${site}/Profile`)}.`),
            button: { label: 'Find sales near you', url: site },
        },
        invalid: {
            heading: "This link doesn't work",
            body: emailParagraph(`It may be out of date or cut short. You can turn the weekly email off on your ${emailLink('profile', `${site}/Profile`)} instead.`),
            button: { label: 'Go to my profile', url: `${site}/Profile` },
        },
    };
    return emailLayout({ siteUrl, ...pages[state] });
}

module.exports = {
    WEEKLY_RADIUS_KM,
    WEEKLY_MAX_SALES,
    WEEKLY_DAYS,
    addDays,
    userArea,
    wantsWeeklyEmail,
    salesThisWeek,
    salesNear,
    newUnsubscribeToken,
    tokenMatches,
    looksLikeToken,
    saleWhen,
    saleTypeLabel,
    weeklySalesEmailHtml,
    unsubscribePageHtml,
};
