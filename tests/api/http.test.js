// Unit tests for the API's shared request helpers (node:test, no extra dependencies).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpError, readJsonBody, requireSecondFactor, parseAudAmount, toCents, cleanText, isDocId, sendError,
} from '../../api/_shared/http.js';

const fakeRes = () => {
  const res = { statusCode: 0, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

test('parseAudAmount accepts numbers and numeric strings, rounded to cents', () => {
  assert.equal(parseAudAmount(12.345), 12.35);
  assert.equal(parseAudAmount(' 7.5 '), 7.5);
  assert.equal(parseAudAmount(0.05, { min: 0.05 }), 0.05);
});

test('parseAudAmount rejects NaN, negatives and out-of-range values', () => {
  for (const bad of [NaN, Infinity, -1, 0.49, 10000.01, 'abc', null, undefined, {}]) {
    assert.throws(() => parseAudAmount(bad), (e) => e instanceof HttpError && e.status === 400, String(bad));
  }
});

test('toCents avoids floating point drift', () => {
  assert.equal(toCents(19.99), 1999);
  assert.equal(toCents(0.1 + 0.2), 30);
});

test('cleanText trims, truncates and falls back', () => {
  assert.equal(cleanText('  hi  ', 10), 'hi');
  assert.equal(cleanText('abcdef', 3), 'abc');
  assert.equal(cleanText('   ', 5, 'x'), 'x');
  assert.equal(cleanText(42, 5, 'x'), 'x');
});

test('isDocId accepts Firestore IDs and rejects paths', () => {
  assert.equal(isDocId('Ab_9-z'), true);
  assert.equal(isDocId('a/b'), false);
  assert.equal(isDocId(''), false);
  assert.equal(isDocId('x'.repeat(129)), false);
  assert.equal(isDocId(null), false);
});

test('requireSecondFactor needs both the 2FA claim and a second-factor session', () => {
  const ok = { uid: 'u', two_fa_enabled: true, firebase: { sign_in_second_factor: 'phone' } };
  assert.equal(requireSecondFactor(ok), ok);
  const shapes = [
    { uid: 'u' },
    { uid: 'u', two_fa_enabled: true },
    { uid: 'u', two_fa_enabled: true, firebase: {} },
    { uid: 'u', two_fa_enabled: false, firebase: { sign_in_second_factor: 'phone' } },
    { uid: 'u', two_fa_enabled: 'true', firebase: { sign_in_second_factor: 'phone' } },
    { uid: 'u', firebase: { sign_in_second_factor: 'phone' } },
  ];
  for (const decoded of shapes) {
    assert.throws(() => requireSecondFactor(decoded), (e) => e.status === 403, JSON.stringify(decoded));
  }
});

test('readJsonBody handles parsed bodies, JSON strings and bad JSON', async () => {
  assert.deepEqual(await readJsonBody({ body: { a: 1 } }), { a: 1 });
  assert.deepEqual(await readJsonBody({ body: '{"a":2}' }), { a: 2 });
  assert.deepEqual(await readJsonBody({ body: '' }), {});
  await assert.rejects(readJsonBody({ body: '{bad' }), (e) => e.status === 400);
});

test('sendError shows HttpError messages but hides internal details', async () => {
  const res1 = fakeRes();
  await sendError(res1, new HttpError(429, 'Too many requests'), 'Ctx');
  assert.deepEqual([res1.statusCode, res1.body], [429, { error: 'Too many requests' }]);

  const res2 = fakeRes();
  const originalError = console.error;
  console.error = () => {};
  try {
    await sendError(res2, new Error('secret stack detail sk_live_123'), 'Failed to create payment');
  } finally {
    console.error = originalError;
  }
  assert.deepEqual([res2.statusCode, res2.body], [500, { error: 'Failed to create payment' }]);
});
