// Builds driving routes for Google Maps, or Apple Maps on Apple devices. Pure helpers, so they
// can be unit tested directly.
import { calculateDistance } from '@/api/firebase/listingSearch';

// The account's home address in a form Google Maps can pin down. Profiles usually hold only the
// street in `address`, with the state and postcode alongside it, and a street alone can match
// the same street name in another city.
export function fullHomeAddress(user) {
    const street = user?.address?.trim();
    if (!street) return undefined;

    const parts = [street];
    if (!user.postcode || !street.includes(user.postcode)) {
        parts.push([user.state, user.postcode].filter(Boolean).join(' '));
    }
    if (!/australia/i.test(street)) parts.push('Australia');
    return parts.filter(Boolean).join(', ');
}

// Where to send Google Maps for a sale: its coordinates, or its address if it has none.
export function saleLocation(sale) {
    return sale?.latitude && sale?.longitude ? `${sale.latitude},${sale.longitude}` : sale?.address;
}

// Orders sales for driving: the sale closest to `start` first, then whichever is closest to that
// one, and so on. Map links keep stops in the order given, so the order is decided here.
/**
 * @param {{ lat: number, lng: number }} start
 * @param {any[]} sales each with a latitude and longitude
 */
export function orderStopsFrom(start, sales) {
    const remaining = [...sales];
    const ordered = [];
    let { lat, lng } = start;
    while (remaining.length > 0) {
        const distances = remaining.map((sale) => calculateDistance(lat, lng, sale.latitude, sale.longitude));
        const [next] = remaining.splice(distances.indexOf(Math.min(...distances)), 1);
        ordered.push(next);
        lat = next.latitude;
        lng = next.longitude;
    }
    return ordered;
}

// Apple Maps links with several stops need iOS or iPadOS 18.4 or later. Older phones and tablets
// stay on Google Maps, so a route never loses stops. iPads ask for desktop sites by default, so
// Safari there looks like a Mac, except for its touch screen, and only its Safari version shows
// the OS. Real Macs all report the same old macOS version, so every Mac gets Apple Maps.
function supportsAppleDirections({ userAgent, maxTouchPoints }) {
    const looksLikeMac = /Macintosh/.test(userAgent);
    if (looksLikeMac && maxTouchPoints <= 1) return true;

    const version = /(?:iPhone OS|iPad; CPU OS) (\d+)_(\d+)/.exec(userAgent)
        || (looksLikeMac && /Version\/(\d+)\.(\d+)/.exec(userAgent));
    if (!version) return false;
    const [major, minor] = [Number(version[1]), Number(version[2])];
    return major > 18 || (major === 18 && minor >= 4);
}

function appleDirectionsUrl(origin, stops) {
    const destination = stops[stops.length - 1];

    let url = `https://maps.apple.com/directions?mode=driving`;
    if (origin) url += `&source=${encodeURIComponent(origin)}`;
    url += `&destination=${encodeURIComponent(destination)}`;
    for (const stop of stops.slice(0, -1)) url += `&waypoint=${encodeURIComponent(stop)}`;
    return url;
}

// A directions link through `stops` in order: Apple Maps on a Mac or a current iPhone or iPad,
// otherwise Google Maps. Without an origin, the map starts from wherever the device is.
/**
 * @param {string | undefined} origin
 * @param {string[]} stops
 * @param {{ userAgent: string, maxTouchPoints: number }} [device]
 */
export function directionsUrl(origin, stops, device = navigator) {
    if (supportsAppleDirections(device)) return appleDirectionsUrl(origin, stops);

    const destination = stops[stops.length - 1];
    const waypoints = stops.slice(0, -1).join('|');

    let url = `https://www.google.com/maps/dir/?api=1`;
    if (origin) url += `&origin=${encodeURIComponent(origin)}`;
    url += `&destination=${encodeURIComponent(destination)}`;
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
    return url;
}
