// Unit tests for which listings a sale can be recorded against.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../../api/_shared/http.js';
import { assertSaleCanBeRecordedAgainst } from '../../api/_shared/sales.js';

const refusal = (status) => (error) => error instanceof HttpError && error.status === status;

test('assertSaleCanBeRecordedAgainst allows the seller\'s paid listings', () => {
  for (const status of ['active', 'pending_approval', 'completed']) {
    assert.doesNotThrow(() => assertSaleCanBeRecordedAgainst({ user_id: 'seller', status }, 'seller'));
  }
});

test('assertSaleCanBeRecordedAgainst refuses drafts, unpaid and rejected listings', () => {
  for (const status of ['draft', 'pending_payment', 'rejected', undefined]) {
    assert.throws(() => assertSaleCanBeRecordedAgainst({ user_id: 'seller', status }, 'seller'), refusal(409));
  }
});

test('assertSaleCanBeRecordedAgainst refuses a missing listing or someone else\'s', () => {
  assert.throws(() => assertSaleCanBeRecordedAgainst(undefined, 'seller'), refusal(403));
  assert.throws(() => assertSaleCanBeRecordedAgainst({ user_id: 'other', status: 'active' }, 'seller'), refusal(403));
});
