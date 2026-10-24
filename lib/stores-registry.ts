import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface DeletedStoreRecord {
  storeId: string;
  storeName: string;
  deletedAt: string;
  deletedByUid?: string;
  deletedByPhone?: string;
  reason?: string;
}

// Global singleton map to persist deleted store tombstones across Next.js API route invocations in Node memory
declare global {
  var __serverDeletedStoresRegistry: Map<string, DeletedStoreRecord> | undefined;
}

if (!globalThis.__serverDeletedStoresRegistry) {
  globalThis.__serverDeletedStoresRegistry = new Map<string, DeletedStoreRecord>();
}

export const serverDeletedStoresRegistry = globalThis.__serverDeletedStoresRegistry;

/**
 * Check if a store has been permanently deleted (in-memory fast path, fallback to Firestore)
 */
export async function isStoreDeletedServer(storeId: string): Promise<boolean> {
  if (!storeId) return false;
  if (serverDeletedStoresRegistry.has(storeId)) return true;

  try {
    const snap = await getDoc(doc(db, 'deleted_stores', storeId));
    if (snap.exists()) {
      serverDeletedStoresRegistry.set(storeId, snap.data() as DeletedStoreRecord);
      return true;
    }
  } catch {
    // Ignore network error in fallback
  }

  return false;
}

/**
 * Record a permanent store deletion in both server memory and Firestore tombstones
 */
export async function recordStoreDeletedServer(
  storeId: string,
  record: Omit<DeletedStoreRecord, 'storeId' | 'deletedAt'> & { deletedAt?: string }
): Promise<void> {
  const fullRecord: DeletedStoreRecord = {
    storeId,
    storeName: record.storeName,
    deletedAt: record.deletedAt || new Date().toISOString(),
    deletedByUid: record.deletedByUid,
    deletedByPhone: record.deletedByPhone,
    reason: record.reason || 'Seller initiated permanent store and catalog deletion',
  };

  serverDeletedStoresRegistry.set(storeId, fullRecord);

  try {
    await setDoc(doc(db, 'deleted_stores', storeId), fullRecord, { merge: true });
  } catch (err) {
    console.warn(`[stores-registry] Could not persist tombstone to Firestore for store ${storeId}:`, err);
  }
}
