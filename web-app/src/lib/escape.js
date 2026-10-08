// Escapes text for safe insertion into HTML strings (innerHTML, document.write, template HTML).
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Returns a copy of a listing whose string fields are HTML-escaped and whose id is URL-safe,
// for building printable HTML from user-supplied listing data.
export function htmlSafeListing(listing) {
    const safe = {};
    for (const [key, value] of Object.entries(listing || {})) {
        safe[key] = typeof value === 'string' ? escapeHtml(value) : value;
    }
    safe.id = encodeURIComponent(String(listing?.id ?? ''));
    return safe;
}
