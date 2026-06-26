import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const isFirebaseEnabled = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

let auth: any = null;
let googleProvider: any = null;
let db: any = null;
let analytics: any = null;

if (isFirebaseEnabled) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    db = getFirestore(app);
    
    if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === 'true') {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099');
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      console.log('[Firebase] Connected to local Emulators');
    } else {
      if (typeof window !== 'undefined') {
        isSupported().then((supported) => {
          if (supported) {
            analytics = getAnalytics(app);
            console.log('[Firebase] Analytics initialized');
          }
        });
      }
    }
  } catch (error) {
    console.error('Firebase initialization failed:', error);
  }
}

export function logAnalyticsEvent(eventName: string, params?: any) {
  if (analytics) {
    try {
      logEvent(analytics, eventName, params);
    } catch (e) {
      console.error('[Analytics] Failed to log event:', eventName, e);
    }
  } else {
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === 'true') {
      console.log(`[Analytics Mock] Event: ${eventName}`, params);
    }
  }
}

export { auth, googleProvider, db, isFirebaseEnabled };
