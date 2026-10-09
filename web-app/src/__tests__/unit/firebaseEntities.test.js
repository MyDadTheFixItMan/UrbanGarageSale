// Runs the real entity code against a fake Firestore SDK that records every query, so these
// tests check which reads and writes the app actually makes.

// Each SDK helper returns a plain descriptor; getDocs / getDoc look results up in `store`.
jest.mock('firebase/firestore', () => {
  const store = { queries: [], getDocs: jest.fn(), getDoc: jest.fn(), batches: [] };
  const tag = (type) => (...args) => ({ type, args });
  return {
    __store: store,
    collection: (_db, name) => ({ type: 'collection', name }),
    doc: (...args) => (args.length === 1
      ? { type: 'doc', path: [args[0].name, 'new-id'], id: 'new-id' }
      : { type: 'doc', path: args.slice(1), id: args[args.length - 1] }),
    query: (ref, ...constraints) => {
      const q = { collection: ref.name, constraints };
      store.queries.push(q);
      return q;
    },
    where: (field, op, value) => ({ type: 'where', field, op, value }),
    orderBy: tag('orderBy'),
    startAt: tag('startAt'),
    endAt: tag('endAt'),
    startAfter: tag('startAfter'),
    limit: (n) => ({ type: 'limit', n }),
    documentId: () => '__name__',
    getDocs: (q) => store.getDocs(q),
    getDoc: (ref) => store.getDoc(ref),
    addDoc: jest.fn(async () => ({ id: 'added-id' })),
    updateDoc: jest.fn(async () => {}),
    deleteDoc: jest.fn(async () => {}),
    setDoc: jest.fn(async () => {}),
    getCountFromServer: jest.fn(),
    getAggregateFromServer: jest.fn(),
    sum: tag('sum'),
    serverTimestamp: () => 'SERVER_TIME',
    writeBatch: () => {
      const batch = { writes: [], set: (ref, data) => batch.writes.push({ ref, data }), commit: jest.fn(async () => store.commit?.()) };
      store.batches.push(batch);
      return batch;
    },
  };
});
jest.mock('firebase/functions', () => {
  const call = jest.fn(async () => ({ data: {} }));
  return { __call: call, httpsCallable: jest.fn(() => call) };
});
jest.mock('@/api/firebase/app', () => ({
  auth: { currentUser: null },
  db: {},
  functions: {},
}));

import * as firestore from 'firebase/firestore';
import * as functionsSdk from 'firebase/functions';
import { auth } from '@/api/firebase/app';
import { firebaseEntities } from '@/api/firebase/entities';

const store = firestore.__store;
const snapshot = (docs) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d })) });
const docSnap = (data) => ({ id: data?.id, exists: () => Boolean(data), data: () => data });
const wheres = (q) => q.constraints.filter((c) => c.type === 'where').map((c) => `${c.field}${c.op}${c.value}`);
const limitOf = (q) => q.constraints.find((c) => c.type === 'limit')?.n;

const FAR_FUTURE = '2999-01-01';

beforeEach(() => {
  store.queries = [];
  store.batches = [];
  store.commit = undefined;
  store.getDocs.mockReset().mockResolvedValue(snapshot([]));
  store.getDoc.mockReset().mockResolvedValue(docSnap(null));
  auth.currentUser = { uid: 'user-1', email: 'seller@example.com' };
  jest.clearAllMocks();
});

describe('GarageSale.filter', () => {
  it('fetches a single listing directly when given an id', async () => {
    store.getDoc.mockResolvedValue(docSnap({ id: 'sale-9', title: 'Big sale' }));
    await expect(firebaseEntities.GarageSale.filter({ id: 'sale-9' })).resolves.toEqual([{ id: 'sale-9', title: 'Big sale' }]);
    expect(store.queries).toHaveLength(0);
  });

  it('caps public searches without a location', async () => {
    await firebaseEntities.GarageSale.filter({ status: 'active' });
    expect(store.queries).toHaveLength(1);
    expect(wheres(store.queries[0])).toEqual(['status==active']);
    expect(limitOf(store.queries[0])).toBe(200);
  });

  it('does not cap a seller viewing their own listings', async () => {
    await firebaseEntities.GarageSale.filter({ status: 'active', user_id: 'user-1' });
    expect(wheres(store.queries[0])).toEqual(['user_id==user-1', 'status==active']);
    expect(limitOf(store.queries[0])).toBeUndefined();
  });

  it('reads only the geohash cells covering a radius search, capped per cell', async () => {
    const nearby = { id: 'near', status: 'active', end_date: FAR_FUTURE, latitude: -37.80, longitude: 144.97 };
    const outside = { id: 'far', status: 'active', end_date: FAR_FUTURE, latitude: -38.15, longitude: 144.36 };
    // Every cell returns both, so the overlap must also be de-duplicated.
    store.getDocs.mockResolvedValue(snapshot([nearby, outside]));

    const results = await firebaseEntities.GarageSale.filter({
      status: 'active', distance: '10', userLatitude: -37.8136, userLongitude: 144.9631,
    });

    expect(store.queries.length).toBeGreaterThan(0);
    store.queries.forEach((q) => {
      expect(q.constraints.some((c) => c.type === 'orderBy' && c.args[0] === 'geohash')).toBe(true);
      expect(limitOf(q)).toBe(100);
    });
    expect(results.map((r) => r.id)).toEqual(['near']);
  });

  it('hides listings that have ended unless includePast is set', async () => {
    store.getDocs.mockResolvedValue(snapshot([
      { id: 'current', end_date: FAR_FUTURE },
      { id: 'ended', end_date: '2000-01-01' },
    ]));
    expect((await firebaseEntities.GarageSale.filter({})).map((r) => r.id)).toEqual(['current']);
    expect((await firebaseEntities.GarageSale.filter({ includePast: true })).map((r) => r.id)).toEqual(['current', 'ended']);
  });
});

describe('GarageSale writes', () => {
  it('stamps new listings with the owner, a draft status and a geohash', async () => {
    await firebaseEntities.GarageSale.create({ title: 'Sale', latitude: -37.8, longitude: 144.9 });
    const written = firestore.addDoc.mock.calls[0][1];
    expect(written).toMatchObject({ title: 'Sale', user_id: 'user-1', status: 'draft' });
    expect(written.geohash).toMatch(/^r1/);
  });

  it('refuses to create a listing when signed out', async () => {
    auth.currentUser = null;
    await expect(firebaseEntities.GarageSale.create({ title: 'Sale' })).rejects.toThrow('Not authenticated');
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it('recomputes the geohash when coordinates change', async () => {
    store.getDoc.mockResolvedValue(docSnap({ id: 'sale-1' }));
    await firebaseEntities.GarageSale.update('sale-1', { latitude: -33.87, longitude: 151.21 });
    expect(firestore.updateDoc.mock.calls[0][1].geohash).toMatch(/^r3/);
  });
});

describe('SavedListing.filter', () => {
  it('always restricts results to the signed-in user', async () => {
    await firebaseEntities.SavedListing.filter({ user_id: 'someone-else' });
    expect(wheres(store.queries[0])).toEqual(['user_id==user-1', 'user_id==someone-else']);
  });
});

describe('ContactMessage.create', () => {
  it('writes the message and the rate-limit marker in one batch, trimming long fields', async () => {
    await firebaseEntities.ContactMessage.create({ name: 'N'.repeat(500), email: 'a@b.c', message: 'hello' });
    const [batch] = store.batches;
    expect(batch.writes.map((w) => w.ref.path[0])).toEqual(['contactRateLimits', 'contactMessages']);
    expect(batch.writes[1].data).toMatchObject({ email: 'a@b.c', message: 'hello', user_id: 'user-1', status: 'unread' });
    expect(batch.writes[1].data.name).toHaveLength(100);
  });

  it('explains the per-minute limit when Firestore rejects the write', async () => {
    store.commit = () => { throw Object.assign(new Error('denied'), { code: 'permission-denied' }); };
    await expect(firebaseEntities.ContactMessage.create({ message: 'again' })).rejects.toThrow('Please wait a minute');
  });
});

describe('User.delete', () => {
  it('goes through the admin Cloud Function rather than deleting the document directly', async () => {
    await firebaseEntities.User.delete('user-42');
    expect(functionsSdk.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'deleteUser');
    expect(functionsSdk.__call).toHaveBeenCalledWith({ userId: 'user-42' });
    expect(firestore.deleteDoc).not.toHaveBeenCalled();
  });
});

describe('admin paging', () => {
  it('asks for one extra document to know whether another page exists', async () => {
    const docs = Array.from({ length: 26 }, (_, i) => ({ id: `u${i}` }));
    store.getDocs.mockResolvedValue(snapshot(docs));
    const page = await firebaseEntities.User.page({ state: 'VIC' });
    expect(limitOf(store.queries[0])).toBe(26);
    expect(wheres(store.queries[0])).toEqual(['state==VIC']);
    expect(page.items).toHaveLength(25);
    expect(page.cursor).not.toBeNull();
  });

  it('returns no cursor on the last page', async () => {
    store.getDocs.mockResolvedValue(snapshot([{ id: 'only' }]));
    const page = await firebaseEntities.ContactMessage.page();
    expect(page.items).toEqual([{ id: 'only' }]);
    expect(page.cursor).toBeNull();
  });
});
