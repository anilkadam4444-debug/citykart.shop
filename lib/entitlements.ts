import {
  MerchantSubscription,
  PlanFeatureEntitlement,
  SUBSCRIPTION_PLANS,
  SubscriptionTierId,
} from './revenue-model';

export const MERCHANT_SUBSCRIPTION_STORAGE_KEY = 'urbandirect_merchant_subs_v1';
export const CAMPAIGNS_STORAGE_KEY = 'urbandirect_campaigns_v1';
export const BILLING_TX_STORAGE_KEY = 'urbandirect_billing_tx_v1';
export const SERVICE_ORDERS_STORAGE_KEY = 'urbandirect_service_orders_v1';

export function getDefaultFreeSubscription(storeId: string, sellerId: string): MerchantSubscription {
  const now = new Date();
  const nextYear = new Date();
  nextYear.setFullYear(now.getFullYear() + 10);

  return {
    id: `sub-free-${storeId}`,
    sellerId,
    storeId,
    planId: 'FREE',
    billingCycle: 'MONTHLY',
    status: 'ACTIVE',
    currency: 'INR',
    currentPrice: SUBSCRIPTION_PLANS.FREE.monthlyPriceInr,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: nextYear.toISOString(),
    cancelAtPeriodEnd: false,
    renewedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function loadMerchantSubscriptionsFromStorage(): Record<string, MerchantSubscription> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(MERCHANT_SUBSCRIPTION_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore storage parse error
  }
  return {};
}

export function saveMerchantSubscriptionToStorage(sub: MerchantSubscription): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadMerchantSubscriptionsFromStorage();
    current[sub.storeId] = sub;
    window.localStorage.setItem(MERCHANT_SUBSCRIPTION_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage write error
  }
}

export function getStoreSubscription(storeId: string, fallbackSellerId: string = ''): MerchantSubscription {
  const allSubs = loadMerchantSubscriptionsFromStorage();
  if (allSubs[storeId]) {
    return allSubs[storeId];
  }
  return getDefaultFreeSubscription(storeId, fallbackSellerId);
}

export function getStoreEntitlements(storeId: string, fallbackPlanId?: SubscriptionTierId): PlanFeatureEntitlement {
  const sub = getStoreSubscription(storeId);
  const planKey = (fallbackPlanId || sub.planId || 'FREE') as SubscriptionTierId;
  const plan = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.FREE;
  return plan.entitlements;
}

export interface ProductQuotaStatus {
  canAdd: boolean;
  maxAllowed: number; // -1 means unlimited
  currentCount: number;
  isUnlimited: boolean;
  isOverQuota: boolean;
  quotaPercent: number; // 0 - 100+
  remaining: number; // -1 if unlimited
  planName: string;
  planId: SubscriptionTierId;
}

/**
 * Enforces product catalogue quota limits safely.
 * Downgrades DO NOT delete existing products; rather, merchants are warned
 * and prevented from creating new items until they upgrade or reduce active listings.
 */
export function checkProductQuota(
  storeId: string,
  currentProductCount: number,
  fallbackPlanId?: SubscriptionTierId
): ProductQuotaStatus {
  const sub = getStoreSubscription(storeId);
  const planKey = (fallbackPlanId || sub.planId || 'FREE') as SubscriptionTierId;
  const plan = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.FREE;
  const maxAllowed = plan.entitlements.maxActiveProducts;

  if (maxAllowed === -1) {
    return {
      canAdd: true,
      maxAllowed: -1,
      currentCount: currentProductCount,
      isUnlimited: true,
      isOverQuota: false,
      quotaPercent: 0,
      remaining: Infinity,
      planName: plan.name,
      planId: planKey,
    };
  }

  const isOverQuota = currentProductCount > maxAllowed;
  const canAdd = currentProductCount < maxAllowed;
  const remaining = Math.max(0, maxAllowed - currentProductCount);
  const quotaPercent = Math.min(100, Math.round((currentProductCount / maxAllowed) * 100));

  return {
    canAdd,
    maxAllowed,
    currentCount: currentProductCount,
    isUnlimited: false,
    isOverQuota,
    quotaPercent,
    remaining,
    planName: plan.name,
    planId: planKey,
  };
}
