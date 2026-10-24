import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { INITIAL_PRODUCTS, INITIAL_STORES, LocalStore } from '@/lib/catalog-data';
import { isStoreDeletedServer, recordStoreDeletedServer, serverDeletedStoresRegistry } from '@/lib/stores-registry';

interface DeleteStoreRequestBody {
  requesterUid?: string;
  requesterPhone?: string;
  sellerId?: string;
  storeNameConfirmation: string;
  reason?: string;
  isAdmin?: boolean;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params;
    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Store ID is required' }, { status: 400 });
    }

    const isDeleted = await isStoreDeletedServer(storeId);
    if (isDeleted) {
      return NextResponse.json(
        { ok: false, deleted: true, error: 'Store has been permanently deleted' },
        { status: 404 }
      );
    }

    // Try Firestore
    const snap = await getDoc(doc(db, 'stores', storeId));
    if (snap.exists()) {
      return NextResponse.json({ ok: true, store: snap.data() });
    }

    // Fallback to static initial stores
    const initialStore = INITIAL_STORES.find((s) => s.id === storeId);
    if (initialStore) {
      return NextResponse.json({ ok: true, store: initialStore });
    }

    return NextResponse.json({ ok: false, error: 'Store not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params;
    if (!storeId || typeof storeId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Valid store ID is required for deletion.' },
        { status: 400 }
      );
    }

    let body: DeleteStoreRequestBody;
    try {
      body = (await req.json()) as DeleteStoreRequestBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid request payload.' },
        { status: 400 }
      );
    }

    const {
      requesterUid,
      requesterPhone,
      sellerId,
      storeNameConfirmation,
      reason,
      isAdmin,
    } = body;

    // 1. Fetch store from Firestore or fallback to static catalog
    let storeRecord: LocalStore | null = null;
    let existsInFirestore = false;

    try {
      const storeSnap = await getDoc(doc(db, 'stores', storeId));
      if (storeSnap.exists()) {
        storeRecord = storeSnap.data() as LocalStore;
        existsInFirestore = true;
      }
    } catch (e) {
      console.warn(`[api/stores/delete] Could not read store ${storeId} from Firestore:`, e);
    }

    if (!storeRecord) {
      const staticMatch = INITIAL_STORES.find((s) => s.id === storeId);
      if (staticMatch) {
        storeRecord = staticMatch;
      }
    }

    if (!storeRecord) {
      return NextResponse.json(
        { ok: false, error: 'Store does not exist or has already been deleted.' },
        { status: 404 }
      );
    }

    // 2. Authorization Verification
    // A store can only be permanently deleted by:
    // a) An authenticated seller whose uid matches store.ownerUid
    // b) A seller whose sellerId matches store.sellerId
    // c) A super admin
    const isOwnerByUid = Boolean(requesterUid && storeRecord.ownerUid && requesterUid === storeRecord.ownerUid);
    const isOwnerBySellerId = Boolean(sellerId && storeRecord.sellerId && sellerId === storeRecord.sellerId);
    const isAuthorized = isOwnerByUid || isOwnerBySellerId || isAdmin;

    if (!isAuthorized) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Unauthorized: You do not have permission to delete this store. Only the verified store owner can perform this action.',
        },
        { status: 403 }
      );
    }

    // 3. Confirmation Name Verification
    // Prevent accidental deletion by requiring typing the exact store name
    const expectedName = storeRecord.name.trim().toLowerCase();
    const providedName = (storeNameConfirmation || '').trim().toLowerCase();

    if (expectedName !== providedName) {
      return NextResponse.json(
        {
          ok: false,
          error: `Confirmation mismatch. You must enter the exact store name "${storeRecord.name}" to confirm permanent deletion.`,
        },
        { status: 400 }
      );
    }

    // 4. Query and delete all dependent products for this store globally in Firestore
    let productsDeletedCount = 0;
    try {
      const productsQ = query(
        collection(db, 'products'),
        where('storeId', '==', storeId)
      );
      const productsSnap = await getDocs(productsQ);

      // Perform Firestore batch deletions in chunks of 400 (well within Firestore 500 limit)
      const docsToDelete = productsSnap.docs;
      const CHUNK_SIZE = 400;

      for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
        const chunk = docsToDelete.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const docItem of chunk) {
          batch.delete(docItem.ref);
          productsDeletedCount++;
        }
        await batch.commit();
      }
    } catch (err) {
      console.warn(`[api/stores/delete] Error during products Firestore query/batch delete:`, err);
    }

    // 5. Delete the store document itself from Firestore if it exists
    if (existsInFirestore) {
      try {
        const storeBatch = writeBatch(db);
        storeBatch.delete(doc(db, 'stores', storeId));
        await storeBatch.commit();
      } catch (err) {
        console.warn(`[api/stores/delete] Error deleting store document ${storeId}:`, err);
      }
    }

    // 6. Record tombstone in server memory registry and Firestore
    await recordStoreDeletedServer(storeId, {
      storeName: storeRecord.name,
      deletedByUid: requesterUid,
      deletedByPhone: requesterPhone,
      reason: reason || 'Verified seller permanent deletion from seller dashboard',
    });

    return NextResponse.json({
      ok: true,
      storeId,
      storeName: storeRecord.name,
      productsDeletedCount,
      message: `Store "${storeRecord.name}" and all ${productsDeletedCount} listed products have been permanently deleted from Citykart globally.`,
    });
  } catch (error) {
    console.error('[api/stores/delete] Internal failure:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to permanently delete store.',
      },
      { status: 500 }
    );
  }
}
