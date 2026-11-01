// Address lookups through the Maps JavaScript API that index.html already loads. Unlike the
// Geocoding web service (maps/api/geocode/json), this works with an API key locked to the
// website's address, so the key can't be copied and used from anywhere else.

// The Maps JavaScript API global (loaded by a script tag, so it has no imported types).
const maps = () => /** @type {any} */ (window).google?.maps;

async function loadGeocoder() {
    for (let attempt = 0; !maps()?.importLibrary && attempt < 50; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!maps()?.importLibrary) {
        throw new Error('Google Maps did not load');
    }
    const { Geocoder } = await maps().importLibrary('geocoding');
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
