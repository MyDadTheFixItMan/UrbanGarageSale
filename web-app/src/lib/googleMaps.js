// Loads Google's Maps JavaScript API (Places and Geocoding) the first time something needs it:
// an address box, or a suburb or postcode lookup. It used to load on every page from
// index.html, about 300 KB that most visitors never used.

const SCRIPT_ID = 'google-maps-js';
const CALLBACK = '__ugsGoogleMapsLoaded';
// Google never calls back for a key that refuses this site's address, so stop waiting.
const LOAD_TIMEOUT_MS = 10000;

/** @type {Promise<any> | null} */
let loading = null;

const maps = () => /** @type {any} */ (window).google?.maps;

/**
 * Resolves with `google.maps` once the API is ready. Safe to call any number of times.
 * @returns {Promise<any>}
 */
export function loadGoogleMaps() {
    if (maps()?.importLibrary) return Promise.resolve(maps());
    if (loading) return loading;

    loading = new Promise((resolve, reject) => {
        const w = /** @type {any} */ (window);
        const timer = setTimeout(() => fail(new Error('Google Maps did not load')), LOAD_TIMEOUT_MS);
        function fail(error) {
            clearTimeout(timer);
            loading = null; // let a later call try again
            document.getElementById(SCRIPT_ID)?.remove();
            reject(error);
        }
        w[CALLBACK] = () => {
            clearTimeout(timer);
            resolve(maps());
        };

        const params = new URLSearchParams({
            key: import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '',
            libraries: 'places',
            loading: 'async',
            callback: CALLBACK,
        });
        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.async = true;
        script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
        script.onerror = () => fail(new Error('Google Maps did not load'));
        document.head.appendChild(script);
    });
    return loading;
}
