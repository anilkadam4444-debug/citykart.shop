import {initializeApp, getApps, getApp} from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut as firebaseSignOut,
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
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  LocalStore,
  OrderRecord,
  Product,
  SellerProfile,
  UserAccount,
} from './catalog-data';
import {
  NANDED_DEMO_BATCH_ID,
  NANDED_DEMO_PRODUCTS,
  NANDED_DEMO_STORES,
} from './nanded-demo-data';

// Initialize Firebase App strictly connected to project `urbandirectintracity`
export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);

export const db = getFirestore(
  firebaseApp,
  firebaseConfig.firestoreDatabaseId
);

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

export {RecaptchaVerifier, signInWithPhoneNumber, firebaseSignOut};
export type {ConfirmationResult};

/**
 * Persist or fetch an authenticated user profile in Firestore (/users/{uid})
 * when signed in via Firebase Phone Authentication.
 */
export async function syncUserAccountToFirestore(
  user: UserAccount
): Promise<void> {
  if (typeof window === 'undefined' || !auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const path = `users/${uid}`;
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        ...user,
        id: user.id || uid,
        uid,
        sellerId: user.sellerId || '',
      },
      {merge: true}
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserAccountFromFirestore(
  uid: string
): Promise<UserAccount | null> {
  if (typeof window === 'undefined' || !auth.currentUser) return null;
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

export async function syncSellerProfileToFirestore(
  seller: SellerProfile
): Promise<void> {
  if (typeof window === 'undefined' || !auth.currentUser) return;
  const path = `sellers/${seller.id}`;
  try {
    await setDoc(
      doc(db, 'sellers', seller.id),
      {
        ...seller,
        ownerUid: auth.currentUser.uid,
      },
      {merge: true}
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncStoreToFirestore(store: LocalStore): Promise<void> {
  if (typeof window === 'undefined') return;
  const path = `stores/${store.id}`;
  const ownerUid = auth.currentUser?.uid || store.ownerUid || store.sellerId;
  try {
    await setDoc(
      doc(db, 'stores', store.id),
      {
        ...store,
        ownerUid,
      },
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
      {
        ...product,
        ownerUid,
      },
      {merge: true}
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncOrderToFirestore(order: OrderRecord): Promise<void> {
  if (typeof window === 'undefined' || !auth.currentUser) return;
  const path = `orders/${order.id}`;
  try {
    await setDoc(
      doc(db, 'orders', order.id),
      {
        ...order,
        buyerUid: auth.currentUser.uid,
      },
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
 * Repeatable, idempotent seeder that writes the 50 Nanded demo stores and
 * 75 Nanded demo products into Firestore (`urbandirectintracity`) using stable IDs
 * (`demo-nanded-store-01a`..`25b` and `demo-nanded-prod-01a`..`25c`) and
 * `isDemo: true`, `demoBatchId: 'nanded-25-cat-demo-v1'`.
 * Never overwrites or deletes non-demo records.
 */
export async function seedNandedDemoCatalogToFirestore(): Promise<{
  storesWritten: number;
  productsWritten: number;
  batchId: string;
}> {
  const storeBatch = writeBatch(db);
  for (const store of NANDED_DEMO_STORES) {
    storeBatch.set(doc(db, 'stores', store.id), store, {merge: true});
  }
  await storeBatch.commit();

  const productBatch = writeBatch(db);
  for (const product of NANDED_DEMO_PRODUCTS) {
    productBatch.set(doc(db, 'products', product.id), product, {merge: true});
  }
  await productBatch.commit();

  return {
    storesWritten: NANDED_DEMO_STORES.length,
    productsWritten: NANDED_DEMO_PRODUCTS.length,
    batchId: NANDED_DEMO_BATCH_ID,
  };
}

/**
 * Safely removes only records tagged with `isDemo == true` and
 * `demoBatchId == 'nanded-25-cat-demo-v1'` without affecting real sellers.
 */
export async function removeNandedDemoCatalogFromFirestore(): Promise<{
  storesRemoved: number;
  productsRemoved: number;
}> {
  const storesQ = query(
    collection(db, 'stores'),
    where('demoBatchId', '==', NANDED_DEMO_BATCH_ID)
  );
  const productsQ = query(
    collection(db, 'products'),
    where('demoBatchId', '==', NANDED_DEMO_BATCH_ID)
  );

  const [storesSnap, productsSnap] = await Promise.all([
    getDocs(storesQ),
    getDocs(productsQ),
  ]);

  let storesRemoved = 0;
  if (!storesSnap.empty) {
    const b1 = writeBatch(db);
    storesSnap.forEach((d) => {
      if (d.data().isDemo === true) {
        b1.delete(d.ref);
        storesRemoved++;
      }
    });
    await b1.commit();
  }

  let productsRemoved = 0;
  if (!productsSnap.empty) {
    const b2 = writeBatch(db);
    productsSnap.forEach((d) => {
      if (d.data().isDemo === true) {
        b2.delete(d.ref);
        productsRemoved++;
      }
    });
    await b2.commit();
  }

  return {storesRemoved, productsRemoved};
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

