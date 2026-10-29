// Storage security rules tests: listing photos are public to view, and only their owner can
// upload (images under 10 MB) or delete them. Everything else is closed.
import test, { before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-urbangaragesale',
    storage: { rules: readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8') },
  });
});
after(() => env.cleanup());

const image = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const jpeg = { contentType: 'image/jpeg' };
const storageFor = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).storage();

test('owners can upload images to their own folder only', async () => {
  await assertSucceeds(uploadBytes(ref(storageFor('alice'), 'listings/alice/a.jpg'), image, jpeg));
  await assertFails(uploadBytes(ref(storageFor('bob'), 'listings/alice/b.jpg'), image, jpeg));
  await assertFails(uploadBytes(ref(storageFor(null), 'listings/alice/c.jpg'), image, jpeg));
});

test('only image types under 10 MB are accepted', async () => {
  const s = storageFor('alice');
  await assertFails(uploadBytes(ref(s, 'listings/alice/x.html'), image, { contentType: 'text/html' }));
  await assertFails(uploadBytes(ref(s, 'listings/alice/x.svg'), image, { contentType: 'image/svg+xml' }));
  await assertFails(uploadBytes(ref(s, 'listings/alice/big.jpg'), new Uint8Array(10 * 1024 * 1024), jpeg));
});

test('listing photos are public to read; only the owner can delete them', async () => {
  await env.withSecurityRulesDisabled((ctx) => uploadBytes(ref(ctx.storage(), 'listings/alice/p.jpg'), image, jpeg));
  await assertSucceeds(getBytes(ref(storageFor(null), 'listings/alice/p.jpg')));
  await assertFails(deleteObject(ref(storageFor('bob'), 'listings/alice/p.jpg')));
  await assertSucceeds(deleteObject(ref(storageFor('alice'), 'listings/alice/p.jpg')));
});

test('everything outside listings/ is closed', async () => {
  await assertFails(uploadBytes(ref(storageFor('alice'), 'other/alice/a.jpg'), image, jpeg));
  await assertFails(getBytes(ref(storageFor('alice'), 'private/file.txt')));
});
