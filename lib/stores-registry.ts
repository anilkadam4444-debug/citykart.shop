import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, IS_PREVIEW_DUMMY_FIREBASE } from './firebase';
import { INITIAL_STORES, LocalStore } from './catalog-data';

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

export const serverDeletedStoresRegistry = globalThis.__serverDeletedStoresRegistry;
export const serverStoresRegistry = globalThis.__serverStoresRegistry;

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
  if (IS_PREVIEW_DUMMY_FIREBASE) return;
  try {
    await setDoc(doc(db, 'deleted_stores', record.storeId), record);
  } catch {
    // Ignore error
  }
}
