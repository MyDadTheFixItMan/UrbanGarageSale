// Business details shown to customers. Set VITE_BUSINESS_ABN (e.g. "12 345 678 901") in the
// Vercel project's environment variables to show the ABN; leave it unset if you have none.
export const BUSINESS_NAME = 'Urban Garage Sale';
export const BUSINESS_ABN = import.meta.env.VITE_BUSINESS_ABN || '';
export const SUPPORT_EMAIL = 'support@urbangaragesales.com.au';
