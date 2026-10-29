export type SubscriptionTierId = 'FREE' | 'STARTER' | 'GROWTH' | 'BUSINESS_PRO' | 'ENTERPRISE';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';
export type SponsoredPlacementTier =
  | 'CATEGORY_SPONSORED'
  | 'LOCAL_FEATURED'
  | 'HOMEPAGE_SPONSORED';
export type CampaignApprovalStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type CampaignStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'EXPIRED'
  | 'REJECTED'
  | 'PENDING_PAYMENT';
export type ValueAddedServiceType =
  | 'CATALOG_DIGITIZATION'
  | 'PRIORITY_DISPATCH_SETUP'
  | 'HYPERLOCAL_MARKETING'
  | string;

export interface PlanFeatureEntitlement {
  featureId: string;
  title: string;
  includedTiers: SubscriptionTierId[];
  maxActiveProducts: number;
}

export interface SubscriptionPlan {
  id: SubscriptionTierId;
  name: string;
  tagline?: string;
  badge?: string;
  badgeText?: string;
  isPopular?: boolean;
  productLimit?: number | 'UNLIMITED';
  monthlyFee: number;
  monthlyPriceInr: number;
  annualPriceInr: number;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  commissionPct: number;
  featuredListings: number;
  highlightedFeatures: string[];
  entitlements: PlanFeatureEntitlement;
}

export type FeeStatus =
  | 'COLLECTED'
  | 'PENDING'
  | 'REFUNDED'
  | 'PAID'
  | 'paid'
  | 'reversed'
  | 'outstanding'
  | 'pending_eligibility'
  | 'reserved_for_invoice';

export interface PlatformFeeLedgerEntry {
  id: string;
  orderId: string;
  storeId: string;
  sellerId?: string;
  amount: number;
  totalFee?: number;
  currency?: string;
  status: FeeStatus;
  createdAt: string;
  updatedAt?: string;
  paidByTransactionId?: string;
}

const PLAN_FREE: SubscriptionPlan = {
  id: 'FREE',
  name: 'Free Tier',
  tagline: 'Start selling locally with zero upfront cost.',
  monthlyFee: 0,
  monthlyPriceInr: 0,
  annualPriceInr: 0,
  monthlyPriceUsd: 0,
  annualPriceUsd: 0,
  commissionPct: 0,
  featuredListings: 0,
  highlightedFeatures: [
    'Up to 20 active products (SKUs)',
    '0% commission on all local orders',
    'Direct UPI QR & Cash-on-Delivery',
    'Verified 6-digit Delivery PIN security',
  ],
  entitlements: {
    featureId: 'free',
    title: 'Free Tier',
    includedTiers: ['FREE'],
    maxActiveProducts: 50,
  },
};

const PLAN_STARTER: SubscriptionPlan = {
  id: 'STARTER',
  name: 'Starter Tier',
  tagline: 'For growing neighborhood shops expanding their catalog.',
  monthlyFee: 999,
  monthlyPriceInr: 999,
  annualPriceInr: 9990,
  monthlyPriceUsd: 12,
  annualPriceUsd: 120,
  commissionPct: 0,
  featuredListings: 2,
  highlightedFeatures: [
    'Up to 100 active products (SKUs)',
    '0% commission on all local orders',
    '2 featured product placements',
    'Priority city category visibility',
  ],
  entitlements: {
    featureId: 'starter',
    title: 'Starter Tier',
    includedTiers: ['STARTER'],
    maxActiveProducts: 250,
  },
};

const PLAN_GROWTH: SubscriptionPlan = {
  id: 'GROWTH',
  name: 'Growth Tier',
  tagline: 'Most popular for established local stores & supermarkets.',
  badge: 'Most Popular',
  badgeText: 'Most Popular',
  isPopular: true,
  monthlyFee: 2499,
  monthlyPriceInr: 2499,
  annualPriceInr: 24990,
  monthlyPriceUsd: 29,
  annualPriceUsd: 290,
  commissionPct: 0,
  featuredListings: 5,
  highlightedFeatures: [
    'Up to 150 active products (SKUs)',
    '0% commission on all local orders',
    'Priority city search & category boost',
    'Promotional banners & WhatsApp support',
  ],
  entitlements: {
    featureId: 'growth',
    title: 'Growth Tier',
    includedTiers: ['GROWTH'],
    maxActiveProducts: 1000,
  },
};

const PLAN_BUSINESS_PRO: SubscriptionPlan = {
  id: 'BUSINESS_PRO',
  name: 'Business Pro',
  tagline: 'Full-scale hyperlocal merchandising & multi-staff access.',
  monthlyFee: 4999,
  monthlyPriceInr: 4999,
  annualPriceInr: 49990,
  monthlyPriceUsd: 59,
  annualPriceUsd: 590,
  commissionPct: 0,
  featuredListings: 15,
  highlightedFeatures: [
    'Up to 500 active products (SKUs)',
    'Citykart Gold Verified store badge',
    'Top city spotlight & 15 featured slots',
    'Up to 5 staff accounts & dedicated lead',
  ],
  entitlements: {
    featureId: 'business_pro',
    title: 'Business Pro',
    includedTiers: ['BUSINESS_PRO'],
    maxActiveProducts: -1,
  },
};

const PLAN_ENTERPRISE: SubscriptionPlan = {
  id: 'ENTERPRISE',
  name: 'Enterprise Tier',
  tagline: 'Custom multi-branch operations for regional chains.',
  monthlyFee: 5999,
  monthlyPriceInr: 5999,
  annualPriceInr: 59990,
  monthlyPriceUsd: 69,
  annualPriceUsd: 690,
  commissionPct: 0,
  featuredListings: 15,
  highlightedFeatures: [
    'Unlimited active products (SKUs)',
    'Multi-branch inventory synchronization',
    'Dedicated account manager & SLA',
  ],
  entitlements: {
    featureId: 'enterprise',
    title: 'Enterprise Tier',
    includedTiers: ['ENTERPRISE'],
    maxActiveProducts: -1,
  },
};

const SUBSCRIPTION_PLANS_ARRAY: SubscriptionPlan[] = [
  PLAN_FREE,
  PLAN_STARTER,
  PLAN_GROWTH,
  PLAN_BUSINESS_PRO,
  PLAN_ENTERPRISE,
];

Object.defineProperties(SUBSCRIPTION_PLANS_ARRAY, {
  FREE: { value: PLAN_FREE, enumerable: false, writable: true, configurable: true },
  STARTER: { value: PLAN_STARTER, enumerable: false, writable: true, configurable: true },
  GROWTH: { value: PLAN_GROWTH, enumerable: false, writable: true, configurable: true },
  BUSINESS_PRO: { value: PLAN_BUSINESS_PRO, enumerable: false, writable: true, configurable: true },
  ENTERPRISE: { value: PLAN_ENTERPRISE, enumerable: false, writable: true, configurable: true },
});

export const SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS_ARRAY as unknown as Record<
  SubscriptionTierId,
  SubscriptionPlan
> &
  SubscriptionPlan[];

export const VALUE_ADDED_SERVICES: Array<{
  id: string;
  type: ValueAddedServiceType;
  name: string;
  title: string;
  description: string;
  price: number;
  priceInr: number;
  billingFrequency: string;
  turnaroundDays: number;
}> = [
  {
    id: 'vas_catalog',
    type: 'CATALOG_DIGITIZATION',
    name: 'Catalog Professionalization Service',
    title: 'Assisted Catalogue Digitisation',
    description: 'Our onboarding team transcribes your paper price list or photos into structured SKUs.',
    price: 499,
    priceInr: 499,
    billingFrequency: 'One-Time',
    turnaroundDays: 2,
  },
  {
    id: 'vas_delivery_boost',
    type: 'PRIORITY_DISPATCH_SETUP',
    name: 'Priority Express Dispatch Badge',
    title: 'Bulk Spreadsheet SKU Import',
    description: 'Fast-track import of up to 500 products from Excel/CSV with category mapping.',
    price: 299,
    priceInr: 299,
    billingFrequency: 'One-Time',
    turnaroundDays: 1,
  },
  {
    id: 'vas_marketing',
    type: 'HYPERLOCAL_MARKETING',
    name: 'Hyperlocal Social Media Marketing Bundle',
    title: 'Storefront Branding & Banner Kit',
    description: 'Custom cover artwork, digital QR standee PDF, and WhatsApp shareable store card.',
    price: 999,
    priceInr: 999,
    billingFrequency: 'One-Time',
    turnaroundDays: 3,
  },
];

export interface BillingTransaction {
  id: string;
  sellerId: string;
  storeId?: string;
  cityId?: string;
  amount: number;
  totalAmount?: number;
  taxAmount?: number;
  currency: string;
  type: 'SUBSCRIPTION' | 'COMMISSION' | 'AD_FEATURE' | 'AD_CAMPAIGN' | 'SERVICE_ORDER';
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';
  description?: string;
  invoiceNumber?: string;
  paymentGateway?: string;
  gatewayTransactionId?: string;
  createdAt: string;
}

export interface MerchantSubscription {
  id: string;
  sellerId: string;
  storeId: string;
  planId: SubscriptionTierId;
  billingCycle: BillingCycle | string;
  status: 'ACTIVE' | 'EXPIRED';
  currency?: string;
  currentPrice?: number;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  paymentMethodSnippet?: string;
  lastPaymentDate?: string;
  renewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FeaturedCampaign {
  id: string;
  storeId: string;
  sellerId?: string;
  ownerUid?: string;
  impressions: number;
  clicks: number;
  status: CampaignStatus | string;
  approvalStatus?: CampaignApprovalStatus | string;
  paymentStatus?: string;
  paymentReferenceId?: string;
  razorpayOrderId?: string;
  city?: string;
  cityId?: string;
  cityName?: string;
  category?: string;
  categoryName?: string;
  basePriceInr?: number;
  taxAmountInr?: number;
  totalPaidInr?: number;
  pricePaid?: number;
  budgetInr?: number;
  invoiceNumber?: string;
  targetProductId?: string;
  targetProductName?: string;
  storeName?: string;
  placementTier?: SponsoredPlacementTier | string;
  placementLabel?: string;
  type?: string;
  durationDays?: number;
  startDate: string;
  endDate: string;
  currency?: string;
  adminNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MerchantServiceOrder {
  id: string;
  sellerId?: string;
  storeId?: string;
  serviceType?: ValueAddedServiceType;
  title?: string;
  amountInr?: number;
  total?: number;
  status?: string;
  notes?: string;
  contactPhone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SponsoredPlacementPackage {
  id?: string;
  name?: string;
  days: number;
  durationDays?: number;
  priceInr: number;
}

export interface SponsoredPlacementConfig {
  id: SponsoredPlacementTier | string;
  name: string;
  badgeLabel?: string;
  packages: SponsoredPlacementPackage[];
  isEnabled: boolean;
  description: string;
  livePaymentsApproved?: boolean;
}

const PLACEMENT_CATEGORY_SPONSORED: SponsoredPlacementConfig = {
  id: 'CATEGORY_SPONSORED',
  name: 'Category Sponsored Product',
  badgeLabel: 'Sponsored',
  isEnabled: true,
  livePaymentsApproved: true,
  description: 'Top placement inside your product category for shoppers in your city.',
  packages: [
    { id: 'cat-7', name: '7 Days', days: 7, durationDays: 7, priceInr: 99 },
    { id: 'cat-30', name: '30 Days', days: 30, durationDays: 30, priceInr: 299 },
  ],
};

const PLACEMENT_LOCAL_FEATURED: SponsoredPlacementConfig = {
  id: 'LOCAL_FEATURED',
  name: 'City Featured Product',
  badgeLabel: 'City Featured',
  isEnabled: true,
  livePaymentsApproved: true,
  description: 'Highlighted in city discovery carousels and store spotlight sections.',
  packages: [
    { id: 'loc-7', name: '7 Days', days: 7, durationDays: 7, priceInr: 199 },
    { id: 'loc-30', name: '30 Days', days: 30, durationDays: 30, priceInr: 599 },
  ],
};

const PLACEMENT_HOMEPAGE_SPONSORED: SponsoredPlacementConfig = {
  id: 'HOMEPAGE_SPONSORED',
  name: 'City Homepage Spotlight',
  badgeLabel: 'Spotlight',
  isEnabled: true,
  livePaymentsApproved: true,
  description: 'Prime hero & above-the-fold spotlight for all buyers shopping in your city.',
  packages: [
    { id: 'home-7', name: '7 Days', days: 7, durationDays: 7, priceInr: 399 },
    { id: 'home-30', name: '30 Days', days: 30, durationDays: 30, priceInr: 1199 },
  ],
};

const PLACEMENTS_ARRAY: SponsoredPlacementConfig[] = [
  PLACEMENT_CATEGORY_SPONSORED,
  PLACEMENT_LOCAL_FEATURED,
  PLACEMENT_HOMEPAGE_SPONSORED,
];

Object.defineProperties(PLACEMENTS_ARRAY, {
  CATEGORY_SPONSORED: {
    value: PLACEMENT_CATEGORY_SPONSORED,
    enumerable: false,
    writable: true,
    configurable: true,
  },
  LOCAL_FEATURED: {
    value: PLACEMENT_LOCAL_FEATURED,
    enumerable: false,
    writable: true,
    configurable: true,
  },
  HOMEPAGE_SPONSORED: {
    value: PLACEMENT_HOMEPAGE_SPONSORED,
    enumerable: false,
    writable: true,
    configurable: true,
  },
});

export const DEFAULT_SPONSORED_PLACEMENT_CONFIGS = PLACEMENTS_ARRAY as unknown as Record<
  SponsoredPlacementTier,
  SponsoredPlacementConfig
> &
  SponsoredPlacementConfig[];

export const FEATURED_STORE_PACKAGES = [
  { id: 'fp-7', name: '7-Day Spotlight Feature', priceInr: 499, durationDays: 7, days: 7 },
  { id: 'fp-14', name: '14-Day Spotlight Feature', priceInr: 899, durationDays: 14, days: 14 },
  { id: 'fp-30', name: '30-Day Premier Feature', priceInr: 1799, durationDays: 30, days: 30 },
];

export function calculatePlatformRevenueMetrics(
  storesInput?: any,
  subscriptionsInput?: Record<string, MerchantSubscription> | any,
  transactionsInput?: BillingTransaction[] | any,
  cityFilter: string = 'ALL',
  extra?: {
    sellers?: any[];
    products?: any[];
    orders?: any[];
    users?: any[];
    serviceOrders?: MerchantServiceOrder[];
  }
) {
  const storesList: any[] = Array.isArray(storesInput) ? storesInput : [];
  const filteredStores =
    !cityFilter || cityFilter === 'ALL'
      ? storesList
      : storesList.filter((s) => s?.city === cityFilter || s?.cityName === cityFilter);
  const storeIdSet = new Set(filteredStores.map((s) => s?.id).filter(Boolean));

  const activeStoresCount = filteredStores.filter(
    (s) => s?.status !== 'SUSPENDED' && s?.isEnabled !== false
  ).length;
  const suspendedStoresCount = Math.max(0, filteredStores.length - activeStoresCount);

  const sellersList = Array.isArray(extra?.sellers) ? extra!.sellers : [];
  const sellersCount =
    !cityFilter || cityFilter === 'ALL'
      ? sellersList.length || filteredStores.length
      : sellersList.filter((sel) =>
          (sel?.storeIds || []).some((sid: string) => storeIdSet.has(sid))
        ).length || filteredStores.length;

  const productsList = Array.isArray(extra?.products) ? extra!.products : [];
  const cityProducts =
    !cityFilter || cityFilter === 'ALL'
      ? productsList
      : productsList.filter((p) => storeIdSet.has(p?.storeId));
  const publishedProductsCount = cityProducts.filter(
    (p) => p?.isAvailable !== false
  ).length;
  const unpublishedProductsCount = Math.max(
    0,
    cityProducts.length - publishedProductsCount
  );

  const usersList = Array.isArray(extra?.users) ? extra!.users : [];
  const buyersCount = usersList.filter(
    (u) => !u?.role || String(u.role).toUpperCase() === 'BUYER'
  ).length;

  const ordersList = Array.isArray(extra?.orders) ? extra!.orders : [];
  const cityOrders =
    !cityFilter || cityFilter === 'ALL'
      ? ordersList
      : ordersList.filter((o) => storeIdSet.has(o?.storeId) || o?.city === cityFilter);

  const totalOrders = cityOrders.length;
  const getOrdStatus = (o: any) => String(o?.orderStatus || o?.status || '').toUpperCase();
  const awaitingOrders = cityOrders.filter((o) =>
    ['NEW', 'PLACED'].includes(getOrdStatus(o))
  ).length;
  const inProgressOrders = cityOrders.filter((o) =>
    ['CONFIRMED', 'ACCEPTED', 'PREPARING', 'PACKED', 'DISPATCHED', 'OUT_FOR_DELIVERY'].includes(
      getOrdStatus(o)
    )
  ).length;
  const completedOrders = cityOrders.filter((o) => getOrdStatus(o) === 'DELIVERED').length;
  const cancelledOrders = cityOrders.filter((o) =>
    ['CANCELLED', 'REJECTED'].includes(getOrdStatus(o))
  ).length;

  const grossOrderValueGmv = cityOrders
    .filter((o) => !['CANCELLED', 'REJECTED'].includes(getOrdStatus(o)))
    .reduce((sum, o) => sum + Number(o?.total || 0), 0);

  const activeSubscribersByPlan: Record<SubscriptionTierId, number> = {
    FREE: 0,
    STARTER: 0,
    GROWTH: 0,
    BUSINESS_PRO: 0,
    ENTERPRISE: 0,
  };

  const subsMap: Record<string, MerchantSubscription> =
    subscriptionsInput && typeof subscriptionsInput === 'object' && !Array.isArray(subscriptionsInput)
      ? subscriptionsInput
      : {};

  let mrrInr = 0;
  for (const store of filteredStores) {
    const sub = subsMap[store.id];
    const planId: SubscriptionTierId =
      sub?.status === 'ACTIVE' && sub?.planId && activeSubscribersByPlan[sub.planId] !== undefined
        ? sub.planId
        : 'FREE';
    activeSubscribersByPlan[planId] = (activeSubscribersByPlan[planId] || 0) + 1;
    const planDef = SUBSCRIPTION_PLANS[planId];
    if (planDef && planDef.monthlyPriceInr > 0) {
      mrrInr += Number(sub?.currentPrice || planDef.monthlyPriceInr || 0);
    }
  }

  const activePaidSubscriptions =
    activeSubscribersByPlan.STARTER +
    activeSubscribersByPlan.GROWTH +
    activeSubscribersByPlan.BUSINESS_PRO +
    activeSubscribersByPlan.ENTERPRISE;

  const txList: BillingTransaction[] = Array.isArray(transactionsInput) ? transactionsInput : [];
  const cityTransactions =
    !cityFilter || cityFilter === 'ALL'
      ? txList
      : txList.filter((tx) => !tx?.storeId || storeIdSet.has(tx.storeId));

  let subscriptionRevenueCollected = 0;
  let adAndServiceRevenueCollected = 0;
  let totalRefunds = 0;
  let successfulTxCount = 0;
  let failedTxCount = 0;

  for (const tx of cityTransactions) {
    const amt = Number(tx?.totalAmount ?? tx?.amount ?? 0);
    if (tx?.status === 'SUCCESS') {
      successfulTxCount += 1;
      if (tx.type === 'SUBSCRIPTION') {
        subscriptionRevenueCollected += amt;
      } else {
        adAndServiceRevenueCollected += amt;
      }
    } else if (tx?.status === 'REFUNDED') {
      totalRefunds += amt;
    } else if (tx?.status === 'FAILED') {
      failedTxCount += 1;
    }
  }

  const serviceOrdersList = Array.isArray(extra?.serviceOrders) ? extra!.serviceOrders : [];
  for (const so of serviceOrdersList) {
    adAndServiceRevenueCollected += Number(so?.total || 0);
  }

  const grossPlatformRevenueInr = subscriptionRevenueCollected + adAndServiceRevenueCollected;
  const netPlatformCollections = Math.max(0, grossPlatformRevenueInr - totalRefunds);

  return {
    gmv: grossOrderValueGmv,
    netRevenue: netPlatformCollections,
    activeStoresCount,
    suspendedStoresCount,
    sellersCount,
    publishedProductsCount,
    unpublishedProductsCount,
    buyersCount,
    totalOrders,
    awaitingOrders,
    inProgressOrders,
    completedOrders,
    cancelledOrders,
    grossOrderValueGmv,
    activePaidSubscriptions,
    subscriptionRevenueCollected,
    adAndServiceRevenueCollected,
    totalRefunds,
    netPlatformCollections,
    successfulTxCount,
    failedTxCount,
    mrrInr,
    arrInr: mrrInr * 12,
    activeSubscribersByPlan,
    totalAdCampaignRevenueInr: adAndServiceRevenueCollected,
    grossPlatformRevenueInr,
    transactionCount: cityTransactions.length,
  };
}

export type PlatformRevenueMetrics = ReturnType<
  typeof calculatePlatformRevenueMetrics
>;

