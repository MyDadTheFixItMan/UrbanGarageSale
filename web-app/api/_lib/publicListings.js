// Reads the public listing copies (publicListings) through Firestore's REST API. Anyone may read
// them (firestore.rules), so no key or service account is needed, and they hold no street
// address. Used by api/page.js and api/sitemap.js.

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'urbangaragesale';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const TIMEOUT_MS = 5000;

// The fields the server pages use; photos and descriptions only where a page shows them.
const LIST_FIELDS = ['title', 'suburb', 'state', 'postcode', 'start_date', 'end_date', 'start_time', 'end_time', 'sale_type', 'status'];

// Firestore REST values ({ stringValue: 'x' }) to plain values.
export function decodeValue(value) {
    if (!value || typeof value !== 'object') return undefined;
    if ('stringValue' in value) return value.stringValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return value.doubleValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('timestampValue' in value) return value.timestampValue;
    if ('nullValue' in value) return null;
    if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
    if ('mapValue' in value) return decodeFields(value.mapValue.fields);
    return undefined;
}

export function decodeFields(fields = {}) {
    return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

const idOf = (name) => name.slice(name.lastIndexOf('/') + 1);

async function firestoreFetch(url, init) {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Firestore ${response.status}: ${(await response.text()).slice(0, 200)}`);
    return response.json();
}

// One listing's public copy, or null if it has none.
export async function getPublicListing(id) {
    const doc = await firestoreFetch(`${BASE}/publicListings/${encodeURIComponent(id)}`);
    return doc ? { id, ...decodeFields(doc.fields) } : null;
}

const equals = (field, value) => ({ fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } });

// The live public copies, optionally only one state's, with just the fields lists need.
export async function listPublicListings({ state } = {}) {
    const filters = [equals('status', 'active'), ...(state ? [equals('state', state)] : [])];
    const body = {
        structuredQuery: {
            from: [{ collectionId: 'publicListings' }],
            where: filters.length > 1 ? { compositeFilter: { op: 'AND', filters } } : filters[0],
            select: { fields: LIST_FIELDS.map((fieldPath) => ({ fieldPath })) },
        },
    };
    const rows = await firestoreFetch(`${BASE}:runQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return (rows ?? [])
        .filter((row) => row.document)
        .map((row) => ({ id: idOf(row.document.name), ...decodeFields(row.document.fields) }));
}
