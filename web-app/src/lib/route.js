// Builds Google Maps driving routes. Pure helpers, so they can be unit tested directly.
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
// one, and so on. Google Maps links keep stops in the order given, so the order is decided here.
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

// A Google Maps directions link through `stops` in order. Without an origin, Google Maps starts
// from wherever the device is.
/**
 * @param {string | undefined} origin
 * @param {string[]} stops
 */
export function directionsUrl(origin, stops) {
    const destination = stops[stops.length - 1];
    const waypoints = stops.slice(0, -1).join('|');

    let url = `https://www.google.com/maps/dir/?api=1`;
    if (origin) url += `&origin=${encodeURIComponent(origin)}`;
    url += `&destination=${encodeURIComponent(destination)}`;
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
    return url;
}
