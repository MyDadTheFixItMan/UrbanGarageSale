// Public entry point for the Firebase client. The implementation lives in ./firebase/.
import { auth } from './firebase/app';
import { firebaseAuth } from './firebase/auth';
import { firebaseEntities } from './firebase/entities';
import { firebaseStorage, firebaseFunctions, firebaseFirestore, getSuburbCoordinates } from './firebase/services';

export { firebaseAuth, firebaseEntities, firebaseStorage, firebaseFunctions, firebaseFirestore, getSuburbCoordinates };

export const firebase = {
  auth: firebaseAuth,
  entities: firebaseEntities,
  functions: firebaseFunctions,
  storage: firebaseStorage,
  firestore: firebaseFirestore,
  asServiceRole: {
    entities: firebaseEntities
  },
  // Get current authenticated user
  get currentUser() {
    return auth.currentUser;
  }
};

export default firebase;
