import { postcodeAndState } from '@/pages/login/loginForms';
import { geocode } from '@/lib/geocode';

// Suburb, postcode and state for a saved address. Someone who types their address instead of
// picking a suggestion has none of them, so they're looked up from the address. A failed lookup
// leaves them blank rather than stopping the account being saved.
/**
 * @param {string} address
 * @param {{ suburb?: string, postcode?: string, state?: string }} [known]
 */
export async function addressDetails(address, { suburb, postcode, state } = {}) {
    const parts = postcodeAndState(address, postcode, state);
    const details = { suburb: suburb || '', postcode: parts.postcode || '', state: parts.state || '' };
    if (!address?.trim() || (details.suburb && details.postcode && details.state)) return details;

    try {
        const place = await geocode(address, { country: 'AU' });
        const part = (type) => place?.components.find((c) => c.types.includes(type))?.short_name;
        return {
            suburb: details.suburb || part('locality') || '',
            postcode: details.postcode || part('postal_code') || '',
            state: details.state || part('administrative_area_level_1') || '',
        };
    } catch (error) {
        console.warn('Address lookup failed:', error);
        return details;
    }
}

// A profile's address on one line. Older profiles may hold the whole address in `address`.
/** @param {{ address?: string, suburb?: string, state?: string, postcode?: string }} [profile] */
export function displayAddress({ address, suburb, state, postcode } = {}) {
    const street = address?.trim();
    if (street && postcode && street.includes(postcode)) return street;
    return [street, [suburb, state, postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

// The area the weekly sales email covers: the address's map point rounded to 2 decimal places
// (about 1 km), so the profile never holds the exact spot of the house. Both are null when the
// address can't be found on the map, and the user then gets no weekly email.
/** @param {string} address */
export async function areaPoint(address) {
    const none = { area_lat: null, area_lng: null };
    if (!address?.trim()) return none;
    try {
        const place = await geocode(address, { country: 'AU' });
        if (!place) return none;
        return { area_lat: Number(place.lat.toFixed(2)), area_lng: Number(place.lng.toFixed(2)) };
    } catch (error) {
        console.warn('Area lookup failed:', error);
        return none;
    }
}

// True when a profile needs its weekly-email area looked up: it has an address but no area, or
// the address is changing.
/**
 * @param {{ address?: string, area_lat?: number | null }} [before]
 * @param {string} [address]
 */
export function needsAreaPoint(before = {}, address = before.address) {
    if (!address?.trim()) return false;
    return address !== before.address || typeof before.area_lat !== 'number';
}
