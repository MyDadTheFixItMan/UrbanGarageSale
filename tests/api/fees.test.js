// Unit tests for the card fee passed on to sellers (node:test, no extra dependencies).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_FEES, cardFeeCents } from '../../api/_shared/fees.js';
import { CARD_FEES as SHOWN_CARD_FEES } from '../../web-app/src/lib/pricing.js';

test('card fees follow Stripe pricing for each way of taking a card', () => {
  assert.equal(cardFeeCents(10000, 'online'), 195); // A$100: 1.65% + 30c
  assert.equal(cardFeeCents(10000, 'terminal'), 175); // 1.65% + 10c
  assert.equal(cardFeeCents(10000, 'tap_to_pay'), 190); // 1.65% + 10c + 15c
  assert.equal(cardFeeCents(2000, 'tap_to_pay'), 58); // A$20: 33c + 25c
});

test('an unknown channel is charged the online rate', () => {
  assert.equal(cardFeeCents(10000, undefined), cardFeeCents(10000, 'online'));
  assert.equal(cardFeeCents(10000, 'bogus'), cardFeeCents(10000, 'online'));
});

test('the fee never takes the whole of a small sale', () => {
  assert.equal(cardFeeCents(50, 'online'), 31);
  assert.ok(cardFeeCents(31, 'online') < 31);
});

test('the fees shown to sellers are the fees charged', () => {
  assert.deepEqual(SHOWN_CARD_FEES, CARD_FEES);
});
