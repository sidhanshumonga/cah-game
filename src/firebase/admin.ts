import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let serviceAccount: any = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err: any) {
    console.error('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT env variable:', err.message);
  }
}

if (getApps().length === 0) {
  if (serviceAccount) {
    try {
      initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (initErr: any) {
      console.error('[firebase-admin] Failed to initialize Firebase Admin with service account:', initErr.message);
      initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
  } else {
    // Automatically loads default credentials on GCP/Firebase Hosting,
    // or falls back to local configuration/emulator
    initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
}

export const adminDb = getFirestore();
export { adminDb as db };
