// Unit tests for the Tap to Pay location address helper.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../../api/_shared/http.js';
import { terminalLocationAddress } from '../../api/_shared/terminal.js';

test('terminalLocationAddress builds a Stripe address from a listing', () => {
  assert.deepEqual(
    terminalLocationAddress({ address: ' 12 Smith St ', suburb: 'Richmond', state: 'vic', postcode: '3121' }),
    { line1: '12 Smith St', city: 'Richmond', state: 'VIC', postal_code: '3121', country: 'AU' },
  );
});

test('terminalLocationAddress refuses incomplete or invalid addresses', () => {
  const full = { address: '12 Smith St', suburb: 'Richmond', state: 'VIC', postcode: '3121' };
  for (const bad of [
    { ...full, address: '' },
    { ...full, suburb: undefined },
    { ...full, state: 'Victoria' },
    { ...full, postcode: '312' },
    null,
  ]) {
    assert.throws(() => terminalLocationAddress(bad), (e) => e instanceof HttpError && e.status === 409, JSON.stringify(bad));
  }
});
