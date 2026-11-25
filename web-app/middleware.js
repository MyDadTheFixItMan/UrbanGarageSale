// Pre-launch phone access (Vercel Routing Middleware).
//
// The Vercel Firewall rule "Pre-launch lockdown" blocks everyone except the
// owner's home IP, plus any browser carrying the right `ugs_preview` cookie.
// Visiting /preview-access?k=<key> saves <key> in that cookie and goes to the
// home page. This file never knows the correct key: it stores whatever it is
// given, and only the firewall rule (in the Vercel dashboard, not in this
// public repo) decides whether the value lets you in.
//
// Delete this file at launch, along with the cookie condition on the rule.

export const config = { matcher: '/preview-access' };

export default function middleware(request) {
  const key = new URL(request.url).searchParams.get('k') || '';
  if (!/^[A-Za-z0-9]{32,128}$/.test(key)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': `ugs_preview=${key}; Path=/; Max-Age=7776000; Secure; HttpOnly; SameSite=Lax`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
