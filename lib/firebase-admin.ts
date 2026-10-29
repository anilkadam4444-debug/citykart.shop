import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
  App,
} from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import firebaseConfig from '../firebase-applet-config.json';

export const TARGET_FIREBASE_PROJECT_ID =
  firebaseConfig.projectId || 'citykart-default';
export const TARGET_FIRESTORE_DATABASE_ID =
  firebaseConfig.firestoreDatabaseId || '(default)';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

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

  try {
    return initializeApp({
      credential: applicationDefault(),
      projectId: TARGET_FIREBASE_PROJECT_ID,
    });
  } catch {
    try {
      return initializeApp({
        projectId: TARGET_FIREBASE_PROJECT_ID,
      });
    } catch {
      return initializeApp();
    }
  }
}

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

function ensureApp(): App {
  if (!cachedApp) {
    cachedApp = getAdminApp();
  }
  return cachedApp;
}

function createNoopFirestoreFallback(): Firestore {
  const noopDoc: any = {
    id: 'noop',
    get: async () => ({ exists: false, data: () => undefined }),
    set: async () => ({}),
    update: async () => ({}),
    delete: async () => ({}),
    collection: () => noopCollection,
  };
  const noopCollection: any = {
    doc: () => noopDoc,
    get: async () => ({ empty: true, docs: [], forEach: () => {} }),
    where: () => noopCollection,
    orderBy: () => noopCollection,
    limit: () => noopCollection,
    add: async () => noopDoc,
  };
  return {
    collection: () => noopCollection,
    doc: () => noopDoc,
    batch: () => ({
      set: () => {},
      update: () => {},
      delete: () => {},
      commit: async () => [],
    }),
    runTransaction: async (fn: any) =>
      fn({
        get: async () => ({ exists: false }),
        set: () => {},
        update: () => {},
        delete: () => {},
      }),
  } as unknown as Firestore;
}

function initAdminDb(): Firestore {
  if (cachedDb) return cachedDb;
  try {
    const app = ensureApp();
    // Dynamic require prevents top-level MODULE_NOT_FOUND during static build collection if optional native deps are absent
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getFirestore } = require('firebase-admin/firestore');
    cachedDb =
      TARGET_FIRESTORE_DATABASE_ID === '(default)'
        ? getFirestore(app)
        : getFirestore(app, TARGET_FIRESTORE_DATABASE_ID);
    return cachedDb!;
  } catch (err) {
    console.warn('[firebase-admin] Falling back to resilient Firestore proxy during build/init:', err);
    cachedDb = createNoopFirestoreFallback();
    return cachedDb;
  }
}

function initAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  try {
    const app = ensureApp();
    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch (err) {
    console.warn('[firebase-admin] Falling back to resilient Auth proxy during build/init:', err);
    cachedAuth = {
      verifyIdToken: async () => {
        throw new Error('Firebase Admin Auth not configured');
      },
      getUser: async () => {
        throw new Error('Firebase Admin Auth not configured');
      },
      setCustomUserClaims: async () => {},
    } as unknown as Auth;
    return cachedAuth;
  }
}

export const adminApp: App = ensureApp();
export const adminDb: Firestore = initAdminDb();
export const adminAuth: Auth = initAdminAuth();
