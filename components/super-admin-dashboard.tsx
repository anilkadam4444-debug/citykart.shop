'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Globe,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
  Handshake,
} from 'lucide-react';
import { useUrbanDirect } from '@/components/urbandirect-provider';
import { AdminLocationManager } from '@/components/admin-location-manager';
import { AdminPartnerManagement } from '@/components/admin-partner-management';
import { CategoryIcon } from '@/components/category-icon';
import { auth, buildAuthenticatedHeaders, db, IS_PREVIEW_DUMMY_FIREBASE } from '@/lib/firebase';
import {
  collection,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  AUTHORITATIVE_STORE_CATEGORIES,
  formatCurrency,
  LocalStore,
  ORDER_STEPS,
  OrderRecord,
  Product,
  SellerProfile,
  CategoryDefinition as StoreCategoryDefinition,
  UserAccount,
} from '@/lib/catalog-data';
import {
  BillingTransaction,
  calculatePlatformRevenueMetrics,
  DEFAULT_SPONSORED_PLACEMENT_CONFIGS,
  FeaturedCampaign,
  MerchantServiceOrder,
  MerchantSubscription,
  SponsoredPlacementConfig,
  SubscriptionPlan as SubscriptionPlanDefinition,
  SubscriptionTierId as SubscriptionPlanId,
} from '@/lib/revenue-model';


type AdminSectionId =
  | 'dashboard'
  | 'analytics'
  | 'admin-management'
  | 'partners'
  | 'sellers-stores'
  | 'buyers'
  | 'products-categories'
  | 'orders'
  | 'subscriptions-plans'
  | 'payments-transactions'
  | 'notifications-status'
  | 'reports-audit-logs'
  | 'platform-settings'
  | 'super-admin-account';

type DateRangePreset = 'ALL' | 'TODAY' | '7D' | '30D' | 'CUSTOM';

export interface AdminAuthorizationRecord {
  id: string;
  phoneE164: string;
  name: string;
  designation: string;
  role: 'super_admin' | 'admin';
  status: 'INVITED' | 'ACTIVE' | 'REVOKED';
  isPermanentSuperAdmin: boolean;
  invitedByUid: string;
  invitedByPhone: string;
  invitedAt: string;
  activatedAt?: string;
  assignedUid?: string;
  lastLoginAt?: string;
  revokedAt?: string;
  revokedByUid?: string;
  revokedReason?: string;
  customClaimsSynced: boolean;
  updatedAt: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  actorUid: string;
  actorPhone: string;
  actorName: string;
  actorRole: 'super_admin' | 'admin';
  targetType:
    | 'STORE'
    | 'SELLER'
    | 'BUYER'
    | 'PRODUCT'
    | 'CATEGORY'
    | 'ORDER'
    | 'SUBSCRIPTION_PLAN'
    | 'PLATFORM_SETTINGS'
    | 'LOCATION'
    | 'ADMIN_USER'
    | 'PARTNER'
    | 'PARTNER_APPLICATION'
    | 'PARTNER_SETTLEMENT'
    | 'SYSTEM';
  targetId: string;
  targetLabel?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface PlatformSettingsState {
  platformName: string;
  domain: string;
  supportPhone: string;
  supportEmail: string;
  defaultCurrency: string;
  allowNewSellerRegistrations: boolean;
  requireLocationVerificationForNewStores: boolean;
  excludeDemoRecordsFromProductionMetrics: boolean;
  maintenanceBannerEnabled: boolean;
  maintenanceBannerMessage: string;
  updatedAt: string;
  updatedBy: string;
}

interface SystemHealthReport {
  firestoreStatus: 'OPERATIONAL' | 'DEGRADED';
  firestoreLatencyMs: number;
  firebaseAuthConfigured: boolean;
  fcmServerConfigured: boolean;
  fcmVapidConfigured: boolean;
  registeredFcmTokenCount: number;
  sellerFcmTokenCount: number;
  buyerFcmTokenCount: number;
  recentSystemEvents: Array<{
    id: string;
    type: 'AUTH' | 'NOTIFICATION' | 'WEBHOOK' | 'FIRESTORE' | 'ADMIN';
    severity: 'INFO' | 'WARNING' | 'ERROR';
    message: string;
    createdAt: string;
  }>;
}

interface DashboardPayload {
  ok: boolean;
  fetchedAt: string;
  isSuperAdmin?: boolean;
  adminRole?: 'super_admin' | 'admin';
  adminAuthorizations?: AdminAuthorizationRecord[];
  admin: {
    uid: string;
    phoneE164: string;
    displayName: string;
    role: 'super_admin' | 'admin';
    authSource: string;
  };
  sellers: SellerProfile[];
  stores: LocalStore[];
  products: Product[];
  orders: OrderRecord[];
  users: UserAccount[];
  categories: Array<StoreCategoryDefinition & { isActive: boolean }>;
  subscriptions: MerchantSubscription[];
  transactions: BillingTransaction[];
  campaigns: FeaturedCampaign[];
  serviceOrders: MerchantServiceOrder[];
  subscriptionPlans: SubscriptionPlanDefinition[];
  platformSettings: PlatformSettingsState;
  locationRequests: Array<{
    id: string;
    country: string;
    stateRegion: string;
    cityName: string;
    status: string;
    createdAt: string;
  }>;
  deletedStores: Array<{
    storeId: string;
    storeName: string;
    deletedAt: string;
    deletedByPhone?: string;
    reason?: string;
  }>;
  auditLogs: AuditLogEntry[];
  systemHealth: SystemHealthReport;
}

const DESIGNATED_OWNER_PHONE = '+918329306616';

export function SuperAdminDashboard() {
  const {
    authenticatedUser,
    setAuthenticatedUser,
    openOtpAuthModal,
    handleSignOutOtpSession,
    stores: providerStores,
    setStores: setProviderStores,
    products: providerProducts,
    setProducts: setProviderProducts,
    orders: providerOrders,
    sellers: providerSellers,
    permanentlyDeleteStore,
  } = useUrbanDirect();

  const [activeSection, setActiveSection] =
    useState<AdminSectionId>('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [excludeDemoRecords, setExcludeDemoRecords] = useState<boolean>(true);

  // Server Authorization & Bootstrap State
  const [authStatusLoading, setAuthStatusLoading] = useState<boolean>(true);
  const [isServerAuthorized, setIsServerAuthorized] = useState<boolean>(false);
  const [requiresBootstrap, setRequiresBootstrap] = useState<boolean>(false);
  const [bootstrapSecretInput, setBootstrapSecretInput] = useState<string>('');
  const [bootstrapLoading, setBootstrapLoading] = useState<boolean>(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [customClaimsConfigured, setCustomClaimsConfigured] =
    useState<boolean>(false);

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(
    null
  );
  const [isLoadingDashboard, setIsLoadingDashboard] = useState<boolean>(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  // Section-Specific Filter States
  const [storeSearch, setStoreSearch] = useState('');
  const [storeStatusFilter, setStoreStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'SUSPENDED' | 'UNVERIFIED' | 'DEMO'
  >('ALL');
  const [storeCategoryFilter, setStoreCategoryFilter] = useState('ALL');
  const [inspectedStoreId, setInspectedStoreId] = useState<string | null>(null);

  const [buyerSearch, setBuyerSearch] = useState('');
  const [buyerStatusFilter, setBuyerStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'SUSPENDED'
  >('ALL');
  const [inspectedBuyerId, setInspectedBuyerId] = useState<string | null>(null);

  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('ALL');
  const [productStateFilter, setProductStateFilter] = useState<
    'ALL' | 'PUBLISHED' | 'UNPUBLISHED' | 'OUT_OF_STOCK' | 'MISSING_IMAGE'
  >('ALL');
  const [productsSubTab, setProductsSubTab] = useState<
    'PRODUCTS' | 'CATEGORIES'
  >('PRODUCTS');

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<
    'ALL' | 'AWAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  >('ALL');
  const [orderPage, setOrderPage] = useState<number>(1);
  const [inspectedOrderId, setInspectedOrderId] = useState<string | null>(null);
  const [orderNoteDraft, setOrderNoteDraft] = useState<string>('');

  const [txStatusFilter, setTxStatusFilter] = useState<
    'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED'
  >('ALL');
  const [txTypeFilter, setTxTypeFilter] = useState<
    'ALL' | 'SUBSCRIPTION' | 'AD_CAMPAIGN' | 'SERVICE_ORDER'
  >('ALL');

  const [auditSearch, setAuditSearch] = useState('');
  const [auditTargetFilter, setAuditTargetFilter] = useState<string>('ALL');

  // Confirmation Modal State for Consequential Actions
  const [confirmModal, setConfirmModal] = useState<{
    type:
      | 'SUSPEND_STORE'
      | 'RESTORE_STORE'
      | 'DELETE_STORE'
      | 'SUSPEND_BUYER'
      | 'RESTORE_BUYER'
      | 'UNPUBLISH_PRODUCT'
      | 'RESTORE_PRODUCT';
    targetId: string;
    targetName: string;
    secondaryId?: string;
  } | null>(null);
  const [confirmReason, setConfirmReason] = useState<string>('');
  const [confirmStoreNameInput, setConfirmStoreNameInput] =
    useState<string>('');

  // Subscription Plan Editor State
  const [editingPlan, setEditingPlan] =
    useState<SubscriptionPlanDefinition | null>(null);
  const [planNameInput, setPlanNameInput] = useState<string>('');
  const [planTaglineInput, setPlanTaglineInput] = useState<string>('');
  const [planMonthlyPrice, setPlanMonthlyPrice] = useState<string>('0');
  const [planAnnualPrice, setPlanAnnualPrice] = useState<string>('0');
  const [planProductLimit, setPlanProductLimit] = useState<string>('25');
  const [planBadgeText, setPlanBadgeText] = useState<string>('');

  // Sponsored Product Placements & Campaigns State
  const [placementConfigs, setPlacementConfigs] = useState<
    SponsoredPlacementConfig[]
  >(() => Object.values(DEFAULT_SPONSORED_PLACEMENT_CONFIGS));
  const [adminCampaigns, setAdminCampaigns] = useState<FeaturedCampaign[]>([]);
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'REJECTED'
  >('ALL');
  const [isSavingPlacements, setIsSavingPlacements] = useState<boolean>(false);

  // Platform Settings Form State
  const [settingsDraft, setSettingsDraft] =
    useState<PlatformSettingsState | null>(null);

  // Admin Management & Authorization Governance State
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'INVITED' | 'REVOKED'
  >('ALL');
  const [showFullAdminPhones, setShowFullAdminPhones] = useState<boolean>(true);
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState<boolean>(false);
  const [addAdminCountryDialCode, setAddAdminCountryDialCode] = useState<string>('+91');
  const [addAdminSubscriberPhone, setAddAdminSubscriberPhone] = useState<string>('');
  const [addAdminName, setAddAdminName] = useState<string>('');
  const [addAdminDesignation, setAddAdminDesignation] = useState<string>('');
  const [addAdminRole, setAddAdminRole] = useState<'admin' | 'super_admin'>('admin');
  const [addAdminError, setAddAdminError] = useState<string | null>(null);

  const [adminToRevoke, setAdminToRevoke] = useState<AdminAuthorizationRecord | null>(null);
  const [revokeReasonInput, setRevokeReasonInput] = useState<string>('');

  const [adminToReactivate, setAdminToReactivate] = useState<AdminAuthorizationRecord | null>(null);
  const [adminToEdit, setAdminToEdit] = useState<AdminAuthorizationRecord | null>(null);
  const [editAdminName, setEditAdminName] = useState<string>('');
  const [editAdminDesignation, setEditAdminDesignation] = useState<string>('');

  // Helper to get fresh Firebase ID token + fallback session header if available
  const getAuthHeaders = useCallback(async (): Promise<
    Record<string, string>
  > => {
    try {
      return await buildAuthenticatedHeaders();
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  }, []);

  // Fetch Dashboard Payload from Server-Protected Route
  const fetchDashboardData = useCallback(async () => {
    setIsLoadingDashboard(true);
    setDashboardError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/dashboard', {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.requiresBootstrap) {
          setRequiresBootstrap(true);
          setIsServerAuthorized(false);
        } else {
          setDashboardError(
            data.error || 'Failed to load Super Admin dashboard data.'
          );
        }
        return;
      }
      setDashboardData(data as DashboardPayload);
      setSettingsDraft(data.platformSettings);
      setExcludeDemoRecords(
        Boolean(
          data.platformSettings?.excludeDemoRecordsFromProductionMetrics ?? true
        )
      );
      setIsServerAuthorized(true);
      setRequiresBootstrap(false);

      // Fetch Sponsored Product Campaigns & Placement Pricing
      fetch('/api/billing/campaigns?includeAll=true', {
        headers,
        cache: 'no-store',
      })
        .then((r) => r.json())
        .then((campData) => {
          if (campData?.ok) {
            if (Array.isArray(campData.campaigns)) {
              setAdminCampaigns(campData.campaigns);
            }
            if (Array.isArray(campData.placementConfigsList)) {
              setPlacementConfigs(campData.placementConfigsList);
            } else if (
              campData.placementConfigs &&
              typeof campData.placementConfigs === 'object'
            ) {
              setPlacementConfigs(Object.values(campData.placementConfigs));
            }
          }
        })
        .catch(() => {});
    } catch {
      setDashboardError(
        'Network error while communicating with Super Admin backend.'
      );
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [getAuthHeaders]);

  // Verify Super Admin Session Status on Mount & Auth Change
  const checkSuperAdminStatus = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/bootstrap', {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      const data = await res.json();
      setCustomClaimsConfigured(Boolean(data.customClaimsConfigured));

      if (data.authorized) {
        setIsServerAuthorized(true);
        setRequiresBootstrap(false);
        await fetchDashboardData();
      } else if (data.requiresBootstrap) {
        setIsServerAuthorized(false);
        setRequiresBootstrap(true);
      } else {
        // Attempt dashboard fetch for authorized additional administrators
        const dashHeaders = await getAuthHeaders();
        const dashRes = await fetch('/api/admin/dashboard', {
          method: 'GET',
          headers: dashHeaders,
          cache: 'no-store',
        });
        const dashData = await dashRes.json();
        if (dashRes.ok && dashData.ok) {
          setIsServerAuthorized(true);
          setRequiresBootstrap(false);
          setDashboardData(dashData as DashboardPayload);
          setSettingsDraft(dashData.platformSettings);
        } else {
          setIsServerAuthorized(false);
          setRequiresBootstrap(false);
        }
      }
    } catch {
      setIsServerAuthorized(false);
    } finally {
      setAuthStatusLoading(false);
    }
  }, [getAuthHeaders, fetchDashboardData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkSuperAdminStatus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authenticatedUser?.phoneE164, authenticatedUser?.id, checkSuperAdminStatus]);

  // Execute Server-Controlled Super Admin Bootstrap
  const handleBootstrapSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBootstrapLoading(true);
    setBootstrapError(null);
    try {
      const headers = await getAuthHeaders();
      const idToken = auth.currentUser
        ? await auth.currentUser.getIdToken().catch(() => undefined)
        : undefined;
      const res = await fetch('/api/admin/bootstrap', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bootstrapSecret: bootstrapSecretInput.trim() || undefined,
          idToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBootstrapError(
          data.error || 'Super Admin authorization bootstrap failed.'
        );
        return;
      }

      // Also persist /admins/{uid} via authenticated client if Firestore rules allow
      const resolvedAdmin = data.adminRecord || data.admin;
      if (resolvedAdmin?.uid && !IS_PREVIEW_DUMMY_FIREBASE && auth.currentUser) {
        try {
          await setDoc(
            doc(db, 'admins', resolvedAdmin.uid),
            {
              uid: resolvedAdmin.uid,
              phoneE164: DESIGNATED_OWNER_PHONE,
              displayName: 'Platform Owner',
              role: 'super_admin',
              platform: 'https://citykart.shop',
              status: 'ACTIVE',
              grantedAt: new Date().toISOString(),
              grantedBy: 'SERVER_BOOTSTRAP',
              lastVerifiedAt: new Date().toISOString(),
              customClaimsSynced: Boolean(resolvedAdmin.customClaimsSynced),
            },
            { merge: true }
          );
        } catch {
          // Server already recorded /admins/{uid}
        }
      }

      if (data.user) {
        setAuthenticatedUser(data.user);
      }
      setIsServerAuthorized(true);
      setRequiresBootstrap(false);
      setActionBanner({
        type: 'success',
        message:
          'Super Admin role (super_admin) verified and bound to your session.',
      });
      await fetchDashboardData();
    } catch {
      setBootstrapError(
        'Network error while bootstrapping Super Admin session.'
      );
    } finally {
      setBootstrapLoading(false);
    }
  };

  // Generic Server Admin Action Dispatcher
  const executeAdminAction = async (
    payload: Record<string, unknown>,
    successMsg: string
  ): Promise<boolean> => {
    setIsSubmittingAction(true);
    setActionBanner(null);
    try {
      const headers = await getAuthHeaders();
      const actionType = String(payload.action || '');
      const isGovernanceAction = [
        'INVITE_ADMIN',
        'REVOKE_ADMIN',
        'REACTIVATE_ADMIN',
        'UPDATE_ADMIN',
      ].includes(actionType);
      const targetEndpoint = isGovernanceAction
        ? '/api/admin/management'
        : '/api/admin/action';

      const res = await fetch(targetEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setActionBanner({
          type: 'error',
          message: data.error || 'Administrative operation failed.',
        });
        return false;
      }

      setActionBanner({
        type: 'success',
        message: data.message || successMsg,
      });
      await fetchDashboardData();
      return true;
    } catch {
      setActionBanner({
        type: 'error',
        message: 'Network error while executing administrative operation.',
      });
      return false;
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Merge live client provider state with server dashboard snapshot so real-time creations are reflected
  const mergedStores = useMemo(() => {
    const map = new Map<string, LocalStore>();
    for (const s of providerStores) {
      map.set(s.id, s);
    }
    for (const s of dashboardData?.stores || []) {
      map.set(s.id, { ...(map.get(s.id) || {}), ...s });
    }
    return Array.from(map.values());
  }, [providerStores, dashboardData?.stores]);

  const mergedProducts = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of providerProducts) {
      map.set(p.id, p);
    }
    for (const p of dashboardData?.products || []) {
      map.set(p.id, { ...(map.get(p.id) || {}), ...p });
    }
    return Array.from(map.values());
  }, [providerProducts, dashboardData?.products]);

  const mergedOrders = useMemo(() => {
    const map = new Map<string, OrderRecord>();
    for (const o of providerOrders) {
      map.set(o.id, o);
    }
    for (const o of dashboardData?.orders || []) {
      map.set(o.id, { ...(map.get(o.id) || {}), ...o });
    }
    return Array.from(map.values());
  }, [providerOrders, dashboardData?.orders]);

  const mergedSellers = useMemo(() => {
    const map = new Map<string, SellerProfile>();
    for (const s of providerSellers) {
      map.set(s.id, s);
    }
    for (const s of dashboardData?.sellers || []) {
      map.set(s.id, { ...(map.get(s.id) || {}), ...s });
    }
    return Array.from(map.values());
  }, [providerSellers, dashboardData?.sellers]);

  const mergedUsers = useMemo(() => {
    return dashboardData?.users || [];
  }, [dashboardData?.users]);

  // Date Range Filter Predicate
  const isWithinSelectedDateRange = useCallback(
    (isoDate?: string): boolean => {
      if (datePreset === 'ALL' || !isoDate) return true;
      const timestamp = new Date(isoDate).getTime();
      if (Number.isNaN(timestamp)) return true;

      const now = new Date();
      if (datePreset === 'TODAY') {
        const startOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        ).getTime();
        return timestamp >= startOfDay;
      }
      if (datePreset === '7D') {
        return timestamp >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
      }
      if (datePreset === '30D') {
        return timestamp >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
      }
      if (datePreset === 'CUSTOM') {
        const start = customStartDate
          ? new Date(customStartDate).getTime()
          : -Infinity;
        const end = customEndDate
          ? new Date(customEndDate).getTime() + 86399999
          : Infinity;
        return timestamp >= start && timestamp <= end;
      }
      return true;
    },
    [datePreset, customStartDate, customEndDate]
  );

  // Scoped datasets respecting Demo vs. Production toggle and Date Range
  const scopedStores = useMemo(() => {
    return mergedStores.filter((s) =>
      excludeDemoRecords ? !s.isDemo : true
    );
  }, [mergedStores, excludeDemoRecords]);

  const scopedStoreIdSet = useMemo(
    () => new Set(scopedStores.map((s) => s.id)),
    [scopedStores]
  );

  const scopedProducts = useMemo(() => {
    return mergedProducts.filter((p) =>
      excludeDemoRecords ? !p.isDemo && scopedStoreIdSet.has(p.storeId) : true
    );
  }, [mergedProducts, excludeDemoRecords, scopedStoreIdSet]);

  const scopedOrders = useMemo(() => {
    const seenOrderIds = new Set<string>();
    return mergedOrders.filter((o) => {
      if (seenOrderIds.has(o.id)) return false;
      seenOrderIds.add(o.id);
      if (excludeDemoRecords && o.storeId.startsWith('demo-')) return false;
      return isWithinSelectedDateRange(o.createdAt);
    });
  }, [mergedOrders, excludeDemoRecords, isWithinSelectedDateRange]);

  const scopedUsers = useMemo(() => {
    const seenPhones = new Set<string>();
    return mergedUsers.filter((u) => {
      if (seenPhones.has(u.phoneE164)) return false;
      seenPhones.add(u.phoneE164);
      return isWithinSelectedDateRange(u.createdAt);
    });
  }, [mergedUsers, isWithinSelectedDateRange]);

  const scopedTransactions = useMemo(() => {
    const seenTxIds = new Set<string>();
    return (dashboardData?.transactions || []).filter((tx) => {
      if (seenTxIds.has(tx.id)) return false;
      seenTxIds.add(tx.id);
      return isWithinSelectedDateRange(tx.createdAt);
    });
  }, [dashboardData?.transactions, isWithinSelectedDateRange]);

  const subscriptionMap = useMemo(() => {
    const map: Record<string, MerchantSubscription> = {};
    (dashboardData?.subscriptions || []).forEach((s) => {
      map[s.storeId] = s;
    });
    return map;
  }, [dashboardData?.subscriptions]);

  // Executive KPIs (Strictly Real, Deduped, Non-Fabricated) - Consistently derived via central utility
  const kpis = useMemo(() => {
    return calculatePlatformRevenueMetrics(
      scopedStores,
      subscriptionMap,
      scopedTransactions,
      'ALL', // already city-scoped in the datasets passed in
      {
        users: scopedUsers,
        products: scopedProducts,
        orders: scopedOrders,
        sellers: mergedSellers,
      }
    );
  }, [
    scopedStores,
    subscriptionMap,
    scopedTransactions,
    scopedUsers,
    scopedProducts,
    scopedOrders,
    mergedSellers,
  ]);

  // Super Admin Authorization & Governance State Derivations
  const isSuperAdmin = useMemo(() => {
    return (
      authenticatedUser?.phoneE164 === DESIGNATED_OWNER_PHONE ||
      dashboardData?.isSuperAdmin === true ||
      dashboardData?.adminRole === 'super_admin'
    );
  }, [authenticatedUser?.phoneE164, dashboardData?.isSuperAdmin, dashboardData?.adminRole]);

  const allAdminAuthorizations = useMemo((): AdminAuthorizationRecord[] => {
    const list = dashboardData?.adminAuthorizations || [];
    const hasOwner = list.some((a) => a.phoneE164 === DESIGNATED_OWNER_PHONE);
    if (!hasOwner) {
      return [
        {
          id: DESIGNATED_OWNER_PHONE,
          phoneE164: DESIGNATED_OWNER_PHONE,
          name: 'Platform Owner',
          designation: 'Chief Platform Administrator',
          role: 'super_admin',
          status: 'ACTIVE',
          isPermanentSuperAdmin: true,
          invitedByUid: 'SYSTEM_BOOTSTRAP',
          invitedByPhone: DESIGNATED_OWNER_PHONE,
          invitedAt: new Date().toISOString(),
          activatedAt: new Date().toISOString(),
          customClaimsSynced: true,
          updatedAt: new Date().toISOString(),
        },
        ...list,
      ];
    }
    return list;
  }, [dashboardData?.adminAuthorizations]);

  const filteredAdmins = useMemo(() => {
    return allAdminAuthorizations.filter((adm) => {
      if (adminStatusFilter !== 'ALL' && adm.status !== adminStatusFilter) {
        return false;
      }
      if (adminSearchQuery.trim()) {
        const q = adminSearchQuery.trim().toLowerCase();
        const matchesName = adm.name.toLowerCase().includes(q);
        const matchesPhone = adm.phoneE164.toLowerCase().includes(q);
        const matchesDesig = (adm.designation || '').toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesDesig;
      }
      return true;
    });
  }, [allAdminAuthorizations, adminStatusFilter, adminSearchQuery]);

  const adminAuditLogs = useMemo(() => {
    const logs = dashboardData?.auditLogs || [];
    return logs.filter(
      (l) =>
        l.targetType === 'ADMIN_USER' ||
        l.action.includes('ADMIN') ||
        l.action.includes('INVITE') ||
        l.action.includes('REVOKE')
    );
  }, [dashboardData?.auditLogs]);

  // Confirm Modal Execution Handler
  const handleConfirmConsequentialAction = async () => {
    if (!confirmModal) return;

    if (confirmModal.type === 'SUSPEND_STORE') {
      const ok = await executeAdminAction(
        {
          action: 'SUSPEND_STORE',
          storeId: confirmModal.targetId,
          reason:
            confirmReason.trim() || 'Suspended by Citykart Platform Owner.',
        },
        `Suspended store "${confirmModal.targetName}".`
      );
      if (ok) {
        if (!IS_PREVIEW_DUMMY_FIREBASE && auth.currentUser) {
          try {
            await updateDoc(doc(db, 'stores', confirmModal.targetId), {
              isActive: false,
              isSuspended: true,
              suspensionReason:
                confirmReason.trim() || 'Suspended by Citykart Platform Owner.',
              suspendedAt: new Date().toISOString(),
            });
          } catch {
            // Server registry updated
          }
        }
        setProviderStores((prev) =>
          prev.map((s) =>
            s.id === confirmModal.targetId
              ? {
                  ...s,
                  isActive: false,
                  isSuspended: true,
                  suspensionReason:
                    confirmReason.trim() ||
                    'Suspended by Citykart Platform Owner.',
                }
              : s
          )
        );
        setConfirmModal(null);
      }
    } else if (confirmModal.type === 'RESTORE_STORE') {
      const ok = await executeAdminAction(
        {
          action: 'RESTORE_STORE',
          storeId: confirmModal.targetId,
          reason:
            confirmReason.trim() || 'Restored by Citykart Platform Owner.',
        },
        `Restored store "${confirmModal.targetName}".`
      );
      if (ok) {
        if (!IS_PREVIEW_DUMMY_FIREBASE && auth.currentUser) {
          try {
            await updateDoc(doc(db, 'stores', confirmModal.targetId), {
              isActive: true,
              isSuspended: false,
              suspensionReason: '',
            });
          } catch {
            // Server registry updated
          }
        }
        setProviderStores((prev) =>
          prev.map((s) =>
            s.id === confirmModal.targetId
              ? { ...s, isActive: true, isSuspended: false }
              : s
          )
        );
        setConfirmModal(null);
      }
    } else if (confirmModal.type === 'DELETE_STORE') {
      const ok = await executeAdminAction(
        {
          action: 'DELETE_STORE',
          storeId: confirmModal.targetId,
          confirmationStoreName: confirmStoreNameInput.trim(),
          reason:
            confirmReason.trim() ||
            'Permanently deleted by Citykart Platform Owner.',
        },
        `Permanently deleted store "${confirmModal.targetName}".`
      );
      if (ok) {
        try {
          await permanentlyDeleteStore(confirmModal.targetId);
        } catch {
          // Handled by server tombstone
        }
        setInspectedStoreId(null);
        setConfirmModal(null);
      }
    } else if (confirmModal.type === 'SUSPEND_BUYER') {
      const ok = await executeAdminAction(
        {
          action: 'SUSPEND_BUYER',
          userId: confirmModal.targetId,
          phoneE164: confirmModal.secondaryId,
          reason:
            confirmReason.trim() ||
            'Account suspended by Citykart Platform Owner.',
        },
        `Suspended buyer account ${confirmModal.targetName}.`
      );
      if (ok) {
        if (!IS_PREVIEW_DUMMY_FIREBASE && auth.currentUser) {
          try {
            await updateDoc(doc(db, 'users', confirmModal.targetId), {
              accountStatus: 'SUSPENDED',
              suspensionReason:
                confirmReason.trim() ||
                'Account suspended by Citykart Platform Owner.',
              suspendedAt: new Date().toISOString(),
            });
          } catch {
            // Server registry updated
          }
        }
        setConfirmModal(null);
      }
    } else if (confirmModal.type === 'RESTORE_BUYER') {
      const ok = await executeAdminAction(
        {
          action: 'RESTORE_BUYER',
          userId: confirmModal.targetId,
          phoneE164: confirmModal.secondaryId,
          reason:
            confirmReason.trim() ||
            'Account restored by Citykart Platform Owner.',
        },
        `Restored buyer account ${confirmModal.targetName}.`
      );
      if (ok) {
        if (!IS_PREVIEW_DUMMY_FIREBASE && auth.currentUser) {
          try {
            await updateDoc(doc(db, 'users', confirmModal.targetId), {
              accountStatus: 'ACTIVE',
              suspensionReason: '',
            });
          } catch {
            // Server registry updated
          }
        }
        setConfirmModal(null);
      }
    } else if (confirmModal.type === 'UNPUBLISH_PRODUCT') {
      const ok = await executeAdminAction(
        {
          action: 'UNPUBLISH_PRODUCT',
          productId: confirmModal.targetId,
          reason:
            confirmReason.trim() ||
            'Unpublished from public discovery by Super Admin.',
        },
        `Unpublished product "${confirmModal.targetName}".`
      );
      if (ok) {
        if (!IS_PREVIEW_DUMMY_FIREBASE && auth.currentUser) {
          try {
            await updateDoc(doc(db, 'products', confirmModal.targetId), {
              isAvailable: false,
              adminUnpublished: true,
              unpublishReason:
                confirmReason.trim() ||
                'Unpublished from public discovery by Super Admin.',
              unpublishedAt: new Date().toISOString(),
            });
          } catch {
            // Server registry updated
          }
        }
        setProviderProducts((prev) =>
          prev.map((p) =>
            p.id === confirmModal.targetId
              ? {
                  ...p,
                  isAvailable: false,
                  adminUnpublished: true,
                  unpublishReason:
                    confirmReason.trim() ||
                    'Unpublished from public discovery by Super Admin.',
                }
              : p
          )
        );
        setConfirmModal(null);
      }
    } else if (confirmModal.type === 'RESTORE_PRODUCT') {
      const ok = await executeAdminAction(
        {
          action: 'RESTORE_PRODUCT',
          productId: confirmModal.targetId,
          reason: confirmReason.trim() || 'Restored to public discovery.',
        },
        `Restored product "${confirmModal.targetName}".`
      );
      if (ok) {
        if (!IS_PREVIEW_DUMMY_FIREBASE && auth.currentUser) {
          try {
            await updateDoc(doc(db, 'products', confirmModal.targetId), {
              isAvailable: true,
              adminUnpublished: false,
              unpublishReason: '',
            });
          } catch {
            // Server registry updated
          }
        }
        setProviderProducts((prev) =>
          prev.map((p) =>
            p.id === confirmModal.targetId
              ? { ...p, isAvailable: true, adminUnpublished: false }
              : p
          )
        );
        setConfirmModal(null);
      }
    }
  };

  // CSV Export Helper
  const downloadCsv = (
    filename: string,
    headers: string[],
    rows: string[][]
  ) => {
    const escapeCell = (val: string) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csvContent = [
      headers.map(escapeCell).join(','),
      ...rows.map((r) => r.map(escapeCell).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Global search results across stores, buyers, products, orders
  const globalSearchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return null;
    const matchedStores = mergedStores
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.sellerName.toLowerCase().includes(q) ||
          s.cityName.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      )
      .slice(0, 4);
    const matchedBuyers = mergedUsers
      .filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.phoneE164.toLowerCase().includes(q)
      )
      .slice(0, 4);
    const matchedProducts = mergedProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.storeName.toLowerCase().includes(q)
      )
      .slice(0, 4);
    const matchedOrders = mergedOrders
      .filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customer.fullName.toLowerCase().includes(q) ||
          o.customer.phone.toLowerCase().includes(q)
      )
      .slice(0, 4);
    return {
      matchedStores,
      matchedBuyers,
      matchedProducts,
      matchedOrders,
      total:
        matchedStores.length +
        matchedBuyers.length +
        matchedProducts.length +
        matchedOrders.length,
    };
  }, [globalSearch, mergedStores, mergedUsers, mergedProducts, mergedOrders]);

  const inspectedStore = useMemo(
    () => mergedStores.find((s) => s.id === inspectedStoreId) || null,
    [mergedStores, inspectedStoreId]
  );

  const inspectedBuyer = useMemo(
    () => mergedUsers.find((u) => u.id === inspectedBuyerId) || null,
    [mergedUsers, inspectedBuyerId]
  );

  const inspectedOrder = useMemo(
    () => mergedOrders.find((o) => o.id === inspectedOrderId) || null,
    [mergedOrders, inspectedOrderId]
  );

  // ============================================================================
  // GATE 1: LOADING INITIAL AUTH STATUS
  // ============================================================================
  if (authStatusLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#003B8E]/20 border border-[#003B8E]/40 flex items-center justify-center mx-auto">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
          <h1 className="text-lg font-extrabold tracking-tight">
            Verifying Super Admin Credentials
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Checking Firebase Phone Authentication session and server-controlled{' '}
            <code className="font-mono text-slate-200">super_admin</code> role
            for Citykart.shop...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // GATE 2: UNAUTHENTICATED — PROMPT FIREBASE PHONE OTP FOR +918329306616
  // ============================================================================
  if (!authenticatedUser) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col justify-between p-6">
        <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/citykart-icon.png"
              alt="Citykart"
              width={36}
              height={36}
              className="w-9 h-9 object-contain"
            />
            <div>
              <span className="text-lg font-extrabold tracking-tight text-white">
                City<span className="text-[#F96302]">kart</span>
              </span>
              <span className="ml-2 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Super Admin
              </span>
            </div>
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-slate-300 hover:text-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/80"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Marketplace</span>
          </Link>
        </header>

        <main className="max-w-lg w-full mx-auto my-12 bg-slate-900/95 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#003B8E] text-white flex items-center justify-center shrink-0 shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#F96302] font-bold">
                Platform Owner Console
              </div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Super Admin Authentication Required
              </h1>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            This console provides centralized governance over sellers, stores,
            buyers, products, subscriptions, orders, and platform health on{' '}
            <strong className="text-white">https://citykart.shop</strong>.
          </p>

          <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Designated Owner Identity</span>
              <span className="font-bold text-white">Platform Owner</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Authorized Mobile Number</span>
              <span className="font-mono font-bold text-emerald-400">
                {DESIGNATED_OWNER_PHONE}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Required Server Role</span>
              <span className="font-mono font-bold text-blue-400">
                super_admin
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() =>
                openOtpAuthModal({
                  defaultJourney: 'BUYER',
                  authContextMode: 'BUYER_SIGN_IN',
                })
              }
              className="w-full py-3.5 px-5 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg"
            >
              <Phone className="w-4 h-4" />
              <span>Sign In with Verified Owner Mobile OTP</span>
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Protected by Firebase Phone Authentication, server-signed HttpOnly
              session verification, and immutable audit logging.
            </p>
          </div>
        </main>

        <footer className="text-center text-[11px] text-slate-500">
          Citykart.shop Global Hyperlocal Marketplace · Zero-Trust Super Admin
          Gateway
        </footer>
      </div>
    );
  }

  // ============================================================================
  // GATE 3: AUTHENTICATED AS NON-ADMIN USER (ORDINARY BUYER OR SELLER) — 403 ACCESS DENIED
  // ============================================================================
  const isAuthorizedAdminUser =
    authenticatedUser.phoneE164 === DESIGNATED_OWNER_PHONE ||
    authenticatedUser.isAdmin === true ||
    authenticatedUser.role === 'admin' ||
    authenticatedUser.role === 'super_admin' ||
    (Array.isArray(authenticatedUser.roles) &&
      authenticatedUser.roles.includes('ADMIN'));

  if (!isAuthorizedAdminUser && !isServerAuthorized) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-slate-900 border border-rose-500/30 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-rose-400 font-bold">
                HTTP 403 · Access Denied
              </div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Restricted to Authorized Administrators
              </h1>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Your currently signed-in account (
            <span className="font-mono font-bold text-white">
              {authenticatedUser.phoneE164}
            </span>{' '}
            · {authenticatedUser.fullName}) is not authorized for administrator access.
            Only the Platform Owner (<code className="font-mono text-emerald-400">+918329306616</code>)
            and administrators authorized by the Super Admin can access platform management routes.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Link
              href="/"
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold text-center transition-colors"
            >
              Return to Buyer Marketplace
            </Link>
            <Link
              href="/seller"
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold text-center transition-colors"
            >
              Go to Seller Dashboard
            </Link>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Are you an authorized administrator?</span>
            <button
              type="button"
              onClick={handleSignOutOtpSession}
              className="text-rose-400 hover:text-rose-300 font-semibold underline cursor-pointer"
            >
              Sign out &amp; switch mobile number
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // GATE 4: OWNER PHONE VERIFIED (+918329306616), SERVER ROLE BOOTSTRAP STEP
  // ("A phone number match by itself must not grant administrative access.")
  // ============================================================================
  if (
    authenticatedUser.phoneE164 === DESIGNATED_OWNER_PHONE &&
    (!isServerAuthorized || requiresBootstrap)
  ) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                Step 2 of 2 · Server Role Authorization
              </div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Activate Trusted Super Admin Role
              </h1>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Your mobile identity{' '}
            <span className="font-mono font-bold text-emerald-400">
              {authenticatedUser.phoneE164}
            </span>{' '}
            is verified via Firebase Phone Authentication. Per Citykart
            zero-trust security policy, a phone number match alone does not
            grant administrative access until the server-controlled{' '}
            <code className="font-mono text-blue-300">super_admin</code> role
            bootstrap is completed.
          </p>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="font-bold text-slate-200">
              What this server bootstrap operation performs:
            </div>
            <ul className="space-y-1.5 text-slate-400 list-disc list-inside">
              <li>
                Verifies your cryptographic session &amp; Firebase UID on the
                backend.
              </li>
              <li>
                Assigns <code className="font-mono text-white">super_admin</code>{' '}
                in Firestore <code className="font-mono">/admins/&#123;uid&#125;</code>{' '}
                and syncs Firebase Custom Claims via Application Default
                Credentials (ADC) when supported.
              </li>
              <li>
                Mints an upgraded HttpOnly{' '}
                <code className="font-mono">urbandirect_session</code> cookie
                with <code className="font-mono">superAdminAuthorized: true</code>.
              </li>
              <li>
                Records an immutable{' '}
                <code className="font-mono">SUPER_ADMIN_BOOTSTRAP</code> entry
                in <code className="font-mono">/auditLogs</code>.
              </li>
            </ul>
          </div>

          {bootstrapError && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{bootstrapError}</span>
            </div>
          )}

          <form onSubmit={handleBootstrapSuperAdmin} className="space-y-4">
            <div>
              <label
                htmlFor="bootstrap-secret"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Optional Server Bootstrap Passphrase (only if{' '}
                <code className="font-mono">SUPER_ADMIN_BOOTSTRAP_SECRET</code>{' '}
                is set in environment)
              </label>
              <input
                id="bootstrap-secret"
                type="password"
                value={bootstrapSecretInput}
                onChange={(e) => setBootstrapSecretInput(e.target.value)}
                placeholder="Leave blank if not configured in server environment"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={bootstrapLoading}
                className="flex-1 py-3 px-5 rounded-xl bg-[#003B8E] hover:bg-[#0047AB] disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {bootstrapLoading
                    ? 'Authorizing super_admin role...'
                    : 'Authorize & Grant super_admin Role'}
                </span>
              </button>
              <Link
                href="/"
                className="py-3 px-4 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-xs font-semibold text-slate-300"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN AUTHORIZED SUPER ADMIN WORKSPACE
  // ============================================================================
  const sidebarGroups: Array<{
    groupLabel: string;
    items: Array<{
      id: AdminSectionId;
      label: string;
      icon: React.ElementType;
      badge?: string | number;
    }>;
  }> = [
    {
      groupLabel: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      ],
    },
    {
      groupLabel: 'Marketplace',
      items: [
        {
          id: 'sellers-stores',
          label: 'Sellers & Stores',
          icon: Store,
          badge: scopedStores.length,
        },
        {
          id: 'buyers',
          label: 'Buyers',
          icon: Users,
          badge: kpis.buyersCount,
        },
        {
          id: 'products-categories',
          label: 'Products & Categories',
          icon: Package,
          badge: scopedProducts.length,
        },
        {
          id: 'orders',
          label: 'Orders',
          icon: ShoppingBag,
          badge: kpis.awaitingOrders > 0 ? `${kpis.awaitingOrders} new` : scopedOrders.length,
        },
      ],
    },
    {
      groupLabel: 'Revenue',
      items: [
        {
          id: 'subscriptions-plans',
          label: 'Subscriptions & Plans',
          icon: Sparkles,
          badge: kpis.activePaidSubscriptions,
        },
        {
          id: 'payments-transactions',
          label: 'Payments & Transactions',
          icon: CreditCard,
          badge: scopedTransactions.length,
        },
      ],
    },
    {
      groupLabel: 'Operations',
      items: [
        {
          id: 'notifications-status',
          label: 'Notifications & System Status',
          icon: Activity,
        },
        {
          id: 'reports-audit-logs',
          label: 'Reports & Audit Logs',
          icon: FileText,
          badge: (dashboardData?.auditLogs || []).length,
        },
      ],
    },
    {
      groupLabel: 'Configuration',
      items: [
        {
          id: 'platform-settings',
          label: 'Platform Settings',
          icon: Settings,
        },
        {
          id: 'super-admin-account',
          label: 'Super Admin Account',
          icon: ShieldCheck,
        },
      ],
    },
    ...(isAuthorizedAdminUser
      ? [
          {
            groupLabel: 'Governance',
            items: [
              {
                id: 'partners' as AdminSectionId,
                label: 'City Partners',
                icon: Handshake,
                badge: '50/50',
              },
              {
                id: 'admin-management' as AdminSectionId,
                label: 'Admin Management',
                icon: ShieldCheck,
                badge: dashboardData?.adminAuthorizations?.length,
              },
            ],
          },
        ]
      : []),
  ];

  const activeSectionMeta = sidebarGroups
    .flatMap((g) => g.items.map((item) => ({ ...item, group: g.groupLabel })))
    .find((i) => i.id === activeSection);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col lg:flex-row">
      {/* ====================================================================
          PERSISTENT LEFT NAVIGATION SIDEBAR (DESKTOP) & TOP NAV (MOBILE)
         ==================================================================== */}
      <aside className="w-full lg:w-64 xl:w-72 bg-[#0B1120] text-slate-200 shrink-0 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto z-30">
        <div>
          {/* Brand Identity Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800/90 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <Image
                src="/citykart-icon.png"
                alt="Citykart"
                width={34}
                height={34}
                className="w-8 h-8 object-contain"
              />
              <div>
                <div className="text-base font-extrabold tracking-tight leading-none text-white">
                  City<span className="text-[#F96302]">kart</span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    .shop
                  </span>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-semibold mt-0.5">
                  Super Admin Console
                </div>
              </div>
            </Link>

            <Link
              href="/"
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 inline-flex items-center gap-1 transition-colors"
              title="Open Public Storefront"
            >
              <span>Storefront</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Verified Owner Identity Badge */}
          <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  Platform Owner
                </div>
                <div className="text-[11px] font-mono text-emerald-400 truncate">
                  {DESIGNATED_OWNER_PHONE}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
              super_admin
            </span>
          </div>

          {/* Grouped Navigation Menu */}
          <nav
            aria-label="Super Admin Sidebar Navigation"
            className="p-3 space-y-5 overflow-x-auto lg:overflow-x-visible"
          >
            {sidebarGroups.map((group) => (
              <div key={group.groupLabel}>
                <div className="px-3 mb-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                  {group.groupLabel}
                </div>
                <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-[#003B8E] text-white shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                              active
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="hidden lg:flex flex-col gap-2 p-4 border-t border-slate-800 bg-slate-950/60 text-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Firestore Health</span>
            <span className="inline-flex items-center gap-1 font-mono text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {dashboardData?.systemHealth.firestoreLatencyMs ?? 12}ms
            </span>
          </div>
          <button
            type="button"
            onClick={handleSignOutOtpSession}
            className="w-full mt-1 py-2 px-3 rounded-xl border border-slate-800 hover:bg-rose-950/50 hover:border-rose-700/50 text-slate-300 hover:text-rose-200 font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Super Admin</span>
          </button>
        </div>
      </aside>

      {/* ====================================================================
          STRUCTURED MAIN WORKSPACE
         ==================================================================== */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Top Operational Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Breadcrumb & Active Section Title */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <span>Super Admin</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span>{activeSectionMeta?.group}</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="text-[#003B8E] font-bold">
                  {activeSectionMeta?.label}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                {activeSectionMeta?.label}
              </h1>
            </div>

            {/* Global Search + Date Filter + Demo Filter + Refresh */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Global Search */}
              <div className="relative w-60 sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Jump to store, seller, buyer, order..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E] focus:bg-white text-slate-900"
                />
                {globalSearch && (
                  <button
                    type="button"
                    onClick={() => setGlobalSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Global Search Dropdown Results */}
                {globalSearchResults && (
                  <div className="absolute right-0 mt-1.5 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 space-y-3 text-xs max-h-96 overflow-y-auto">
                    {globalSearchResults.total === 0 ? (
                      <div className="text-slate-500 py-3 text-center">
                        No matching records for &ldquo;{globalSearch}&rdquo;
                      </div>
                    ) : (
                      <>
                        {globalSearchResults.matchedStores.length > 0 && (
                          <div>
                            <div className="text-[10px] font-mono uppercase text-slate-400 font-bold mb-1">
                              Stores ({globalSearchResults.matchedStores.length})
                            </div>
                            {globalSearchResults.matchedStores.map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => {
                                  setActiveSection('sellers-stores');
                                  setInspectedStoreId(st.id);
                                  setGlobalSearch('');
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center justify-between gap-2 cursor-pointer"
                              >
                                <span className="font-semibold text-slate-900 truncate">
                                  {st.name}
                                </span>
                                <span className="text-[11px] text-slate-500 shrink-0">
                                  {st.cityName}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {globalSearchResults.matchedBuyers.length > 0 && (
                          <div>
                            <div className="text-[10px] font-mono uppercase text-slate-400 font-bold mb-1">
                              Buyers ({globalSearchResults.matchedBuyers.length})
                            </div>
                            {globalSearchResults.matchedBuyers.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setActiveSection('buyers');
                                  setInspectedBuyerId(u.id);
                                  setGlobalSearch('');
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center justify-between gap-2 cursor-pointer"
                              >
                                <span className="font-semibold text-slate-900 truncate">
                                  {u.fullName}
                                </span>
                                <span className="font-mono text-[11px] text-slate-500 shrink-0">
                                  {u.phoneE164}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {globalSearchResults.matchedProducts.length > 0 && (
                          <div>
                            <div className="text-[10px] font-mono uppercase text-slate-400 font-bold mb-1">
                              Products ({globalSearchResults.matchedProducts.length})
                            </div>
                            {globalSearchResults.matchedProducts.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setActiveSection('products-categories');
                                  setProductSearch(p.name);
                                  setGlobalSearch('');
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center justify-between gap-2 cursor-pointer"
                              >
                                <span className="font-semibold text-slate-900 truncate">
                                  {p.name}
                                </span>
                                <span className="font-mono text-[11px] text-slate-600 shrink-0">
                                  {formatCurrency(p.price, p.currency)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {globalSearchResults.matchedOrders.length > 0 && (
                          <div>
                            <div className="text-[10px] font-mono uppercase text-slate-400 font-bold mb-1">
                              Orders ({globalSearchResults.matchedOrders.length})
                            </div>
                            {globalSearchResults.matchedOrders.map((o) => (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => {
                                  setActiveSection('orders');
                                  setInspectedOrderId(o.id);
                                  setGlobalSearch('');
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center justify-between gap-2 cursor-pointer"
                              >
                                <span className="font-mono font-semibold text-slate-900">
                                  {o.id}
                                </span>
                                <span className="text-[11px] text-slate-500 truncate">
                                  {o.customer.fullName} · {formatCurrency(o.total)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Date Range Selector */}
              <select
                aria-label="Date range filter"
                value={datePreset}
                onChange={(e) =>
                  setDatePreset(e.target.value as DateRangePreset)
                }
                className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl text-slate-800"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today</option>
                <option value="7D">Last 7 Days</option>
                <option value="30D">Last 30 Days</option>
                <option value="CUSTOM">Custom Range</option>
              </select>

              {datePreset === 'CUSTOM' && (
                <div className="flex items-center gap-1.5 text-xs">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded-lg text-xs"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              )}

              {/* Exclude Demo Records Toggle */}
              <button
                type="button"
                onClick={() => setExcludeDemoRecords((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  excludeDemoRecords
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
                title="Toggle exclusion of Nanded demo batch stores/products from production metrics"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>
                  {excludeDemoRecords
                    ? 'Production Only'
                    : 'Including Demo Data'}
                </span>
              </button>

              {/* Refresh Data Button */}
              <button
                type="button"
                onClick={fetchDashboardData}
                disabled={isLoadingDashboard}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isLoadingDashboard ? 'animate-spin text-[#003B8E]' : ''
                  }`}
                />
                <span>Refresh</span>
              </button>

            </div>
          </div>
        </header>

        {/* Action Status Feedback Banner */}
        {actionBanner && (
          <div
            className={`mx-4 sm:mx-6 lg:mx-8 mt-4 p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              actionBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {actionBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
              )}
              <span>{actionBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionBanner(null)}
              className="underline font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {dashboardError && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between">
            <span>{dashboardError}</span>
            <button
              type="button"
              onClick={fetchDashboardData}
              className="px-3 py-1 rounded-lg bg-rose-700 text-white font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Workspace Section Content */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1">
          {/* ================================================================
              SECTION 1: EXECUTIVE DASHBOARD OVERVIEW
             ================================================================ */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {/* Primary 4-Card Executive Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span>Active Local Stores</span>
                    <Store className="w-4 h-4 text-[#003B8E]" />
                  </div>
                  <div className="mt-2 text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900">
                    {kpis.activeStoresCount}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Registered Sellers: <strong>{kpis.sellersCount}</strong>
                    </span>
                    {kpis.suspendedStoresCount > 0 && (
                      <span className="text-amber-700 font-semibold">
                        {kpis.suspendedStoresCount} suspended
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span>Published Products</span>
                    <Package className="w-4 h-4 text-[#003B8E]" />
                  </div>
                  <div className="mt-2 text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900">
                    {kpis.publishedProductsCount}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Registered Buyers: <strong>{kpis.buyersCount}</strong>
                    </span>
                    {kpis.unpublishedProductsCount > 0 && (
                      <span className="text-rose-700 font-semibold">
                        {kpis.unpublishedProductsCount} unpublished
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span>Marketplace Orders ({datePreset})</span>
                    <ShoppingBag className="w-4 h-4 text-[#F96302]" />
                  </div>
                  <div className="mt-2 text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900">
                    {kpis.totalOrders}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Gross Order Value:{' '}
                      <strong className="font-mono text-slate-800">
                        {formatCurrency(kpis.grossOrderValueGmv)}
                      </strong>
                    </span>
                    <span className="text-slate-400">Direct Seller GMV</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span>Net Platform Revenue ({datePreset})</span>
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="mt-2 text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-emerald-700">
                    {formatCurrency(kpis.netPlatformCollections)}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Active Paid Plans:{' '}
                      <strong>{kpis.activePaidSubscriptions}</strong>
                    </span>
                    <span className="font-mono">
                      Subs: {formatCurrency(kpis.subscriptionRevenueCollected)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Pipeline + Financial Accounting Separation */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Order Fulfillment Funnel */}
                <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900">
                        Order Lifecycle Breakdown
                      </h2>
                      <p className="text-xs text-slate-500">
                        Real-time status across all deduplicated orders in the
                        selected period
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('orders')}
                      className="text-xs font-bold text-[#003B8E] hover:underline cursor-pointer"
                    >
                      Inspect Orders →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80">
                      <div className="text-[11px] font-semibold text-amber-900">
                        Awaiting Acceptance
                      </div>
                      <div className="mt-1 text-xl font-extrabold font-mono tabular-nums text-amber-950">
                        {kpis.awaitingOrders}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80">
                      <div className="text-[11px] font-semibold text-blue-900">
                        In Progress / Transit
                      </div>
                      <div className="mt-1 text-xl font-extrabold font-mono tabular-nums text-blue-950">
                        {kpis.inProgressOrders}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                      <div className="text-[11px] font-semibold text-emerald-900">
                        Completed / Delivered
                      </div>
                      <div className="mt-1 text-xl font-extrabold font-mono tabular-nums text-emerald-950">
                        {kpis.completedOrders}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/80">
                      <div className="text-[11px] font-semibold text-rose-900">
                        Cancelled
                      </div>
                      <div className="mt-1 text-xl font-extrabold font-mono tabular-nums text-rose-950">
                        {kpis.cancelledOrders}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong>Accounting Rule:</strong> Gross Order Value (
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(kpis.grossOrderValueGmv)}
                      </span>
                      ) is settled directly between buyers and local stores via
                      UPI/Cash on Delivery (0% commission).
                    </span>
                  </div>
                </div>

                {/* Platform Monetization Ledger Summary */}
                <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900">
                        Platform Revenue &amp; Billing Health
                      </h2>
                      <p className="text-xs text-slate-500">
                        Citykart SaaS subscriptions, promoted campaigns &amp;
                        services
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('payments-transactions')}
                      className="text-xs font-bold text-[#003B8E] hover:underline cursor-pointer"
                    >
                      Ledger →
                    </button>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">
                        Subscription Revenue Collected
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(kpis.subscriptionRevenueCollected)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">
                        Promoted Campaigns &amp; Services
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(kpis.adAndServiceRevenueCollected)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">Refunds Issued</span>
                      <span className="font-mono font-bold text-rose-700">
                        -{formatCurrency(kpis.totalRefunds)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-bold text-slate-900">
                        Net Platform Collections
                      </span>
                      <span className="font-mono text-sm font-extrabold text-emerald-700">
                        {formatCurrency(kpis.netPlatformCollections)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Successful Tx: <strong>{kpis.successfulTxCount}</strong>
                    </span>
                    <span>
                      Failed Tx:{' '}
                      <strong
                        className={
                          kpis.failedTxCount > 0 ? 'text-rose-600' : ''
                        }
                      >
                        {kpis.failedTxCount}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Orders & Recent Administrative Audit Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Orders */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Recent Marketplace Orders
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveSection('orders')}
                      className="text-xs font-bold text-[#003B8E] hover:underline cursor-pointer"
                    >
                      View all ({scopedOrders.length})
                    </button>
                  </div>
                  {scopedOrders.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No orders recorded for the selected time range.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {scopedOrders.slice(0, 5).map((ord) => (
                        <div
                          key={ord.id}
                          className="py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-slate-900">
                              {ord.id}{' '}
                              <span className="font-sans font-normal text-slate-500">
                                · {ord.storeName}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              Buyer: {ord.customer.fullName} ({ord.customer.phone})
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-slate-900">
                              {formatCurrency(ord.total)}
                            </div>
                            <div className="text-[10px] font-semibold text-blue-700">
                              {ord.orderStatus === 'CANCELLED'
                                ? 'Cancelled'
                                : ORDER_STEPS[ord.currentStepIndex] ||
                                  'Order Placed'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Audit Events */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Recent Super Admin Audit Trail
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveSection('reports-audit-logs')}
                      className="text-xs font-bold text-[#003B8E] hover:underline cursor-pointer"
                    >
                      Full Audit Log →
                    </button>
                  </div>
                  {(dashboardData?.auditLogs || []).length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No administrative mutations logged yet in this session.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {(dashboardData?.auditLogs || [])
                        .slice(0, 5)
                        .map((log) => (
                          <div key={log.id} className="py-2.5 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[11px] font-bold text-[#003B8E]">
                                {log.action}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {new Date(log.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-slate-700">{log.summary}</div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              SECTION 2: ANALYTICS
             ================================================================ */}
          {activeSection === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* City & Geography Store Distribution */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Active Store &amp; Order Density by City
                    </h2>
                    <p className="text-xs text-slate-500">
                      Computed directly from registered stores, products, and
                      completed orders
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-3 font-semibold">
                            City / State
                          </th>
                          <th className="py-2 px-3 font-semibold text-right">
                            Stores
                          </th>
                          <th className="py-2 px-3 font-semibold text-right">
                            Products
                          </th>
                          <th className="py-2 pl-3 font-semibold text-right">
                            Orders (GMV)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Array.from(
                          scopedStores.reduce((acc, st) => {
                            const key = `${st.cityName}, ${st.stateRegion || st.country}`;
                            const entry = acc.get(key) || {
                              cityLabel: key,
                              stores: 0,
                              products: 0,
                              orders: 0,
                              gmv: 0,
                            };
                            entry.stores += 1;
                            entry.products += scopedProducts.filter(
                              (p) => p.storeId === st.id
                            ).length;
                            const stOrders = scopedOrders.filter(
                              (o) =>
                                o.storeId === st.id &&
                                o.orderStatus !== 'CANCELLED'
                            );
                            entry.orders += stOrders.length;
                            entry.gmv += stOrders.reduce(
                              (s, o) => s + o.total,
                              0
                            );
                            acc.set(key, entry);
                            return acc;
                          }, new Map<string, { cityLabel: string; stores: number; products: number; orders: number; gmv: number }>())
                        )
                          .map(([, v]) => v)
                          .sort((a, b) => b.stores - a.stores)
                          .map((row) => (
                            <tr key={row.cityLabel}>
                              <td className="py-2.5 pr-3 font-semibold text-slate-900">
                                {row.cityLabel}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                {row.stores}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                {row.products}
                              </td>
                              <td className="py-2.5 pl-3 text-right font-mono">
                                {row.orders} ({formatCurrency(row.gmv)})
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Categories by Store & Product Coverage */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Category Coverage Across 25 Store Categories
                    </h2>
                    <p className="text-xs text-slate-500">
                      Real storefront and SKU distribution across Citykart
                      taxonomy
                    </p>
                  </div>
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {AUTHORITATIVE_STORE_CATEGORIES.map((cat) => {
                      const catStores = scopedStores.filter(
                        (s) =>
                          s.categoryId === cat.id || s.category === cat.name
                      ).length;
                      const catProducts = scopedProducts.filter(
                        (p) =>
                          p.categoryId === cat.id || p.category === cat.name
                      ).length;
                      const widthPct = Math.min(
                        100,
                        Math.round(
                          (catProducts / Math.max(1, scopedProducts.length)) *
                            100 *
                            4
                        )
                      );
                      return (
                        <div key={cat.id} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-800 truncate">
                              {cat.name}
                            </span>
                            <span className="font-mono text-[11px] text-slate-600 shrink-0">
                              {catStores} stores · {catProducts} SKUs
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-[#003B8E] rounded-full"
                              style={{ width: `${Math.max(4, widthPct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              SECTION 3: ADMIN MANAGEMENT & AUTHORIZATION GOVERNANCE (SUPER ADMIN ONLY)
             ================================================================ */}
          {activeSection === 'admin-management' && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-[#0B1120] to-[#002D6E] border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-mono uppercase tracking-widest font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Super Admin Governance</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Admin Management &amp; Mobile Authorizations
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Authorize additional team members as platform administrators using their mobile numbers.
                    Invited administrators authenticate via Firebase Phone OTP and receive administrative access automatically.
                  </p>
                </div>

                <div className="shrink-0 flex flex-wrap items-center gap-3">
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddAdminError(null);
                        setAddAdminSubscriberPhone('');
                        setAddAdminName('');
                        setAddAdminDesignation('');
                        setIsAddAdminModalOpen(true);
                      }}
                      className="py-3 px-5 rounded-2xl bg-[#F96302] hover:bg-[#E05500] text-white text-xs font-extrabold inline-flex items-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-orange-500/20 active:scale-95"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Authorize Administrator</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={fetchDashboardData}
                    className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDashboard ? 'animate-spin' : ''}`} />
                    <span>Refresh Registry</span>
                  </button>
                </div>
              </div>

              {/* KPI Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <div className="text-slate-500 text-xs font-semibold flex items-center justify-between">
                    <span>Total Administrators</span>
                    <Users className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {allAdminAuthorizations.length}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Includes 1 permanent Platform Owner
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <div className="text-slate-500 text-xs font-semibold flex items-center justify-between">
                    <span>Active Administrators</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-emerald-600 font-mono">
                    {allAdminAuthorizations.filter((a) => a.status === 'ACTIVE').length}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-medium">
                    Verified OTP session active
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <div className="text-slate-500 text-xs font-semibold flex items-center justify-between">
                    <span>Pending Invitations</span>
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-amber-600 font-mono">
                    {allAdminAuthorizations.filter((a) => a.status === 'INVITED').length}
                  </div>
                  <div className="text-[11px] text-amber-700 font-medium">
                    Awaiting initial OTP sign-in
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <div className="text-slate-500 text-xs font-semibold flex items-center justify-between">
                    <span>Revoked Access</span>
                    <UserX className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-2xl font-black text-rose-600 font-mono">
                    {allAdminAuthorizations.filter((a) => a.status === 'REVOKED').length}
                  </div>
                  <div className="text-[11px] text-rose-700 font-medium">
                    Access revoked by Platform Owner
                  </div>
                </div>
              </div>

              {/* Toolbar & Filters */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="relative w-full sm:w-96">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={adminSearchQuery}
                      onChange={(e) => setAdminSearchQuery(e.target.value)}
                      placeholder="Search by phone number, name, or designation..."
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#003B8E]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
                      {(['ALL', 'ACTIVE', 'INVITED', 'REVOKED'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setAdminStatusFilter(st)}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                            adminStatusFilter === st
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st === 'ALL'
                            ? 'All'
                            : st === 'ACTIVE'
                            ? 'Active'
                            : st === 'INVITED'
                            ? 'Pending'
                            : 'Revoked'}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowFullAdminPhones(!showFullAdminPhones)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {showFullAdminPhones ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showFullAdminPhones ? 'Mask Phones' : 'Show Full Phones'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Administrators Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#003B8E]" />
                    <span>Administrator Registry ({filteredAdmins.length})</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Zero-Trust RBAC Enforcement
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-4">Administrator</th>
                        <th className="py-3.5 px-4">Mobile Number</th>
                        <th className="py-3.5 px-4">Role</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Date Authorized</th>
                        <th className="py-3.5 px-4">Last Activity</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredAdmins.map((adm) => {
                        const isOwner = adm.isPermanentSuperAdmin || adm.phoneE164 === DESIGNATED_OWNER_PHONE;
                        const displayPhone = showFullAdminPhones
                          ? adm.phoneE164
                          : `${adm.phoneE164.slice(0, 3)} •••••• ${adm.phoneE164.slice(-4)}`;

                        return (
                          <tr key={adm.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isOwner
                                      ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                      : adm.status === 'ACTIVE'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : adm.status === 'INVITED'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                                  }`}
                                >
                                  {isOwner ? <Shield className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{adm.name}</span>
                                    {isOwner && (
                                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-extrabold border border-purple-200">
                                        Platform Owner
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500">{adm.designation || 'Administrator'}</div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px]">
                                {displayPhone}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                  adm.role === 'super_admin'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-sky-50 text-sky-700 border-sky-200'
                                }`}
                              >
                                {adm.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              {adm.status === 'ACTIVE' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Active
                                </span>
                              )}
                              {adm.status === 'INVITED' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[11px]">
                                  <Clock className="w-3 h-3" />
                                  Pending Sign-In
                                </span>
                              )}
                              {adm.status === 'REVOKED' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                                  <AlertCircle className="w-3 h-3" />
                                  Revoked
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                              {adm.invitedAt ? new Date(adm.invitedAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              }) : 'System Seed'}
                            </td>

                            <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                              {adm.lastLoginAt ? (
                                new Date(adm.lastLoginAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              ) : adm.status === 'INVITED' ? (
                                <span className="text-amber-600 font-medium">Awaiting OTP login</span>
                              ) : (
                                '—'
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              {isOwner ? (
                                <span className="text-[11px] font-semibold text-slate-400 inline-flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> Permanent Owner
                                </span>
                              ) : isSuperAdmin ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAdminToEdit(adm);
                                      setEditAdminName(adm.name);
                                      setEditAdminDesignation(adm.designation || '');
                                    }}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-[11px] font-semibold transition-colors cursor-pointer"
                                    title="Edit Administrator Details"
                                  >
                                    Edit
                                  </button>

                                  {adm.status === 'REVOKED' ? (
                                    <button
                                      type="button"
                                      onClick={() => setAdminToReactivate(adm)}
                                      className="py-1 px-2.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] transition-colors cursor-pointer"
                                    >
                                      Reactivate
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAdminToRevoke(adm);
                                        setRevokeReasonInput('');
                                      }}
                                      className="py-1 px-2.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] transition-colors cursor-pointer"
                                    >
                                      Revoke Access
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Protected</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredAdmins.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="font-semibold text-sm">No administrators matched your filters</p>
                            <p className="text-xs text-slate-400 mt-1">Try clearing search or status filter</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Admin Governance Audit Trail */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#003B8E]" />
                    <span>Administrator Authorization Audit Trail</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    Immutable Governance Ledger
                  </span>
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {adminAuditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                            {log.action}
                          </span>
                          <span className="font-semibold text-slate-800">{log.summary}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Actor: <strong className="text-slate-700">{log.actorName}</strong> ({log.actorPhone}) · Target ID: <code className="font-mono text-slate-700">{log.targetId}</code>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono shrink-0">
                        {new Date(log.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  ))}

                  {adminAuditLogs.length === 0 && (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No admin authorization audit records logged yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              SECTION: CITY PARTNER PROGRAM GOVERNANCE & 50/50 REVENUE SETTLEMENTS
             ================================================================ */}
          {activeSection === 'partners' && (
            <AdminPartnerManagement
              isSuperAdmin={isSuperAdmin}
              onActionCompleted={(msg) =>
                setActionBanner({ type: 'success', message: msg })
              }
            />
          )}

          {/* ================================================================
              SECTION 3: SELLERS & STORES MANAGEMENT
             ================================================================ */}
          {activeSection === 'sellers-stores' && (
            <div className="space-y-5">
              {/* Filter Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    placeholder="Search by store name, seller owner, mobile number, city, state, postal code..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={storeStatusFilter}
                    onChange={(e) =>
                      setStoreStatusFilter(
                        e.target.value as
                          | 'ALL'
                          | 'ACTIVE'
                          | 'SUSPENDED'
                          | 'UNVERIFIED'
                          | 'DEMO'
                      )
                    }
                    className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="ALL">All Store Statuses</option>
                    <option value="ACTIVE">Active &amp; Public</option>
                    <option value="SUSPENDED">Suspended / Disabled</option>
                    <option value="UNVERIFIED">Unverified Location</option>
                    <option value="DEMO">Demo Stores Only</option>
                  </select>

                  <select
                    value={storeCategoryFilter}
                    onChange={(e) => setStoreCategoryFilter(e.target.value)}
                    className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl max-w-[220px]"
                  >
                    <option value="ALL">All 25 Categories</option>
                    {AUTHORITATIVE_STORE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stores Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-3 px-4 font-bold">Store &amp; ID</th>
                        <th className="py-3 px-4 font-bold">
                          Seller &amp; Phone
                        </th>
                        <th className="py-3 px-4 font-bold">Category</th>
                        <th className="py-3 px-4 font-bold">Location</th>
                        <th className="py-3 px-4 font-bold text-right">
                          SKUs / Orders
                        </th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mergedStores
                        .filter((st) => {
                          if (excludeDemoRecords && st.isDemo && storeStatusFilter !== 'DEMO') {
                            return false;
                          }
                          if (storeStatusFilter === 'ACTIVE') {
                            if (!st.isActive || st.isSuspended) return false;
                          } else if (storeStatusFilter === 'SUSPENDED') {
                            if (st.isActive && !st.isSuspended) return false;
                          } else if (storeStatusFilter === 'UNVERIFIED') {
                            if (st.locationVerified) return false;
                          } else if (storeStatusFilter === 'DEMO') {
                            if (!st.isDemo) return false;
                          }
                          if (
                            storeCategoryFilter !== 'ALL' &&
                            st.categoryId !== storeCategoryFilter
                          ) {
                            return false;
                          }
                          const q = storeSearch.trim().toLowerCase();
                          if (!q) return true;
                          const seller = mergedSellers.find(
                            (s) => s.id === st.sellerId
                          );
                          return (
                            st.name.toLowerCase().includes(q) ||
                            st.id.toLowerCase().includes(q) ||
                            st.sellerName.toLowerCase().includes(q) ||
                            (seller?.phoneE164 || '')
                              .toLowerCase()
                              .includes(q) ||
                            st.cityName.toLowerCase().includes(q) ||
                            st.stateRegion.toLowerCase().includes(q) ||
                            (st.postalCode || '').toLowerCase().includes(q)
                          );
                        })
                        .map((st) => {
                          const seller = mergedSellers.find(
                            (s) => s.id === st.sellerId
                          );
                          const stProductsCount = mergedProducts.filter(
                            (p) => p.storeId === st.id
                          ).length;
                          const stOrdersCount = mergedOrders.filter(
                            (o) => o.storeId === st.id
                          ).length;
                          const isSuspended =
                            Boolean(st.isSuspended) || !st.isActive;

                          return (
                            <tr
                              key={st.id}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">
                                  {st.name}
                                </div>
                                <div className="font-mono text-[11px] text-slate-400">
                                  {st.id}
                                  {st.isDemo && (
                                    <span className="ml-1.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-sans font-semibold text-[10px]">
                                      Demo
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-800">
                                  {seller?.businessOwnerName || st.sellerName}
                                </div>
                                <div className="font-mono text-[11px] text-slate-500">
                                  {seller?.phoneE164 || 'Unlinked phone'}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-700">
                                {st.category}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-800">
                                  {st.cityName}, {st.stateRegion}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {st.neighborhood} · {st.country}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono">
                                {stProductsCount} SKUs · {stOrdersCount} orders
                              </td>
                              <td className="py-3 px-4">
                                {isSuspended ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 font-bold text-[11px]">
                                    Suspended
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                                    Active
                                  </span>
                                )}
                                {!st.locationVerified && (
                                  <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                                    Unverified Location
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setInspectedStoreId(st.id)}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer"
                                  >
                                    Inspect
                                  </button>
                                  {isSuspended ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConfirmReason('');
                                        setConfirmModal({
                                          type: 'RESTORE_STORE',
                                          targetId: st.id,
                                          targetName: st.name,
                                        });
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                                    >
                                      Restore
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConfirmReason('');
                                        setConfirmModal({
                                          type: 'SUSPEND_STORE',
                                          targetId: st.id,
                                          targetName: st.name,
                                        });
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer"
                                    >
                                      Suspend
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmReason('');
                                      setConfirmStoreNameInput('');
                                      setConfirmModal({
                                        type: 'DELETE_STORE',
                                        targetId: st.id,
                                        targetName: st.name,
                                      });
                                    }}
                                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                                    title="Permanently Delete Store"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Store Detail Inspection Drawer/Panel */}
              {inspectedStore && (
                <div className="bg-white border-2 border-[#003B8E]/30 rounded-2xl p-6 shadow-lg space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-mono uppercase text-[#003B8E] font-bold">
                        Store Inspection · {inspectedStore.id}
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900">
                        {inspectedStore.name}
                      </h3>
                      <p className="text-xs text-slate-600">
                        {inspectedStore.specialty} · {inspectedStore.category}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectedStoreId(null)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900">
                        Seller Identity
                      </div>
                      <div>Owner: {inspectedStore.sellerName}</div>
                      <div>Seller ID: {inspectedStore.sellerId}</div>
                      <div>UPI Handle: {inspectedStore.upiHandle}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900">
                        Geographic Scope
                      </div>
                      <div>
                        {inspectedStore.cityName}, {inspectedStore.stateRegion},{' '}
                        {inspectedStore.country}
                      </div>
                      <div>Address: {inspectedStore.address}</div>
                      <div>
                        Verification: {inspectedStore.verificationStatus}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900">
                        Operational Actions
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {!inspectedStore.locationVerified && (
                          <button
                            type="button"
                            onClick={() =>
                              executeAdminAction(
                                {
                                  action: 'VERIFY_STORE_LOCATION',
                                  storeId: inspectedStore.id,
                                },
                                `Verified location for ${inspectedStore.name}.`
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#003B8E] text-white font-semibold cursor-pointer"
                          >
                            Verify Location
                          </button>
                        )}
                        <Link
                          href={`/stores/${inspectedStore.id}`}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                        >
                          Open Public URL ↗
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              SECTION 4: BUYERS DIRECTORY & ACCOUNT GOVERNANCE
             ================================================================ */}
          {activeSection === 'buyers' && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={buyerSearch}
                    onChange={(e) => setBuyerSearch(e.target.value)}
                    placeholder="Search buyers by full name, verified E.164 mobile phone, or UID..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <select
                  value={buyerStatusFilter}
                  onChange={(e) =>
                    setBuyerStatusFilter(
                      e.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED'
                    )
                  }
                  className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="ALL">All Account Statuses</option>
                  <option value="ACTIVE">Active Accounts</option>
                  <option value="SUSPENDED">Suspended Accounts</option>
                </select>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-3 px-4 font-bold">Buyer Name</th>
                        <th className="py-3 px-4 font-bold">Verified Phone</th>
                        <th className="py-3 px-4 font-bold">Roles</th>
                        <th className="py-3 px-4 font-bold">Registered</th>
                        <th className="py-3 px-4 font-bold text-right">
                          Orders Placed
                        </th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mergedUsers
                        .filter((u) => {
                          const status = u.accountStatus || 'ACTIVE';
                          if (
                            buyerStatusFilter !== 'ALL' &&
                            status !== buyerStatusFilter
                          ) {
                            return false;
                          }
                          const q = buyerSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            u.fullName.toLowerCase().includes(q) ||
                            u.phoneE164.toLowerCase().includes(q) ||
                            u.id.toLowerCase().includes(q)
                          );
                        })
                        .map((u) => {
                          const userOrders = mergedOrders.filter(
                            (o) =>
                              o.customer.phone === u.phoneE164 ||
                              o.customer.fullName.toLowerCase() ===
                                u.fullName.toLowerCase()
                          );
                          const totalSpent = userOrders.reduce(
                            (s, o) => s + o.total,
                            0
                          );
                          const isSuspended = u.accountStatus === 'SUSPENDED';
                          const isOwnerRow =
                            u.phoneE164 === DESIGNATED_OWNER_PHONE;

                          return (
                            <tr key={u.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">
                                  {u.fullName}
                                </div>
                                <div className="font-mono text-[10px] text-slate-400">
                                  {u.id}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                                {u.phoneE164}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1">
                                  {u.roles.map((r) => (
                                    <span
                                      key={r}
                                      className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold"
                                    >
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {new Date(u.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-right font-mono">
                                {userOrders.length} ({formatCurrency(totalSpent)}
                                )
                              </td>
                              <td className="py-3 px-4">
                                {isSuspended ? (
                                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-bold text-[11px]">
                                    Suspended
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                                    Active
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setInspectedBuyerId(u.id)}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer"
                                  >
                                    Orders
                                  </button>
                                  {!isOwnerRow &&
                                    (isSuspended ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setConfirmReason('');
                                          setConfirmModal({
                                            type: 'RESTORE_BUYER',
                                            targetId: u.id,
                                            targetName: `${u.fullName} (${u.phoneE164})`,
                                            secondaryId: u.phoneE164,
                                          });
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                                      >
                                        Restore
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setConfirmReason('');
                                          setConfirmModal({
                                            type: 'SUSPEND_BUYER',
                                            targetId: u.id,
                                            targetName: `${u.fullName} (${u.phoneE164})`,
                                            secondaryId: u.phoneE164,
                                          });
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer"
                                      >
                                        Suspend
                                      </button>
                                    ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {inspectedBuyer && (
                <div className="bg-white border-2 border-[#003B8E]/30 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Buyer Order History: {inspectedBuyer.fullName} (
                        {inspectedBuyer.phoneE164})
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectedBuyerId(null)}
                      className="p-1 rounded-lg border border-slate-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs">
                    {mergedOrders
                      .filter(
                        (o) => o.customer.phone === inspectedBuyer.phoneE164
                      )
                      .map((ord) => (
                        <div
                          key={ord.id}
                          className="py-2 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono font-bold">
                              {ord.id}
                            </span>{' '}
                            · {ord.storeName} · {ord.createdAt}
                          </div>
                          <div className="font-mono font-bold">
                            {formatCurrency(ord.total)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              SECTION 5: PRODUCTS & CATEGORIES
             ================================================================ */}
          {activeSection === 'products-categories' && (
            <div className="space-y-5">
              {/* Sub-tab Switcher */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProductsSubTab('PRODUCTS')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    productsSubTab === 'PRODUCTS'
                      ? 'bg-[#003B8E] text-white'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  Global Product Catalog ({scopedProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setProductsSubTab('CATEGORIES')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    productsSubTab === 'CATEGORIES'
                      ? 'bg-[#003B8E] text-white'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  25 Store Categories Governance
                </button>
              </div>

              {productsSubTab === 'PRODUCTS' ? (
                <>
                  {/* Product Filters */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search products by name, SKU, store name, or city..."
                        className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={productStateFilter}
                        onChange={(e) =>
                          setProductStateFilter(
                            e.target.value as
                              | 'ALL'
                              | 'PUBLISHED'
                              | 'UNPUBLISHED'
                              | 'OUT_OF_STOCK'
                              | 'MISSING_IMAGE'
                          )
                        }
                        className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                      >
                        <option value="ALL">All Listing States</option>
                        <option value="PUBLISHED">Published &amp; Live</option>
                        <option value="UNPUBLISHED">
                          Admin Unpublished / Hidden
                        </option>
                        <option value="OUT_OF_STOCK">Out of Stock</option>
                        <option value="MISSING_IMAGE">
                          Using Studio Artwork (No Custom Photo)
                        </option>
                      </select>

                      <select
                        value={productCategoryFilter}
                        onChange={(e) =>
                          setProductCategoryFilter(e.target.value)
                        }
                        className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl max-w-[220px]"
                      >
                        <option value="ALL">All Categories</option>
                        {AUTHORITATIVE_STORE_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Products Table */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <th className="py-3 px-4 font-bold">
                              Product &amp; SKU
                            </th>
                            <th className="py-3 px-4 font-bold">
                              Store &amp; City
                            </th>
                            <th className="py-3 px-4 font-bold">Category</th>
                            <th className="py-3 px-4 font-bold text-right">
                              Price
                            </th>
                            <th className="py-3 px-4 font-bold text-right">
                              Stock
                            </th>
                            <th className="py-3 px-4 font-bold">Visibility</th>
                            <th className="py-3 px-4 font-bold text-right">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {scopedProducts
                            .filter((p) => {
                              if (
                                productCategoryFilter !== 'ALL' &&
                                p.categoryId !== productCategoryFilter
                              ) {
                                return false;
                              }
                              if (productStateFilter === 'PUBLISHED') {
                                if (!p.isAvailable || p.adminUnpublished)
                                  return false;
                              } else if (productStateFilter === 'UNPUBLISHED') {
                                if (!p.adminUnpublished) return false;
                              } else if (
                                productStateFilter === 'OUT_OF_STOCK'
                              ) {
                                if (p.stock > 0 && p.isAvailable) return false;
                              } else if (
                                productStateFilter === 'MISSING_IMAGE'
                              ) {
                                if (p.customImageUrl) return false;
                              }
                              const q = productSearch.trim().toLowerCase();
                              if (!q) return true;
                              return (
                                p.name.toLowerCase().includes(q) ||
                                p.sku.toLowerCase().includes(q) ||
                                p.storeName.toLowerCase().includes(q) ||
                                p.city.toLowerCase().includes(q)
                              );
                            })
                            .slice(0, 100)
                            .map((p) => {
                              const isUnpublished = Boolean(p.adminUnpublished);
                              return (
                                <tr key={p.id} className="hover:bg-slate-50/80">
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-slate-900">
                                      {p.name}
                                    </div>
                                    <div className="font-mono text-[10px] text-slate-400">
                                      {p.sku} · {p.id}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-slate-800">
                                      {p.storeName}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {p.city} ({p.neighborhood})
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-slate-700">
                                    {p.category}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                    {formatCurrency(p.price, p.currency)}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono">
                                    {p.stock}
                                  </td>
                                  <td className="py-3 px-4">
                                    {isUnpublished ? (
                                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-bold text-[11px]">
                                        Unpublished
                                      </span>
                                    ) : p.isAvailable && p.stock > 0 ? (
                                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                                        Public
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[11px]">
                                        Out of Stock
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    {isUnpublished ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setConfirmReason('');
                                          setConfirmModal({
                                            type: 'RESTORE_PRODUCT',
                                            targetId: p.id,
                                            targetName: p.name,
                                          });
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                                      >
                                        Restore Listing
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setConfirmReason('');
                                          setConfirmModal({
                                            type: 'UNPUBLISH_PRODUCT',
                                            targetId: p.id,
                                            targetName: p.name,
                                          });
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer"
                                      >
                                        Unpublish
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                /* 25 Categories Governance Table */
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <th className="py-3 px-4 font-bold">#</th>
                          <th className="py-3 px-4 font-bold">Category Name</th>
                          <th className="py-3 px-4 font-bold">Slug</th>
                          <th className="py-3 px-4 font-bold text-right">
                            Stores
                          </th>
                          <th className="py-3 px-4 font-bold text-right">
                            Products
                          </th>
                          <th className="py-3 px-4 font-bold">Status</th>
                          <th className="py-3 px-4 font-bold text-right">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(
                          dashboardData?.categories ||
                          AUTHORITATIVE_STORE_CATEGORIES.map((c) => ({
                            ...c,
                            isActive: true,
                          }))
                        ).map((cat) => {
                          const stCount = scopedStores.filter(
                            (s) => s.categoryId === cat.id
                          ).length;
                          const prCount = scopedProducts.filter(
                            (p) => p.categoryId === cat.id
                          ).length;
                          return (
                            <tr key={cat.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4 font-mono text-slate-500">
                                {cat.order}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                                <CategoryIcon
                                  categoryIdOrName={cat.name}
                                  className="w-4 h-4 text-[#003B8E]"
                                />
                                <span>{cat.name}</span>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-500">
                                /categories/{cat.slug}
                              </td>
                              <td className="py-3 px-4 text-right font-mono">
                                {stCount}
                              </td>
                              <td className="py-3 px-4 text-right font-mono">
                                {prCount}
                              </td>
                              <td className="py-3 px-4">
                                {cat.isActive ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                                    Enabled
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-bold text-[11px]">
                                    Disabled
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    executeAdminAction(
                                      {
                                        action: 'TOGGLE_CATEGORY',
                                        categoryId: cat.id,
                                        isActive: !cat.isActive,
                                      },
                                      `Updated category "${cat.name}".`
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 font-semibold cursor-pointer"
                                >
                                  {cat.isActive ? 'Disable' : 'Enable'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              SECTION 6: ORDERS OVERSIGHT
             ================================================================ */}
          {activeSection === 'orders' && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={orderSearch}
                    onChange={(e) => {
                      setOrderSearch(e.target.value);
                      setOrderPage(1);
                    }}
                    placeholder="Search orders by Order ID, buyer name, buyer phone, store name, city..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => {
                    setOrderStatusFilter(
                      e.target.value as
                        | 'ALL'
                        | 'AWAITING'
                        | 'IN_PROGRESS'
                        | 'COMPLETED'
                        | 'CANCELLED'
                    );
                    setOrderPage(1);
                  }}
                  className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="ALL">All Order Statuses</option>
                  <option value="AWAITING">Awaiting Seller Acceptance</option>
                  <option value="IN_PROGRESS">In Preparation / Delivery</option>
                  <option value="COMPLETED">Delivered &amp; Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-3 px-4 font-bold">Order ID</th>
                        <th className="py-3 px-4 font-bold">Buyer</th>
                        <th className="py-3 px-4 font-bold">Store</th>
                        <th className="py-3 px-4 font-bold">Payment</th>
                        <th className="py-3 px-4 font-bold text-right">
                          Total
                        </th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold text-right">
                          Inspect
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scopedOrders
                        .filter((o) => {
                          if (orderStatusFilter === 'AWAITING') {
                            if (
                              o.currentStepIndex !== 0 ||
                              o.orderStatus === 'CANCELLED'
                            )
                              return false;
                          } else if (orderStatusFilter === 'IN_PROGRESS') {
                            if (
                              (o.currentStepIndex !== 1 &&
                                o.currentStepIndex !== 2) ||
                              o.orderStatus === 'CANCELLED'
                            )
                              return false;
                          } else if (orderStatusFilter === 'COMPLETED') {
                            if (
                              o.currentStepIndex < 3 ||
                              o.orderStatus === 'CANCELLED'
                            )
                              return false;
                          } else if (orderStatusFilter === 'CANCELLED') {
                            if (o.orderStatus !== 'CANCELLED') return false;
                          }
                          const q = orderSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            o.id.toLowerCase().includes(q) ||
                            o.customer.fullName.toLowerCase().includes(q) ||
                            o.customer.phone.toLowerCase().includes(q) ||
                            o.storeName.toLowerCase().includes(q)
                          );
                        })
                        .slice((orderPage - 1) * 20, orderPage * 20)
                        .map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4">
                              <div className="font-mono font-bold text-slate-900">
                                {ord.id}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {ord.createdAt}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-800">
                                {ord.customer.fullName}
                              </div>
                              <div className="font-mono text-[11px] text-slate-500">
                                {ord.customer.phone}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              {ord.storeName}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {ord.paymentMethod}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(ord.total)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                  ord.orderStatus === 'CANCELLED'
                                    ? 'bg-rose-100 text-rose-900'
                                    : ord.currentStepIndex >= 3
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : 'bg-blue-100 text-blue-900'
                                }`}
                              >
                                {ord.orderStatus === 'CANCELLED'
                                  ? 'Cancelled'
                                  : ORDER_STEPS[ord.currentStepIndex] ||
                                    'Order Placed'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setInspectedOrderId(ord.id)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Inspection & Admin Note Panel */}
              {inspectedOrder && (
                <div className="bg-white border-2 border-[#003B8E]/30 rounded-2xl p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[11px] font-mono uppercase text-[#003B8E] font-bold">
                        Order Inspection · {inspectedOrder.id}
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900">
                        {inspectedOrder.storeName} →{' '}
                        {inspectedOrder.customer.fullName}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Delivery Address: {inspectedOrder.customer.address} ·
                        Buyer Phone: {inspectedOrder.customer.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectedOrderId(null)}
                      className="p-1.5 rounded-lg border border-slate-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Line Items */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="font-bold text-slate-900">
                      Order Items ({inspectedOrder.items.length})
                    </div>
                    {inspectedOrder.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between"
                      >
                        <span>
                          {item.quantity}x {item.product.name} ({item.variant})
                        </span>
                        <span className="font-mono font-semibold">
                          {formatCurrency(item.product.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold">
                      <span>Total Direct Settlement</span>
                      <span className="font-mono">
                        {formatCurrency(inspectedOrder.total)}
                      </span>
                    </div>
                  </div>

                  {/* Administrative Oversight Notes (Does not fabricate delivery/payment state) */}
                  <div className="space-y-2 text-xs">
                    <div className="font-bold text-slate-900">
                      Super Admin Support &amp; Dispute Oversight Notes
                    </div>
                    {(inspectedOrder.adminNotes || []).length > 0 && (
                      <div className="space-y-1.5">
                        {(inspectedOrder.adminNotes || []).map((n) => (
                          <div
                            key={n.id}
                            className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 text-slate-800"
                          >
                            <div className="text-[10px] font-mono text-slate-500">
                              {new Date(n.createdAt).toLocaleString()} ·{' '}
                              {n.adminUid}
                            </div>
                            <div>{n.note}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={orderNoteDraft}
                        onChange={(e) => setOrderNoteDraft(e.target.value)}
                        placeholder="Add an administrative audit note (e.g., spoke with seller regarding dispatch)..."
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!orderNoteDraft.trim()) return;
                          const ok = await executeAdminAction(
                            {
                              action: 'ADD_ORDER_ADMIN_NOTE',
                              orderId: inspectedOrder.id,
                              note: orderNoteDraft.trim(),
                            },
                            `Added oversight note to order ${inspectedOrder.id}.`
                          );
                          if (ok) setOrderNoteDraft('');
                        }}
                        className="px-4 py-2 rounded-xl bg-[#003B8E] text-white font-bold cursor-pointer"
                      >
                        Append Note
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              SECTION 7: SUBSCRIPTIONS & PLANS
             ================================================================ */}
          {activeSection === 'subscriptions-plans' && (
            <div className="space-y-6">
              {/* Authoritative Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {(dashboardData?.subscriptionPlans || []).map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-2xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase font-bold text-[#003B8E]">
                          {plan.id}
                        </span>
                        {plan.badge && (
                          <span className="px-2 py-0.5 rounded bg-orange-100 text-[#F96302] font-bold text-[10px]">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900">
                        {plan.name}
                      </h3>
                      <p className="text-xs text-slate-500">{plan.tagline}</p>
                      <div className="pt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold font-mono text-slate-900">
                          {formatCurrency(plan.monthlyPriceInr)}
                        </span>
                        <span className="text-xs text-slate-500">/ month</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Annual: {formatCurrency(plan.annualPriceInr)}/yr · SKU
                        Limit:{' '}
                        {plan.entitlements.maxActiveProducts === -1 || plan.entitlements.maxActiveProducts >= 100000
                          ? 'Unlimited'
                          : plan.entitlements.maxActiveProducts}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlan(plan);
                        setPlanNameInput(plan.name);
                        setPlanTaglineInput(plan.tagline || '');
                        setPlanMonthlyPrice(String(plan.monthlyPriceInr));
                        setPlanAnnualPrice(String(plan.annualPriceInr));
                        setPlanProductLimit(
                          plan.entitlements.maxActiveProducts === -1 || plan.entitlements.maxActiveProducts >= 100000
                            ? '999999'
                            : String(plan.entitlements.maxActiveProducts)
                        );
                        setPlanBadgeText(plan.badge || '');
                      }}
                      className="w-full py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer"
                    >
                      Configure Pricing &amp; Entitlements
                    </button>
                  </div>
                ))}
              </div>

              {/* Plan Editor Modal */}
              {editingPlan && (
                <div className="bg-white border-2 border-[#003B8E] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-slate-900">
                      Edit Subscription Tier: {editingPlan.name} (
                      {editingPlan.id})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingPlan(null)}
                      className="p-1 rounded-lg border border-slate-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Plan Display Name
                      </label>
                      <input
                        type="text"
                        value={planNameInput}
                        onChange={(e) => setPlanNameInput(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Plan Tagline / Subtitle
                      </label>
                      <input
                        type="text"
                        value={planTaglineInput}
                        onChange={(e) => setPlanTaglineInput(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Highlight Badge
                      </label>
                      <input
                        type="text"
                        value={planBadgeText}
                        onChange={(e) => setPlanBadgeText(e.target.value)}
                        placeholder="e.g. Most Popular"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Monthly Price (INR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={planMonthlyPrice}
                        onChange={(e) => setPlanMonthlyPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Annual Price (INR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={planAnnualPrice}
                        onChange={(e) => setPlanAnnualPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        SKU Limit (999999 = Unlimited)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={planProductLimit}
                        onChange={(e) => setPlanProductLimit(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPlan(null)}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const limitNum = Number(planProductLimit);
                        const targetLimit = limitNum >= 100000 ? 999999 : limitNum;
                        const ok = await executeAdminAction(
                          {
                            action: 'UPDATE_SUBSCRIPTION_PLAN',
                            planId: editingPlan.id,
                            name: planNameInput.trim() || editingPlan.name,
                            tagline: planTaglineInput.trim() || editingPlan.tagline,
                            monthlyPriceInr: Number(planMonthlyPrice),
                            annualPriceInr: Number(planAnnualPrice),
                            maxActiveProducts: targetLimit,
                            productLimit: targetLimit,
                            entitlements: {
                              ...editingPlan.entitlements,
                              maxActiveProducts: targetLimit,
                            },
                            badge: planBadgeText.trim(),
                          },
                          `Updated ${planNameInput.trim() || editingPlan.name} subscription plan.`
                        );
                        if (ok) {
                          setEditingPlan(null);
                          await fetchDashboardData();
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold cursor-pointer"
                    >
                      Save Plan Configuration
                    </button>
                  </div>
                </div>
              )}

              {/* Active Merchant Subscriptions Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Merchant Store Subscriptions
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-3 px-4 font-bold">Subscription ID</th>
                        <th className="py-3 px-4 font-bold">Store</th>
                        <th className="py-3 px-4 font-bold">Plan &amp; Cycle</th>
                        <th className="py-3 px-4 font-bold text-right">
                          Price
                        </th>
                        <th className="py-3 px-4 font-bold">Renewal Period</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(dashboardData?.subscriptions || []).map((sub) => {
                        const st = mergedStores.find(
                          (s) => s.id === sub.storeId
                        );
                        return (
                          <tr key={sub.id}>
                            <td className="py-3 px-4 font-mono font-semibold">
                              {sub.id}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {st?.name || sub.storeId}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-[#003B8E]">
                                {sub.planId}
                              </span>{' '}
                              · {sub.billingCycle}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold">
                              {formatCurrency(sub.currentPrice, sub.currency)}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {new Date(
                                sub.currentPeriodStart || Date.now()
                              ).toLocaleDateString()}{' '}
                              →{' '}
                              {new Date(
                                sub.currentPeriodEnd || Date.now()
                              ).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                                {sub.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sponsored Product Placement Pricing & Availability Editor */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-mono uppercase font-bold text-[#F96302]">
                      Ad Revenue Configuration
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Sponsored Product Placement Pricing &amp; Availability
                    </h3>
                    <p className="text-xs text-slate-500">
                      Centralized server-controlled pricing (excl. 18% GST) for seller product promotions across Category, Local Featured, and Homepage placements.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSavingPlacements}
                    onClick={async () => {
                      setIsSavingPlacements(true);
                      try {
                        const headers = await getAuthHeaders();
                        const configMap = Object.fromEntries(
                          placementConfigs.map((c) => [c.id, c])
                        );
                        const res = await fetch('/api/billing/campaigns', {
                          method: 'POST',
                          headers,
                          body: JSON.stringify({
                            action: 'ADMIN_UPDATE',
                            subAction: 'UPDATE_PRICING',
                            placementConfigs: configMap,
                            actorUid: authenticatedUser?.id || 'super-admin',
                            actorPhone:
                              authenticatedUser?.phoneE164 ||
                              DESIGNATED_OWNER_PHONE,
                          }),
                        });
                        const data = await res.json();
                        if (data.ok) {
                          if (Array.isArray(data.placementConfigsList)) {
                            setPlacementConfigs(data.placementConfigsList);
                          }
                          setActionBanner({
                            type: 'success',
                            message:
                              'Saved Sponsored Product Placement pricing and availability.',
                          });
                        } else {
                          setActionBanner({
                            type: 'error',
                            message:
                              data.error ||
                              'Could not save sponsored placement pricing.',
                          });
                        }
                      } catch {
                        setActionBanner({
                          type: 'error',
                          message:
                            'Network error while saving sponsored placement pricing.',
                        });
                      } finally {
                        setIsSavingPlacements(false);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isSavingPlacements
                      ? 'Saving Pricing...'
                      : 'Save Placement Pricing'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {placementConfigs.map((cfg, idx) => {
                    const pkg7 = cfg.packages.find((p) => p.days === 7) || cfg.packages[0];
                    const pkg30 = cfg.packages.find((p) => p.days === 30) || cfg.packages[1] || cfg.packages[0];
                    return (
                      <div
                        key={cfg.id}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">
                            {cfg.name}
                          </span>
                          <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cfg.isEnabled}
                              onChange={(e) => {
                                const next = [...placementConfigs];
                                next[idx] = {
                                  ...cfg,
                                  isEnabled: e.target.checked,
                                };
                                setPlacementConfigs(next);
                              }}
                            />
                            <span>{cfg.isEnabled ? 'Enabled' : 'Disabled'}</span>
                          </label>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {cfg.description}
                        </p>
                        <div className="flex items-center justify-between text-[10px]">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              cfg.livePaymentsApproved
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {cfg.livePaymentsApproved
                              ? 'Live Razorpay Approved'
                              : 'Proposed Pricing (Sandbox Mode)'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">
                              7 Days Fee (₹)
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={pkg7?.priceInr ?? 99}
                              onChange={(e) => {
                                const val = Math.max(
                                  1,
                                  Number(e.target.value) || 1
                                );
                                const next = [...placementConfigs];
                                next[idx] = {
                                  ...cfg,
                                  packages: cfg.packages.map((p) =>
                                    p.days === 7
                                      ? { ...p, priceInr: val }
                                      : p
                                  ),
                                };
                                setPlacementConfigs(next);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">
                              30 Days Fee (₹)
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={pkg30?.priceInr ?? 299}
                              onChange={(e) => {
                                const val = Math.max(
                                  1,
                                  Number(e.target.value) || 1
                                );
                                const next = [...placementConfigs];
                                next[idx] = {
                                  ...cfg,
                                  packages: cfg.packages.map((p) =>
                                    p.days === 30
                                      ? { ...p, priceInr: val }
                                      : p
                                  ),
                                };
                                setPlacementConfigs(next);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sponsored Product Campaigns & Moderation Ledger */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Sponsored Product Campaigns &amp; Moderation (
                      {adminCampaigns.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Monitor active seller product promotions, impressions, clicks, CTR, and approve/pause/reject campaigns.
                    </p>
                  </div>
                  <select
                    value={campaignStatusFilter}
                    onChange={(e) =>
                      setCampaignStatusFilter(
                        e.target.value as
                          | 'ALL'
                          | 'ACTIVE'
                          | 'PAUSED'
                          | 'EXPIRED'
                          | 'REJECTED'
                      )
                    }
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold"
                  >
                    <option value="ALL">All Campaign Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PAUSED">Paused</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-3 px-4 font-bold">
                          Product &amp; Store
                        </th>
                        <th className="py-3 px-4 font-bold">
                          Placement &amp; City
                        </th>
                        <th className="py-3 px-4 font-bold">Duration</th>
                        <th className="py-3 px-4 font-bold text-right">
                          Fee Paid
                        </th>
                        <th className="py-3 px-4 font-bold text-right">
                          Impressions / Clicks
                        </th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold text-right">
                          Moderation
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminCampaigns
                        .filter((c) => {
                          if (campaignStatusFilter === 'ALL') return true;
                          return c.status === campaignStatusFilter;
                        })
                        .map((c) => {
                          const ctr =
                            c.impressions > 0
                              ? ((c.clicks / c.impressions) * 100).toFixed(1)
                              : '0.0';
                          const displayCity = c.city || c.cityName;
                          const displayCategory = c.category || c.categoryName;
                          const displayFee = c.pricePaid ?? c.budgetInr;
                          return (
                            <tr key={c.id}>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">
                                  {c.targetProductName || c.storeName}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Store: {c.storeName} · ID: {c.id}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-[#003B8E]">
                                  {c.placementLabel || c.type}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {displayCity}
                                  {displayCategory ? ` · ${displayCategory}` : ''}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                                {c.durationDays}d (
                                {new Date(c.startDate).toLocaleDateString()} →{' '}
                                {new Date(c.endDate).toLocaleDateString()})
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(displayFee, c.currency)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono">
                                {c.impressions.toLocaleString()} imp ·{' '}
                                {c.clicks.toLocaleString()} clk ({ctr}%)
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                    c.status === 'ACTIVE'
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : c.status === 'PAUSED'
                                        ? 'bg-amber-100 text-amber-900'
                                        : c.status === 'REJECTED'
                                          ? 'bg-rose-100 text-rose-900'
                                          : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {c.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  {c.status !== 'ACTIVE' &&
                                    c.status !== 'EXPIRED' && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const headers = await getAuthHeaders();
                                          await fetch(
                                            '/api/billing/campaigns',
                                            {
                                              method: 'POST',
                                              headers,
                                              body: JSON.stringify({
                                                action: 'ADMIN_UPDATE',
                                                campaignId: c.id,
                                                status: 'ACTIVE',
                                                approvalStatus: 'APPROVED',
                                                actorUid:
                                                  authenticatedUser?.id ||
                                                  'super-admin',
                                                actorPhone:
                                                  authenticatedUser?.phoneE164 ||
                                                  DESIGNATED_OWNER_PHONE,
                                              }),
                                            }
                                          );
                                          await fetchDashboardData();
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                                      >
                                        Approve / Resume
                                      </button>
                                    )}
                                  {c.status === 'ACTIVE' && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const headers = await getAuthHeaders();
                                        await fetch('/api/billing/campaigns', {
                                          method: 'POST',
                                          headers,
                                          body: JSON.stringify({
                                            action: 'ADMIN_UPDATE',
                                            campaignId: c.id,
                                            status: 'PAUSED',
                                            actorUid:
                                              authenticatedUser?.id ||
                                              'super-admin',
                                            actorPhone:
                                              authenticatedUser?.phoneE164 ||
                                              DESIGNATED_OWNER_PHONE,
                                          }),
                                        });
                                        await fetchDashboardData();
                                      }}
                                      className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 font-semibold cursor-pointer"
                                    >
                                      Pause
                                    </button>
                                  )}
                                  {c.status !== 'REJECTED' && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const headers = await getAuthHeaders();
                                        await fetch('/api/billing/campaigns', {
                                          method: 'POST',
                                          headers,
                                          body: JSON.stringify({
                                            action: 'ADMIN_UPDATE',
                                            campaignId: c.id,
                                            status: 'REJECTED',
                                            approvalStatus: 'REJECTED',
                                            actorUid:
                                              authenticatedUser?.id ||
                                              'super-admin',
                                            actorPhone:
                                              authenticatedUser?.phoneE164 ||
                                              DESIGNATED_OWNER_PHONE,
                                          }),
                                        });
                                        await fetchDashboardData();
                                      }}
                                      className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 font-semibold cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              SECTION 8: PAYMENTS & TRANSACTIONS LEDGER
             ================================================================ */}
          {activeSection === 'payments-transactions' && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={txStatusFilter}
                    onChange={(e) =>
                      setTxStatusFilter(
                        e.target.value as
                          | 'ALL'
                          | 'SUCCESS'
                          | 'PENDING'
                          | 'FAILED'
                          | 'REFUNDED'
                      )
                    }
                    className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="ALL">All Payment Statuses</option>
                    <option value="SUCCESS">Success</option>
                    <option value="PENDING">Pending</option>
                    <option value="FAILED">Failed</option>
                    <option value="REFUNDED">Refunded</option>
                  </select>

                  <select
                    value={txTypeFilter}
                    onChange={(e) =>
                      setTxTypeFilter(
                        e.target.value as
                          | 'ALL'
                          | 'SUBSCRIPTION'
                          | 'AD_CAMPAIGN'
                          | 'SERVICE_ORDER'
                      )
                    }
                    className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="ALL">All Revenue Streams</option>
                    <option value="SUBSCRIPTION">SaaS Subscriptions</option>
                    <option value="AD_CAMPAIGN">Promoted Campaigns</option>
                    <option value="SERVICE_ORDER">Onboarding Services</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      `citykart-billing-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
                      [
                        'Invoice',
                        'Transaction ID',
                        'Store ID',
                        'Type',
                        'Description',
                        'Subtotal',
                        'GST',
                        'Total',
                        'Status',
                        'Gateway',
                        'Created At',
                      ],
                      scopedTransactions.map((t) => [
                        String(t.invoiceNumber || ''),
                        String(t.id || ''),
                        String(t.storeId || ''),
                        String(t.type || ''),
                        String(t.description || ''),
                        String(t.amount ?? 0),
                        String(t.taxAmount ?? 0),
                        String(t.totalAmount ?? 0),
                        String(t.status || ''),
                        String(t.paymentGateway || ''),
                        String(t.createdAt || ''),
                      ])
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-[#003B8E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Ledger CSV</span>
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-3 px-4 font-bold">
                          Invoice &amp; Reference
                        </th>
                        <th className="py-3 px-4 font-bold">Store</th>
                        <th className="py-3 px-4 font-bold">Type</th>
                        <th className="py-3 px-4 font-bold">Description</th>
                        <th className="py-3 px-4 font-bold text-right">
                          Amount (Incl. Tax)
                        </th>
                        <th className="py-3 px-4 font-bold">Gateway</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scopedTransactions
                        .filter((tx) => {
                          if (
                            txStatusFilter !== 'ALL' &&
                            tx.status !== txStatusFilter
                          )
                            return false;
                          if (
                            txTypeFilter !== 'ALL' &&
                            tx.type !== txTypeFilter
                          )
                            return false;
                          return true;
                        })
                        .map((tx) => {
                          const st = mergedStores.find(
                            (s) => s.id === tx.storeId
                          );
                          return (
                            <tr key={tx.id}>
                              <td className="py-3 px-4">
                                <div className="font-mono font-bold text-slate-900">
                                  {tx.invoiceNumber}
                                </div>
                                <div className="font-mono text-[10px] text-slate-400">
                                  {tx.id}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-800">
                                {st?.name || tx.storeId}
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px]">
                                {tx.type}
                              </td>
                              <td className="py-3 px-4 text-slate-700">
                                {tx.description}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(tx.totalAmount, tx.currency)}
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {tx.paymentGateway}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                    tx.status === 'SUCCESS'
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : tx.status === 'FAILED'
                                        ? 'bg-rose-100 text-rose-900'
                                        : 'bg-amber-100 text-amber-900'
                                  }`}
                                >
                                  {tx.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              SECTION 9: NOTIFICATIONS & SYSTEM STATUS
             ================================================================ */}
          {activeSection === 'notifications-status' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Cloud Firestore Database</span>
                    <Database className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-lg font-extrabold text-emerald-700">
                    {dashboardData?.systemHealth.firestoreStatus ||
                      'OPERATIONAL'}
                  </div>
                  <div className="text-xs font-mono text-slate-500">
                    Measured Read Latency:{' '}
                    {dashboardData?.systemHealth.firestoreLatencyMs ?? 12} ms
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Firebase Phone Authentication</span>
                    <Phone className="w-4 h-4 text-[#003B8E]" />
                  </div>
                  <div className="text-lg font-extrabold text-emerald-700">
                    ACTIVE (urbandirectintracity)
                  </div>
                  <div className="text-xs text-slate-500">
                    Owner E.164 Verified: {DESIGNATED_OWNER_PHONE}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>FCM Web Push Dispatch</span>
                    <Bell className="w-4 h-4 text-[#F96302]" />
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 font-mono">
                    {dashboardData?.systemHealth.registeredFcmTokenCount ?? 0}{' '}
                    Registered Devices
                  </div>
                  <div className="text-xs text-slate-500">
                    Sellers:{' '}
                    {dashboardData?.systemHealth.sellerFcmTokenCount ?? 0} ·
                    Buyers:{' '}
                    {dashboardData?.systemHealth.buyerFcmTokenCount ?? 0}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Recent Operational &amp; Notification Events
                </h3>
                {(dashboardData?.systemHealth.recentSystemEvents || [])
                  .length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No system warnings or errors recorded in the current runtime
                    window.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {(
                      dashboardData?.systemHealth.recentSystemEvents || []
                    ).map((ev) => (
                      <div
                        key={ev.id}
                        className="py-2.5 flex items-center justify-between gap-4"
                      >
                        <div>
                          <span className="font-mono font-bold text-[#003B8E]">
                            [{ev.type}]
                          </span>{' '}
                          <span>{ev.message}</span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-400">
                          {new Date(ev.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================
              SECTION 10: REPORTS & AUDIT LOGS
             ================================================================ */}
          {activeSection === 'reports-audit-logs' && (
            <div className="space-y-5">
              {/* Demo Data Management & Audit Log Controls */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search immutable audit logs by action, target ID, or summary..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={auditTargetFilter}
                    onChange={(e) => setAuditTargetFilter(e.target.value)}
                    className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="ALL">All Target Types</option>
                    <option value="STORE">Store Actions</option>
                    <option value="BUYER">Buyer Actions</option>
                    <option value="PRODUCT">Product Actions</option>
                    <option value="CATEGORY">Category Actions</option>
                    <option value="ORDER">Order Notes</option>
                    <option value="SUBSCRIPTION_PLAN">Subscription Plans</option>
                    <option value="PLATFORM_SETTINGS">Platform Settings</option>
                    <option value="SYSTEM">System / Bootstrap</option>
                  </select>

                  <button
                    type="button"
                    onClick={() =>
                      downloadCsv(
                        `citykart-super-admin-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
                        [
                          'Log ID',
                          'Timestamp',
                          'Action',
                          'Actor Phone',
                          'Target Type',
                          'Target ID',
                          'Summary',
                        ],
                        (dashboardData?.auditLogs || []).map((l) => [
                          l.id,
                          l.createdAt,
                          l.action,
                          l.actorPhone,
                          l.targetType,
                          l.targetId,
                          l.summary,
                        ])
                      )
                    }
                    className="px-3.5 py-2 rounded-xl bg-[#003B8E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Audit CSV</span>
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-3 px-4 font-bold">Timestamp</th>
                        <th className="py-3 px-4 font-bold">Action</th>
                        <th className="py-3 px-4 font-bold">Administrator</th>
                        <th className="py-3 px-4 font-bold">Target</th>
                        <th className="py-3 px-4 font-bold">Summary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(dashboardData?.auditLogs || [])
                        .filter((l) => {
                          if (
                            auditTargetFilter !== 'ALL' &&
                            l.targetType !== auditTargetFilter
                          )
                            return false;
                          const q = auditSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            l.action.toLowerCase().includes(q) ||
                            l.summary.toLowerCase().includes(q) ||
                            l.targetId.toLowerCase().includes(q)
                          );
                        })
                        .map((log) => (
                          <tr key={log.id}>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-[#003B8E]">
                              {log.action}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {log.actorPhone} ({log.actorRole})
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono text-[11px] font-semibold">
                                {log.targetType}: {log.targetId}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-800">
                              {log.summary}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              SECTION 11: PLATFORM SETTINGS & GLOBAL LOCATIONS
             ================================================================ */}
          {activeSection === 'platform-settings' && settingsDraft && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Global Marketplace Configuration
                  </h2>
                  <p className="text-xs text-slate-500">
                    Changes are validated on the server and recorded in the
                    Super Admin audit log.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Platform Brand Name
                    </label>
                    <input
                      type="text"
                      value={settingsDraft.platformName}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          platformName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Support Phone (E.164)
                    </label>
                    <input
                      type="text"
                      value={settingsDraft.supportPhone}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          supportPhone: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Support Email
                    </label>
                    <input
                      type="email"
                      value={settingsDraft.supportEmail}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          supportEmail: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Default Currency
                    </label>
                    <input
                      type="text"
                      value={settingsDraft.defaultCurrency}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          defaultCurrency: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2.5 text-xs pt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsDraft.allowNewSellerRegistrations}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          allowNewSellerRegistrations: e.target.checked,
                        })
                      }
                    />
                    <span className="font-semibold text-slate-800">
                      Allow new seller onboarding and storefront registrations
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        settingsDraft.requireLocationVerificationForNewStores
                      }
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          requireLocationVerificationForNewStores:
                            e.target.checked,
                        })
                      }
                    />
                    <span className="font-semibold text-slate-800">
                      Require canonical location directory verification for new
                      stores
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        settingsDraft.excludeDemoRecordsFromProductionMetrics
                      }
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          excludeDemoRecordsFromProductionMetrics:
                            e.target.checked,
                        })
                      }
                    />
                    <span className="font-semibold text-slate-800">
                      Exclude Nanded demo batch records from default executive
                      metrics
                    </span>
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={isSubmittingAction}
                    onClick={() =>
                      executeAdminAction(
                        {
                          action: 'UPDATE_PLATFORM_SETTINGS',
                          settings: settingsDraft,
                        },
                        'Saved global platform settings.'
                      )
                    }
                    className="px-5 py-2.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold cursor-pointer"
                  >
                    Save Platform Settings
                  </button>
                </div>
              </div>

              {/* Embedded Global Location Directory Manager */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <AdminLocationManager stores={scopedStores} />
              </div>
            </div>
          )}

          {/* ================================================================
              SECTION 12: SUPER ADMIN ACCOUNT & SECURITY DOCUMENTATION
             ================================================================ */}
          {activeSection === 'super-admin-account' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#003B8E] text-white flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">
                      Platform Owner Security Profile
                    </h2>
                    <p className="text-xs text-slate-500">
                      Authoritative Super Admin credentials for
                      https://citykart.shop
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">Display Name</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      Platform Owner
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">Verified Mobile Number</div>
                    <div className="font-mono font-bold text-emerald-700 mt-0.5">
                      {DESIGNATED_OWNER_PHONE}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">Server Role</div>
                    <div className="font-mono font-bold text-[#003B8E] mt-0.5">
                      super_admin
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">
                      Server Role Verification
                    </div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {customClaimsConfigured
                        ? 'ADC Custom Claims + Firestore /admins/{uid}'
                        : 'Google X.509 + HMAC + Firestore /admins/{uid}'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 text-xs">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Zero-Key Production Firebase &amp; Cloud Run Security
                  Architecture
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-slate-700 leading-relaxed">
                  <li>
                    <strong>Firebase Phone Authentication:</strong> In Firebase
                    Console (<code className="font-mono">urbandirectintracity</code>
                    ) → Authentication → Sign-in method, ensure{' '}
                    <strong>Phone</strong> is enabled and{' '}
                    <code className="font-mono">citykart.shop</code> (plus your
                    Cloud Run domain) is listed under Authorized domains.
                  </li>
                  <li>
                    <strong>
                      No Service Account Private Key Required (ADC + Google X.509):
                    </strong>{' '}
                    The backend verifies Firebase ID tokens cryptographically
                    using Google&apos;s public{' '}
                    <code className="font-mono">
                      securetoken@system.gserviceaccount.com
                    </code>{' '}
                    X.509 certificates and initializes{' '}
                    <code className="font-mono">firebase-admin</code> via Cloud
                    Run Application Default Credentials (ADC). No JSON private
                    key is needed.
                  </li>
                  <li>
                    <strong>Initial Role Bootstrap:</strong> Sign in at{' '}
                    <code className="font-mono">https://citykart.shop/admin</code>{' '}
                    with <code className="font-mono">+918329306616</code> via
                    Firebase Phone OTP and click{' '}
                    <strong>Authorize &amp; Grant super_admin Role</strong>. The
                    server verifies your authenticated session, writes{' '}
                    <code className="font-mono">/admins/&#123;uid&#125;</code>,
                    and issues an HttpOnly HMAC-signed{' '}
                    <code className="font-mono">urbandirect_session</code>{' '}
                    cookie.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* ================================================================
              SECTION: CITY PARTNERS (APPLICATIONS, ALLOCATIONS & SETTLEMENTS)
             ================================================================ */}
          {activeSection === 'partners' && (
            <AdminPartnerManagement
              isSuperAdmin={isSuperAdmin}
              onActionCompleted={(msg) => {
                setActionBanner({ type: 'success', message: msg });
                void fetchDashboardData();
              }}
            />
          )}
        </main>
      </div>

      {/* ====================================================================
          CONSEQUENTIAL ACTION CONFIRMATION MODAL
         ==================================================================== */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Confirm {confirmModal.type.replace(/_/g, ' ')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Target: <strong className="text-slate-900">{confirmModal.targetName}</strong>
            </p>

            {confirmModal.type === 'DELETE_STORE' && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
                <p>
                  <strong>Permanent Impact:</strong> This store and all of its
                  products will be immediately removed from public discovery and
                  recorded in <code className="font-mono">/deleted_stores</code>
                  . Historical orders and financial ledger records are preserved
                  for legal audit.
                </p>
                <label className="block font-bold mt-2">
                  Type exact store name &ldquo;{confirmModal.targetName}&rdquo;
                  to confirm:
                </label>
                <input
                  type="text"
                  value={confirmStoreNameInput}
                  onChange={(e) => setConfirmStoreNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Administrative Reason (recorded in immutable audit log)
              </label>
              <input
                type="text"
                value={confirmReason}
                onChange={(e) => setConfirmReason(e.target.value)}
                placeholder="Enter reason for this administrative action..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isSubmittingAction ||
                  (confirmModal.type === 'DELETE_STORE' &&
                    confirmStoreNameInput.trim().toLowerCase() !==
                      confirmModal.targetName.trim().toLowerCase())
                }
                onClick={handleConfirmConsequentialAction}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                {isSubmittingAction ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 1: ADD / AUTHORIZE NEW ADMINISTRATOR BY MOBILE NUMBER
         ==================================================================== */}
      {isAddAdminModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#003B8E]/10 border border-[#003B8E]/20 text-[#003B8E] flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Authorize Administrator
                  </h3>
                  <p className="text-xs text-slate-500">
                    Grant administrative rights to a mobile number
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddAdminModalOpen(false);
                  setAddAdminError(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addAdminError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-medium">
                {addAdminError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAddAdminError(null);
                const rawSubscriber = addAdminSubscriberPhone.replace(/\D/g, '');
                if (!rawSubscriber || rawSubscriber.length < 10) {
                  setAddAdminError('Please enter a valid 10-digit mobile number.');
                  return;
                }
                if (!addAdminName.trim()) {
                  setAddAdminError('Please enter the administrator\'s full name.');
                  return;
                }
                const normalizedPhone = `${addAdminCountryDialCode}${rawSubscriber}`;
                const ok = await executeAdminAction(
                  {
                    action: 'INVITE_ADMIN',
                    phoneE164: normalizedPhone,
                    name: addAdminName.trim(),
                    designation: addAdminDesignation.trim() || 'Administrator',
                    role: addAdminRole,
                  },
                  `Successfully authorized ${addAdminName.trim()} (${normalizedPhone}) as ${addAdminRole === 'super_admin' ? 'Super Admin' : 'Admin'}.`
                );
                if (ok) {
                  setIsAddAdminModalOpen(false);
                  setAddAdminSubscriberPhone('');
                  setAddAdminName('');
                  setAddAdminDesignation('');
                  setAddAdminRole('admin');
                }
              }}
              className="space-y-4 text-xs"
            >
              {/* City Partner vs Admin Architecture Warning Banner */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-950 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Looking to onboard a City Partner?</strong> City Partners must NOT be authorized here as administrators. Use the{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddAdminModalOpen(false);
                      setActiveSection('partners');
                    }}
                    className="text-[#003B8E] underline font-bold cursor-pointer hover:text-[#002D6E]"
                  >
                    City Partner Program tab &rarr; Direct Onboard Partner
                  </button>{' '}
                  to assign exclusive canonical city rights, 50/50 revenue attribution, and KYC payout capture without granting platform-wide administrative privileges.
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Administrator Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={addAdminCountryDialCode}
                    onChange={(e) => setAddAdminCountryDialCode(e.target.value)}
                    className="w-24 px-2.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-800"
                  >
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+971">🇦🇪 +971</option>
                  </select>
                  <input
                    type="tel"
                    required
                    value={addAdminSubscriberPhone}
                    onChange={(e) => setAddAdminSubscriberPhone(e.target.value)}
                    placeholder="9876543210"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#003B8E]"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  The administrator must authenticate via Firebase Phone OTP using this exact mobile number.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addAdminName}
                  onChange={(e) => setAddAdminName(e.target.value)}
                  placeholder="e.g. Ramesh Kulkarni"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#003B8E]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Designation / Role Title
                </label>
                <input
                  type="text"
                  value={addAdminDesignation}
                  onChange={(e) => setAddAdminDesignation(e.target.value)}
                  placeholder="e.g. Senior Operations Manager"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#003B8E]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Assigned Administrative Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={addAdminRole}
                  onChange={(e) => setAddAdminRole(e.target.value as 'admin' | 'super_admin')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-[#003B8E]"
                >
                  <option value="admin">
                    Operational Admin — Store, Buyer, Product &amp; Order Operations
                  </option>
                  <option value="super_admin">
                    Super Admin — Full Platform Administration &amp; Governance
                  </option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Operational admins cannot invite new admins, promote users, or revoke Super Admin access.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddAdminModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="px-5 py-2.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAction ? 'Authorizing...' : 'Authorize Mobile Number'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: REVOKE ADMINISTRATOR ACCESS
         ==================================================================== */}
      {adminToRevoke && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center shrink-0">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Revoke Admin Access
                  </h3>
                  <p className="text-xs text-slate-500">
                    Immediately strip administrative privileges
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdminToRevoke(null);
                  setRevokeReasonInput('');
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-2">
              <p className="font-semibold">
                You are about to revoke administrative access for:
              </p>
              <div className="font-bold text-slate-900 text-sm">
                {adminToRevoke.name} ({adminToRevoke.phoneE164})
              </div>
              <p className="text-[11px] text-rose-900 leading-relaxed pt-1 border-t border-rose-200/80">
                The user will be immediately blocked from accessing administrative routes and APIs. Their buyer or seller account will remain intact.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-bold text-slate-800">
                Reason for Revocation (logged in audit trail)
              </label>
              <input
                type="text"
                value={revokeReasonInput}
                onChange={(e) => setRevokeReasonInput(e.target.value)}
                placeholder="e.g. Role transition / operational reassignment"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-rose-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setAdminToRevoke(null);
                  setRevokeReasonInput('');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={async () => {
                  const ok = await executeAdminAction(
                    {
                      action: 'REVOKE_ADMIN',
                      phoneE164: adminToRevoke.phoneE164,
                      reason: revokeReasonInput.trim() || 'Revoked by Super Admin.',
                    },
                    `Revoked administrative access for ${adminToRevoke.name} (${adminToRevoke.phoneE164}).`
                  );
                  if (ok) {
                    setAdminToRevoke(null);
                    setRevokeReasonInput('');
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isSubmittingAction ? 'Revoking...' : 'Confirm Revocation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: REACTIVATE ADMINISTRATOR
         ==================================================================== */}
      {adminToReactivate && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Reactivate Admin Access
                  </h3>
                  <p className="text-xs text-slate-500">
                    Restore administrative authorization
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdminToReactivate(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to reactivate administrative access for{' '}
              <strong className="text-slate-900">{adminToReactivate.name}</strong> (
              <span className="font-mono text-emerald-700 font-bold">{adminToReactivate.phoneE164}</span>)?
              They will regain full operational access upon their next sign in via Firebase Phone OTP.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdminToReactivate(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={async () => {
                  const ok = await executeAdminAction(
                    {
                      action: 'REACTIVATE_ADMIN',
                      phoneE164: adminToReactivate.phoneE164,
                    },
                    `Reactivated administrative access for ${adminToReactivate.name} (${adminToReactivate.phoneE164}).`
                  );
                  if (ok) {
                    setAdminToReactivate(null);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isSubmittingAction ? 'Reactivating...' : 'Reactivate Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4: EDIT ADMINISTRATOR DETAILS
         ==================================================================== */}
      {adminToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-[#003B8E] flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Edit Admin Details
                  </h3>
                  <p className="text-xs text-slate-500">
                    Update display name and designation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdminToEdit(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await executeAdminAction(
                  {
                    action: 'UPDATE_ADMIN',
                    phoneE164: adminToEdit.phoneE164,
                    name: editAdminName.trim() || adminToEdit.name,
                    designation: editAdminDesignation.trim() || adminToEdit.designation,
                  },
                  `Updated profile details for administrator ${adminToEdit.phoneE164}.`
                );
                if (ok) {
                  setAdminToEdit(null);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Mobile Number (Read-only ID)
                </label>
                <input
                  type="text"
                  disabled
                  value={adminToEdit.phoneE164}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-mono text-xs text-slate-600 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editAdminName}
                  onChange={(e) => setEditAdminName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#003B8E]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Designation / Role Title
                </label>
                <input
                  type="text"
                  value={editAdminDesignation}
                  onChange={(e) => setEditAdminDesignation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#003B8E]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAdminToEdit(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="px-5 py-2.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAction ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
