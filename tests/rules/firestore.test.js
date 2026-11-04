// Firestore security rules tests (audit CQ-5). The rules are the real access control for
// everything the website reads and writes directly, so every allow/deny that matters is here.
// Run: cd tests/rules && npm test   (starts the emulators; needs Java)
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-urbangaragesale',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

// Signed-in users. A "2FA session" token is what Firebase issues after the SMS step; the
// two_fa_enabled and admin claims are set only by the server.
const secondFactor = { firebase: { sign_in_provider: 'password', sign_in_second_factor: 'phone' } };
const as = {
  anon: () => env.unauthenticatedContext().firestore(),
  user: (uid = 'alice') => env.authenticatedContext(uid).firestore(),
  verified: (uid = 'alice') => env.authenticatedContext(uid, { email: `${uid}@x.com`, email_verified: true }).firestore(),
  seller: (uid = 'alice') => env.authenticatedContext(uid, { ...secondFactor, two_fa_enabled: true }).firestore(),
  admin: (uid = 'boss') => env.authenticatedContext(uid, { ...secondFactor, two_fa_enabled: true, admin: true }).firestore(),
  adminNo2fa: (uid = 'boss') => env.authenticatedContext(uid, { two_fa_enabled: true, admin: true }).firestore(),
};

// Writes test data with rules switched off.
const seed = (path, data) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

const photo = (uid, name = '1.jpg') =>
  `https://firebasestorage.googleapis.com/v0/b/test.appspot.com/o/listings%2F${uid}%2F${name}?alt=media&token=t`;

// A date string `days` from now, so tests of the "not years away" limit don't go stale.
const daysAhead = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const listing = (overrides = {}) => ({
  title: 'Moving sale',
  description: 'Lots of things',
  address: '1 Smith St, Fitzroy VIC 3065',
  suburb: 'Fitzroy',
  postcode: '3065',
  state: 'VIC',
  latitude: -37.8,
  longitude: 144.98,
  geohash: 'r1r0f',
  start_date: '2026-11-07',
  end_date: '2026-11-08',
  start_time: '08:00',
  end_time: '15:00',
  sale_type: 'garage_sale',
  photos: [],
  thumbnails: [],
  status: 'draft',
  payment_status: 'pending',
  draft_expires_at: null,
  user_id: 'alice',
  ...overrides,
});

// ---------- Users ----------

test('users can create their own profile with the default role only', async () => {
  const db = as.user('alice');
  await assertSucceeds(setDoc(doc(db, 'users/alice'), { full_name: 'Alice', email: 'a@x.com', role: 'user' }));
  await assertFails(setDoc(doc(as.user('bob'), 'users/bob'), { full_name: 'Bob', role: 'admin' }));
  await assertFails(setDoc(doc(db, 'users/someone-else'), { full_name: 'Mallory' }));
});

test('users cannot set role, 2FA or Stripe fields on their profile', async () => {
  await seed('users/alice', { full_name: 'Alice', role: 'user' });
  const db = as.user('alice');
  for (const field of ['role', 'two_fa_enabled', 'cardPaymentsEnabled', 'stripeConnectId']) {
    await assertFails(updateDoc(doc(db, 'users/alice'), { [field]: field === 'role' ? 'admin' : true }), field);
  }
  await assertSucceeds(updateDoc(doc(db, 'users/alice'), { full_name: 'Alice B', phone: '+61412345678' }));
});

test('only active listings can be saved to favourites, and a favourite can always be removed', async () => {
  for (const status of ['active', 'draft', 'pending_payment', 'pending_approval', 'completed', 'rejected']) {
    await seed(`garageSales/${status}`, listing({ status }));
  }
  const db = as.user('alice');
  const save = (saleId, id = saleId) =>
    setDoc(doc(db, 'savedListings', id), { garage_sale_id: saleId, user_id: 'alice', created_at: new Date() });

  await assertSucceeds(save('active'));
  for (const status of ['draft', 'pending_payment', 'pending_approval', 'completed', 'rejected']) {
    await assertFails(save(status));
  }
  await assertFails(save('no-such-listing'));
  await assertFails(updateDoc(doc(db, 'savedListings/active'), { garage_sale_id: 'draft' }));

  await assertFails(setDoc(doc(db, 'savedListings/extra'), { garage_sale_id: 'active', user_id: 'alice', junk: 'x' }));
  await seed('savedListings/ended', { garage_sale_id: 'rejected', user_id: 'alice' });
  await assertSucceeds(deleteDoc(doc(db, 'savedListings/ended')));
});

test('profile fields are type and size checked, and unknown fields are refused', async () => {
  await seed('users/alice', { full_name: 'Alice', role: 'user' });
  const db = as.user('alice');
  await assertFails(updateDoc(doc(db, 'users/alice'), { full_name: 'x'.repeat(101) }));
  await assertFails(updateDoc(doc(db, 'users/alice'), { postcode: '30651' }));
  await assertFails(updateDoc(doc(db, 'users/alice'), { suburb: 'x'.repeat(101) }));
  await assertFails(updateDoc(doc(db, 'users/alice'), { phone_verified: 'yes' }));
  await assertFails(updateDoc(doc(db, 'users/alice'), { is_admin: true }));
  await assertSucceeds(updateDoc(doc(db, 'users/alice'), { suburb: 'Fitzroy', postcode: '3065', state: 'VIC' }));
});

test('profiles are private to their owner and admins', async () => {
  await seed('users/alice', { full_name: 'Alice', role: 'user' });
  await assertSucceeds(getDoc(doc(as.user('alice'), 'users/alice')));
  await assertFails(getDoc(doc(as.user('bob'), 'users/alice')));
  await assertFails(getDoc(doc(as.anon(), 'users/alice')));
  await assertSucceeds(getDoc(doc(as.admin(), 'users/alice')));
});

test('admin access needs the admin claim and a second-factor session', async () => {
  await seed('users/alice', { full_name: 'Alice', role: 'user' });
  // A role field alone (without the server-set claim) is not enough.
  await seed('users/boss', { role: 'admin' });
  await assertFails(getDoc(doc(env.authenticatedContext('boss', secondFactor).firestore(), 'users/alice')));
  // The claim without a second-factor session is not enough.
  await assertFails(getDoc(doc(as.adminNo2fa(), 'users/alice')));
  await assertSucceeds(getDoc(doc(as.admin(), 'users/alice')));
});

test('admins cannot change roles directly (only via setUserRole)', async () => {
  await seed('users/alice', { full_name: 'Alice', role: 'user' });
  await assertFails(updateDoc(doc(as.admin(), 'users/alice'), { role: 'admin' }));
  await assertSucceeds(updateDoc(doc(as.admin(), 'users/alice'), { full_name: 'Alice (checked)' }));
});

// ---------- Listings ----------

test('public reads see active listings only', async () => {
  await seed('garageSales/live', listing({ status: 'active', payment_status: 'paid' }));
  await seed('garageSales/draft', listing());
  const anon = as.anon();
  await assertSucceeds(getDoc(doc(anon, 'garageSales/live')));
  await assertFails(getDoc(doc(anon, 'garageSales/draft')));
  await assertSucceeds(getDocs(query(collection(anon, 'garageSales'), where('status', '==', 'active'))));
  await assertFails(getDocs(collection(anon, 'garageSales')));
  await assertSucceeds(getDoc(doc(as.user('alice'), 'garageSales/draft')));
  await assertFails(getDoc(doc(as.user('bob'), 'garageSales/draft')));
});

test('creating a listing needs 2FA enabled and a second-factor session', async () => {
  const data = { ...listing(), created_at: Timestamp.now() };
  await assertFails(setDoc(doc(as.user('alice'), 'garageSales/a'), data));
  await assertFails(setDoc(doc(env.authenticatedContext('alice', { two_fa_enabled: true }).firestore(), 'garageSales/a'), data));
  await assertSucceeds(setDoc(doc(as.seller('alice'), 'garageSales/a'), data));
});

test('sellers cannot create listings for someone else or already paid/approved', async () => {
  const db = as.seller('alice');
  await assertFails(setDoc(doc(db, 'garageSales/a'), listing({ user_id: 'bob' })));
  await assertFails(setDoc(doc(db, 'garageSales/b'), listing({ status: 'pending_approval', payment_status: 'paid' })));
  await assertFails(setDoc(doc(db, 'garageSales/c'), listing({ status: 'active', payment_status: 'completed' })));
  await assertFails(setDoc(doc(db, 'garageSales/d'), { ...listing(), created_by: 'a@x.com' }));
});

test('listing fields are schema checked', async () => {
  const db = as.seller('alice');
  await assertFails(setDoc(doc(db, 'garageSales/a'), listing({ title: 'x'.repeat(151) })));
  await assertFails(setDoc(doc(db, 'garageSales/b'), listing({ description: 'x'.repeat(5001) })));
  await assertFails(setDoc(doc(db, 'garageSales/c'), listing({ postcode: 'ABCD' })));
  await assertFails(setDoc(doc(db, 'garageSales/d'), listing({ latitude: 'north' })));
  await assertFails(setDoc(doc(db, 'garageSales/e'), listing({ start_date: '7 Nov 2026' })));
  await assertFails(setDoc(doc(db, 'garageSales/f'), listing({ photos: Array(6).fill(photo('alice')) })));
  await assertSucceeds(setDoc(doc(db, 'garageSales/f5'), listing({ photos: Array(5).fill(photo('alice')) })));
  await assertFails(setDoc(doc(db, 'garageSales/g'), listing({ is_featured: true })));
  await assertSucceeds(setDoc(doc(db, 'garageSales/h'), listing()));
});

test("photos must be the seller's own uploads", async () => {
  const db = as.seller('alice');
  const save = (id, fields) => setDoc(doc(db, `garageSales/${id}`), listing(fields));
  await assertSucceeds(save('own', { photos: [photo('alice'), photo('alice', '2.jpg')], thumbnails: [photo('alice', 't.jpg'), null] }));
  await assertFails(save('other', { photos: [photo('bob')] }));
  await assertFails(save('mixed', { photos: [photo('alice'), photo('bob')] }));
  await assertFails(save('thumb', { thumbnails: [photo('bob')] }));
  await assertFails(save('site', { photos: ['https://example.test/1.jpg'] }));
  await assertFails(save('junk', { photos: [{ a: 1 }, 42] }));
  await assertFails(save('script', { photos: ['javascript:alert(1)'] }));
});

test('coordinates, sale dates and draft expiry must be real and in range', async () => {
  const db = as.seller('alice');
  const save = (id, fields) => setDoc(doc(db, `garageSales/${id}`), listing(fields));
  await assertFails(save('a', { latitude: 91 }));
  await assertFails(save('b', { longitude: -181 }));
  await assertFails(save('c', { end_date: '2099-12-31' }));
  await assertFails(save('d', { start_date: '2026-11-08', end_date: '2026-11-07' }));
  await assertFails(save('e', { start_date: '2026-11-07', end_date: '2026-11-10' }));
  await assertFails(save('f', { start_date: '2026-13-45', end_date: '2026-13-45' }));
  await assertFails(save('g', { start_date: daysAhead(500), end_date: daysAhead(500) }));
  await assertFails(save('h', { draft_expires_at: 'never' }));
  await assertFails(save('i', { draft_expires_at: '2099-01-01T00:00:00.000Z' }));
  await assertSucceeds(save('j', { start_date: daysAhead(30), end_date: daysAhead(32) }));
  await assertSucceeds(save('k', { start_date: '', end_date: '' }));
  await assertSucceeds(save('l', { draft_expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() }));
});

test('legacy listings with extra fields can still be edited', async () => {
  await seed('garageSales/old', { ...listing(), legacy_field: 'kept' });
  await assertSucceeds(updateDoc(doc(as.seller('alice'), 'garageSales/old'), { title: 'New title' }));
});

test('a seller can only end a live listing; everything else goes through an approved edit', async () => {
  await seed('garageSales/live', listing({ status: 'active', payment_status: 'paid' }));
  const db = as.seller('alice');
  const live = doc(db, 'garageSales/live');

  for (const change of [
    { title: 'New title' }, { description: 'New description' }, { sale_type: 'estate_sale' },
    { photos: ['https://example.test/1.jpg'] }, { thumbnails: ['https://example.test/1-thumb.jpg'] },

    { start_date: '2026-12-05' }, { end_date: '2026-12-06' }, { start_time: '06:00' }, { end_time: '20:00' },
    { address: '2 Other St' }, { suburb: 'Carlton' }, { postcode: '3053' }, { state: 'NSW' },
    { latitude: -33.8 }, { longitude: 151.2 }, { geohash: 'r1r0g' },
    { draft_expires_at: '2026-12-01T00:00:00.000Z' }, { created_at: Timestamp.now() },
  ]) {
    await assertFails(updateDoc(live, change));
  }
  await assertFails(updateDoc(live, { status: 'draft' }));
  // Sending it back would let a rejection refund a sale that already ran.
  await assertFails(updateDoc(live, { status: 'pending_approval' }));
  await assertFails(updateDoc(live, { status: 'completed', title: 'Sneaked in' }));

  // A seller can still end their own sale, and an admin isn't limited.
  await assertSucceeds(updateDoc(doc(as.admin(), 'garageSales/live'), { address: '3 Admin St' }));
  await assertSucceeds(updateDoc(live, { status: 'completed' }));
});

test('edits to a live listing wait privately, and only an admin can put them live', async () => {
  const change = {
    user_id: 'alice',
    title: 'New title',
    description: 'New description',
    sale_type: 'estate_sale',
    photos: [photo('alice')],
    thumbnails: [photo('alice', '1-thumb.jpg')],
    status: 'pending',
    submitted_at: Timestamp.now(),
  };
  await seed('garageSales/live', listing({ status: 'active', payment_status: 'paid' }));
  await seed('garageSales/draft', listing({ status: 'draft' }));
  const seller = as.seller('alice');
  const edit = doc(seller, 'listingEdits/live');

  // The edit page checks for a waiting edit before there is one; that must not be refused.
  const noEdit = await assertSucceeds(getDoc(doc(seller, 'listingEdits/live')));
  assert.equal(noEdit.exists(), false);
  await assertFails(getDoc(doc(as.anon(), 'listingEdits/live')));

  // Only the owner of a live listing, and only the allowed fields.
  await assertFails(setDoc(doc(seller, 'listingEdits/draft'), change));
  await assertFails(setDoc(doc(seller, 'listingEdits/missing'), change));
  await assertFails(setDoc(doc(as.seller('bob'), 'listingEdits/live'), { ...change, user_id: 'bob' }));
  await assertFails(setDoc(edit, { ...change, address: '2 Other St' }));
  await assertFails(setDoc(edit, { ...change, start_date: '2026-12-05' }));
  await assertFails(setDoc(edit, { ...change, status: 'approved' }));
  await assertFails(setDoc(edit, { ...change, refusal_reason: 'Faked' }));
  await assertFails(setDoc(edit, { ...change, title: 'x'.repeat(151) }));
  await assertSucceeds(setDoc(edit, change));

  // Private until approved: the public listing is unchanged and the edit can't be read.
  await assertFails(getDoc(doc(as.anon(), 'listingEdits/live')));
  await assertFails(getDoc(doc(as.user('bob'), 'listingEdits/live')));
  await assertSucceeds(getDoc(doc(seller, 'listingEdits/live')));
  await assertSucceeds(getDoc(doc(as.admin(), 'listingEdits/live')));
  const stillPublic = await getDoc(doc(as.anon(), 'garageSales/live'));
  assert.equal(stillPublic.data().title, listing().title);

  // A new edit replaces a refused one, and the seller can withdraw it.
  await seed('listingEdits/live', { ...change, status: 'refused', refusal_reason: 'No' });
  await assertSucceeds(setDoc(edit, change));
  await assertSucceeds(deleteDoc(edit));

  // An admin approves by copying the changes onto the listing.
  const { user_id, status, submitted_at, ...content } = change;
  await assertSucceeds(updateDoc(doc(as.admin(), 'garageSales/live'), content));
});

test('dates and location are locked once a listing is paid or approved', async () => {
  await seed('garageSales/paid', listing({ status: 'pending_approval', payment_status: 'paid' }));
  const db = as.seller('alice');
  await assertFails(updateDoc(doc(db, 'garageSales/paid'), { start_date: '2026-12-05' }));
  await assertFails(updateDoc(doc(db, 'garageSales/paid'), { address: '2 Other St', geohash: 'r1r0g' }));
  await assertSucceeds(updateDoc(doc(db, 'garageSales/paid'), { description: 'Updated description' }));
});

test('sellers cannot mark their own listing paid or approved', async () => {
  await seed('garageSales/a', listing({ status: 'pending_payment' }));
  const db = as.seller('alice');
  await assertFails(updateDoc(doc(db, 'garageSales/a'), { status: 'pending_approval', payment_status: 'paid' }));
  await assertFails(updateDoc(doc(db, 'garageSales/a'), { status: 'active' }));
  await assertSucceeds(updateDoc(doc(db, 'garageSales/a'), { status: 'draft' }));
  await assertSucceeds(updateDoc(doc(db, 'garageSales/a'), { status: 'completed' }));
});

test('free listings are allowed only inside the free period', async () => {
  await seed('appSettings/default', { is_active: true, free_listing_start: '2026-11-01', free_listing_end: '2026-11-30' });
  const db = as.seller('alice');
  const free = (start) => listing({ status: 'pending_approval', payment_status: 'completed', start_date: start, end_date: start });
  await assertSucceeds(setDoc(doc(db, 'garageSales/inside'), free('2026-11-14')));
  await assertFails(setDoc(doc(db, 'garageSales/outside'), free('2026-12-05')));

  await seed('appSettings/default', { is_active: false, free_listing_start: '2026-11-01', free_listing_end: '2026-11-30' });
  await assertFails(setDoc(doc(db, 'garageSales/off'), free('2026-11-14')));
});

test('free listings wait for admin approval and stay private until then', async () => {
  await seed('appSettings/default', { is_active: true, free_listing_start: '2026-11-01', free_listing_end: '2026-11-30' });
  await seed('garageSales/draft', listing({ start_date: '2026-11-14', end_date: '2026-11-14' }));
  const db = as.seller('alice');
  const free = (status) => ({ status, payment_status: 'completed', start_date: '2026-11-14', end_date: '2026-11-14' });

  await assertFails(setDoc(doc(db, 'garageSales/direct'), listing(free('active'))));
  await assertFails(updateDoc(doc(db, 'garageSales/draft'), free('active')));

  await assertSucceeds(setDoc(doc(db, 'garageSales/waiting'), listing(free('pending_approval'))));
  await assertSucceeds(updateDoc(doc(db, 'garageSales/draft'), free('pending_approval')));
  await assertFails(getDoc(doc(as.anon(), 'garageSales/waiting')));
  await assertFails(updateDoc(doc(db, 'garageSales/waiting'), { status: 'active' }));

  await assertSucceeds(updateDoc(doc(as.admin(), 'garageSales/waiting'), { status: 'active' }));
  await assertSucceeds(getDoc(doc(as.anon(), 'garageSales/waiting')));
});

test('other users cannot edit or delete a listing', async () => {
  await seed('garageSales/a', listing());
  await assertFails(updateDoc(doc(as.seller('bob'), 'garageSales/a'), { title: 'Mine now' }));
  await assertFails(deleteDoc(doc(as.seller('bob'), 'garageSales/a')));
  await assertSucceeds(deleteDoc(doc(as.user('alice'), 'garageSales/a')));
});

// ---------- Payments ----------

test('clients may only record a $0 free-period payment for their own free listing', async () => {
  await seed('garageSales/free', listing({ status: 'pending_approval', payment_status: 'completed' }));
  await seed('garageSales/unpaid', listing({ status: 'pending_payment' }));
  const db = as.user('alice');
  const payment = (overrides) => ({
    garage_sale_id: 'free', user_id: 'alice', amount: 0, payment_method: 'free_period', status: 'completed', ...overrides,
  });
  await assertSucceeds(setDoc(doc(db, 'payments/p1'), payment()));
  await assertFails(setDoc(doc(db, 'payments/p2'), payment({ amount: 10, payment_method: 'stripe' })));
  await assertFails(setDoc(doc(db, 'payments/p3'), payment({ garage_sale_id: 'unpaid' })));
  await assertFails(setDoc(doc(as.user('bob'), 'payments/p4'), payment({ user_id: 'bob' })));
  await assertFails(setDoc(doc(db, 'payments/p5'), payment({ transaction_id: 'pi_fake' })));
});

test('payments are readable by their owner and admins only; updates are admin only', async () => {
  await seed('payments/p', { user_id: 'alice', amount: 10, status: 'completed' });
  await assertSucceeds(getDoc(doc(as.user('alice'), 'payments/p')));
  await assertFails(getDoc(doc(as.user('bob'), 'payments/p')));
  await assertFails(updateDoc(doc(as.user('alice'), 'payments/p'), { status: 'refunded' }));
  await assertSucceeds(getDoc(doc(as.admin(), 'payments/p')));
});

// ---------- Urban Pay ----------

test('sales and stats are server-written only', async () => {
  await seed('sales/s', { sellerId: 'alice', amount: 5 });
  await seed('sellerStats/alice', { totalEarnings: 5 });
  const db = as.seller('alice');
  await assertSucceeds(getDoc(doc(db, 'sales/s')));
  await assertSucceeds(getDoc(doc(db, 'sellerStats/alice')));
  await assertFails(setDoc(doc(db, 'sales/new'), { sellerId: 'alice', amount: 1000 }));
  await assertFails(updateDoc(doc(db, 'sellerStats/alice'), { totalEarnings: 1e6 }));
  await assertFails(getDoc(doc(as.seller('bob'), 'sales/s')));
});

// ---------- Contact messages ----------

const message = (uid, overrides = {}) => ({
  name: 'Alice', email: `${uid}@x.com`, message: 'Hello', user_id: uid, status: 'unread', created_at: serverTimestamp(), ...overrides,
});

const sendMessage = (db, uid, overrides = {}) => {
  const batch = writeBatch(db);
  const messageRef = doc(collection(db, 'contactMessages'));
  batch.set(doc(db, `contactRateLimits/${uid}`), { last: serverTimestamp(), messageId: messageRef.id });
  batch.set(messageRef, message(uid, overrides));
  return batch.commit();
};

test('contact messages are size-limited and rate limited to one a minute', async () => {
  const db = as.verified('alice');
  await assertSucceeds(sendMessage(db, 'alice'));
  await assertFails(sendMessage(db, 'alice'));
  await assertFails(sendMessage(as.verified('bob'), 'bob', { message: 'x'.repeat(4001) }));
  await assertFails(sendMessage(as.verified('carol'), 'carol', { status: 'replied' }));
  await assertFails(sendMessage(as.verified('dave'), 'dave', { user_id: 'alice' }));
});

test('one marker cannot cover a whole batch of contact messages', async () => {
  const db = as.verified('alice');
  const batch = writeBatch(db);
  batch.set(doc(db, 'contactRateLimits/alice'), { last: serverTimestamp(), messageId: 'm0' });
  for (let i = 0; i < 3; i++) batch.set(doc(db, `contactMessages/m${i}`), message('alice'));
  await assertFails(batch.commit());
});

test('contact replies can only go to the sender\'s own verified email', async () => {
  await assertFails(sendMessage(as.verified('alice'), 'alice', { email: 'stranger@x.com' }));
  await assertFails(sendMessage(env.authenticatedContext('bob', { email: 'bob@x.com', email_verified: false }).firestore(), 'bob'));
  await assertFails(sendMessage(as.user('carol'), 'carol'));
});

test('contact messages are readable by admins only', async () => {
  await seed('contactMessages/m', { user_id: 'alice', message: 'Hi' });
  await assertFails(getDoc(doc(as.user('alice'), 'contactMessages/m')));
  await assertSucceeds(getDoc(doc(as.admin(), 'contactMessages/m')));
});

// ---------- Server-only collections ----------

test('auditLog, oauth_states and rateLimits have no client access', async () => {
  await seed('auditLog/a', { action: 'setUserRole' });
  for (const path of ['auditLog/a', 'oauth_states/s', 'rateLimits/r']) {
    await assertFails(getDoc(doc(as.admin(), path)), path);
    await assertFails(setDoc(doc(as.admin(), path), { x: 1 }), path);
  }
});

test('app settings are readable when signed in and writable by admins only', async () => {
  await assertFails(setDoc(doc(as.seller('alice'), 'appSettings/default'), { is_active: true }));
  await assertSucceeds(setDoc(doc(as.admin(), 'appSettings/default'), { is_active: true }));
  await assertSucceeds(getDoc(doc(as.user('alice'), 'appSettings/default')));
  await assertFails(getDoc(doc(as.anon(), 'appSettings/default')));
});
