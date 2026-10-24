import {OrderRecord, Product} from './catalog-data';

/**
 * Valid order statuses that count toward product popularity.
 * Excludes CANCELLED, FAILED, or incomplete checkout states.
 */
export const VALID_POPULARITY_ORDER_STATUSES = new Set([
  'NEW',
  'CONFIRMED',
  'PREPARING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]);

export interface ProductPopularityMetrics {
  productId: string;
  storeId: string;
  /** Number of distinct valid orders containing this product */
  orderCount: number;
  /** Total units ordered across all valid orders */
  quantitySold: number;
  /** Timestamp (ms) of the most recent valid order containing this product, or 0 */
  lastOrderedAtMs: number;
}

export interface CityPopularityRankResult {
  /** Ranked products (most ordered first, followed by deterministic fallback) */
  rankedProducts: Product[];
  /** Lookup map of popularity metrics keyed by product.id */
  popularityByProductId: Record<string, ProductPopularityMetrics>;
  /** True if at least one eligible product in the current view/city has validOrderCount > 0 */
  hasValidOrderHistory: boolean;
  /** Total number of distinct valid orders counted for eligible stores in this city */
  totalValidCityOrders: number;
}

/**
 * Parses an order or product timestamp into epoch milliseconds.
 * Safely returns 0 if the value is missing or only a time string like '14:10'.
 */
export function parseSafeTimestampMs(value?: string | number | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (!value || typeof value !== 'string') {
    return 0;
  }
  const trimmed = value.trim();
  // Ignore bare HH:mm strings that lack a date component
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    return 0;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Determines whether an OrderRecord is eligible to be counted in popularity calculations.
 *
 * Rules enforced:
 * 1. Must have a valid order ID and store ID.
 * 2. Excludes CANCELLED and FAILED orders.
 * 3. Excludes test or demo orders (`isTest` or `isDemo`).
 * 4. Must contain at least one item with positive quantity.
 */
export function isOrderValidForPopularity(order: OrderRecord): boolean {
  if (!order || typeof order.id !== 'string' || !order.id.trim()) {
    return false;
  }
  if (typeof order.storeId !== 'string' || !order.storeId.trim()) {
    return false;
  }
  if (order.isTest === true || order.isDemo === true) {
    return false;
  }
  const status = order.orderStatus || 'NEW';
  if (status === 'CANCELLED' || status === 'REJECTED') {
    return false;
  }
  if (!VALID_POPULARITY_ORDER_STATUSES.has(status)) {
    return false;
  }
  if (!Array.isArray(order.items) || order.items.length === 0) {
    return false;
  }
  return order.items.some(
    (item) =>
      item &&
      item.product &&
      typeof item.product.id === 'string' &&
      item.quantity > 0
  );
}

/**
 * Aggregates product popularity strictly from valid, deduplicated orders
 * belonging to eligible stores.
 */
export function computeProductPopularityFromOrders(params: {
  products: Product[];
  orders: OrderRecord[];
  eligibleStoreIds: Set<string>;
}): {
  popularityByProductId: Record<string, ProductPopularityMetrics>;
  totalValidCityOrders: number;
} {
  const {products, orders, eligibleStoreIds} = params;

  const popularityByProductId: Record<string, ProductPopularityMetrics> = {};
  const eligibleProductMap = new Map<string, Product>();

  for (const product of products) {
    if (!eligibleStoreIds.has(product.storeId)) continue;
    eligibleProductMap.set(product.id, product);

    // Initialize with 0; if a non-demo product has persisted valid counters from backend,
    // use them only as baseline when no local order records are tracked yet.
    const baseOrderCount =
      !product.isDemo &&
      typeof product.orderCount === 'number' &&
      product.orderCount > 0
        ? Math.floor(product.orderCount)
        : 0;
    const baseQtySold =
      !product.isDemo &&
      typeof product.quantitySold === 'number' &&
      product.quantitySold > 0
        ? Math.floor(product.quantitySold)
        : 0;
    const baseLastOrderedMs = !product.isDemo
      ? parseSafeTimestampMs(product.lastOrderedAt)
      : 0;

    popularityByProductId[product.id] = {
      productId: product.id,
      storeId: product.storeId,
      orderCount: baseOrderCount,
      quantitySold: baseQtySold,
      lastOrderedAtMs: baseLastOrderedMs,
    };
  }

  // Deduplicate orders by order.id to prevent duplicate order-processing events
  const seenOrderIds = new Set<string>();
  let totalValidCityOrders = 0;

  for (const order of orders) {
    if (!isOrderValidForPopularity(order)) {
      continue;
    }
    const normalizedOrderId = order.id.trim();
    if (seenOrderIds.has(normalizedOrderId)) {
      continue;
    }
    seenOrderIds.add(normalizedOrderId);

    // Ensure the order is for an eligible store in the buyer's selected city
    if (!eligibleStoreIds.has(order.storeId)) {
      continue;
    }

    const orderTimestampMs =
      parseSafeTimestampMs(order.createdAtIso) ||
      parseSafeTimestampMs(order.createdAt);

    // Track distinct products within this single order so multiple variants of the
    // same product in one order increment `orderCount` once and `quantitySold` by total units.
    const productsCountedInThisOrder = new Set<string>();
    let orderMatchedEligibleProduct = false;

    for (const item of order.items) {
      if (!item?.product?.id || item.quantity <= 0) continue;
      const productId = item.product.id;
      const catalogProduct = eligibleProductMap.get(productId);
      if (!catalogProduct) continue;

      // Verify store-product relationship consistency
      if (catalogProduct.storeId !== order.storeId) continue;

      const metrics = popularityByProductId[productId];
      if (!metrics) continue;

      orderMatchedEligibleProduct = true;

      if (!productsCountedInThisOrder.has(productId)) {
        productsCountedInThisOrder.add(productId);
        metrics.orderCount += 1;
      }

      metrics.quantitySold += item.quantity;
      if (orderTimestampMs > metrics.lastOrderedAtMs) {
        metrics.lastOrderedAtMs = orderTimestampMs;
      }
    }

    if (orderMatchedEligibleProduct) {
      totalValidCityOrders += 1;
    }
  }

  return {
    popularityByProductId,
    totalValidCityOrders,
  };
}

/**
 * Ranks a list of city-eligible products primarily by popularity (most ordered first),
 * with a clean, deterministic fallback for products with zero orders.
 *
 * Ranking hierarchy:
 * 1. Primary: `orderCount` DESC (highest number of valid orders first)
 * 2. Secondary (tie-breaker): `quantitySold` DESC (total units ordered)
 * 3. Tertiary (tie-breaker): `lastOrderedAtMs` DESC (most recent order activity)
 * 4. Fallback for zero-order products (or remaining ties):
 *    a. Active in-stock products (`isAvailable && stock > 0`) before out-of-stock
 *    b. Recently added products first (`createdAt` timestamp DESC)
 *    c. Deterministic alphabetical / ID tie-breaker
 */
export function rankProductsByPopularity(params: {
  products: Product[];
  orders: OrderRecord[];
  eligibleStoreIds: Set<string>;
}): CityPopularityRankResult {
  const {products, orders, eligibleStoreIds} = params;

  const {popularityByProductId, totalValidCityOrders} =
    computeProductPopularityFromOrders({
      products,
      orders,
      eligibleStoreIds,
    });

  const hasValidOrderHistory = Object.values(popularityByProductId).some(
    (m) => m.orderCount > 0
  );

  const rankedProducts = [...products].sort((a, b) => {
    const metricsA = popularityByProductId[a.id] || {
      orderCount: 0,
      quantitySold: 0,
      lastOrderedAtMs: 0,
    };
    const metricsB = popularityByProductId[b.id] || {
      orderCount: 0,
      quantitySold: 0,
      lastOrderedAtMs: 0,
    };

    // 1. Primary: Highest number of valid orders
    if (metricsB.orderCount !== metricsA.orderCount) {
      return metricsB.orderCount - metricsA.orderCount;
    }

    // 2. Secondary: Highest total quantity sold
    if (metricsB.quantitySold !== metricsA.quantitySold) {
      return metricsB.quantitySold - metricsA.quantitySold;
    }

    // 3. Tertiary: Most recent valid order activity
    if (metricsB.lastOrderedAtMs !== metricsA.lastOrderedAtMs) {
      return metricsB.lastOrderedAtMs - metricsA.lastOrderedAtMs;
    }

    // 4. Fallback for zero-order products: Active & in-stock products first
    const inStockA = a.isAvailable && a.stock > 0 ? 1 : 0;
    const inStockB = b.isAvailable && b.stock > 0 ? 1 : 0;
    if (inStockB !== inStockA) {
      return inStockB - inStockA;
    }

    // 5. Recently added products first (when createdAt date exists)
    const createdMsA = parseSafeTimestampMs(a.createdAt);
    const createdMsB = parseSafeTimestampMs(b.createdAt);
    if (createdMsB !== createdMsA) {
      return createdMsB - createdMsA;
    }

    // 6. Deterministic fallback order so newly added / zero-order products are always discoverable
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) return nameCompare;
    return a.id.localeCompare(b.id);
  });

  return {
    rankedProducts,
    popularityByProductId,
    hasValidOrderHistory,
    totalValidCityOrders,
  };
}
