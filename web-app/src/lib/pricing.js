// Listing fee in Australian dollars. Must match LISTING_FEE_CENTS in functions/index.js.
export const LISTING_FEE_AUD = 10;

// Card fees taken from each Urban Pay card sale, covering Stripe's processing cost.
// Must match CARD_FEES in api/_shared/fees.js, which charges them.
export const CARD_FEES = {
  online: { percent: 1.65, fixedCents: 30 },
  terminal: { percent: 1.65, fixedCents: 10 },
  tap_to_pay: { percent: 1.65, fixedCents: 25 },
};

// e.g. "1.65% + 25c"
export function describeCardFee({ percent, fixedCents }) {
  return `${percent}% + ${fixedCents}c`;
}
