import { NextRequest, NextResponse } from 'next/server';
import { db, IS_PREVIEW_DUMMY_FIREBASE, removeUndefined } from '@/lib/firebase';
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
  INITIAL_PRODUCTS,
  INITIAL_STORES,
  LocalStore,
  Product,
} from '@/lib/catalog-data';
import {
  isStoreDeletedServer,
  serverDeletedProductsRegistry,
  serverProductsRegistry,
  serverStoresRegistry,
  upsertServerProduct,
  upsertServerStore,
} from '@/lib/stores-registry';
import { checkProductQuota } from '@/lib/entitlements';
import { SubscriptionTierId } from '@/lib/revenue-model';
import {
  normalizePhoneE164,
  serverStoreOverridesRegistry,
  verifyAdminRequest,
  verifyAuthenticatedCaller,
} from '@/lib/super-admin-auth';
import {
  normalizeImageUrlInput,
  parseCSVText,
  resolveCategoryFromInput,
} from '@/lib/csv-parser';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sellerId,
      storeId,
      ownerUid,
      mode = 'ADD_NEW',
      planId,
      store: clientStorePayload,
      csvText,
      items: rawItems = [],
    } = body as {
      sellerId: string;
      storeId: string;
      ownerUid?: string;
      mode?: 'ADD_NEW' | 'UPDATE_EXISTING';
      planId?: SubscriptionTierId;
      store?: Partial<LocalStore>;
      csvText?: string;
      items?: Array<Partial<Product>>;
    };

    if (!sellerId || !storeId) {
      return NextResponse.json(
        { ok: false, error: 'Missing required sellerId or storeId parameter.' },
        { status: 400 }
      );
    }

    // Support direct raw CSV text payload if items array was not pre-parsed
    let items: Array<Partial<Product>> = Array.isArray(rawItems) ? [...rawItems] : [];
    if (items.length === 0 && typeof csvText === 'string' && csvText.trim().length > 0) {
      const matrix = parseCSVText(csvText);
      if (matrix.length >= 2) {
        const headers = matrix[0].map((h) => h.trim().toLowerCase());
        const findIdx = (names: string[]) => {
          for (const n of names) {
            const exact = headers.findIndex((h) => h === n || h.startsWith(`${n} (`));
            if (exact !== -1) return exact;
          }
          for (const n of names) {
            const sub = headers.findIndex((h) => h.includes(n));
            if (sub !== -1) return sub;
          }
          return -1;
        };
        const idxName = findIdx(['product name', 'item name', 'title', 'name']);
        const idxCat = findIdx(['category', 'product category', 'type']);
        const idxPrice = findIdx(['price (inr)', 'price', 'selling price', 'mrp', 'cost']);
        const idxDelivery = findIdx(['delivery charge (inr)', 'delivery charge', 'delivery fee', 'shipping']);
        const idxSku = findIdx(['sku', 'product code', 'item code', 'product id']);
        const idxStock = findIdx(['stock quantity', 'stock', 'qty', 'quantity']);
        const idxUnit = findIdx(['unit', 'pack size', 'weight']);
        const idxDesc = findIdx(['description', 'product description', 'details']);
        const idxDim = findIdx(['dimensions', 'dimension']);
        const idxMat = findIdx(['materials', 'material', 'ingredients']);
        const idxVar = findIdx(['product variants', 'variants', 'options']);
        const idxImg = findIdx(['product image url', 'image url', 'image', 'photo']);

        if (idxName !== -1 && idxPrice !== -1) {
          for (const row of matrix.slice(1)) {
            const name = (row[idxName] || '').trim();
            const priceStr = (row[idxPrice] || '').trim();
            if (!name && !priceStr) continue;
            const resolvedCat =
              resolveCategoryFromInput(idxCat !== -1 ? row[idxCat] : '') ||
              AUTHORITATIVE_STORE_CATEGORIES[0];
            items.push({
              name,
              categoryId: resolvedCat.id,
              category: resolvedCat.name,
              price: Number(priceStr.replace(/[^0-9.]/g, '')),
              deliveryCharge:
                idxDelivery !== -1 && row[idxDelivery]
                  ? Number(row[idxDelivery].replace(/[^0-9.]/g, '')) || 0
                  : 0,
              sku: idxSku !== -1 ? (row[idxSku] || '').trim() : undefined,
              stock:
                idxStock !== -1 && row[idxStock]
                  ? Math.max(0, Math.floor(Number(row[idxStock].replace(/[^0-9]/g, '')) || 0))
                  : 10,
              unit: idxUnit !== -1 && row[idxUnit] ? row[idxUnit].trim() : 'Pcs',
              description: idxDesc !== -1 ? (row[idxDesc] || '').trim() : undefined,
              dimensions: idxDim !== -1 ? (row[idxDim] || '').trim() : undefined,
              materials: idxMat !== -1 ? (row[idxMat] || '').trim() : undefined,
              variants:
                idxVar !== -1 && row[idxVar]
                  ? row[idxVar]
                      .split(/[;,]/)
                      .map((v) => v.trim())
                      .filter(Boolean)
                  : ['Standard'],
              customImageUrl:
                idxImg !== -1 ? normalizeImageUrlInput(row[idxImg]) || undefined : undefined,
            });
          }
        }
      }
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

    if (await isStoreDeletedServer(storeId)) {
      return NextResponse.json(
        { ok: false, error: 'This store has been permanently deleted.' },
        { status: 404 }
      );
    }

    // 1. Fetch store from memory, client payload, or Firestore to verify store existence
    let activeStore: LocalStore | null =
      serverStoresRegistry.get(storeId) ||
      INITIAL_STORES.find((s) => s.id === storeId) ||
      null;

    if (!activeStore && !IS_PREVIEW_DUMMY_FIREBASE) {
      try {
        const storeDocSnap = await getDoc(doc(db, 'stores', storeId));
        if (storeDocSnap.exists()) {
          activeStore = storeDocSnap.data() as LocalStore;
        }
      } catch {
        // Fallback to client store payload if offline
      }
    }

    if (!activeStore && clientStorePayload && clientStorePayload.id === storeId && clientStorePayload.name) {
      activeStore = {
        ...clientStorePayload,
        id: storeId,
        sellerId: clientStorePayload.sellerId || sellerId,
      } as LocalStore;
      await upsertServerStore(activeStore);
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
    const isInitialDemoStore = INITIAL_STORES.some((s) => s.id === storeId);
    const isStoreOwner =
      adminCheck.authorized ||
      isInitialDemoStore ||
      activeStore.sellerId === sellerId ||
      caller.sellerId === sellerId ||
      Boolean(caller.storeIds && caller.storeIds.includes(storeId)) ||
      Boolean(caller.uid && (activeStore.ownerUid === caller.uid || ownerUid === caller.uid)) ||
      Boolean(
        caller.phoneE164 &&
          activeStore.phone &&
          normalizePhoneE164(caller.phoneE164) === normalizePhoneE164(activeStore.phone)
      );

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
    const existingProductsList: Product[] = [];
    const existingSkuMap = new Map<string, Product>();
    const existingNameMap = new Map<string, Product>();

    const registryStoreProds = Array.from(serverProductsRegistry.values()).filter(
      (p) => p.storeId === storeId && !serverDeletedProductsRegistry.has(p.id)
    );

    if (registryStoreProds.length > 0) {
      for (const p of registryStoreProds) {
        existingProductsList.push(p);
        if (p.sku) existingSkuMap.set(p.sku.toLowerCase().trim(), p);
        if (p.id) existingSkuMap.set(p.id.toLowerCase().trim(), p);
        if (p.name) existingNameMap.set(p.name.toLowerCase().trim(), p);
      }
    } else if (!IS_PREVIEW_DUMMY_FIREBASE) {
      try {
        const productsQ = query(
          collection(db, 'products'),
          where('storeId', '==', storeId)
        );
        const existingProductsSnap = await getDocs(productsQ);
        existingProductsSnap.forEach((d) => {
          const p = d.data() as Product;
          if (!serverDeletedProductsRegistry.has(p.id)) {
            existingProductsList.push(p);
            if (p.sku) existingSkuMap.set(p.sku.toLowerCase().trim(), p);
            if (p.id) existingSkuMap.set(p.id.toLowerCase().trim(), p);
            if (p.name) existingNameMap.set(p.name.toLowerCase().trim(), p);
          }
        });
      } catch {
        // Fallback to in-memory initial products
      }
    }

    if (existingProductsList.length === 0) {
      const sourceProds = INITIAL_PRODUCTS.filter(
        (p) => p.storeId === storeId && !serverDeletedProductsRegistry.has(p.id)
      );
      for (const p of sourceProds) {
        existingProductsList.push(p);
        if (p.sku) existingSkuMap.set(p.sku.toLowerCase().trim(), p);
        if (p.id) existingSkuMap.set(p.id.toLowerCase().trim(), p);
        if (p.name) existingNameMap.set(p.name.toLowerCase().trim(), p);
      }
    }

    // 3. Evaluate Subscription Quota for net-new products
    const quotaStatus = checkProductQuota(storeId, existingProductsList.length, planId);
    let remainingQuota = quotaStatus.isUnlimited ? Infinity : quotaStatus.remaining;

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
      const rawPrice =
        typeof rawItem.price === 'string'
          ? Number(String(rawItem.price).replace(/[^0-9.]/g, ''))
          : Number(rawItem.price);

      if (!productName) {
        errors.push(`Row ${rowNum}: Product name is missing.`);
        failedCount++;
        continue;
      }

      if (isNaN(rawPrice) || rawPrice <= 0) {
        errors.push(`Row ${rowNum} (${productName}): Price must be a valid positive number.`);
        failedCount++;
        continue;
      }

      const rawStock =
        rawItem.stock !== undefined && rawItem.stock !== null && String(rawItem.stock).trim() !== ''
          ? Math.max(0, Math.floor(Number(String(rawItem.stock).replace(/[^0-9.]/g, '')) || 0))
          : 10;

      const sku = (
        rawItem.sku ||
        `SKU-${productName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || Date.now().toString(36).slice(-4)}-${index + 1}`
      ).trim();

      const rawDeliveryCharge =
        rawItem.deliveryCharge !== undefined &&
        !isNaN(Number(rawItem.deliveryCharge)) &&
        Number(rawItem.deliveryCharge) >= 0
          ? Number(rawItem.deliveryCharge)
          : undefined;

      // Resolve category match using authoritative resolver
      const matchedCat =
        AUTHORITATIVE_STORE_CATEGORIES.find(
          (c) =>
            c.id === rawItem.categoryId ||
            c.name.toLowerCase() === (rawItem.category || '').toLowerCase()
        ) ||
        resolveCategoryFromInput(rawItem.category || rawItem.categoryId) ||
        AUTHORITATIVE_STORE_CATEGORIES[0];

      const normalizedCustomImg = normalizeImageUrlInput(rawItem.customImageUrl) || undefined;

      // Check existing product match by SKU or Name
      const matchedBySku = existingSkuMap.get(sku.toLowerCase());
      const matchedByName = existingNameMap.get(productName.toLowerCase());
      const matchedExisting = matchedBySku || matchedByName;

      if (matchedExisting) {
        // Update existing product (works seamlessly in both ADD_NEW and UPDATE_EXISTING modes)
        const updatedProd: Product = {
          ...matchedExisting,
          name: productName,
          sku: rawItem.sku ? sku : matchedExisting.sku,
          price: rawPrice,
          deliveryCharge:
            rawDeliveryCharge !== undefined
              ? rawDeliveryCharge
              : (matchedExisting.deliveryCharge ?? 0),
          stock: rawStock,
          isAvailable: rawStock > 0,
          statusNote: rawStock > 0 ? 'In stock' : 'Out of stock',
          categoryId: matchedCat.id,
          category: matchedCat.name,
          unit: (rawItem.unit || matchedExisting.unit || 'Pcs').trim(),
          description: (rawItem.description || matchedExisting.description || `${productName} from ${activeStore.name}`).trim(),
          dimensions: (rawItem.dimensions || matchedExisting.dimensions || 'Standard').trim(),
          materials: (rawItem.materials || matchedExisting.materials || 'Fresh Quality').trim(),
          variants:
            Array.isArray(rawItem.variants) && rawItem.variants.length > 0
              ? rawItem.variants
              : matchedExisting.variants || ['Standard'],
          artworkPreset: matchedExisting.artworkPreset || matchedCat.defaultArtworkPreset,
          customImageUrl: normalizedCustomImg || matchedExisting.customImageUrl,
        };

        productsToCommit.push(updatedProd);
        existingSkuMap.set(updatedProd.sku.toLowerCase(), updatedProd);
        existingNameMap.set(updatedProd.name.toLowerCase(), updatedProd);
        updatedCount++;
      } else {
        // Creating a net-new product — check remaining subscription quota
        if (remainingQuota <= 0) {
          errors.push(
            `Row ${rowNum} (${productName}): Skipped because store subscription limit (${quotaStatus.maxAllowed} products on ${quotaStatus.planName}) was reached.`
          );
          skippedCount++;
          continue;
        }

        const newProductId = `prod-${storeId.replace(/[^a-zA-Z0-9\-]/g, '')}-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 6)}`;

        const newProd: Product = {
          id: newProductId,
          sellerId: activeStore.sellerId || sellerId,
          ownerUid: ownerUid || activeStore.ownerUid || caller.uid || sellerId,
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
          variants:
            Array.isArray(rawItem.variants) && rawItem.variants.length > 0
              ? rawItem.variants
              : ['Standard'],
          statusNote: rawStock > 0 ? 'In stock' : 'Out of stock',
          artworkPreset: matchedCat.defaultArtworkPreset,
          customImageUrl: normalizedCustomImg,
          createdAt: nowIso,
        };

        productsToCommit.push(newProd);
        existingSkuMap.set(newProd.sku.toLowerCase(), newProd);
        existingNameMap.set(newProd.name.toLowerCase(), newProd);
        createdCount++;
        remainingQuota--;
      }
    }

    if (productsToCommit.length === 0 && failedCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: errors[0] || 'No valid products could be imported from the uploaded file.',
          errors,
          createdCount,
          updatedCount,
          skippedCount,
          failedCount,
        },
        { status: 400 }
      );
    }

    // Update in-memory server registry first without N sequential Firestore roundtrips
    for (const prod of productsToCommit) {
      await upsertServerProduct(prod, { skipFirestore: true });
    }
    globalThis.__discoveryCatalogCache = undefined;

    // 5. Commit Firestore Write Batch in Chunk Sizes <= 400
    if (!IS_PREVIEW_DUMMY_FIREBASE && productsToCommit.length > 0) {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < productsToCommit.length; i += CHUNK_SIZE) {
        const chunk = productsToCommit.slice(i, i + CHUNK_SIZE);
        try {
          const batch = writeBatch(db);
          for (const p of chunk) {
            const docRef = doc(db, 'products', p.id);
            const cleanedPayload = removeUndefined(p as unknown as Record<string, unknown>);
            batch.set(docRef, cleanedPayload, { merge: true });
          }
          await batch.commit();
        } catch (err) {
          console.warn('[bulk-upload] Firestore batch write fallback notice:', err);
        }
      }
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
