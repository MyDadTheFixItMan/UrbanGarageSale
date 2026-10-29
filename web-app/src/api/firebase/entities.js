import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  orderBy,
  startAt,
  endAt,
  limit,
  startAfter,
  documentId,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { geohashQueryBounds } from 'geofire-common';
import { ref, deleteObject } from 'firebase/storage';
import { auth, db, functions, storage } from './app';
import { LISTING_STATUS, PAYMENT_STATUS } from '@/lib/listings';
import { AppError } from '@/lib/appError';
import {
  MAX_LISTINGS_PER_CELL,
  MAX_LISTINGS_UNLOCATED,
  withGeohash,
  hasLocationFilter,
  radiusKm,
  refineListingResults
} from './listingSearch';

const toRecords = (snapshot) => snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

function requireUser(message = 'Please sign in and try again.') {
  const user = auth.currentUser;
  if (!user) throw new AppError(message, { code: 'auth/no-current-user' });
  return user;
}

// Equality filters for the given fields, skipping ones that are not set.
function equalityConstraints(filters, fields) {
  return fields.filter((field) => filters[field]).map((field) => where(field, '==', filters[field]));
}

async function updateAndReload(collectionName, id, data) {
  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, data);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...docSnap.data() };
}

// Admin lists read one page at a time instead of whole collections.
const ADMIN_PAGE_SIZE = 25;
export const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

// One page of a query. `cursor` is the last document of the previous page; the returned
// cursor is null when there are no more pages.
async function fetchPage(collectionName, constraints, cursor) {
  const snapshot = await getDocs(query(
    collection(db, collectionName), ...constraints, ...(cursor ? [startAfter(cursor)] : []), limit(ADMIN_PAGE_SIZE + 1)
  ));
  const docs = snapshot.docs.slice(0, ADMIN_PAGE_SIZE);
  return {
    items: docs.map((d) => ({ id: d.id, ...d.data() })),
    cursor: snapshot.docs.length > ADMIN_PAGE_SIZE ? docs[docs.length - 1] : null
  };
}

// Loads the given documents one by one; ones the user may not read are skipped.
async function getByIds(collectionName, ids = []) {
  const unique = [...new Set(ids.filter(Boolean))];
  const docs = await Promise.all(unique.map((id) => getDoc(doc(db, collectionName, id)).catch(() => null)));
  return docs.filter((d) => d && d.exists()).map((d) => ({ id: d.id, ...d.data() }));
}

const countOf = async (collectionName, ...constraints) =>
  (await getCountFromServer(query(collection(db, collectionName), ...constraints))).data().count;

const sumOf = async (collectionName, field, ...constraints) =>
  (await getAggregateFromServer(query(collection(db, collectionName), ...constraints), { total: sum(field) })).data().total || 0;

// Local calendar date as YYYY-MM-DD, the format listings store start_date/end_date in.
function localIsoDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Firestore entity management
export const firebaseEntities = {
  GarageSale: {
    create: async (data) => {
      const user = requireUser();
      const docRef = await addDoc(collection(db, 'garageSales'), {
        ...withGeohash(data),
        user_id: user.uid,
        created_at: new Date(),
        status: data.status || LISTING_STATUS.DRAFT
      });
      return { id: docRef.id, ...data };
    },

    filter: async (filters = {}) => {
      if (filters.id) {
        const docSnap = await getDoc(doc(db, 'garageSales', filters.id));
        return docSnap.exists() ? [{ id: docSnap.id, ...docSnap.data() }] : [];
      }

      const garageSalesRef = collection(db, 'garageSales');
      const constraints = equalityConstraints(filters, ['user_id', 'status', 'postcode']);
      let results;

      if (filters.status === LISTING_STATUS.ACTIVE && hasLocationFilter(filters)) {
        // Radius search: only the geohash cells covering the radius are read.
        const bounds = geohashQueryBounds([filters.userLatitude, filters.userLongitude], radiusKm(filters) * 1000);
        const snapshots = await Promise.all(bounds.map(([start, end]) => getDocs(query(
          garageSalesRef, ...constraints, orderBy('geohash'), startAt(start), endAt(end), limit(MAX_LISTINGS_PER_CELL)
        ))));
        results = snapshots.flatMap(toRecords);
      } else {
        // Public searches without a location are capped; owner and admin views are not.
        const capped = filters.status === LISTING_STATUS.ACTIVE && !filters.user_id;
        const snapshot = await getDocs(query(garageSalesRef, ...constraints, ...(capped ? [limit(MAX_LISTINGS_UNLOCATED)] : [])));
        results = toRecords(snapshot);
      }

      return refineListingResults(results, filters);
    },

    // Listings the user may not read (no longer live) are skipped.
    getByIds: (ids) => getByIds('garageSales', ids),

    // Admin: one page of listings, optionally with a single status.
    /** @param {{ status?: string, cursor?: any }} [options] */
    page: ({ status, cursor } = {}) => fetchPage('garageSales', [
      ...(status ? [where('status', '==', status)] : []),
      orderBy(documentId())
    ], cursor),

    update: (id, data) => updateAndReload('garageSales', id, withGeohash(data)),

    // Admin: rejects a listing awaiting approval and refunds its listing fee (Cloud Function).
    reject: async (id, reason) => {
      const result = await httpsCallable(functions, 'rejectListing')({ saleId: id, reason });
      return result.data;
    },

    // Removes the listing's photos from Storage too. Photo deletion is best effort: a photo
    // that can't be deleted must not stop the listing being deleted.
    delete: async (id) => {
      const snap = await getDoc(doc(db, 'garageSales', id));
      if (snap.exists()) {
        const { photos = [], thumbnails = [] } = snap.data();
        await Promise.all([...photos, ...thumbnails].map((url) => deleteObject(ref(storage, url)).catch(() => null)));
      }
      await deleteDoc(doc(db, 'garageSales', id));
      return { id, deleted: true };
    }
  },

  // Saved listings belong to an account by user_id only, so they survive an email change.
  SavedListing: {
    create: async ({ garage_sale_id }) => {
      const user = requireUser();
      const docRef = await addDoc(collection(db, 'savedListings'), {
        garage_sale_id,
        user_id: user.uid,
        created_at: new Date()
      });
      return { id: docRef.id, garage_sale_id };
    },

    // The signed-in user's saved listings.
    mine: async () => {
      const user = requireUser();
      return toRecords(await getDocs(query(collection(db, 'savedListings'), where('user_id', '==', user.uid))));
    },

    delete: async (id) => {
      await deleteDoc(doc(db, 'savedListings', id));
    }
  },

  User: {
    filter: async (filters = {}) => {
      const constraints = equalityConstraints(filters, ['role', 'state']);
      return toRecords(await getDocs(query(collection(db, 'users'), ...constraints)));
    },

    getByIds: (ids) => getByIds('users', ids),

    // Admin: one page of users, optionally narrowed to a state and/or exact postcode.
    /** @param {{ state?: string, postcode?: string, cursor?: any }} [options] */
    page: ({ state, postcode, cursor } = {}) => fetchPage('users', [
      ...equalityConstraints({ state, postcode }, ['state', 'postcode']),
      orderBy(documentId())
    ], cursor),

    update: (id, data) => updateAndReload('users', id, data),

    // Admin: sets the admin claim and role, and records the change in the audit log.
    setRole: async (id, role) => {
      await httpsCallable(functions, 'setUserRole')({ userId: id, role });
      return { id, role };
    },

    delete: async (id) => {
      // Admin-only Cloud Function: removes the auth account and the user's personal data.
      requireUser('Not authenticated. Please log in to delete users.');
      await httpsCallable(functions, 'deleteUser')({ userId: id });
      return { id, deleted: true };
    }
  },

  Payment: {
    create: async (data) => {
      const user = requireUser();
      const docRef = await addDoc(collection(db, 'payments'), {
        ...data,
        user_id: user.uid,
        user_email: user.email,
        created_at: new Date(),
        status: data.status || PAYMENT_STATUS.PENDING
      });
      return { id: docRef.id, ...data };
    },

    filter: async (filters = {}) => {
      const constraints = equalityConstraints(filters, ['user_id', 'status']);
      return toRecords(await getDocs(query(collection(db, 'payments'), ...constraints)));
    },

    // Admin: one page of payments, newest first, optionally only those made since a date.
    /** @param {{ since?: Date, cursor?: any }} [options] */
    page: ({ since, cursor } = {}) => fetchPage('payments', [
      ...(since ? [where('created_at', '>=', since)] : []),
      orderBy('created_at', 'desc')
    ], cursor),

    update: (id, data) => updateAndReload('payments', id, data)
  },

  ContactMessage: {
    // Written together with the sender's rate-limit marker; Firestore rules allow one
    // message per user per minute and limit field sizes.
    create: async (data) => {
      const user = requireUser('Please sign in to send a message.');
      const messageRef = doc(collection(db, 'contactMessages'));
      const batch = writeBatch(db);
      batch.set(doc(db, 'contactRateLimits', user.uid), { last: serverTimestamp() });
      batch.set(messageRef, {
        name: String(data.name || '').slice(0, 100),
        email: String(data.email || '').slice(0, 254),
        message: String(data.message || '').slice(0, 4000),
        user_id: user.uid,
        status: 'unread',
        created_at: serverTimestamp()
      });
      try {
        await batch.commit();
      } catch (error) {
        if (error.code === 'permission-denied') {
          throw new AppError('Please wait a minute before sending another message.', { code: 'app/rate-limited', cause: error });
        }
        throw error;
      }
      return { id: messageRef.id, ...data };
    },

    filter: async (filters = {}) => {
      const constraints = equalityConstraints(filters, ['status']);
      return toRecords(await getDocs(query(collection(db, 'contactMessages'), orderBy('created_at', 'desc'), ...constraints)));
    },

    // Admin: one page of messages, newest first.
    /** @param {{ cursor?: any }} [options] */
    page: ({ cursor } = {}) => fetchPage('contactMessages', [orderBy('created_at', 'desc')], cursor),

    update: (id, data) => updateAndReload('contactMessages', id, data),

    delete: async (id) => {
      await deleteDoc(doc(db, 'contactMessages', id));
    }
  },

  // Admin dashboard totals, computed by Firestore aggregation queries so no collection is
  // downloaded. Each aggregation costs one read per 1,000 matching documents.
  AdminStats: {
    get: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [
        totalListings, activeListings, pendingListings, draftListings, completedListings,
        totalRevenue, monthlyRevenue, unreadMessages, totalUsers, listingsByState, usersByState
      ] = await Promise.all([
        countOf('garageSales'),
        countOf('garageSales', where('status', '==', LISTING_STATUS.ACTIVE), where('end_date', '>=', localIsoDate())),
        countOf('garageSales', where('status', '==', LISTING_STATUS.PENDING_APPROVAL)),
        countOf('garageSales', where('status', '==', LISTING_STATUS.DRAFT)),
        countOf('garageSales', where('status', '==', LISTING_STATUS.COMPLETED)),
        sumOf('payments', 'amount', where('status', '==', PAYMENT_STATUS.COMPLETED)),
        sumOf('payments', 'amount', where('status', '==', PAYMENT_STATUS.COMPLETED), where('created_at', '>=', monthStart)),
        countOf('contactMessages', where('status', '==', 'unread')),
        countOf('users'),
        Promise.all(AU_STATES.map((state) => countOf('garageSales', where('state', '==', state)))),
        Promise.all(AU_STATES.map((state) => countOf('users', where('state', '==', state))))
      ]);

      return {
        totalListings, activeListings, pendingListings, draftListings, completedListings,
        totalRevenue, monthlyRevenue, unreadMessages, totalUsers,
        byState: AU_STATES.map((state, i) => ({ state, listings: listingsByState[i], users: usersByState[i] }))
      };
    },

    // Top 10 postcodes by listing count, counted server-side by an admin Cloud Function.
    topPostcodes: async (state) => {
      const result = await httpsCallable(functions, 'adminTopPostcodes')({ state: state || null });
      const data = /** @type {{ postcodes?: Array<{ name: string, count: number }> }} */ (result.data);
      return data.postcodes || [];
    }
  },

  // App Settings (single document store)
  AppSettings: {
    get: async () => {
      try {
        const docSnap = await getDoc(doc(db, 'appSettings', 'default'));
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : {};
      } catch (error) {
        console.error('✗ Error getting app settings:', error);
        return {};
      }
    },

    update: async (data) => {
      try {
        const docRef = doc(db, 'appSettings', 'default');
        await setDoc(docRef, data, { merge: true });
        const docSnap = await getDoc(docRef);
        return { id: docSnap.id, ...docSnap.data() };
      } catch (error) {
        console.error('✗ Error updating app settings:', error);
        throw error;
      }
    }
  }
};
