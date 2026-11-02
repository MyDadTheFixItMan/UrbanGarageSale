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
