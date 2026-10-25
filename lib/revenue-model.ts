/**
 * URBANDIRECT — Revenue & Monetization Engine Data Model
 * 
 * Core Policy: Merchants retain 100% of their sales revenue and manage their own
 * delivery and customer payments. URBANDIRECT monetizes strictly via merchant SaaS subscriptions,
 * transparent ad placements (Featured Stores & Sponsored Products), and optional assisted onboarding services.
 */

export type SubscriptionTierId = 'FREE' | 'GROWTH' | 'BUSINESS_PRO';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';
export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

export interface PlanFeatureEntitlement {
  maxActiveProducts: number; // 20 for Free, 150 for Growth, Infinity (-1) for Business Pro
  hasStoreOffersBanner: boolean;
  hasBasicAnalytics: boolean;
  hasAdvancedAnalytics: boolean;
  hasPriorityCityListing: boolean;
  hasRepeatCustomerTools: boolean;
  hasMultiStaffAccess: boolean;
  hasAiStoreAssistant: boolean;
  hasCustomDomainSupport: boolean;
  hasVerifiedBadge: boolean;
  supportLevel: 'COMMUNITY' | 'PRIORITY_WHATSAPP' | 'DEDICATED_ACCOUNT_MANAGER';
}

export interface SubscriptionPlan {
  id: SubscriptionTierId;
  name: string;
  tagline: string;
  badge?: string;
  isPopular?: boolean;
  monthlyPriceInr: number;
  annualPriceInr: number; // typically ~17% discount (approx 10 months fee for 12 months)
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  entitlements: PlanFeatureEntitlement;
  highlightedFeatures: string[];
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTierId, SubscriptionPlan> = {
  FREE: {
    id: 'FREE',
    name: 'Starter Merchant',
    tagline: 'Essential digital storefront for local neighborhood retail shops.',
    monthlyPriceInr: 299,
    annualPriceInr: 2999, // save ~16%
    monthlyPriceUsd: 3.99,
    annualPriceUsd: 39.99,
    entitlements: {
      maxActiveProducts: 20,
      hasStoreOffersBanner: false,
      hasBasicAnalytics: false,
      hasAdvancedAnalytics: false,
      hasPriorityCityListing: false,
      hasRepeatCustomerTools: false,
      hasMultiStaffAccess: false,
      hasAiStoreAssistant: false,
      hasCustomDomainSupport: false,
      hasVerifiedBadge: false,
      supportLevel: 'COMMUNITY',
    },
    highlightedFeatures: [
      'Up to 20 active SKUs in product catalogue',
      'Hyperlocal city & neighborhood discovery',
      'Direct WhatsApp & UPI doorstep payments',
      'Zero commission on all customer sales',
      'Standard store profile & operating hours',
    ],
  },
  GROWTH: {
    id: 'GROWTH',
    name: 'Growth Merchant',
    tagline: 'For thriving local businesses expanding customer reach and store sales.',
    badge: 'Most Popular',
    isPopular: true,
    monthlyPriceInr: 699,
    annualPriceInr: 6999, // save ~16%
    monthlyPriceUsd: 8.99,
    annualPriceUsd: 89.99,
    entitlements: {
      maxActiveProducts: 150,
      hasStoreOffersBanner: true,
      hasBasicAnalytics: true,
      hasAdvancedAnalytics: false,
      hasPriorityCityListing: true,
      hasRepeatCustomerTools: false,
      hasMultiStaffAccess: false,
      hasAiStoreAssistant: false,
      hasCustomDomainSupport: false,
      hasVerifiedBadge: false,
      supportLevel: 'PRIORITY_WHATSAPP',
    },
    highlightedFeatures: [
      'Up to 150 active SKUs in catalogue',
      'Priority ranking in city-wide browse & search',
      'Promotional store banners & discount tags',
      'Basic sales, traffic & popularity analytics',
      'Instant WhatsApp order alerts assistance',
      'Priority merchant support via WhatsApp',
    ],
  },
  BUSINESS_PRO: {
    id: 'BUSINESS_PRO',
    name: 'Business Pro',
    tagline: 'For market leaders requiring high-capacity catalog scale, team management & deep insights.',
    badge: 'Full Power',
    monthlyPriceInr: 1499,
    annualPriceInr: 14999, // save ~16%
    monthlyPriceUsd: 18.99,
    annualPriceUsd: 189.99,
    entitlements: {
      maxActiveProducts: 500, // High capacity catalogue cap
      hasStoreOffersBanner: true,
      hasBasicAnalytics: true,
      hasAdvancedAnalytics: true,
      hasPriorityCityListing: true,
      hasRepeatCustomerTools: true,
      hasMultiStaffAccess: true,
      hasAiStoreAssistant: true,
      hasCustomDomainSupport: true,
      hasVerifiedBadge: true,
      supportLevel: 'DEDICATED_ACCOUNT_MANAGER',
    },
    highlightedFeatures: [
      'High capacity catalogue (up to 500 SKUs)',
      'Citykart Verified Merchant gold badge',
      'Advanced sales, retention & repeat customer cohort analytics',
      'Store staff & manager sub-accounts',
      'AI Store Assistant for copy, descriptions & catalogue tagging',
      'Custom domain & branded storefront readiness',
      'Dedicated local account manager',
    ],
  },
};

export interface MerchantSubscription {
  id: string;
  sellerId: string;
  storeId: string;
  planId: SubscriptionTierId;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  currency: 'INR' | 'USD';
  currentPrice: number;
  currentPeriodStart: string; // ISO string
  currentPeriodEnd: string; // ISO string
  cancelAtPeriodEnd: boolean;
  paymentMethodSnippet?: string; // e.g. "UPI ID" or "Card ending in 4242"
  lastPaymentDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'SUBSCRIPTION' | 'AD_CAMPAIGN' | 'SERVICE_ORDER';
export type TransactionStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';

export interface BillingTransaction {
  id: string;
  sellerId: string;
  storeId: string;
  type: TransactionType;
  description: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  currency: 'INR' | 'USD';
  status: TransactionStatus;
  paymentGateway: 'RAZORPAY' | 'STRIPE' | 'OFFLINE_TRANSFER';
  gatewayTransactionId?: string;
  invoiceNumber: string;
  receiptUrl?: string;
  createdAt: string;
}

// Advertising & Placements
export type CampaignPlacementType = 'FEATURED_STORE' | 'SPONSORED_PRODUCT';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'SCHEDULED' | 'PAUSED' | 'COMPLETED' | 'REJECTED';

export interface CampaignDurationOption {
  days: number;
  priceInr: number;
  priceUsd: number;
  label: string;
}

export const FEATURED_STORE_PACKAGES: CampaignDurationOption[] = [
  { days: 7, priceInr: 299, priceUsd: 4.99, label: '7 Days Boost' },
  { days: 14, priceInr: 549, priceUsd: 8.99, label: '14 Days Boost (Save 8%)' },
  { days: 30, priceInr: 999, priceUsd: 15.99, label: '30 Days Spotlight (Save 16%)' },
];

export const SPONSORED_PRODUCT_PACKAGES: CampaignDurationOption[] = [
  { days: 7, priceInr: 199, priceUsd: 2.99, label: '7 Days Product Push' },
  { days: 14, priceInr: 369, priceUsd: 5.49, label: '14 Days (Save 7%)' },
  { days: 30, priceInr: 699, priceUsd: 9.99, label: '30 Days (Save 12%)' },
];

export interface FeaturedCampaign {
  id: string;
  sellerId: string;
  storeId: string;
  storeName: string;
  type: CampaignPlacementType;
  targetProductId?: string;
  targetProductName?: string;
  cityId: string;
  cityName: string;
  categoryId?: string;
  status: CampaignStatus;
  startDate: string; // ISO
  endDate: string; // ISO
  durationDays: number;
  budgetInr: number;
  impressions: number;
  clicks: number;
  createdAt: string;
}

// Value-Added Services
export type ValueAddedServiceType = 'CATALOGUE_SETUP' | 'BULK_UPLOAD' | 'CUSTOM_DOMAIN' | 'PHOTOGRAPHY_ASSIST';
export type ServiceOrderStatus = 'SUBMITTED' | 'IN_REVIEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ValueAddedServiceDefinition {
  type: ValueAddedServiceType;
  title: string;
  priceInr: number;
  priceUsd: number;
  billingFrequency: 'ONE_TIME' | 'MONTHLY';
  turnaroundDays: number;
  description: string;
  deliverables: string[];
}

export const VALUE_ADDED_SERVICES: Record<ValueAddedServiceType, ValueAddedServiceDefinition> = {
  CATALOGUE_SETUP: {
    type: 'CATALOGUE_SETUP',
    title: 'Assisted Catalogue Digitisation',
    priceInr: 499,
    priceUsd: 7.99,
    billingFrequency: 'ONE_TIME',
    turnaroundDays: 2,
    description: 'Send us your shop paper price list, menu, or bills on WhatsApp. Our onboarding team digitises up to 50 items with images and accurate categorization.',
    deliverables: [
      'Up to 50 SKUs formatted and published',
      'Category & sub-category mapping',
      'Stock level configuration',
      'Quality check & mobile verification',
    ],
  },
  BULK_UPLOAD: {
    type: 'BULK_UPLOAD',
    title: 'Bulk Excel / CSV Catalogue Import',
    priceInr: 299,
    priceUsd: 4.99,
    billingFrequency: 'ONE_TIME',
    turnaroundDays: 1,
    description: 'Have existing spreadsheet inventory? We validate, sanitize, and import your CSV / Excel product catalogue directly into your store.',
    deliverables: [
      'Import up to 500 SKUs from Excel/CSV',
      'Error checking and duplicate suppression',
      'Unit and variant pricing mapping',
      'Post-import audit report',
    ],
  },
  CUSTOM_DOMAIN: {
    type: 'CUSTOM_DOMAIN',
    title: 'Custom Domain & Branded Storefront',
    priceInr: 299,
    priceUsd: 4.99,
    billingFrequency: 'MONTHLY',
    turnaroundDays: 1,
    description: 'Connect your own domain (e.g. shop.yourbrand.com) directly to your Citykart storefront with automated SSL certificate provisioning.',
    deliverables: [
      'Automated SSL / TLS certificates',
      'Custom CNAME and DNS routing setup',
      'Branded store header without marketplace chrome',
      'SEO canonical indexing for your domain',
    ],
  },
  PHOTOGRAPHY_ASSIST: {
    type: 'PHOTOGRAPHY_ASSIST',
    title: 'Product Image Enhancement & Background Cleanup',
    priceInr: 399,
    priceUsd: 5.99,
    billingFrequency: 'ONE_TIME',
    turnaroundDays: 2,
    description: 'Professional white-background clipping and contrast enhancement for up to 30 shop photos.',
    deliverables: [
      'Up to 30 product images retouched',
      'Studio-white clean backdrop',
      'Fast CDN web-optimized compression',
    ],
  },
};

export interface MerchantServiceOrder {
  id: string;
  sellerId: string;
  storeId: string;
  serviceType: ValueAddedServiceType;
  title: string;
  amountInr: number;
  status: ServiceOrderStatus;
  notes?: string;
  contactPhone: string;
  createdAt: string;
  updatedAt: string;
}



export interface PlatformRevenueMetrics {
  mrrInr: number;
  arrInr: number;
  totalSubscribers: number;
  activeSubscribersByPlan: Record<SubscriptionTierId, number>;
  monthlyPaidChurnRatePercent: number;
  totalAdCampaignRevenueInr: number;
  totalServiceOrdersRevenueInr: number;
  grossPlatformRevenueInr: number;
  transactionCount: number;
  activePaidSubscriptions: number;
  subscriptionRevenueCollected: number;
  adAndServiceRevenueCollected: number;

  // Marketplace KPIs (Required with defaults)
  buyersCount: number;
  sellersCount: number;
  activeStoresCount: number;
  suspendedStoresCount: number;
  publishedProductsCount: number;
  unpublishedProductsCount: number;
  totalOrders: number;
  awaitingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  grossOrderValueGmv: number;
  successfulTxCount: number;
  failedTxCount: number;
  totalRefunds: number;
  netPlatformCollections: number;
}

import { LocalStore, UserAccount, Product, OrderRecord, SellerProfile } from './catalog-data';

/**
 * Calculates platform-wide or city-filtered revenue and marketplace metrics.
 * Centralized logic to be shared between Admin dashboards.
 */
export function calculatePlatformRevenueMetrics(
  stores: LocalStore[],
  subscriptions: Record<string, MerchantSubscription>,
  transactions: BillingTransaction[],
  cityFilter: string = 'ALL',
  extra?: {
    users?: UserAccount[];
    products?: Product[];
    orders?: OrderRecord[];
    sellers?: SellerProfile[];
  }
): PlatformRevenueMetrics {
  const activeSubscribersByPlan: Record<SubscriptionTierId, number> = {
    FREE: 0,
    GROWTH: 0,
    BUSINESS_PRO: 0,
  };

  let mrrInr = 0;
  let arrInr = 0;
  let activePaidSubscriptions = 0;

  const eligibleStoreIds = new Set(
    cityFilter === 'ALL'
      ? stores.map((s) => s.id)
      : stores.filter((s) => s.cityId === cityFilter).map((s) => s.id)
  );

  stores.forEach((st) => {
    if (eligibleStoreIds.has(st.id)) {
      const sub = subscriptions[st.id];
      const tier = (sub?.planId || 'FREE') as SubscriptionTierId;
      activeSubscribersByPlan[tier] = (activeSubscribersByPlan[tier] || 0) + 1;

      if (sub && sub.status === 'ACTIVE') {
        if (tier !== 'FREE') {
          activePaidSubscriptions++;
        }
        const plan = SUBSCRIPTION_PLANS[tier];
        if (sub.billingCycle === 'ANNUAL') {
          mrrInr += Math.round(plan.annualPriceInr / 12);
          arrInr += plan.annualPriceInr;
        } else {
          mrrInr += plan.monthlyPriceInr;
          arrInr += plan.monthlyPriceInr * 12;
        }
      }
    }
  });

  const filteredTransactions = cityFilter === 'ALL'
    ? transactions
    : transactions.filter((tx) => eligibleStoreIds.has(tx.storeId));

  let totalAdCampaignRevenueInr = 0;
  let totalServiceOrdersRevenueInr = 0;
  let subscriptionRevenueCollected = 0;
  let adAndServiceRevenueCollected = 0;
  let grossPlatformRevenueInr = 0;
  let successfulTxCount = 0;
  let failedTxCount = 0;
  let totalRefunds = 0;

  filteredTransactions.forEach((tx) => {
    if (tx.status === 'SUCCESS') {
      successfulTxCount++;
      grossPlatformRevenueInr += tx.totalAmount;
      if (tx.type === 'SUBSCRIPTION') {
        subscriptionRevenueCollected += tx.totalAmount;
      } else {
        adAndServiceRevenueCollected += tx.totalAmount;
        if (tx.type === 'AD_CAMPAIGN') {
          totalAdCampaignRevenueInr += tx.totalAmount;
        } else if (tx.type === 'SERVICE_ORDER') {
          totalServiceOrdersRevenueInr += tx.totalAmount;
        }
      }
    } else if (tx.status === 'FAILED') {
      failedTxCount++;
    } else if (tx.status === 'REFUNDED') {
      totalRefunds += tx.totalAmount;
    }
  });

  const netPlatformCollections = Math.max(0, grossPlatformRevenueInr - totalRefunds);

  // Marketplace Metrics (only if extra data is provided)
  const metrics: PlatformRevenueMetrics = {
    mrrInr,
    arrInr,
    totalSubscribers: stores.length,
    activeSubscribersByPlan,
    monthlyPaidChurnRatePercent: 0,
    totalAdCampaignRevenueInr,
    totalServiceOrdersRevenueInr,
    grossPlatformRevenueInr,
    transactionCount: filteredTransactions.length,
    activePaidSubscriptions,
    subscriptionRevenueCollected,
    adAndServiceRevenueCollected,
    successfulTxCount,
    failedTxCount,
    totalRefunds,
    netPlatformCollections,
    // Defaults for marketplace KPIs
    buyersCount: 0,
    sellersCount: 0,
    activeStoresCount: stores.filter((s) => s.isActive && !s.isSuspended).length,
    suspendedStoresCount: stores.filter((s) => s.isSuspended || !s.isActive).length,
    publishedProductsCount: 0,
    unpublishedProductsCount: 0,
    totalOrders: 0,
    awaitingOrders: 0,
    inProgressOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    grossOrderValueGmv: 0,
  };

  if (extra) {
    if (extra.users) {
      metrics.buyersCount = extra.users.filter((u) => u.roles.includes('BUYER')).length;
    }
    if (extra.sellers) {
      metrics.sellersCount = extra.sellers.length;
    }
    if (extra.products) {
      metrics.publishedProductsCount = extra.products.filter((p) => p.isAvailable && !p.adminUnpublished).length;
      metrics.unpublishedProductsCount = extra.products.filter((p) => p.adminUnpublished).length;
    }
    if (extra.orders) {
      metrics.totalOrders = extra.orders.length;
      metrics.awaitingOrders = extra.orders.filter((o) => o.currentStepIndex === 0 && o.orderStatus !== 'CANCELLED').length;
      metrics.inProgressOrders = extra.orders.filter((o) => (o.currentStepIndex === 1 || o.currentStepIndex === 2) && o.orderStatus !== 'CANCELLED').length;
      metrics.completedOrders = extra.orders.filter((o) => o.currentStepIndex >= 3 && o.orderStatus !== 'CANCELLED').length;
      metrics.cancelledOrders = extra.orders.filter((o) => o.orderStatus === 'CANCELLED').length;
      metrics.grossOrderValueGmv = extra.orders.filter((o) => o.orderStatus !== 'CANCELLED').reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    }
  }

  return metrics;
}

