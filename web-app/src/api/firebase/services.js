import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  orderBy
} from 'firebase/firestore';
import { db, getStorageInstance, getFunctionsInstance } from './app';
import { geocode, reverseGeocode } from '@/lib/geocode';
import { toAppError } from '@/lib/appError';

const toRecords = (snapshot) => snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

// Storage functions
export const firebaseStorage = {
  uploadImage: async (file, path) => {
    try {
      const [{ ref, uploadBytes, getDownloadURL }, storage] = await Promise.all([import('firebase/storage'), getStorageInstance()]);
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (error) {
      throw toAppError(error, 'Image upload failed. Please try again.');
    }
  }
};

// Cloud Functions
export const firebaseFunctions = {
  invoke: async (functionName, data) => {
    try {
      const [{ httpsCallable }, functions] = await Promise.all([import('firebase/functions'), getFunctionsInstance()]);
      const response = await httpsCallable(functions, functionName)(data);
      return response.data;
    } catch (error) {
      console.error(`Function ${functionName} failed:`, error);
      throw toAppError(error, 'That request failed. Please try again.');
    }
  }
};

// Thin Firestore wrapper for collections that have no entity of their own (e.g. promotions).
export const firebaseFirestore = {
  collection: (collectionName) => ({
    doc: (docName) => {
      const docRef = () => doc(db, collectionName, docName);
      return {
        get: async () => {
          const docSnap = await getDoc(docRef());
          return {
            exists: docSnap.exists(),
            data: () => docSnap.data(),
          };
        },
        set: (data, options = {}) => setDoc(docRef(), data, options),
        delete: () => deleteDoc(docRef()),
      };
    },
    // Get all documents from collection, optionally ordered
    /**
     * @param {string | null} [orderByField]
     * @param {'asc' | 'desc'} [orderDirection]
     */
    getDocs: async (orderByField = null, orderDirection = 'asc') => {
      const collectionRef = collection(db, collectionName);
      const q = orderByField ? query(collectionRef, orderBy(orderByField, orderDirection)) : collectionRef;
      return toRecords(await getDocs(q));
    },
    // Add new document to collection
    add: async (data) => {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        created_at: new Date(),
      });
      return docRef.id;
    },
    // Query documents with where clause
    queryDocs: async (whereField, operator, value) => {
      const q = query(collection(db, collectionName), where(whereField, operator, value));
      return toRecords(await getDocs(q));
    },
  }),
};

// The Australian postcode at a point (or its suburb when Google has no postcode there), for
// filling in the search box from the visitor's location; null if there is neither or the
// point is outside Australia.
export async function getPostcodeForLocation(lat, lng) {
  try {
    const components = await reverseGeocode(lat, lng);
    if (!components) return null;
    const inAustralia = components.some((c) => c.types.includes('country') && c.short_name === 'AU');
    if (!inAustralia) return null;
    const find = (type) => components.find((c) => c.types.includes(type))?.long_name;
    const postcode = find('postal_code');
    return /^\d{4}$/.test(postcode || '') ? postcode : find('locality') || null;
  } catch (error) {
    console.warn('⚠️ Google Geocoding API lookup failed for your location:', error.message);
    return null;
  }
}

// Coordinates for a suburb/postcode using Google Maps geocoding; null if not found.
export async function getSuburbCoordinates(suburbOrPostcode) {
  if (!suburbOrPostcode) return null;

  try {
    const result = await geocode(suburbOrPostcode.trim(), { country: 'AU' });
    // Text Google can't place comes back as just "Australia", which is not a place to search around.
    if (!result || result.components.every((c) => c.types.includes('country'))) return null;

    const locality = [...result.components].reverse().find((c) => c.types.includes('locality'));
    return {
      lat: result.lat,
      lng: result.lng,
      name: locality?.long_name || suburbOrPostcode
    };
  } catch (error) {
    console.warn(`⚠️ Google Geocoding API lookup failed for "${suburbOrPostcode}":`, error.message);
    return null;
  }
}
