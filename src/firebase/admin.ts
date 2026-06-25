import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRemoteJWKSet, jwtVerify } from 'jose';

let serviceAccount: any = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount && typeof serviceAccount.private_key === 'string') {
      // Replace double-escaped newlines with actual newlines for serverless environments (like Vercel)
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
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

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function verifyIdToken(idToken: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not configured');
  }
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  return {
    uid: payload.sub as string,
    email: payload.email as string,
    ...payload,
  };
}

