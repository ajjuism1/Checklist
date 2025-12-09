import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if we're in browser and config is valid
let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let storageInstance: FirebaseStorage | undefined;

// Only initialize in browser environment and if config exists and is valid
const shouldInitialize = 
  typeof window !== 'undefined' && 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'undefined' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'undefined';

if (shouldInitialize) {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
    storageInstance = getStorage(app);
    
    // Enable offline persistence for better performance and offline support
    // This caches data locally and reduces network requests
    if (dbInstance && typeof window !== 'undefined') {
      enableIndexedDbPersistence(dbInstance).catch((err) => {
        // Persistence can only be enabled in one tab at a time
        if (err.code === 'failed-precondition') {
          console.warn('Firestore persistence already enabled in another tab');
        } else if (err.code === 'unimplemented') {
          console.warn('Firestore persistence is not available in this browser');
        } else {
          console.warn('Error enabling Firestore persistence:', err);
        }
      });
    }
  } catch (error) {
    // Silently fail during build - Firebase will be initialized on client side
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Firebase initialization failed:', error);
    }
  }
}

// Export with fallback for build-time
export const auth: Auth = authInstance as Auth;
export const db: Firestore = dbInstance as Firestore;
export const storage: FirebaseStorage = storageInstance as FirebaseStorage;

export default app as FirebaseApp;

