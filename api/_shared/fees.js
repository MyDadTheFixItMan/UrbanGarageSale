// Card fees passed on to sellers on each Urban Pay card sale. They match Stripe Australia's
// standard domestic card pricing (stripe.com/au/pricing, checked 2026-11-03): 1.65% + 30c
// online, 1.65% + 10c in person, plus 15c per Tap to Pay authorisation. International cards
// cost the platform more (3.5%); that difference is not passed on.
// Must match CARD_FEES in web-app/src/lib/pricing.js, which shows them to sellers.
export const CARD_FEES = {
  online: { percent: 1.65, fixedCents: 30 },
  terminal: { percent: 1.65, fixedCents: 10 },
  tap_to_pay: { percent: 1.65, fixedCents: 25 },
};

// The fee in cents for a card sale, taken from the seller's payout as a Stripe application fee.
// Unknown channels are charged the online rate. Never the whole sale.
export function cardFeeCents(amountCents, channel) {
  const { percent, fixedCents } = CARD_FEES[channel] || CARD_FEES.online;
  const fee = Math.round((amountCents * percent) / 100) + fixedCents;
  return Math.min(fee, amountCents - 1);
}
