// One Stripe client for every API handler, created on first use so a missing key fails the
// request (with a reported error) rather than the module load.
import Stripe from 'stripe';

let stripe = null;

export function getStripe() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}
