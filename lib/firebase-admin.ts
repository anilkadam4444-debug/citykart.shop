import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../firebase-applet-config.json';

export const TARGET_FIRESTORE_DATABASE_ID =
  firebaseConfig.firestoreDatabaseId ||
  'ai-studio-urbandirectgloba-e84b263b-d482-4469-8ff3-92b474ec82f9';

export const TARGET_FIREBASE_PROJECT_ID =
  firebaseConfig.projectId || 'urbandirectintracity';

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // 1. Explicit Service Account JSON string in environment (if configured)
  const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (saKey && saKey.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(saKey);
      return initializeApp({
        credential: cert(parsed),
        projectId: TARGET_FIREBASE_PROJECT_ID,
      });
    } catch (e) {
      console.warn('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    }
  }

  // 2. Individual credentials if explicitly provided in environment
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  if (privateKey && clientEmail) {
    try {
      return initializeApp({
        credential: cert({
          projectId: TARGET_FIREBASE_PROJECT_ID,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        } as ServiceAccount),
      });
    } catch (e) {
      console.warn('[firebase-admin] Failed to initialize with private key:', e);
    }
  }

  // 3. Application Default Credentials (ADC) - standard Zero-Key architecture for Cloud Run
  try {
    return initializeApp({
      credential: applicationDefault(),
      projectId: TARGET_FIREBASE_PROJECT_ID,
    });
  } catch {
    // 4. Safe fallback for build-time or restricted execution environments
    try {
      return initializeApp({
        projectId: TARGET_FIREBASE_PROJECT_ID,
      });
    } catch {
      return initializeApp();
    }
  }
}

const app = getAdminApp();

// Explicitly bind to the named provisioned database ID (never default to non-existent '(default)')
export const adminDb = getFirestore(app, TARGET_FIRESTORE_DATABASE_ID);
export const adminAuth = getAuth(app);
export { app as adminApp };
