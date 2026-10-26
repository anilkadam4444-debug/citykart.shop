import {initializeApp, getApps, getApp} from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  writeBatch,
  query,
  where,
  getDocFromServer,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  LocalStore,
  OrderRecord,
  Product,
  SellerProfile,
  UserAccount,
} from './catalog-data';

// Initialize Firebase App strictly connected to project `urbandirectintracity`
export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);

export const db = getFirestore(
  firebaseApp,
  firebaseConfig.firestoreDatabaseId
);

// Suppress benign idle GrpcConnection stream timeout logs in console
try {
  setLogLevel('error');
} catch {
  // Ignore in environments where log level cannot be mutated
}

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId; // 'urbandirectintracity'
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;

export enum OperationType {
  CREATE = 'create',
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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

let connectionTested = false;

export async function testFirestoreConnection(): Promise<void> {
  if (typeof window === 'undefined' || connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error(
        'Please check your Firebase configuration for project urbandirectintracity.'
      );
    }
  }
}

export {RecaptchaVerifier, signInWithPhoneNumber, firebaseSignOut, onAuthStateChanged};
export type {ConfirmationResult};

export function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined) as unknown as T;
  }
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (val !== undefined) {
      cleaned[key] = removeUndefined(val);
    }
  }
  return cleaned as T;
}

/**
 * Persist or fetch an authenticated user profile in Firestore (/users/{uid})
 * when signed in via Firebase Phone Authentication.
 */
export async function syncUserAccountToFirestore(
  user: UserAccount
): Promise<void> {
  const uid = auth.currentUser?.uid || user.uid || user.id;
  if (!uid) return;
  const sanitizedRoles = Array.isArray(user.roles)
    ? user.roles.filter((r) => r === 'BUYER' || r === 'SELLER')
    : ['BUYER'];
  const path = `users/${uid}`;
  try {
    const rawPayload: Record<string, unknown> = {
      ...user,
      id: user.id || uid,
      uid,
      roles: sanitizedRoles.length > 0 ? sanitizedRoles : ['BUYER'],
      isAdmin: false,
      sellerId: user.sellerId || '',
    };
    const cleanedPayload = removeUndefined(rawPayload);
    await setDoc(doc(db, 'users', uid), cleanedPayload, {merge: true});
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserAccountFromFirestore(
  uid: string
): Promise<UserAccount | null> {
  if (!uid) return null;
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as UserAccount;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
  return null;
}

export async function findUserAccountByPhoneInFirestore(
  phoneE164: string
): Promise<UserAccount | null> {
  if (!phoneE164) return null;
  const path = 'users';
  try {
    const q = query(
      collection(db, 'users'),
      where('phoneE164', '==', phoneE164)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as UserAccount;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
  return null;
}

export async function syncSellerProfileToFirestore(
  seller: SellerProfile,
  explicitUid?: string
): Promise<void> {
  const sellerWithUid = seller as SellerProfile & {ownerUid?: string};
  const ownerUid =
    auth.currentUser?.uid || explicitUid || sellerWithUid.ownerUid || seller.id;
  if (!seller.id) return;
  const path = `sellers/${seller.id}`;
  try {
    await setDoc(
      doc(db, 'sellers', seller.id),
      removeUndefined({
        ...seller,
        role: 'SELLER',
        ownerUid,
      }),
      {merge: true}
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export default firebaseApp;

export async function syncStoreToFirestore(store: LocalStore): Promise<void> {
  if (typeof window === 'undefined') return;
  const path = `stores/${store.id}`;
  const ownerUid = auth.currentUser?.uid || store.ownerUid || store.sellerId;
  try {
    await setDoc(
      doc(db, 'stores', store.id),
      removeUndefined({
        ...store,
        ownerUid,
      }),
      {merge: true}
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncProductToFirestore(product: Product): Promise<void> {
  if (typeof window === 'undefined') return;
  const path = `products/${product.id}`;
  const ownerUid = auth.currentUser?.uid || product.ownerUid || product.sellerId;
  try {
    await setDoc(
      doc(db, 'products', product.id),
      removeUndefined({
        ...product,
        ownerUid,
      }),
      {merge: true}
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncOrderToFirestore(order: OrderRecord): Promise<void> {
  if (!order.id) return;
  const path = `orders/${order.id}`;
  const buyerUid = auth.currentUser?.uid || order.buyerUid || '';
  const sanitizedOrder: OrderRecord = { ...order };
  delete sanitizedOrder.buyerDeliveryPin;
  delete sanitizedOrder.buyerOrderAccessToken;
  try {
    await setDoc(
      doc(db, 'orders', order.id),
      removeUndefined({
        ...sanitizedOrder,
        buyerUid,
      }),
      {merge: true}
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetches all stores and products from Firestore (`urbandirectintracity`)
 * and returns them so the UI merges live Firestore records with the catalog.
 */
export async function fetchStoresAndProductsFromFirestore(): Promise<{
  stores: LocalStore[];
  products: Product[];
}> {
  try {
    const [storesSnap, productsSnap] = await Promise.all([
      getDocs(collection(db, 'stores')),
      getDocs(collection(db, 'products')),
    ]);
    const stores: LocalStore[] = [];
    storesSnap.forEach((docSnap) => {
      stores.push(docSnap.data() as LocalStore);
    });
    const products: Product[] = [];
    productsSnap.forEach((docSnap) => {
      products.push(docSnap.data() as Product);
    });
    return {stores, products};
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'stores/products');
    return {stores: [], products: []};
  }
}


/**
 * Permanently deletes a single product document from Firestore (/products/{productId}).
 */
export async function deleteProductFromFirestore(productId: string): Promise<boolean> {
  const path = `products/${productId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'products', productId));
    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

/**
 * Permanently deletes a store document (/stores/{storeId}) and all associated
 * products in Firestore (/products where storeId == storeId) in batches.
 */
export async function deleteStoreAndProductsFromFirestore(storeId: string): Promise<{
  storeDeleted: boolean;
  productsDeleted: number;
}> {
  try {
    const productsQ = query(collection(db, 'products'), where('storeId', '==', storeId));
    const productsSnap = await getDocs(productsQ);

    const docsToDelete = productsSnap.docs;
    const CHUNK_SIZE = 400;
    let productsDeleted = 0;

    for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
      const chunk = docsToDelete.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const docItem of chunk) {
        batch.delete(docItem.ref);
        productsDeleted++;
      }
      await batch.commit();
    }

    // Delete store document
    const storeBatch = writeBatch(db);
    storeBatch.delete(doc(db, 'stores', storeId));
    await storeBatch.commit();

    return { storeDeleted: true, productsDeleted };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `stores/${storeId}`);
    return { storeDeleted: false, productsDeleted: 0 };
  }
}

