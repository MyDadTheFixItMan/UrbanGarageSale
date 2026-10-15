// Address lookups through the Maps JavaScript API that index.html already loads. Unlike the
// Geocoding web service (maps/api/geocode/json), this works with an API key locked to the
// website's address, so the key can't be copied and used from anywhere else.

async function loadGeocoder() {
    for (let attempt = 0; !window.google?.maps?.importLibrary && attempt < 50; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!window.google?.maps?.importLibrary) {
        throw new Error('Google Maps did not load');
    }
    const { Geocoder } = await window.google.maps.importLibrary('geocoding');
    return new Geocoder();
}

// Returns the first match as { lat, lng, components }, or null when nothing matches.
// Throws if Google Maps can't be reached.
export async function geocode(address, { country } = {}) {
    const geocoder = await loadGeocoder();
    const request = { address, region: 'au', ...(country ? { componentRestrictions: { country } } : {}) };
    try {
        const { results } = await geocoder.geocode(request);
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
