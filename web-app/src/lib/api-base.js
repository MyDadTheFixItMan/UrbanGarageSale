import { appCheckHeaders } from '@/api/firebase/app';

// Base URL of the Vercel API (the repo's api/ folder). Set VITE_API_BASE_URL for local development.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://urban-garage-sale.vercel.app';

// fetch() for our API: adds the App Check token so the API can tell the request came from this site.
export async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}), ...(await appCheckHeaders()) };
  return fetch(url, { ...options, headers });
}
