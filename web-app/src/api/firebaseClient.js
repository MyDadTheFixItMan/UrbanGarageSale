import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  linkWithPhoneNumber,
  RecaptchaVerifier,
  linkWithCredential,
  PhoneAuthProvider,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { 
  getFirestore, 
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
  QueryConstraint
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';

// Firebase configuration
// TODO: Replace with your Firebase config from Google Cloud Console
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Configure app verification for Phone Authentication
// For development: disable app verification to allow testing
// For production: enable verification when reCAPTCHA is fully configured
const isDevelopment = import.meta.env.MODE === 'development' || !import.meta.env.PROD;
if (isDevelopment) {
  auth.settings.appVerificationDisabledForTesting = true;
  console.log('✓ Phone Auth: Development mode - app verification disabled for testing');
} else {
  auth.settings.appVerificationDisabledForTesting = false;
  console.log('✓ Phone Auth: Production mode - app verification enabled');
}

// Authentication functions
export const firebaseAuth = {
  // Login with email and password
  login: async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  },

  // Sign up new user
  signUp: async (email, password) => {
    try {
      console.log('Firebase sign up attempt with email:', email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('Firebase sign up successful');
      return userCredential.user;
    } catch (error) {
      console.error('Firebase sign up error code:', error.code);
      console.error('Firebase sign up error message:', error.message);
      
      // Provide specific error messages based on Firebase error codes
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email is already registered. Please sign in or use a different email.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password is too weak. Use at least 6 characters with a mix of letters and numbers.');
      } else if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Email/password sign up is not enabled. Contact support.');
      } else {
        throw new Error(`Sign up failed: ${error.message}`);
      }
    }
  },

  // Logout
  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  },

  // Get current user
  getCurrentUser: () => {
    return auth.currentUser;
  },

  // Check if authenticated
  isAuthenticated: async () => {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe(); // Immediately unsubscribe after first check
        resolve(!!user);
      });
    });
  },

  // Get current user data
  me: async () => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }
    
    // Get user profile from Firestore
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return {
        id: user.uid,
        email: user.email,
        ...userSnap.data()
      };
    }
    
    // If user doesn't exist in Firestore yet, return minimal auth user data
    // Do NOT auto-create empty profiles - this prevents "No Name" users
    return {
      id: user.uid,
      email: user.email,
      full_name: '',
      role: 'user',
      // Profile will be created when user completes signup/onboarding
    };
  },

  // Listen to auth state changes
  onAuthStateChanged: (callback) => {
    return onAuthStateChanged(auth, callback);
  },

  // Update user profile
  updateProfile: async (data) => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }
    
    if (!data || Object.keys(data).length === 0) {
      console.warn('⚠️ updateProfile called with empty data');
      return;
    }
    
    try {
      console.log('🔵 Updating profile for user:', user.uid, 'with data:', data);
      const userRef = doc(db, 'users', user.uid);
      // Use setDoc with merge to create or update
      await setDoc(userRef, data, { merge: true });
      console.log('✓ Profile updated successfully');
    } catch (error) {
      console.error('❌ Error updating profile:', error.code, error.message);
      throw error;
    }
  },

  // Send password reset email
  resetPassword: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw new Error(`Password reset failed: ${error.message}`);
    }
  },

  // Change password (requires current password)
  changePassword: async (currentPassword, newPassword) => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error('No authenticated user');
    }

    try {
      // Reauthenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update to new password
      await updatePassword(user, newPassword);
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        throw new Error('Current password is incorrect');
      }
      throw new Error(`Password change failed: ${error.message}`);
    }
  },

  // Initialize reCAPTCHA verifier
  setupRecaptcha: (elementId) => {
    return new Promise((resolve, reject) => {
      // Verify element exists
      const element = document.getElementById(elementId);
      if (!element) {
        reject(new Error(`reCAPTCHA container element with id "${elementId}" not found`));
        return;
      }
      
      // Clear any existing reCAPTCHA completely
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
      element.innerHTML = '';
      element.style.display = 'none'; // Keep hidden for invisible reCAPTCHA
      
      // Clear existing verifier
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          console.log('ℹ Info clearing previous reCAPTCHA:', e.message);
        }
        window.recaptchaVerifier = null;
      }
      
      // Wait for DOM to update before creating new verifier
      setTimeout(() => {
        try {
          const recaptchaKey = import.meta.env.VITE_FIREBASE_RECAPTCHA_KEY;
          if (!recaptchaKey) {
            console.error('❌ reCAPTCHA key not configured. Check VITE_FIREBASE_RECAPTCHA_KEY in .env.local');
            reject(new Error('reCAPTCHA key not configured'));
            return;
          }

          console.log('Creating reCAPTCHA verifier with element:', elementId, isDevelopment ? '(dev mode)' : '(prod mode)');
          
          // Create verifier for both dev and prod
          // In development with appVerificationDisabledForTesting=true, Firebase will skip reCAPTCHA validation
          // but the verifier object is still required by linkWithPhoneNumber()
          const verifier = new RecaptchaVerifier(auth, elementId, {
            size: 'invisible',
            callback: (response) => {
              console.log('✓ reCAPTCHA verified, token length:', response?.length || 0);
            },
            'expired-callback': () => {
              console.log('⚠️ reCAPTCHA expired');
            },
            'error-callback': (error) => {
              console.error('❌ reCAPTCHA error:', error);
            }
          });
          
          window.recaptchaVerifier = verifier;
          console.log('✓ reCAPTCHA verifier created successfully');
          resolve(verifier);
        } catch (error) {
          console.error('❌ Failed to create reCAPTCHA verifier:', error.message);
          window.recaptchaVerifier = null;
          reject(error);
        }
      }, 100);
    });
  },

  // Send SMS verification code
  sendPhoneVerification: async (phoneNumber) => {
    try {
      // Get current authenticated user (should be the email/password user from signup)
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user signed in. Please complete email signup first.');
      }

      console.log('Current user before phone verification:', user.email, user.uid);

      // Normalize phone number: remove spaces, dashes, parentheses
      let cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
      
      // For countries like AU (+61), remove leading 0 if it comes after +61
      // e.g., "+610412345678" becomes "+61412345678"
      if (cleanPhone.match(/^\+610/)) {
        cleanPhone = cleanPhone.replace(/^\+610/, '+61');
      }

      // Verify phone number format
      if (!cleanPhone.match(/^\+[1-9]\d{1,14}$/)) {
        throw new Error('Invalid phone number format');
      }
      
      console.log('Sending SMS to:', cleanPhone, 'for user:', user.email);
      
      // In development mode, use a test phone number format
      // Firebase will auto-confirm test numbers without SMS or reCAPTCHA
      let phoneToUse = cleanPhone;
      if (isDevelopment) {
        // For development/testing: use a special format that Firebase recognizes
        // We convert the user's number to a test number that auto-confirms
        console.log('Development mode: Using Firebase test SMS flow');
        // Just use the number as-is, Firebase will handle it in test mode
      }
      
      // In development with appVerificationDisabledForTesting=true, Firebase will skip verification
      // We still need to provide a verifier object, but Firebase won't validate it
      let verifier = window.recaptchaVerifier;
      
      // If no verifier in development, just proceed - Firebase might send test SMS
      if (!verifier && isDevelopment) {
        console.log('⚠️ No reCAPTCHA verifier available in development mode, attempting direct SMS send');
        // Don't throw error, try to proceed without verifier
      } else if (!verifier) {
        throw new Error('reCAPTCHA not initialized. Please try again.');
      }
      
      if (verifier) {
        console.log('Using reCAPTCHA verifier for phone verification');
      }
      
      // Link phone number to existing email/password user
      const confirmationResult = await linkWithPhoneNumber(user, phoneToUse, verifier);
      
      // Store confirmation result for verification code
      window.confirmationResult = confirmationResult;
      console.log('✓ SMS sent successfully to phone:', cleanPhone);
      return confirmationResult;
    } catch (error) {
      console.error('Phone verification error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Provide detailed error messages
      if (error.code === 'auth/captcha-check-failed' || error.message.includes('Recaptcha verification failed')) {
        throw new Error(`reCAPTCHA validation failed. In development, clear your browser cache and reload the page. If this persists, check your .env.local for a valid VITE_FIREBASE_RECAPTCHA_KEY.`);
      }
      if (error.code === 'auth/invalid-app-credential' || error.message.includes('invalid-app-credential')) {
        throw new Error(`SMS service not properly configured.\n\nTo fix this:\n1. Go to Firebase Console > Authentication > Phone\n2. Enable Phone Authentication\n3. Add your domain to the Authorized domains list (http://localhost:5173 for development)`);
      }
      if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many SMS requests. Please wait a few minutes and try again.');
      }
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  },

  // Verify SMS code and link phone credential
  verifyPhoneCode: async (code) => {
    try {
      const confirmationResult = window.confirmationResult;
      if (!confirmationResult) {
        throw new Error('No SMS verification in progress');
      }

      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user logged in');
      }

      // Verify the code - this will confirm the phone without creating a new session
      const result = await confirmationResult.confirm(code);
      
      // Phone is now verified, return the user
      return result.user;
    } catch (error) {
      console.error('Phone verification error details:', error);
      throw new Error(`Invalid verification code: ${error.message}`);
    }
  },

  // Clear reCAPTCHA
  clearRecaptcha: () => {
    // Clear the DOM element completely
    const element = document.getElementById('recaptcha-container');
    if (element) {
      // Remove all child elements and reset innerHTML
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
      element.innerHTML = '';
      element.style.display = 'none';
    }
    
    // Clear the Firebase verifier
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {
        console.log('Error clearing reCAPTCHA verifier:', e);
      }
      window.recaptchaVerifier = null;
    }
    
    window.confirmationResult = null;
  },
};

// Firestore entity management
export const firebaseEntities = {
  // GarageSale entity
  GarageSale: {
    create: async (data) => {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const garageSalesRef = collection(db, 'garageSales');
      const docRef = await addDoc(garageSalesRef, {
        ...data,
        created_by: user.email,
        user_id: user.uid,
        created_at: new Date(),
        status: 'draft'
      });
      
      return { id: docRef.id, ...data };
    },

    filter: async (filters = {}) => {
      const garageSalesRef = collection(db, 'garageSales');
      let q = query(garageSalesRef);

      // Build query constraints
      const constraints = [];
      
      if (filters.id) {
        const docRef = doc(db, 'garageSales', filters.id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? [{ id: docSnap.id, ...docSnap.data() }] : [];
      }

      if (filters.created_by) {
        constraints.push(where('created_by', '==', filters.created_by));
      }

      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }

      if (filters.postcode) {
        constraints.push(where('postcode', '==', filters.postcode));
      }

      if (constraints.length > 0) {
        q = query(garageSalesRef, ...constraints);
      }

      const querySnapshot = await getDocs(q);
      let results = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter out past listings (where end_date has passed) unless explicitly requested
      if (!filters.includePast) {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Start of today
        results = results.filter(listing => {
          if (!listing.end_date) {
            console.log(`Listing ${listing.id} missing end_date, including`);
            return true;
          }
          
          // Handle both string dates and Date objects
          let endDate = listing.end_date;
          if (typeof endDate === 'string') {
            endDate = new Date(endDate);
          } else if (endDate.toDate) {
            // Firestore Timestamp
            endDate = endDate.toDate();
          }
          
          endDate.setHours(23, 59, 59, 999); // End of that day
          const isPastListing = endDate < now;
          
          if (isPastListing) {
            console.log(`Listing ${listing.id} ended on ${endDate.toLocaleDateString()}, excluding (today is ${now.toLocaleDateString()})`);
          }
          return !isPastListing;
        });
      }

      // Handle distance-based filtering
      if (filters.distance && (filters.userLatitude !== undefined && filters.userLongitude !== undefined)) {
        const radiusKm = parseInt(filters.distance) || 25;
        console.log(`Filtering by distance: ${radiusKm}km from lat=${filters.userLatitude}, lng=${filters.userLongitude}`);
        
        // Calculate distances using Haversine formula
        results = results.filter(listing => {
          if (!listing.latitude || !listing.longitude) {
            console.log(`Listing ${listing.id} missing coordinates, excluding`);
            return false;
          }
          
          const distance = calculateDistance(
            filters.userLatitude,
            filters.userLongitude,
            listing.latitude,
            listing.longitude
          );
          
          console.log(`Listing ${listing.id} (${listing.suburb}): ${distance.toFixed(2)}km`);
          return distance <= radiusKm;
        });
      }

      return results;
    },

    update: async (id, data) => {
      const docRef = doc(db, 'garageSales', id);
      await updateDoc(docRef, data);
      const docSnap = await getDoc(docRef);
      return { id: docSnap.id, ...docSnap.data() };
    },

    delete: async (id) => {
      console.log('firebaseClient: Deleting GarageSale with id:', id);
      const docRef = doc(db, 'garageSales', id);
      await deleteDoc(docRef);
      console.log('firebaseClient: Successfully deleted GarageSale:', id);
      return { id, deleted: true };
    }
  },

  // SavedListing entity
  SavedListing: {
    create: async (data) => {
      console.log('firebaseClient: Creating SavedListing with data:', data);
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      const savedListingsRef = collection(db, 'savedListings');
      const docRef = await addDoc(savedListingsRef, {
        ...data,
        user_email: user.email,
        user_id: user.uid,
        created_at: new Date()
      });
      
      console.log('firebaseClient: SavedListing created with id:', docRef.id);
      return { id: docRef.id, ...data };
    },

    filter: async (filters = {}) => {
      console.log('firebaseClient: Filtering SavedListings with filters:', filters);
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const savedListingsRef = collection(db, 'savedListings');
      
      // Build constraints - always filter by current user ID for security
      const constraints = [where('user_id', '==', user.uid)];

      if (filters.user_email) {
        constraints.push(where('user_email', '==', filters.user_email));
      }

      if (filters.user_id) {
        constraints.push(where('user_id', '==', filters.user_id));
      }

      const q = query(savedListingsRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('firebaseClient: SavedListings filter returned', results.length, 'items:', results);
      return results;
    },

    delete: async (id) => {
      console.log('firebaseClient: Deleting SavedListing with id:', id);
      const docRef = doc(db, 'savedListings', id);
      await deleteDoc(docRef);
      console.log('firebaseClient: SavedListing deleted successfully');
    }
  },

  // User entity
  User: {
    filter: async (filters = {}) => {
      const usersRef = collection(db, 'users');
      const constraints = [];

      if (filters.role) {
        constraints.push(where('role', '==', filters.role));
      }

      if (filters.state) {
        constraints.push(where('state', '==', filters.state));
      }

      const q = constraints.length > 0
        ? query(usersRef, ...constraints)
        : query(usersRef);

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },

    update: async (id, data) => {
      const docRef = doc(db, 'users', id);
      await updateDoc(docRef, data);
      const docSnap = await getDoc(docRef);
      return { id: docSnap.id, ...docSnap.data() };
    },

    delete: async (id) => {
      // Call the backend API to delete the user
      // This will handle both Firebase Auth deletion and Firestore deletion
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated. Please log in to delete users.');
      }
      
      try {
        console.log('🔵 Starting user deletion for id:', id);
        const token = await user.getIdToken();
        console.log('✓ Got ID token for:', user.email);
        
        const response = await fetch('http://localhost:3000/deleteUser', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: id }),
        });

        console.log('🔵 Delete API response status:', response.status);
        const responseData = await response.json();
        console.log('🔵 Delete API response:', responseData);

        if (!response.ok) {
          const errorMsg = responseData.error || 'Failed to delete user';
          console.error('❌ Delete failed:', errorMsg);
          throw new Error(errorMsg);
        }

        console.log('✓ User deletion succeeded');
        return { id, deleted: true };
      } catch (error) {
        console.error('❌ User.delete() error:', error.message, error);
        throw error;
      }
    }
  },

  // Payment entity
  Payment: {
    create: async (data) => {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      const paymentsRef = collection(db, 'payments');
      const docRef = await addDoc(paymentsRef, {
        ...data,
        user_id: user.uid,
        user_email: user.email,
        created_at: new Date(),
        status: data.status || 'pending'
      });

      return { id: docRef.id, ...data };
    },

    filter: async (filters = {}) => {
      const paymentsRef = collection(db, 'payments');
      const constraints = [];

      if (filters.user_id) {
        constraints.push(where('user_id', '==', filters.user_id));
      }

      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }

      const q = constraints.length > 0
        ? query(paymentsRef, ...constraints)
        : query(paymentsRef);

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },

    update: async (id, data) => {
      const docRef = doc(db, 'payments', id);
      await updateDoc(docRef, data);
      const docSnap = await getDoc(docRef);
      return { id: docSnap.id, ...docSnap.data() };
    }
  },

  // ContactMessage entity
  ContactMessage: {
    create: async (data) => {
      const messagesRef = collection(db, 'contactMessages');
      const docRef = await addDoc(messagesRef, {
        ...data,
        created_at: new Date(),
        status: data.status || 'unread'
      });

      return { id: docRef.id, ...data };
    },

    filter: async (filters = {}) => {
      const messagesRef = collection(db, 'contactMessages');
      const constraints = [];

      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }

      const q = constraints.length > 0
        ? query(messagesRef, orderBy('created_at', 'desc'), ...constraints)
        : query(messagesRef, orderBy('created_at', 'desc'));

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },

    update: async (id, data) => {
      const docRef = doc(db, 'contactMessages', id);
      await updateDoc(docRef, data);
      const docSnap = await getDoc(docRef);
      return { id: docSnap.id, ...docSnap.data() };
    },

    delete: async (id) => {
      const docRef = doc(db, 'contactMessages', id);
      await deleteDoc(docRef);
    }
  },

  // App Settings (single document store)
  AppSettings: {
    get: async () => {
      try {
        const docRef = doc(db, 'appSettings', 'default');
        const docSnap = await getDoc(docRef);
        console.log('✓ Fetched app settings:', docSnap.exists() ? docSnap.data() : 'no data');
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : {};
      } catch (error) {
        console.error('✗ Error getting app settings:', error);
        return {};
      }
    },

    update: async (data) => {
      try {
        console.log('📝 Updating app settings with:', data);
        const docRef = doc(db, 'appSettings', 'default');
        await setDoc(docRef, data, { merge: true });
        console.log('✓ App settings saved successfully');
        const docSnap = await getDoc(docRef);
        return { id: docSnap.id, ...docSnap.data() };
      } catch (error) {
        console.error('✗ Error updating app settings:', error);
        throw error;
      }
    }
  }
};

// Storage functions
export const firebaseStorage = {
  uploadImage: async (file, path) => {
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (error) {
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }
};

// Cloud Functions
export const firebaseFunctions = {
  invoke: async (functionName, data) => {
    try {
      // Use local API server instead of Firebase Cloud Functions to avoid CORS issues
      const apiUrl = `http://localhost:3000/${functionName}`;
      
      console.log(`Calling local API: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`Function call failed:`, error);
      throw new Error(`Function call failed: ${error.message}`);
    }
  }
};

// Helper to get auth token
const getAuthToken = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch (error) {
    console.error('Failed to get auth token:', error);
  }
  return '';
};

// Firestore API wrapper
export const firebaseFirestore = {
  collection: (collectionName) => {
    return {
      doc: (docName) => {
        return {
          get: async () => {
            try {
              const docRef = doc(db, collectionName, docName);
              const docSnap = await getDoc(docRef);
              return {
                exists: docSnap.exists(),
                data: () => docSnap.data(),
              };
            } catch (error) {
              console.error('Error getting document:', error);
              throw error;
            }
          },
          set: async (data, options = {}) => {
            try {
              const docRef = doc(db, collectionName, docName);
              await setDoc(docRef, data, options);
            } catch (error) {
              console.error('Error setting document:', error);
              throw error;
            }
          },
          delete: async () => {
            try {
              const docRef = doc(db, collectionName, docName);
              await deleteDoc(docRef);
            } catch (error) {
              console.error('Error deleting document:', error);
              throw error;
            }
          },
        };
      },
      // Get all documents from collection, optionally ordered
      getDocs: async (orderByField = null, orderDirection = 'asc') => {
        try {
          const collectionRef = collection(db, collectionName);
          let q;
          if (orderByField) {
            q = query(collectionRef, orderBy(orderByField, orderDirection));
          } else {
            q = collectionRef;
          }
          const snapshot = await getDocs(q);
          return snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));
        } catch (error) {
          console.error('Error getting documents:', error);
          throw error;
        }
      },
      // Add new document to collection
      add: async (data) => {
        try {
          const collectionRef = collection(db, collectionName);
          const docRef = await addDoc(collectionRef, {
            ...data,
            created_at: new Date(),
          });
          return docRef.id;
        } catch (error) {
          console.error('Error adding document:', error);
          throw error;
        }
      },
    };
  },
};

// Main Firebase client export
export const firebase = {
  auth: firebaseAuth,
  entities: firebaseEntities,
  functions: firebaseFunctions,
  storage: firebaseStorage,
  firestore: firebaseFirestore,
  asServiceRole: {
    entities: firebaseEntities
  },
  // Seed sample listings
  seedSampleListings: async () => {
    const sampleListings = [
      {
        title: 'Vintage Furniture & Decor',
        description: 'Beautiful vintage furniture, lamps, and home decor items. Great condition!',
        address: '123 Chapel Street',
        suburb: 'Prahran',
        postcode: '3181',
        state: 'VIC',
        latitude: -37.8606,
        longitude: 145.0039,
        start_date: '2026-02-08',
        end_date: '2026-02-08',
        start_time: '09:00',
        end_time: '15:00',
        sale_type: 'garage_sale',
        photos: [],
        created_by: 'seller@example.com',
        user_id: 'demo_user_1',
        status: 'active',
        payment_status: 'pending'
      },
      {
        title: 'Electronics & Books',
        description: 'Used electronics, textbooks, and paperbacks. All working perfectly.',
        address: '456 Fitzroy Street',
        suburb: 'Fitzroy',
        postcode: '3065',
        state: 'VIC',
        latitude: -37.8019,
        longitude: 144.9766,
        start_date: '2026-02-07',
        end_date: '2026-02-08',
        start_time: '08:00',
        end_time: '14:00',
        sale_type: 'garage_sale',
        photos: [],
        created_by: 'seller@example.com',
        user_id: 'demo_user_2',
        status: 'active',
        payment_status: 'pending'
      },
      {
        title: 'Moving Sale - Everything Must Go',
        description: 'Complete household items. Owner relocating interstate.',
        address: '789 Toorak Road',
        suburb: 'South Yarra',
        postcode: '3141',
        state: 'VIC',
        latitude: -37.8468,
        longitude: 145.0164,
        start_date: '2026-02-14',
        end_date: '2026-02-15',
        start_time: '09:00',
        end_time: '16:00',
        sale_type: 'moving_sale',
        photos: [],
        created_by: 'seller@example.com',
        user_id: 'demo_user_3',
        status: 'active',
        payment_status: 'pending'
      },
      {
        title: 'Garden Tools & Outdoor Gear',
        description: 'Lawnmowers, gardening tools, outdoor furniture and BBQ equipment.',
        address: '321 Commercial Road',
        suburb: 'Melbourne',
        postcode: '3000',
        state: 'VIC',
        latitude: -37.8136,
        longitude: 144.9631,
        start_date: '2026-02-09',
        end_date: '2026-02-09',
        start_time: '10:00',
        end_time: '14:00',
        sale_type: 'garage_sale',
        photos: [],
        created_by: 'seller@example.com',
        user_id: 'demo_user_4',
        status: 'active',
        payment_status: 'pending'
      },
      {
        title: 'Kids Toys & Baby Equipment',
        description: 'Children\'s toys, stroller, crib, and kids clothing. Gently used.',
        address: '654 Southbank Boulevard',
        suburb: 'Southbank',
        postcode: '3006',
        state: 'VIC',
        latitude: -37.8267,
        longitude: 144.9769,
        start_date: '2026-02-10',
        end_date: '2026-02-10',
        start_time: '09:00',
        end_time: '13:00',
        sale_type: 'garage_sale',
        photos: [],
        created_by: 'seller@example.com',
        user_id: 'demo_user_5',
        status: 'active',
        payment_status: 'pending'
      },
      {
        title: 'Clothing & Fashion Items',
        description: 'Designer clothes, shoes, handbags and accessories. Various sizes.',
        address: '987 Queen Street',
        suburb: 'Melbourne',
        postcode: '3000',
        state: 'VIC',
        latitude: -37.8129,
        longitude: 144.9701,
        start_date: '2026-02-11',
        end_date: '2026-02-11',
        start_time: '10:00',
        end_time: '15:00',
        sale_type: 'garage_sale',
        photos: [],
        created_by: 'seller@example.com',
        user_id: 'demo_user_6',
        status: 'active',
        payment_status: 'pending'
      },
      {
        title: 'Estate Sale - Antiques & Collectibles',
        description: 'Antique furniture, china, jewelry and rare collectible items.',
        address: '111 Domain Road',
        suburb: 'South Yarra',
        postcode: '3141',
        state: 'VIC',
        latitude: -37.8394,
        longitude: 144.9852,
        start_date: '2026-02-15',
        end_date: '2026-02-16',
        start_time: '10:00',
        end_time: '17:00',
        sale_type: 'estate_sale',
        photos: [],
        created_by: 'seller@example.com',
        user_id: 'demo_user_7',
        status: 'active',
        payment_status: 'pending'
      },
      {
        title: 'Kitchen & Dining Equipment',
        description: 'Pots, pans, dishes, cutlery, kitchen appliances and dining furniture.',
        address: '222 Brunswick Street',
        suburb: 'Fitzroy',
        postcode: '3065',
        state: 'VIC',
        latitude: -37.8006,
        longitude: 144.9814,
        start_date: '2026-02-12',
        end_date: '2026-02-12',
        start_time: '09:00',
        end_time: '14:00',
        sale_type: 'garage_sale',
        photos: [],
        created_by: 'seller@example.com',
        user_id: 'demo_user_8',
        status: 'active',
        payment_status: 'pending'
      },
      {
        title: 'Sports & Fitness Equipment',
        description: 'Exercise bikes, dumbbells, yoga mats, sports equipment and gear.',
        address: '333 Swanston Street',
        suburb: 'Melbourne',
        postcode: '3000',
        state: 'VIC',
        latitude: -37.8102,
        longitude: 144.9658,
        start_date: '2026-02-13',
        end_date: '2026-02-13',
        start_time: '10:00',
        end_time: '13:00',
        sale_type: 'garage_sale',
        photos: [],
        created_by: 'seller@example.com',
        user_id: 'demo_user_9',
        status: 'active',
        payment_status: 'pending'
      },
      {
        title: 'Yard Sale - Everything Goes',
        description: 'Mixed household items, furniture, and miscellaneous goods.',
        address: '444 Lonsdale Street',
        suburb: 'Melbourne',
        postcode: '3000',
        state: 'VIC',
        latitude: -37.8141,
        longitude: 144.9609,
        start_date: '2026-02-16',
        end_date: '2026-02-16',
        start_time: '08:00',
        end_time: '12:00',
        sale_type: 'yard_sale',
        photos: [],
        created_by: 'seller@example.com',
        user_id: 'demo_user_10',
        status: 'active',
        payment_status: 'pending'
      }
    ];

    try {
      let count = 0;
      for (const listing of sampleListings) {
        try {
          // Directly insert listings without user_id requirement
          const garageSalesRef = collection(db, 'garageSales');
          await addDoc(garageSalesRef, {
            ...listing,
            created_at: new Date(),
          });
          count++;
        } catch (itemError) {
          console.error(`Error adding listing "${listing.title}":`, itemError);
        }
      }
      console.log(`✅ Successfully added ${count} sample listings to Firestore`);
      return count;
    } catch (error) {
      console.error('❌ Error seeding sample listings:', error);
      throw error;
    }
  }
};

// Helper function to calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

// Suburb to coordinates mapping (Melbourne VIC suburbs)
const SUBURB_COORDS = {
  // Melbourne CBD
  'melbourne': { lat: -37.8136, lng: 144.9631, name: 'Melbourne' },
  '3000': { lat: -37.8136, lng: 144.9631, name: 'Melbourne' },
  
  // Inner suburbs
  'fitzroy': { lat: -37.8019, lng: 144.9766, name: 'Fitzroy' },
  '3065': { lat: -37.8019, lng: 144.9766, name: 'Fitzroy' },
  'prahran': { lat: -37.8606, lng: 145.0039, name: 'Prahran' },
  '3181': { lat: -37.8606, lng: 145.0039, name: 'Prahran' },
  'south yarra': { lat: -37.8468, lng: 145.0164, name: 'South Yarra' },
  '3141': { lat: -37.8468, lng: 145.0164, name: 'South Yarra' },
  'southbank': { lat: -37.8267, lng: 144.9769, name: 'Southbank' },
  '3006': { lat: -37.8267, lng: 144.9769, name: 'Southbank' },
  
  // Outer suburbs
  'brunswick': { lat: -37.7667, lng: 144.9833, name: 'Brunswick' },
  '3056': { lat: -37.7667, lng: 144.9833, name: 'Brunswick' },
  'box hill': { lat: -37.8236, lng: 145.1061, name: 'Box Hill' },
  '3128': { lat: -37.8236, lng: 145.1061, name: 'Box Hill' },
  'footscray': { lat: -37.8078, lng: 144.9014, name: 'Footscray' },
  '3011': { lat: -37.8078, lng: 144.9014, name: 'Footscray' },
  'ringwood': { lat: -37.8286, lng: 145.2292, name: 'Ringwood' },
  '3134': { lat: -37.8286, lng: 145.2292, name: 'Ringwood' },
};

// Helper function to get coordinates for a suburb/postcode
async function getSuburbCoordinates(suburbOrPostcode) {
  if (!suburbOrPostcode) return null;
  
  const searchTerm = suburbOrPostcode.toLowerCase().trim();
  
  // First try hardcoded lookup (Melbourne suburbs)
  const hardcodedResult = SUBURB_COORDS[searchTerm];
  if (hardcodedResult) {
    console.log(`✓ Found suburb "${suburbOrPostcode}" in hardcoded coordinates`);
    return hardcodedResult;
  }
  
  // Fallback to Google Places API for other suburbs/postcodes
  console.log(`📍 Suburb "${suburbOrPostcode}" not in hardcoded list, trying Google Places API...`);
  try {
    const response = await fetch('http://localhost:3000/getPrincipalCoordinates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locationQuery: suburbOrPostcode,
        country: 'Australia'
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.latitude !== undefined && data.longitude !== undefined) {
        console.log(`✓ Found coordinates via API: lat=${data.latitude}, lng=${data.longitude}`);
        return {
          lat: data.latitude,
          lng: data.longitude,
          name: data.name || suburbOrPostcode
        };
      }
    }
  } catch (error) {
    console.warn(`⚠️  Google Places lookup failed for "${suburbOrPostcode}":`, error.message);
  }
  
  console.log(`✗ Could not find coordinates for "${suburbOrPostcode}"`);
  return null;
}

// Export utility function to window for easy access in components
if (typeof window !== 'undefined') {
  window.firebaseSuburbLookup = getSuburbCoordinates;
}

export default firebase;
