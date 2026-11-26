// Address lookups through the Maps JavaScript API (loaded on first use, lib/googleMaps.js). Unlike the
// Geocoding web service (maps/api/geocode/json), this works with an API key locked to the
// website's address, so the key can't be copied and used from anywhere else.

import { loadGoogleMaps } from '@/lib/googleMaps';

async function loadGeocoder() {
    const maps = await loadGoogleMaps();
    const { Geocoder } = await maps.importLibrary('geocoding');
    return new Geocoder();
}

// Google never answers a lookup from a site address the API key doesn't allow, so stop waiting.
const LOOKUP_TIMEOUT_MS = 8000;

function withTimeout(lookup) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Google Maps did not respond')), LOOKUP_TIMEOUT_MS);
    });
    return Promise.race([lookup, timeout]).finally(() => clearTimeout(timer));
}

// Returns the first match as { lat, lng, components }, or null when nothing matches.
// Throws if Google Maps can't be reached or doesn't respond.
/**
 * @param {string} address
 * @param {{ country?: string }} [options]
 */
export async function geocode(address, { country } = {}) {
    const geocoder = await loadGeocoder();
    const request = { address, region: 'au', ...(country ? { componentRestrictions: { country } } : {}) };
    try {
        const { results } = await withTimeout(geocoder.geocode(request));
        const result = results?.[0];
        if (!result) return null;
        return {
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng(),
            components: result.address_components || [],
        };
    } catch (error) {
        if (error?.code === 'ZERO_RESULTS') return null;
        throw error;
    }
}

// The address parts of the place at a point, for example its postcode and suburb, or null when
// Google has nothing there. Throws if Google Maps can't be reached or doesn't respond.
/**
 * @param {number} lat
 * @param {number} lng
 */
export async function reverseGeocode(lat, lng) {
    const geocoder = await loadGeocoder();
    try {
        const { results } = await withTimeout(geocoder.geocode({ location: { lat, lng }, region: 'au' }));
        return results?.length ? results.flatMap((result) => result.address_components || []) : null;
    } catch (error) {
        if (error?.code === 'ZERO_RESULTS') return null;
        throw error;
    }
}
