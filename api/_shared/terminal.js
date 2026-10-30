// Stripe Terminal locations for Tap to Pay. Stripe requires every Tap to Pay payment to be tied
// to a registered location in the same country as the account receiving the money, so each
// garage sale gets one location at its own address, created the first time the seller uses
// Tap to Pay there and reused afterwards.
import { getStripe } from './stripe.js';
import { getFirestore } from './firebase-admin.js';
import { HttpError } from './http.js';

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

// The Stripe location address for a garage sale listing. Throws a 409 when the listing is
// missing part of its address, since Stripe would reject it.
export function terminalLocationAddress(listing) {
  const line1 = typeof listing?.address === 'string' ? listing.address.trim() : '';
  const city = typeof listing?.suburb === 'string' ? listing.suburb.trim() : '';
  const state = typeof listing?.state === 'string' ? listing.state.trim().toUpperCase() : '';
  const postcode = typeof listing?.postcode === 'string' ? listing.postcode.trim() : '';

  if (!line1 || !city || !AU_STATES.includes(state) || !/^\d{4}$/.test(postcode)) {
    throw new HttpError(409, 'This garage sale needs a full street address, suburb, state and postcode before it can take Tap to Pay payments.');
  }
  return { line1: line1.slice(0, 200), city: city.slice(0, 100), state, postal_code: postcode, country: 'AU' };
}

const sameAddress = (a, b) => ['line1', 'city', 'state', 'postal_code', 'country'].every((k) => a?.[k] === b?.[k]);

// Returns the Stripe location ID for a garage sale, creating it if needed. The mapping lives in
// terminalLocations/{garageSaleId}, which clients can't read or write (firestore.rules).
export async function getOrCreateTerminalLocation(garageSaleId, listing) {
  const address = terminalLocationAddress(listing);
  const ref = getFirestore().collection('terminalLocations').doc(garageSaleId);
  const existing = (await ref.get()).data();
  if (existing?.locationId && sameAddress(existing.address, address)) {
    return existing.locationId;
  }

  const location = await getStripe().terminal.locations.create({
    display_name: (listing.title || `Garage sale, ${address.city}`).slice(0, 100),
    address,
    metadata: { garageSaleId, sellerId: listing.user_id },
  });
  await ref.set({ locationId: location.id, address, sellerId: listing.user_id, createdAt: new Date() });
  return location.id;
}
