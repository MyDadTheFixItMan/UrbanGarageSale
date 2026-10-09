// Sends browser errors to the reportClientError Cloud Function, which logs them to
// Google Cloud Error Reporting (grouped, with email notifications for new errors).
// No personal data is sent: no user details, and URLs are reported without query strings.

const ENDPOINT = 'https://us-central1-urbangaragesale.cloudfunctions.net/reportClientError';
const MAX_REPORTS_PER_PAGE = 10;
let sent = 0;

export function reportError(error, extra = {}) {
    if (!import.meta.env.PROD || sent >= MAX_REPORTS_PER_PAGE) return;
    sent++;
    try {
        const body = JSON.stringify({
            source: 'web-app',
            message: String(error?.message || error || 'Unknown error').slice(0, 500),
            stack: String(error?.stack || '').slice(0, 4000),
            url: window.location.origin + window.location.pathname,
            userAgent: navigator.userAgent.slice(0, 300),
            ...extra,
        });
        const blob = new Blob([body], { type: 'application/json' });
        if (!navigator.sendBeacon?.(ENDPOINT, blob)) {
            fetch(ENDPOINT, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
        }
    } catch {
        // Reporting must never break the page
    }
}

// Catches errors React's error boundary cannot see (event handlers, async code).
export function initErrorReporting() {
    window.addEventListener('error', (event) => reportError(event.error || event.message));
    window.addEventListener('unhandledrejection', (event) => reportError(event.reason));
}
