import {NextRequest, NextResponse} from 'next/server';
import {
  CustomerShoppingLocation,
  INITIAL_PRODUCTS,
  INITIAL_STORES,
  LocalStore,
  normalizeCityId,
  Product,
  ProductCategory,
  queryCityScopedCatalog,
} from '@/lib/catalog-data';
import {fetchStoresAndProductsFromFirestore} from '@/lib/firebase';
import {
  serverDeletedProductsRegistry,
  serverDeletedStoresRegistry,
  serverProductsRegistry,
  serverStoresRegistry,
} from '@/lib/stores-registry';
import {
  serverProductOverridesRegistry,
  serverStoreOverridesRegistry,
} from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';

declare global {
  var __discoveryCatalogCache:
    | {
        stores: LocalStore[];
        products: Product[];
        fetchedAtMs: number;
      }
    | undefined;
}

const DISCOVERY_CACHE_TTL_MS = 15_000;

async function getCachedLiveCatalog(): Promise<{
  stores: LocalStore[];
  products: Product[];
}> {
  const now = Date.now();
  if (
    globalThis.__discoveryCatalogCache &&
    now - globalThis.__discoveryCatalogCache.fetchedAtMs < DISCOVERY_CACHE_TTL_MS
  ) {
    return globalThis.__discoveryCatalogCache;
  }

  try {
    const liveCatalog = await Promise.race([
      fetchStoresAndProductsFromFirestore(),
      new Promise<{ stores: LocalStore[]; products: Product[] }>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore discovery timeout')), 2500)
      ),
    ]);
    globalThis.__discoveryCatalogCache = {
      stores: liveCatalog.stores,
      products: liveCatalog.products,
      fetchedAtMs: now,
    };
    return liveCatalog;
  } catch {
    return (
      globalThis.__discoveryCatalogCache || {
        stores: [],
        products: [],
      }
    );
  }
}

export async function GET(req: NextRequest) {
  const {searchParams} = new URL(req.url);
  const city = (searchParams.get('city') || '').trim();
  const stateRegion = (searchParams.get('stateRegion') || '').trim();
  const country = (searchParams.get('country') || '').trim();
  const cityId = (searchParams.get('cityId') || '').trim();
  const locality = (searchParams.get('locality') || '').trim();
  const category = (searchParams.get('category') ||
    'All Categories') as ProductCategory;
  const searchQuery = (searchParams.get('q') || '').trim();
  const onlyDeliverableToLocality =
    searchParams.get('onlyDeliverable') === 'true';

  const customerLocation: CustomerShoppingLocation = city
    ? {
        mode: 'SELECTED_LOCATION',
        country,
        stateRegion,
        city,
        cityId: cityId || normalizeCityId(country, stateRegion, city),
        locality,
      }
    : {
        mode: 'UNSET',
        country: '',
        stateRegion: '',
        city: '',
        locality: '',
      };

  // Merge initial catalog, server registries, and cached live Firestore stores & products while respecting deletions & admin moderation
  const storesMap = new Map<string, LocalStore>();
  for (const s of INITIAL_STORES) {
    if (!serverDeletedStoresRegistry.has(s.id)) {
      storesMap.set(s.id, s);
    }
  }
  for (const s of serverStoresRegistry.values()) {
    if (s?.id && !serverDeletedStoresRegistry.has(s.id)) {
      storesMap.set(s.id, s);
    }
  }
  const productsMap = new Map<string, Product>();
  for (const p of INITIAL_PRODUCTS) {
    if (
      !serverDeletedStoresRegistry.has(p.storeId) &&
      !serverDeletedProductsRegistry.has(p.id)
    ) {
      productsMap.set(p.id, p);
    }
  }
  for (const p of serverProductsRegistry.values()) {
    if (
      p?.id &&
      !serverDeletedStoresRegistry.has(p.storeId) &&
      !serverDeletedProductsRegistry.has(p.id)
    ) {
      productsMap.set(p.id, p);
    }
  }

  const liveCatalog = await getCachedLiveCatalog();
  for (const s of liveCatalog.stores) {
    if (s?.id && !serverDeletedStoresRegistry.has(s.id)) {
      storesMap.set(s.id, s);
    }
  }
  for (const p of liveCatalog.products) {
    if (
      p?.id &&
      !serverDeletedStoresRegistry.has(p.storeId) &&
      !serverDeletedProductsRegistry.has(p.id)
    ) {
      productsMap.set(p.id, p);
    }
  }

  for (const [storeId, override] of serverStoreOverridesRegistry.entries()) {
    const st = storesMap.get(storeId);
    if (st) {
      storesMap.set(storeId, {
        ...st,
        isSuspended: override.isSuspended,
        isActive: override.isActive,
      });
    }
  }
  for (const [prodId, override] of serverProductOverridesRegistry.entries()) {
    const pr = productsMap.get(prodId);
    if (pr) {
      productsMap.set(prodId, {
        ...pr,
        adminUnpublished: override.adminUnpublished,
        isAvailable: override.isAvailable,
      });
    }
  }

  const eligibleStores = Array.from(storesMap.values()).filter(
    (s) => !s.isSuspended && s.isActive !== false
  );
  const eligibleProducts = Array.from(productsMap.values()).filter(
    (p) => !p.adminUnpublished && p.isAvailable !== false
  );

  const result = queryCityScopedCatalog({
    stores: eligibleStores,
    products: eligibleProducts,
    customerLocation,
    selectedCategory: category,
    searchQuery,
    onlyDeliverableToLocality,
  });

  return NextResponse.json({
    customerLocation,
    requiresCitySelection: result.requiresCitySelection,
    stores: result.filteredStores,
    products: result.filteredProducts,
    totalEligibleStoresInCity: result.eligibleStoresInCity.length,
    categoryStoreCounts: result.categoryStoreCounts,
    categoryProductCounts: result.categoryProductCounts,
  });
}
