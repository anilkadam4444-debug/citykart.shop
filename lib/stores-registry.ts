import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, IS_PREVIEW_DUMMY_FIREBASE, removeUndefined } from './firebase';
import {
  INITIAL_PRODUCTS,
  INITIAL_SELLERS,
  INITIAL_STORES,
  LocalStore,
  Product,
  SellerProfile,
} from './catalog-data';

export interface DeletedStoreRecord {
  storeId: string;
  storeName: string;
  deletedAt: string;
  deletedByUid?: string;
  deletedByPhone?: string;
  reason?: string;
}

declare global {
  var __serverDeletedStoresRegistry: Map<string, DeletedStoreRecord> | undefined;
  var __serverStoresRegistry: Map<string, LocalStore> | undefined;
  var __serverSellersRegistry: Map<string, SellerProfile> | undefined;
  var __serverProductsRegistry: Map<string, Product> | undefined;
  var __serverDeletedProductsRegistry: Set<string> | undefined;
}

if (!globalThis.__serverDeletedStoresRegistry) {
  globalThis.__serverDeletedStoresRegistry = new Map<string, DeletedStoreRecord>();
}

if (!globalThis.__serverStoresRegistry) {
  const storeMap = new Map<string, LocalStore>();
  for (const s of INITIAL_STORES) {
    storeMap.set(s.id, s);
  }
  globalThis.__serverStoresRegistry = storeMap;
}

if (!globalThis.__serverSellersRegistry) {
  const sellerMap = new Map<string, SellerProfile>();
  for (const s of INITIAL_SELLERS) {
    sellerMap.set(s.id, s);
  }
  globalThis.__serverSellersRegistry = sellerMap;
}

if (!globalThis.__serverProductsRegistry) {
  const productMap = new Map<string, Product>();
  for (const p of INITIAL_PRODUCTS) {
    productMap.set(p.id, p);
  }
  globalThis.__serverProductsRegistry = productMap;
}

if (!globalThis.__serverDeletedProductsRegistry) {
  globalThis.__serverDeletedProductsRegistry = new Set<string>();
}

export const serverDeletedStoresRegistry = globalThis.__serverDeletedStoresRegistry;
export const serverStoresRegistry = globalThis.__serverStoresRegistry;
export const serverSellersRegistry = globalThis.__serverSellersRegistry;
export const serverProductsRegistry = globalThis.__serverProductsRegistry;
export const serverDeletedProductsRegistry = globalThis.__serverDeletedProductsRegistry;

export function getAllServerStores(): LocalStore[] {
  return Array.from(serverStoresRegistry.values()).filter(
    (s) => !serverDeletedStoresRegistry.has(s.id)
  );
}

export function getAllServerSellers(): SellerProfile[] {
  return Array.from(serverSellersRegistry.values());
}

export function getAllServerProducts(): Product[] {
  return Array.from(serverProductsRegistry.values()).filter(
    (p) =>
      !serverDeletedProductsRegistry.has(p.id) &&
      !serverDeletedStoresRegistry.has(p.storeId)
  );
}

export async function upsertServerStore(
  store: LocalStore,
  seller?: SellerProfile
): Promise<LocalStore> {
  serverDeletedStoresRegistry.delete(store.id);
  serverStoresRegistry.set(store.id, store);
  if (seller?.id) {
    serverSellersRegistry.set(seller.id, seller);
  }
  if (!IS_PREVIEW_DUMMY_FIREBASE) {
    try {
      await setDoc(doc(db, 'stores', store.id), removeUndefined(store), { merge: true });
      if (seller?.id) {
        await setDoc(doc(db, 'sellers', seller.id), removeUndefined(seller), { merge: true });
      }
    } catch {
      // Ignore Firestore write fallback in preview
    }
  }
  return store;
}

export async function upsertServerProduct(
  product: Product,
  options?: { skipFirestore?: boolean }
): Promise<Product> {
  serverDeletedProductsRegistry.delete(product.id);
  serverProductsRegistry.set(product.id, product);

  // Recalculate activeSkus for the parent store if present
  const parentStore = serverStoresRegistry.get(product.storeId);
  if (parentStore) {
    const storeProductsCount = Array.from(serverProductsRegistry.values()).filter(
      (p) =>
        p.storeId === parentStore.id &&
        !serverDeletedProductsRegistry.has(p.id) &&
        p.isAvailable !== false &&
        p.stock > 0
    ).length;
    serverStoresRegistry.set(parentStore.id, {
      ...parentStore,
      activeSkus: storeProductsCount,
    });
  }

  if (!IS_PREVIEW_DUMMY_FIREBASE && !options?.skipFirestore) {
    try {
      await setDoc(doc(db, 'products', product.id), removeUndefined(product), { merge: true });
    } catch {
      // Ignore Firestore write fallback in preview
    }
  }
  return product;
}

export async function deleteServerProduct(productId: string): Promise<void> {
  const existing = serverProductsRegistry.get(productId);
  serverProductsRegistry.delete(productId);
  serverDeletedProductsRegistry.add(productId);

  if (existing?.storeId) {
    const parentStore = serverStoresRegistry.get(existing.storeId);
    if (parentStore) {
      const storeProductsCount = Array.from(serverProductsRegistry.values()).filter(
        (p) =>
          p.storeId === parentStore.id &&
          !serverDeletedProductsRegistry.has(p.id) &&
          p.isAvailable !== false &&
          p.stock > 0
      ).length;
      serverStoresRegistry.set(parentStore.id, {
        ...parentStore,
        activeSkus: storeProductsCount,
      });
    }
  }

  if (!IS_PREVIEW_DUMMY_FIREBASE) {
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch {
      // Ignore error
    }
  }
}

export async function isStoreDeletedServer(storeId: string): Promise<boolean> {
  if (!storeId) return false;
  if (serverDeletedStoresRegistry.has(storeId)) return true;
  if (IS_PREVIEW_DUMMY_FIREBASE) return false;

  try {
    const snap = await getDoc(doc(db, 'deleted_stores', storeId));
    if (snap.exists()) {
      serverDeletedStoresRegistry.set(storeId, snap.data() as DeletedStoreRecord);
      return true;
    }
  } catch {
    // Ignore fallback
  }

  return false;
}

export async function recordStoreDeletedServer(
  storeIdOrRecord: string | DeletedStoreRecord,
  maybeRecord?: Partial<DeletedStoreRecord>
) {
  const record: DeletedStoreRecord =
    typeof storeIdOrRecord === 'string'
      ? {
          storeId: storeIdOrRecord,
          storeName: maybeRecord?.storeName || 'Store',
          deletedAt: maybeRecord?.deletedAt || new Date().toISOString(),
          deletedByUid: maybeRecord?.deletedByUid,
          deletedByPhone: maybeRecord?.deletedByPhone,
          reason: maybeRecord?.reason,
        }
      : storeIdOrRecord;

  serverDeletedStoresRegistry.set(record.storeId, record);
  serverStoresRegistry.delete(record.storeId);
  for (const [prodId, prod] of serverProductsRegistry.entries()) {
    if (prod.storeId === record.storeId) {
      serverProductsRegistry.delete(prodId);
      serverDeletedProductsRegistry.add(prodId);
    }
  }
  if (IS_PREVIEW_DUMMY_FIREBASE) return;
  try {
    await setDoc(doc(db, 'deleted_stores', record.storeId), record);
  } catch {
    // Ignore error
  }
}

