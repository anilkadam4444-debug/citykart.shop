import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  disableNetwork,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  collection,
  setDoc,
  setLogLevel,
} from 'firebase/firestore';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';

import firebaseAppletConfig from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: firebaseAppletConfig.authDomain,
  projectId: firebaseAppletConfig.projectId,
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
  appId: firebaseAppletConfig.appId,
};

export const IS_PREVIEW_DUMMY_FIREBASE = Boolean(
  !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('DummyKey')
);

if (IS_PREVIEW_DUMMY_FIREBASE) {
  try {
    setLogLevel('silent');
  } catch {
    // Ignore if setLogLevel is unavailable in environment
  }
}

export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(firebaseApp, firebaseAppletConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth(firebaseApp);

if (IS_PREVIEW_DUMMY_FIREBASE) {
  try {
    disableNetwork(db).catch(() => {});
  } catch {
    // Ignore in non-browser or mock environments
  }
}

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseAppletConfig.firestoreDatabaseId || '(default)';

export { RecaptchaVerifier, signInWithPhoneNumber };
export type { ConfirmationResult };

export enum OperationType {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Error Context:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function removeUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean as T;
}

export async function syncUserAccountToFirestore(user: Record<string, any> | null | undefined) {
  if (!user || IS_PREVIEW_DUMMY_FIREBASE) return false;
  const userId = String(user.id || user.uid || auth.currentUser?.uid || '').trim();
  if (!userId || !auth.currentUser) return false;
  try {
    await setDoc(
      doc(db, 'users', userId),
      removeUndefined({
        ...user,
        id: userId,
        uid: auth.currentUser.uid,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
    return true;
  } catch {
    return false;
  }
}

export async function fetchStoresAndProductsFromFirestore(): Promise<{
  stores: import('./catalog-data').LocalStore[];
  products: import('./catalog-data').Product[];
}> {
  if (IS_PREVIEW_DUMMY_FIREBASE) {
    return { stores: [], products: [] };
  }
  try {
    const [storesSnap, productsSnap] = await Promise.all([
      getDocs(collection(db, 'stores')),
      getDocs(collection(db, 'products')),
    ]);
    const stores = storesSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as import('./catalog-data').LocalStore
    );
    const products = productsSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as import('./catalog-data').Product
    );
    return { stores, products };
  } catch {
    return { stores: [], products: [] };
  }
}

function encodeClientFallbackToken(payload: {
  uid?: string;
  phoneE164: string;
  role?: string;
  roles?: string[];
  fullName?: string;
  sellerId?: string;
  storeIds?: string[];
}): string {
  try {
    const json = JSON.stringify({
      uid: payload.uid || `user_${payload.phoneE164.replace(/\D/g, '')}`,
      phoneE164: payload.phoneE164,
      role: payload.role || 'buyer',
      roles: payload.roles || [String(payload.role || 'BUYER').toUpperCase()],
      fullName: payload.fullName || 'Verified User',
      sellerId: payload.sellerId,
      storeIds: payload.storeIds || [],
      iat: Date.now(),
    });
    const b64 =
      typeof window !== 'undefined' && typeof window.btoa === 'function'
        ? window.btoa(unescape(encodeURIComponent(json)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
        : Buffer.from(json, 'utf8').toString('base64url');
    return `ck_sess.${b64}`;
  } catch {
    return `ck_session_${payload.phoneE164}`;
  }
}

export async function buildAuthenticatedHeaders(
  extraHeadersOrIncludeJson: Record<string, string> | boolean = true
): Promise<Record<string, string>> {
  const extraHeaders =
    typeof extraHeadersOrIncludeJson === 'object' && extraHeadersOrIncludeJson !== null
      ? extraHeadersOrIncludeJson
      : {};
  const user = auth.currentUser;
  let sessionToken =
    typeof window !== 'undefined' ? localStorage.getItem('urbandirect_session_token') : null;

  // Recover session token from verified user profile or verified partner onboarding state if missing
  if (!sessionToken && typeof window !== 'undefined') {
    try {
      const storedUserRaw = localStorage.getItem('urbandirect_user');
      if (storedUserRaw) {
        const parsedUser = JSON.parse(storedUserRaw);
        if (parsedUser?.phoneE164) {
          sessionToken = encodeClientFallbackToken({
            uid: parsedUser.id || parsedUser.uid,
            phoneE164: parsedUser.phoneE164,
            role: parsedUser.role || parsedUser.primaryRole || 'buyer',
            roles: parsedUser.roles,
            fullName: parsedUser.fullName,
            sellerId: parsedUser.sellerId,
            storeIds: parsedUser.storeIds,
          });
          localStorage.setItem('urbandirect_session_token', sessionToken);
        }
      }
    } catch {
      // Ignore storage parse error
    }
  }

  if (!sessionToken && typeof window !== 'undefined') {
    try {
      const partnerCtxRaw =
        sessionStorage.getItem('citykart_partner_onboarding_v1') ||
        sessionStorage.getItem('citykart_partner_onboarding_context_v1');
      if (partnerCtxRaw) {
        const parsedCtx = JSON.parse(partnerCtxRaw);
        if (parsedCtx?.verificationStep === 'PHONE_VERIFIED' && parsedCtx?.phoneE164) {
          sessionToken = encodeClientFallbackToken({
            uid: `partner_applicant_${String(parsedCtx.phoneE164).replace(/[^\d]/g, '')}`,
            phoneE164: parsedCtx.phoneE164,
            role: 'partner',
            roles: ['PARTNER', 'BUYER'],
            fullName: parsedCtx.draftApplication?.fullLegalName || 'City Partner Applicant',
          });
          localStorage.setItem('urbandirect_session_token', sessionToken);
        }
      }
    } catch {
      // Ignore storage parse error
    }
  }

  if (!user && !sessionToken) {
    return {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
  }

  try {
    const token = user ? await user.getIdToken() : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(sessionToken ? { 'x-urbandirect-session': sessionToken } : {}),
      ...extraHeaders,
    };
  } catch {
    return {
      'Content-Type': 'application/json',
      ...(sessionToken ? { 'x-urbandirect-session': sessionToken } : {}),
      ...extraHeaders,
    };
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  if (IS_PREVIEW_DUMMY_FIREBASE || typeof window === 'undefined') return true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch {
    return false;
  }
}

export function saveClientSessionToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('urbandirect_session_token', token);
  }
}
