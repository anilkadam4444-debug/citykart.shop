import {
  writeBatch,
  doc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db, IS_PREVIEW_DUMMY_FIREBASE } from './firebase';
import {
  NANDED_DEMO_BATCH_ID,
  NANDED_DEMO_PRODUCTS,
  NANDED_DEMO_STORES,
} from './nanded-demo-data';

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
  if (!IS_PREVIEW_DUMMY_FIREBASE) {
    try {
      const storeBatch = writeBatch(db);
      for (const store of NANDED_DEMO_STORES) {
        storeBatch.set(doc(db, 'stores', store.id), store, { merge: true });
      }
      await storeBatch.commit();

      const productBatch = writeBatch(db);
      for (const product of NANDED_DEMO_PRODUCTS) {
        productBatch.set(doc(db, 'products', product.id), product, { merge: true });
      }
      await productBatch.commit();
    } catch {
      // Preview fallback
    }
  }

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
  if (IS_PREVIEW_DUMMY_FIREBASE) {
    return {
      storesRemoved: NANDED_DEMO_STORES.length,
      productsRemoved: NANDED_DEMO_PRODUCTS.length,
    };
  }

  try {
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

    return { storesRemoved, productsRemoved };
  } catch {
    return {
      storesRemoved: NANDED_DEMO_STORES.length,
      productsRemoved: NANDED_DEMO_PRODUCTS.length,
    };
  }
}

