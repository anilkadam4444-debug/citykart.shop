import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  LocalStore,
  OrderRecord,
  Product,
  SellerProfile,
} from '@/lib/catalog-data';
import {
  INITIAL_PRODUCTS,
  INITIAL_SELLERS,
  INITIAL_STORES,
} from '@/lib/initial-data';
import {
  BillingTransaction,
  FeaturedCampaign,
  MerchantSubscription,
  PlatformFeeLedgerEntry,
} from '@/lib/revenue-model';
import { serverOrdersRegistry } from '@/lib/orders-registry';
import { serverDeletedStoresRegistry } from '@/lib/stores-registry';
import { serverPlatformFeeLedgerRegistry } from '@/lib/fees';
import {
  serverStoreOverridesRegistry,
  verifyAuthenticatedCaller,
} from '@/lib/super-admin-auth';
import {
  calculateCityPartnerRevenueReport,
  hydratePartnerRegistriesFromFirestore,
  resolvePartnerStatusForUser,
  sanitizeApplicationForApplicantView,
  serverPartnerNotificationsRegistry,
  serverPartnerSettlementsRegistry,
  verifyPartnerCityAccess,
} from '@/lib/partner-program';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await hydratePartnerRegistriesFromFirestore();

  const caller = await verifyAuthenticatedCaller(req);
  if (!caller.authenticated) {
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        error: 'Authentication required to access the City Partner portal.',
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const requestedCityId = searchParams.get('cityId') || undefined;
  const periodMonth = searchParams.get('periodMonth') || 'ALL';

  const statusInfo = resolvePartnerStatusForUser({
    uid: caller.uid,
    phoneE164: caller.phoneE164,
  });

  const notifications = Array.from(
    serverPartnerNotificationsRegistry.values()
  )
    .filter(
      (n) =>
        n.recipientPhoneE164 === caller.phoneE164 ||
        (n.recipientUid && n.recipientUid === caller.uid)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // If the caller is not yet an active approved Partner, return only their application status
  if (!statusInfo.isActivePartner || !statusInfo.partnerRecord) {
    return NextResponse.json({
      ok: true,
      authenticated: true,
      isActivePartner: false,
      dashboardAccessAllowed: false,
      partnerRecord: statusInfo.partnerRecord,
      latestApplication: statusInfo.latestApplication
        ? sanitizeApplicationForApplicantView(statusInfo.latestApplication)
        : null,
      notifications,
    });
  }

  const partner = statusInfo.partnerRecord;

  // Enforce strict city-scoped access control (Partners can NEVER access another city)
  const accessCheck = verifyPartnerCityAccess(partner, requestedCityId);
  if (!accessCheck.allowed) {
    return NextResponse.json(
      {
        ok: false,
        authenticated: true,
        isActivePartner: true,
        dashboardAccessAllowed: false,
        error: accessCheck.error,
        assignedCityId: partner.assignedCityId,
      },
      { status: 403 }
    );
  }

  const assignedCityId = partner.assignedCityId.toLowerCase();

  // Load stores, sellers, products, orders, subscriptions, transactions, campaigns, and fee ledger
  const [
    fsStoresSnap,
    fsSellersSnap,
    fsProductsSnap,
    fsOrdersSnap,
    fsSubsSnap,
    fsTxSnap,
    fsCampaignsSnap,
    fsLedgerSnap,
  ] = await Promise.all([
    getDocs(collection(db, 'stores')).catch(() => null),
    getDocs(collection(db, 'sellers')).catch(() => null),
    getDocs(collection(db, 'products')).catch(() => null),
    getDocs(collection(db, 'orders')).catch(() => null),
    getDocs(collection(db, 'merchantSubscriptions')).catch(() => null),
    getDocs(collection(db, 'billingTransactions')).catch(() => null),
    getDocs(collection(db, 'featuredCampaigns')).catch(() => null),
    getDocs(collection(db, 'platformFeeLedger')).catch(() => null),
  ]);

  const deletedStoreIds = new Set<string>(serverDeletedStoresRegistry.keys());

  const storesMap = new Map<string, LocalStore>();
  for (const st of INITIAL_STORES) {
    if (!deletedStoreIds.has(st.id)) storesMap.set(st.id, { ...st });
  }
  fsStoresSnap?.forEach((d) => {
    const data = d.data() as LocalStore;
    if (data?.id && !deletedStoreIds.has(data.id)) storesMap.set(data.id, data);
  });
  for (const [storeId, override] of serverStoreOverridesRegistry.entries()) {
    const existing = storesMap.get(storeId);
    if (existing) {
      storesMap.set(storeId, {
        ...existing,
        isSuspended: override.isSuspended,
        isActive: override.isActive,
      });
    }
  }

  // Strictly filter stores to the partner's assigned canonical cityId
  const cityStores = Array.from(storesMap.values()).filter(
    (s) => (s.cityId || '').trim().toLowerCase() === assignedCityId
  );
  const cityStoreIdSet = new Set(cityStores.map((s) => s.id));
  const citySellerIdSet = new Set(cityStores.map((s) => s.sellerId));

  const sellersMap = new Map<string, SellerProfile>();
  for (const s of INITIAL_SELLERS) sellersMap.set(s.id, { ...s });
  fsSellersSnap?.forEach((d) => {
    const data = d.data() as SellerProfile;
    if (data?.id) sellersMap.set(data.id, data);
  });
  const citySellers = Array.from(sellersMap.values()).filter((s) =>
    citySellerIdSet.has(s.id)
  );

  const productsMap = new Map<string, Product>();
  for (const p of INITIAL_PRODUCTS) {
    if (!deletedStoreIds.has(p.storeId)) productsMap.set(p.id, { ...p });
  }
  fsProductsSnap?.forEach((d) => {
    const data = d.data() as Product;
    if (data?.id && !deletedStoreIds.has(data.storeId)) {
      productsMap.set(data.id, data);
    }
  });
  const cityProducts = Array.from(productsMap.values()).filter((p) =>
    cityStoreIdSet.has(p.storeId)
  );

  const ordersMap = new Map<string, OrderRecord>();
  for (const [id, ord] of serverOrdersRegistry.entries()) {
    ordersMap.set(id, ord);
  }
  fsOrdersSnap?.forEach((d) => {
    const data = d.data() as OrderRecord;
    if (data?.id) ordersMap.set(data.id, data);
  });
  const cityOrders = Array.from(ordersMap.values()).filter((o) =>
    cityStoreIdSet.has(o.storeId)
  );

  // Sanitize orders for partner view (protect private buyer street address & unmasked phone)
  const sanitizedCityOrders = cityOrders.map((o) => ({
    id: o.id,
    createdAt: o.createdAt,
    storeId: o.storeId,
    storeName: o.storeName,
    sellerId: o.sellerId,
    itemCount: Array.isArray(o.items)
      ? o.items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0)
      : 1,
    subtotal: o.subtotal,
    totalPlatformFee: o.totalPlatformFee || 0,
    total: o.total,
    paymentMethod: o.paymentMethod,
    orderStatus: o.orderStatus || 'PLACED',
    locality: o.customer?.locality || partner.assignedCityName,
    city: o.customer?.city || partner.assignedCityName,
  }));

  const subscriptionsMap = new Map<string, MerchantSubscription>();
  fsSubsSnap?.forEach((d) => {
    const data = d.data() as MerchantSubscription;
    if (data?.storeId && cityStoreIdSet.has(data.storeId)) {
      subscriptionsMap.set(data.storeId, data);
    }
  });

  const transactionsMap = new Map<string, BillingTransaction>();
  fsTxSnap?.forEach((d) => {
    const data = d.data() as BillingTransaction;
    if (data?.id) transactionsMap.set(data.id, data);
  });
  const allTransactions = Array.from(transactionsMap.values());

  const campaignsMap = new Map<string, FeaturedCampaign>();
  fsCampaignsSnap?.forEach((d) => {
    const data = d.data() as FeaturedCampaign;
    if (data?.id && cityStoreIdSet.has(data.storeId)) {
      campaignsMap.set(data.id, data);
    }
  });

  const ledgerMap = new Map<string, PlatformFeeLedgerEntry>();
  for (const [id, entry] of serverPlatformFeeLedgerRegistry.entries()) {
    ledgerMap.set(id, entry);
  }
  fsLedgerSnap?.forEach((d) => {
    const data = d.data() as PlatformFeeLedgerEntry;
    if (data?.id) ledgerMap.set(data.id, data);
  });
  const allLedgerEntries = Array.from(ledgerMap.values());

  // Calculate Lifetime & Selected Period 50/50 Revenue Reports for the Partner's City
  const lifetimeRevenueReport = calculateCityPartnerRevenueReport({
    cityId: partner.assignedCityId,
    cityName: partner.assignedCityName,
    periodMonth: 'ALL',
    currency: 'INR',
    partnerSharePercent: partner.revenueSharePercent,
    stores: cityStores,
    orders: cityOrders,
    transactions: allTransactions,
    platformFeeLedger: allLedgerEntries,
    campaigns: Array.from(campaignsMap.values()),
    subscriptions: Array.from(subscriptionsMap.values()),
  });

  const periodRevenueReport =
    periodMonth === 'ALL'
      ? lifetimeRevenueReport
      : calculateCityPartnerRevenueReport({
          cityId: partner.assignedCityId,
          cityName: partner.assignedCityName,
          periodMonth,
          currency: 'INR',
          partnerSharePercent: partner.revenueSharePercent,
          stores: cityStores,
          orders: cityOrders,
          transactions: allTransactions,
          platformFeeLedger: allLedgerEntries,
          campaigns: Array.from(campaignsMap.values()),
          subscriptions: Array.from(subscriptionsMap.values()),
        });

  // Partner's monthly settlement statements
  const settlements = Array.from(serverPartnerSettlementsRegistry.values())
    .filter((s) => s.partnerId === partner.id)
    .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth));

  return NextResponse.json({
    ok: true,
    authenticated: true,
    isActivePartner: true,
    dashboardAccessAllowed: true,
    partnerRecord: partner,
    cityMetrics: {
      assignedCityId: partner.assignedCityId,
      assignedCityName: partner.assignedCityName,
      assignedStateRegion: partner.assignedStateRegion,
      assignedCountry: partner.assignedCountry,
      totalSellersCount: citySellers.length,
      totalStoresCount: cityStores.length,
      activeStoresCount: cityStores.filter((s) => s.isActive && !s.isSuspended)
        .length,
      totalProductsCount: cityProducts.length,
      activePaidSubscriptionsCount: Array.from(
        subscriptionsMap.values()
      ).filter((sub) => sub.status === 'ACTIVE' && sub.planId !== 'FREE')
        .length,
      activeCampaignsCount: Array.from(campaignsMap.values()).filter(
        (c) => c.status === 'ACTIVE'
      ).length,
      totalOrdersCount: cityOrders.length,
      deliveredOrdersCount: cityOrders.filter(
        (o) => o.orderStatus === 'DELIVERED' || o.currentStepIndex >= 3
      ).length,
    },
    cityStores: cityStores.map((s) => ({
      id: s.id,
      name: s.name,
      sellerId: s.sellerId,
      sellerName: s.sellerName,
      category: s.category,
      neighborhood: s.neighborhood,
      cityName: s.cityName,
      cityId: s.cityId,
      isActive: s.isActive,
      isSuspended: Boolean(s.isSuspended),
      verifiedSince: s.verifiedSince,
      activeSkus: cityProducts.filter((p) => p.storeId === s.id).length,
      subscriptionTier: subscriptionsMap.get(s.id)?.planId || 'FREE',
    })),
    recentCityOrders: sanitizedCityOrders.slice(0, 50),
    lifetimeRevenueReport,
    periodRevenueReport,
    settlements,
    notifications,
  });
}
