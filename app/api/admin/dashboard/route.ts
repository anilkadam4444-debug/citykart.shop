import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import {
  db,
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  IS_PREVIEW_DUMMY_FIREBASE,
} from '@/lib/firebase';
import {
  AUTHORITATIVE_STORE_CATEGORIES,
  LocalStore,
  OrderRecord,
  Product,
  SellerProfile,
  UserAccount,
} from '@/lib/catalog-data';
import {
  INITIAL_PRODUCTS,
  INITIAL_SELLERS,
  INITIAL_STORES,
  INITIAL_USER_ACCOUNTS,
  serverUserAccounts,
} from '@/lib/initial-data';
import {
  NANDED_DEMO_BATCH_ID,
} from '@/lib/nanded-demo-data';

import {
  BillingTransaction,
  FeaturedCampaign,
  MerchantServiceOrder,
  MerchantSubscription,
  SubscriptionTierId,
  VALUE_ADDED_SERVICES,
} from '@/lib/revenue-model';
import { getDefaultFreeSubscription } from '@/lib/entitlements';
import { serverOrdersRegistry, serverNotificationsRegistry } from '@/lib/orders-registry';
import { serverDeletedStoresRegistry } from '@/lib/stores-registry';
import {
  getAdminAuditLogs,
  getAuthoritativeAdminAuthorizations,
  getAuthoritativePlatformSettings,
  getAuthoritativePlatformSettingsAsync,
  getAuthoritativeSubscriptionPlans,
  getAuthoritativeSubscriptionPlansAsync,
  serverBuyerOverridesRegistry,
  serverProductOverridesRegistry,
  serverStoreOverridesRegistry,
  serverSystemEventsRegistry,
  verifyAdminRequest,
} from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // 1. Strict Server-Side Authorization Gate (Super Admin or Operational Admin)
  const authCheck = await verifyAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json(
      {
        ok: false,
        authorized: false,
        requiresBootstrap: authCheck.requiresBootstrap,
        isSuperAdmin: authCheck.isSuperAdmin,
        adminRole: authCheck.role,
        error: authCheck.reason,
      },
      { status: authCheck.status }
    );
  }

  const { searchParams } = new URL(req.url);
  const excludeDemo = searchParams.get('excludeDemo') === 'true';

  const startProbeMs = Date.now();
  let firestoreHealthy = !IS_PREVIEW_DUMMY_FIREBASE;
  let firestoreLatencyMs = 1;

  if (!IS_PREVIEW_DUMMY_FIREBASE) {
    try {
      await getDoc(doc(db, 'test', 'connection'));
      firestoreHealthy = true;
      firestoreLatencyMs = Date.now() - startProbeMs;
    } catch {
      firestoreHealthy = false;
      firestoreLatencyMs = Date.now() - startProbeMs;
    }
  }

  // 2. Fetch Firestore collections in parallel with graceful fallback
  const [
    fsUsersSnap,
    fsSellersSnap,
    fsStoresSnap,
    fsProductsSnap,
    fsOrdersSnap,
    fsSubsSnap,
    fsTxSnap,
    fsCampaignsSnap,
    fsServiceOrdersSnap,
    fsLocationReqsSnap,
    fsFcmTokensSnap,
    auditLogs,
  ] = IS_PREVIEW_DUMMY_FIREBASE
    ? [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        await getAdminAuditLogs(150),
      ]
    : await Promise.all([
        getDocs(collection(db, 'users')).catch(() => null),
        getDocs(collection(db, 'sellers')).catch(() => null),
        getDocs(collection(db, 'stores')).catch(() => null),
        getDocs(collection(db, 'products')).catch(() => null),
        getDocs(collection(db, 'orders')).catch(() => null),
        getDocs(collection(db, 'merchantSubscriptions')).catch(() => null),
        getDocs(collection(db, 'billingTransactions')).catch(() => null),
        getDocs(collection(db, 'featuredCampaigns')).catch(() => null),
        getDocs(collection(db, 'merchantServiceOrders')).catch(() => null),
        getDocs(collection(db, 'locationRequests')).catch(() => null),
        getDocs(collection(db, 'fcm_tokens')).catch(() => null),
        getAdminAuditLogs(150),
      ]);

  // 3. Merge Deleted Store Tombstones
  const deletedStoreIds = new Set<string>(serverDeletedStoresRegistry.keys());

  // 4. Merge Sellers
  const sellersMap = new Map<string, SellerProfile>();
  for (const s of INITIAL_SELLERS) {
    sellersMap.set(s.id, { ...s });
  }

  fsSellersSnap?.forEach((d) => {
    const data = d.data() as SellerProfile;
    if (data?.id) sellersMap.set(data.id, data);
  });

  // 5. Merge Stores + Apply Admin Suspension Overrides
  const storesMap = new Map<string, LocalStore>();
  for (const st of INITIAL_STORES) {
    if (!deletedStoreIds.has(st.id)) {
      storesMap.set(st.id, { ...st });
    }
  }
  fsStoresSnap?.forEach((d) => {
    const data = d.data() as LocalStore;
    if (data?.id && !deletedStoreIds.has(data.id)) {
      storesMap.set(data.id, data);
    }
  });
  for (const [storeId, override] of serverStoreOverridesRegistry.entries()) {
    const existing = storesMap.get(storeId);
    if (existing) {
      storesMap.set(storeId, {
        ...existing,
        isSuspended: override.isSuspended,
        isActive: override.isActive,
        suspensionReason: override.suspensionReason,
        suspendedAt: override.suspendedAt,
        locationVerified:
          override.locationVerified ?? existing.locationVerified,
        verificationStatus:
          override.verificationStatus ?? existing.verificationStatus,
      });
    }
  }

  // 6. Merge Products + Apply Admin Unpublish Overrides
  const productsMap = new Map<string, Product>();
  for (const p of INITIAL_PRODUCTS) {
    if (!deletedStoreIds.has(p.storeId)) {
      productsMap.set(p.id, { ...p });
    }
  }
  fsProductsSnap?.forEach((d) => {
    const data = d.data() as Product;
    if (data?.id && !deletedStoreIds.has(data.storeId)) {
      productsMap.set(data.id, data);
    }
  });
  for (const [productId, override] of serverProductOverridesRegistry.entries()) {
    const existing = productsMap.get(productId);
    if (existing) {
      productsMap.set(productId, {
        ...existing,
        adminUnpublished: override.adminUnpublished,
        isAvailable: override.isAvailable,
        unpublishReason: override.unpublishReason,
        unpublishedAt: override.unpublishedAt,
      });
    }
  }

  // 7. Merge Users (Buyers & Sellers) + Apply Admin Buyer Overrides
  const usersMap = new Map<string, UserAccount>();
  for (const u of INITIAL_USER_ACCOUNTS) {
    usersMap.set(u.phoneE164 || u.id, { ...u, accountStatus: 'ACTIVE' });
  }
  for (const [, u] of serverUserAccounts.entries()) {
    usersMap.set(u.phoneE164 || u.id, {
      ...u,
      accountStatus: u.accountStatus || 'ACTIVE',
    });
  }
  fsUsersSnap?.forEach((d) => {
    const data = d.data() as UserAccount;
    if (data?.phoneE164 || data?.id) {
      usersMap.set(data.phoneE164 || data.id, {
        ...data,
        accountStatus: data.accountStatus || 'ACTIVE',
      });
    }
  });
  for (const [, override] of serverBuyerOverridesRegistry.entries()) {
    for (const [key, user] of usersMap.entries()) {
      if (user.id === override.userId || user.phoneE164 === override.phoneE164) {
        usersMap.set(key, {
          ...user,
          accountStatus: override.accountStatus,
          suspensionReason: override.suspensionReason,
          suspendedAt: override.suspendedAt,
        });
      }
    }
  }

  // 8. Merge Orders (Deduplicated by order ID)
  const ordersMap = new Map<string, OrderRecord>();
  for (const [id, ord] of serverOrdersRegistry.entries()) {
    ordersMap.set(id, ord);
  }
  fsOrdersSnap?.forEach((d) => {
    const data = d.data() as OrderRecord;
    if (data?.id) ordersMap.set(data.id, data);
  });

  // 9. Subscriptions, Billing Transactions, Campaigns, Service Orders
  const subscriptionsMap = new Map<string, MerchantSubscription>();
  fsSubsSnap?.forEach((d) => {
    const data = d.data() as MerchantSubscription;
    if (data?.storeId) subscriptionsMap.set(data.storeId, data);
  });

  const transactionsMap = new Map<string, BillingTransaction>();
  fsTxSnap?.forEach((d) => {
    const data = d.data() as BillingTransaction;
    if (data?.id) transactionsMap.set(data.id, data);
  });

  const campaignsMap = new Map<string, FeaturedCampaign>();
  fsCampaignsSnap?.forEach((d) => {
    const data = d.data() as FeaturedCampaign;
    if (data?.id) campaignsMap.set(data.id, data);
  });

  const serviceOrdersMap = new Map<string, MerchantServiceOrder>();
  fsServiceOrdersSnap?.forEach((d) => {
    const data = d.data() as MerchantServiceOrder;
    if (data?.id) serviceOrdersMap.set(data.id, data);
  });

  // Location requests
  const locationRequests: Array<Record<string, unknown>> = [];
  fsLocationReqsSnap?.forEach((d) => {
    locationRequests.push({ id: d.id, ...d.data() });
  });

  // Filter datasets based on `excludeDemo`
  const allSellers = Array.from(sellersMap.values()).filter((s) =>
    excludeDemo ? !s.isDemo && !s.id.startsWith('demo-nanded-') : true
  );
  const allStores = Array.from(storesMap.values()).filter((s) =>
    excludeDemo ? !s.isDemo && !s.id.startsWith('demo-nanded-') : true
  );
  const allProducts = Array.from(productsMap.values()).filter((p) =>
    excludeDemo ? !p.isDemo && !p.id.startsWith('demo-nanded-') : true
  );
  const allOrders = Array.from(ordersMap.values()).filter((o) =>
    excludeDemo ? !o.isDemo && !o.isTest : true
  );
  const allUsers = Array.from(usersMap.values()).filter((u) =>
    excludeDemo ? !u.id.startsWith('user-demo-nanded-') : true
  );

  // Ensure every store has a resolved subscription record
  const resolvedStoreSubscriptions: MerchantSubscription[] = allStores.map(
    (st) =>
      subscriptionsMap.get(st.id) ||
      getDefaultFreeSubscription(st.id, st.sellerId)
  );

  const authoritativePlansMap = await getAuthoritativeSubscriptionPlansAsync();
  const subscriptionPlansList = Object.values(authoritativePlansMap).map(
    (plan) => ({
      ...plan,
      productLimit:
        plan.entitlements.maxActiveProducts >= 100000
          ? ('UNLIMITED' as const)
          : plan.entitlements.maxActiveProducts,
      badgeText:
        (plan as unknown as { badgeText?: string }).badgeText ||
        (plan.isPopular ? 'Most Popular' : ''),
    })
  );
  const platformSettings = await getAuthoritativePlatformSettingsAsync();

  // Compute Fcm token count & notification count
  let fcmTokensCount = 0;
  let sellerFcmTokenCount = 0;
  let buyerFcmTokenCount = 0;
  fsFcmTokensSnap?.forEach((d) => {
    fcmTokensCount++;
    const role = d.data()?.role;
    if (role === 'SELLER' || role === 'BOTH') sellerFcmTokenCount++;
    if (role === 'BUYER' || role === 'BOTH' || !role) buyerFcmTokenCount++;
  });
  const sellerNotificationsCount = serverNotificationsRegistry.length;
  const recentEvents = Array.from(serverSystemEventsRegistry.values()).sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return NextResponse.json({
    ok: true,
    authorized: true,
    fetchedAt: new Date().toISOString(),
    isSuperAdmin: authCheck.isSuperAdmin,
    adminRole: authCheck.role,
    adminRecord: authCheck.superAdminRecord,
    adminAuthorizations: authCheck.isSuperAdmin
      ? await getAuthoritativeAdminAuthorizations()
      : authCheck.authorizationRecord
        ? [authCheck.authorizationRecord]
        : [],
    excludeDemo,
    demoBatchInfo: {
      batchId: NANDED_DEMO_BATCH_ID,
      demoStoresCount: Array.from(storesMap.values()).filter((s) => s.isDemo)
        .length,
      demoProductsCount: Array.from(productsMap.values()).filter((p) => p.isDemo)
        .length,
    },
    sellers: allSellers,
    stores: allStores,
    products: allProducts,
    orders: allOrders,
    users: allUsers,
    categories: AUTHORITATIVE_STORE_CATEGORIES,
    subscriptions: resolvedStoreSubscriptions,
    transactions: Array.from(transactionsMap.values()),
    campaigns: Array.from(campaignsMap.values()),
    serviceOrders: Array.from(serviceOrdersMap.values()),
    subscriptionPlans: subscriptionPlansList,
    valueAddedServices: VALUE_ADDED_SERVICES,
    platformSettings,
    locationRequests,
    deletedStores: Array.from(serverDeletedStoresRegistry.values()),
    auditLogs,
    systemHealth: {
      firebaseProjectId: FIREBASE_PROJECT_ID,
      firestoreDatabaseId: FIRESTORE_DATABASE_ID,
      firestoreHealthy,
      firestoreStatus: firestoreHealthy ? 'OPERATIONAL' : 'DEGRADED',
      firestoreLatencyMs,
      firebaseAuthConfigured: true,
      fcmServerConfigured: true,
      hasServiceAccountCredentials: Boolean(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ),
      hasVapidKey: Boolean(
        process.env.FIREBASE_WEB_PUSH_CERTIFICATE_KEY ||
          process.env.FIREBASE_VAPID_KEY
      ),
      fcmVapidConfigured: Boolean(
        process.env.FIREBASE_WEB_PUSH_CERTIFICATE_KEY ||
          process.env.FIREBASE_VAPID_KEY
      ),
      registeredFcmTokensCount: fcmTokensCount,
      registeredFcmTokenCount: fcmTokensCount,
      sellerFcmTokenCount,
      buyerFcmTokenCount,
      inAppSellerNotificationsCount: sellerNotificationsCount,
      recentEvents,
      recentSystemEvents: recentEvents,
      checkedAt: new Date().toISOString(),
    },
  });
}
