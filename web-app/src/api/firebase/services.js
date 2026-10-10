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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from './app';

const toRecords = (snapshot) => snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

// Storage functions
export const firebaseStorage = {
  uploadImage: async (file, path) => {
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (error) {
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }
};

// Cloud Functions
export const firebaseFunctions = {
  invoke: async (functionName, data) => {
    try {
      const response = await httpsCallable(functions, functionName)(data);
      return response.data;
    } catch (error) {
      console.error(`Function call failed:`, error);
      throw new Error(`Function call failed: ${error.message}`);
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

// Coordinates for a suburb/postcode using the Google Geocoding API; null if not found.
export async function getSuburbCoordinates(suburbOrPostcode) {
  if (!suburbOrPostcode) return null;
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

  if (!googleMapsApiKey) {
    console.warn('⚠️ Missing VITE_GOOGLE_PLACES_API_KEY - geocoding lookup skipped');
    return null;
  }

  try {
    const searchTerm = suburbOrPostcode.trim();
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchTerm)}&country=AU&key=${googleMapsApiKey}`
    );
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.results?.[0];
    if (!result) return null;

    const locality = [...(result.address_components || [])].reverse().find((c) => c.types.includes('locality'));
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      name: locality?.long_name || suburbOrPostcode
    };
  } catch (error) {
    console.warn(`⚠️ Google Geocoding API lookup failed for "${suburbOrPostcode}":`, error.message);
    return null;
  }
}
