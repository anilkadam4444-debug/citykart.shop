import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AUTHORITATIVE_STORE_CATEGORIES,
  INITIAL_STORES,
  LocalStore,
  Product,
} from '@/lib/catalog-data';
import { checkProductQuota } from '@/lib/entitlements';
import { isStoreDeletedServer } from '@/lib/stores-registry';
import {
  normalizePhoneE164,
  serverStoreOverridesRegistry,
  verifyAdminRequest,
  verifyAuthenticatedCaller,
} from '@/lib/super-admin-auth';

function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sellerId,
      storeId,
      ownerUid,
      mode = 'ADD_NEW',
      items = [],
    } = body as {
      sellerId: string;
      storeId: string;
      ownerUid?: string;
      mode: 'ADD_NEW' | 'UPDATE_EXISTING';
      items: Array<Partial<Product>>;
    };

    if (!sellerId || !storeId) {
      return NextResponse.json(
        { ok: false, error: 'Missing required sellerId or storeId parameter.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No product records provided for bulk upload.' },
        { status: 400 }
      );
    }

    if (items.length > 500) {
      return NextResponse.json(
        { ok: false, error: 'Bulk upload batch size exceeds max limit of 500 products per request.' },
        { status: 400 }
      );
    }

    // 0. Cryptographic Caller & Admin Verification
    const [caller, adminCheck] = await Promise.all([
      verifyAuthenticatedCaller(req),
      verifyAdminRequest(req),
    ]);

    if (!caller.authenticated && !adminCheck.authorized) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Authentication required: Please sign in to your verified seller account to bulk-upload products.',
        },
        { status: 401 }
      );
    }

    if (await isStoreDeletedServer(storeId)) {
      return NextResponse.json(
        { ok: false, error: 'This store has been permanently deleted.' },
        { status: 404 }
      );
    }

    // 1. Fetch store from Firestore or catalog to verify store existence & ownership
    let activeStore: LocalStore | null = null;
    try {
      const storeDocSnap = await getDoc(doc(db, 'stores', storeId));
      if (storeDocSnap.exists()) {
        activeStore = storeDocSnap.data() as LocalStore;
      }
    } catch {
      // Fallback to static store catalog if offline
    }
    if (!activeStore) {
      activeStore = INITIAL_STORES.find((s) => s.id === storeId) || null;
    }

    if (!activeStore) {
      return NextResponse.json(
        { ok: false, error: `Store ID "${storeId}" could not be found or verified.` },
        { status: 404 }
      );
    }

    // Check store suspension
    const storeOverride = serverStoreOverridesRegistry.get(storeId);
    if (storeOverride?.isSuspended || activeStore.isSuspended) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Store is currently suspended and cannot upload or modify products.',
        },
        { status: 403 }
      );
    }

    // Verify seller ownership of the target store
    const isStoreOwner =
      adminCheck.authorized ||
      (activeStore.sellerId === sellerId &&
        (caller.sellerId === sellerId ||
          (caller.uid && activeStore.ownerUid === caller.uid) ||
          (caller.phoneE164 &&
            activeStore.phone &&
            caller.phoneE164 === normalizePhoneE164(activeStore.phone))));

    if (!isStoreOwner) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Forbidden: You can only bulk-upload products to a store owned by your verified seller account.',
        },
        { status: 403 }
      );
    }

    // 2. Fetch existing products in store to evaluate quota and duplicates
    const productsQ = query(
      collection(db, 'products'),
      where('storeId', '==', storeId)
    );
    const existingProductsSnap = await getDocs(productsQ);
    const existingProductsList: Product[] = [];
    const existingSkuMap = new Map<string, Product>();
    const existingNameMap = new Map<string, Product>();

    existingProductsSnap.forEach((d) => {
      const p = d.data() as Product;
      existingProductsList.push(p);
      if (p.sku) existingSkuMap.set(p.sku.toLowerCase(), p);
      if (p.id) existingSkuMap.set(p.id.toLowerCase(), p);
      if (p.name) existingNameMap.set(p.name.toLowerCase(), p);
    });

    // 3. Evaluate Subscription Quota
    if (mode === 'ADD_NEW') {
      const quotaStatus = checkProductQuota(storeId, existingProductsList.length);
      if (!quotaStatus.canAdd && !quotaStatus.isUnlimited) {
        return NextResponse.json(
          {
            ok: false,
            error: `Subscription Quota Exceeded: Your current plan "${quotaStatus.planName}" allows a maximum of ${quotaStatus.maxAllowed} products (Currently listed: ${quotaStatus.currentCount}). Please upgrade your plan to list more products.`,
            quotaStatus,
          },
          { status: 403 }
        );
      }
    }

    // 4. Process each row safely
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const productsToCommit: Product[] = [];

    const nowIso = new Date().toISOString();

    for (let index = 0; index < items.length; index++) {
      const rawItem = items[index];
      const rowNum = index + 1;

      const productName = (rawItem.name || '').trim();
      const rawPrice = Number(rawItem.price);
      if (!productName) {
        errors.push(`Row ${rowNum}: Product name is missing.`);
        failedCount++;
        continue;
      }

      if (isNaN(rawPrice) || rawPrice < 0) {
        errors.push(`Row ${rowNum} (${productName}): Price must be a valid non-negative number.`);
        failedCount++;
        continue;
      }

      const rawStock = Math.max(0, Math.floor(Number(rawItem.stock) || 0));
      const sku = (rawItem.sku || `SKU-${Date.now().toString(36).slice(-4)}-${index}`).trim();

      const rawDeliveryCharge = rawItem.deliveryCharge !== undefined && !isNaN(Number(rawItem.deliveryCharge)) && Number(rawItem.deliveryCharge) >= 0 ? Number(rawItem.deliveryCharge) : undefined;

      // Check category match
      const matchedCat =
        AUTHORITATIVE_STORE_CATEGORIES.find(
          (c) =>
            c.id === rawItem.categoryId ||
            c.name.toLowerCase() === (rawItem.category || '').toLowerCase()
        ) || AUTHORITATIVE_STORE_CATEGORIES[0];

      // Check existing product match for Mode A or Mode B
      const matchedBySku = existingSkuMap.get(sku.toLowerCase());
      const matchedByName = existingNameMap.get(productName.toLowerCase());
      const matchedExisting = matchedBySku || matchedByName;

      if (mode === 'ADD_NEW') {
        if (matchedExisting) {
          // In Add New mode, skip existing duplicate
          skippedCount++;
          continue;
        }

        const newProductId = `prod-${storeId.replace(/[^a-zA-Z0-9\-]/g, '')}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

        const newProd: Product = {
          id: newProductId,
          sellerId,
          ownerUid: ownerUid || activeStore.ownerUid || sellerId,
          storeId,
          storeName: activeStore.name,
          sku,
          name: productName,
          categoryId: matchedCat.id,
          category: matchedCat.name,
          price: rawPrice,
          deliveryCharge: rawDeliveryCharge ?? 0,
          currency: 'INR',
          unit: (rawItem.unit || 'Pcs').trim(),
          city: activeStore.cityName || activeStore.city,
          neighborhood: activeStore.neighborhood || activeStore.address || 'Local Market',
          distanceKm: 1.2,
          deliveryMins: activeStore.avgDispatchMins || 30,
          stock: rawStock,
          isAvailable: rawStock > 0,
          rating: 4.8,
          reviewsCount: 0,
          description: (rawItem.description || `${productName} from ${activeStore.name}`).trim(),
          dimensions: (rawItem.dimensions || 'Standard').trim(),
          materials: (rawItem.materials || 'Fresh Quality').trim(),
          variants: Array.isArray(rawItem.variants) && rawItem.variants.length > 0
            ? rawItem.variants
            : ['Standard'],
          statusNote: rawStock > 0 ? 'In stock' : 'Out of stock',
          artworkPreset: matchedCat.defaultArtworkPreset,
          customImageUrl: rawItem.customImageUrl || undefined,
          createdAt: nowIso,
        };

        productsToCommit.push(newProd);
        createdCount++;
      } else if (mode === 'UPDATE_EXISTING') {
        if (!matchedExisting) {
          skippedCount++;
          continue;
        }

        const updatedProd: Product = {
          ...matchedExisting,
          name: productName,
          price: rawPrice,
          deliveryCharge: rawDeliveryCharge !== undefined ? rawDeliveryCharge : (matchedExisting.deliveryCharge ?? 0),
          stock: rawStock,
          isAvailable: rawStock > 0,
          statusNote: rawStock > 0 ? 'In stock' : 'Out of stock',
          categoryId: matchedCat.id,
          category: matchedCat.name,
          unit: (rawItem.unit || matchedExisting.unit || 'Pcs').trim(),
          description: (rawItem.description || matchedExisting.description).trim(),
          dimensions: (rawItem.dimensions || matchedExisting.dimensions).trim(),
          materials: (rawItem.materials || matchedExisting.materials).trim(),
          variants: Array.isArray(rawItem.variants) && rawItem.variants.length > 0
            ? rawItem.variants
            : matchedExisting.variants,
          customImageUrl: rawItem.customImageUrl || matchedExisting.customImageUrl,
        };

        productsToCommit.push(updatedProd);
        updatedCount++;
      }
    }

    // 5. Commit Firestore Write Batch in Chunk Sizes <= 400
    const CHUNK_SIZE = 400;
    for (let i = 0; i < productsToCommit.length; i += CHUNK_SIZE) {
      const chunk = productsToCommit.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const p of chunk) {
        const docRef = doc(db, 'products', p.id);
        const cleanedPayload = removeUndefined(p as unknown as Record<string, unknown>);
        batch.set(docRef, cleanedPayload, { merge: true });
      }
      await batch.commit();
    }

    return NextResponse.json({
      ok: true,
      mode,
      createdCount,
      updatedCount,
      skippedCount,
      failedCount,
      totalProcessed: items.length,
      errors,
      committedProducts: productsToCommit,
    });
  } catch (error) {
    console.error('Error executing bulk product upload API:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Server error processing bulk upload.',
      },
      { status: 500 }
    );
  }
}
