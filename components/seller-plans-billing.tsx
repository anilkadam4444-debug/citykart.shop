'use client';

import Script from 'next/script';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Check,
  Zap,
  FileText,
  AlertCircle,
  ArrowRight,
  Sparkles,
  BarChart3,
  Eye,
  MousePointerClick,
  Pause,
  Play,
  ShieldCheck,
  Store,
  Tag,
} from 'lucide-react';

// Extend window interface for Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}

import {
  BillingTransaction,
  DEFAULT_SPONSORED_PLACEMENT_CONFIGS,
  FeaturedCampaign,
  FEATURED_STORE_PACKAGES,
  MerchantServiceOrder,
  MerchantSubscription,
  SponsoredPlacementConfig,
  SponsoredPlacementTier,
  SUBSCRIPTION_PLANS,
  SubscriptionTierId,
  VALUE_ADDED_SERVICES,
  ValueAddedServiceType,
  PlatformFeeLedgerEntry,
} from '@/lib/revenue-model';
import {
  BILLING_TX_STORAGE_KEY,
  CAMPAIGNS_STORAGE_KEY,
  checkProductQuota,
  getStoreSubscription,
  saveMerchantSubscriptionToStorage,
  SERVICE_ORDERS_STORAGE_KEY,
} from '@/lib/entitlements';
import { LocalStore, Product, SellerProfile } from '@/lib/catalog-data';
import { buildAuthenticatedHeaders } from '@/lib/firebase';
import { ProductStudioArtwork } from './product-studio-artwork';

interface SellerPlansBillingProps {
  seller: SellerProfile;
  store: LocalStore;
  products: Product[];
  initialTab?: 'plan' | 'advertising' | 'services' | 'invoices';
  initialUpgradeTier?: SubscriptionTierId | null;
  initialPromoteProductId?: string | null;
  onRefreshEntitlements?: () => void;
}

export function SellerPlansBilling({
  seller,
  store,
  products,
  initialTab = 'plan',
  initialPromoteProductId = null,
  onRefreshEntitlements,
}: SellerPlansBillingProps) {
  const [activeTab, setActiveTab] = useState<
    'plan' | 'advertising' | 'services' | 'invoices' | 'fees'
  >(initialPromoteProductId ? 'advertising' : initialTab);

  const [subscription, setSubscription] = useState<MerchantSubscription>(() =>
    getStoreSubscription(store.id, seller.id)
  );

  const [isAnnualBilling, setIsAnnualBilling] = useState(
    subscription.billingCycle === 'ANNUAL'
  );

  // Eligible store products for promotion (published, in-stock, belonging to this store)
  const eligibleProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.storeId === store.id &&
          p.isAvailable &&
          p.stock > 0 &&
          !p.adminUnpublished
      ),
    [products, store.id]
  );

  const [placementConfigs, setPlacementConfigs] = useState<
    Record<SponsoredPlacementTier, SponsoredPlacementConfig>
  >(DEFAULT_SPONSORED_PLACEMENT_CONFIGS);

  const [transactions, setTransactions] = useState<BillingTransaction[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(BILLING_TX_STORAGE_KEY);
      if (raw) {
        const all = JSON.parse(raw) as BillingTransaction[];
        return all.filter(
          (t) => t.storeId === store.id || t.sellerId === seller.id
        );
      }
    } catch {}
    return [];
  });

  const [campaigns, setCampaigns] = useState<FeaturedCampaign[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
      if (raw) {
        const all = JSON.parse(raw) as FeaturedCampaign[];
        return all.filter(
          (c) => c.storeId === store.id || c.sellerId === seller.id
        );
      }
    } catch {}
    return [];
  });

  const [serviceOrders, setServiceOrders] = useState<MerchantServiceOrder[]>(
    () => {
      if (typeof window === 'undefined') return [];
      try {
        const raw = window.localStorage.getItem(SERVICE_ORDERS_STORAGE_KEY);
        if (raw) {
          const all = JSON.parse(raw) as MerchantServiceOrder[];
          return all.filter(
            (s) => s.storeId === store.id || s.sellerId === seller.id
          );
        }
      } catch {}
      return [];
    }
  );

  const [fees, setFees] = useState<PlatformFeeLedgerEntry[]>([]);
  useEffect(() => {
    buildAuthenticatedHeaders(false)
      .then((headers) => fetch(`/api/billing/fees?sellerId=${seller.id}`, { headers }))
      .then(res => res.json())
      .then(data => {
        if (data.ok && Array.isArray(data.fees)) {
          setFees(data.fees);
        }
      })
      .catch(err => console.error('Error fetching fees:', err));
  }, [seller.id]);

  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState<string | null>(
    null
  );
  const [bannerMessage, setBannerMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Sponsored Product & Ad Campaign State
  const [adPlacementType, setAdPlacementType] = useState<
    'FEATURED_STORE' | 'SPONSORED_PRODUCT'
  >('SPONSORED_PRODUCT');
  const [adPlacementTier, setAdPlacementTier] =
    useState<SponsoredPlacementTier>('CATEGORY_SPONSORED');
  const [adSelectedProductId, setAdSelectedProductId] = useState<string>(
    initialPromoteProductId || eligibleProducts[0]?.id || products[0]?.id || ''
  );
  const [adDurationDays, setAdDurationDays] = useState<number>(7);
  const [isLaunchingCampaign, setIsLaunchingCampaign] = useState(false);

  // Sync live campaigns & centralized pricing config from Firestore API
  useEffect(() => {
    let active = true;
    const fetchLiveCampaignsAndPricing = async () => {
      try {
        const res = await fetch(
          `/api/billing/campaigns?storeId=${encodeURIComponent(store.id)}&includeExpired=true`
        );
        const data = await res.json();
        if (!active || !res.ok || !data.ok) return;

        if (data.placementConfigs) {
          setPlacementConfigs(data.placementConfigs);
        }
        if (Array.isArray(data.campaigns)) {
          setCampaigns((prev) => {
            const map = new Map<string, FeaturedCampaign>();
            for (const c of prev) map.set(c.id, c);
            for (const c of data.campaigns as FeaturedCampaign[]) {
              map.set(c.id, c);
            }
            const merged = Array.from(map.values()).sort(
              (a, b) =>
                new Date(b.createdAt || 0).getTime() -
                new Date(a.createdAt || 0).getTime()
            );
            try {
              const raw = window.localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
              const existingAll: FeaturedCampaign[] = raw
                ? JSON.parse(raw)
                : [];
              const globalMap = new Map<string, FeaturedCampaign>();
              for (const c of existingAll) globalMap.set(c.id, c);
              for (const c of merged) globalMap.set(c.id, c);
              window.localStorage.setItem(
                CAMPAIGNS_STORAGE_KEY,
                JSON.stringify(Array.from(globalMap.values()))
              );
            } catch {}
            return merged;
          });
        }
      } catch {
        // Ignore network errors on background sync
      }
    };

    void fetchLiveCampaignsAndPricing();
    return () => {
      active = false;
    };
  }, [store.id]);

  // New Service Booking State
  const [selectedServiceType, setSelectedServiceType] =
    useState<ValueAddedServiceType>('CATALOGUE_SETUP');
  const [serviceContactPhone, setServiceContactPhone] = useState(
    seller.phoneE164 || ''
  );
  const [serviceNotes, setServiceNotes] = useState('');
  const [isBookingService, setIsBookingService] = useState(false);

  // Invoice Receipt Modal State
  const [activeReceipt, setActiveReceipt] =
    useState<BillingTransaction | null>(null);

  const quota = checkProductQuota(
    store.id,
    products.length,
    subscription.planId
  );
  const currentPlan =
    SUBSCRIPTION_PLANS[subscription.planId] || SUBSCRIPTION_PLANS.FREE;

  // Persist updated transactions
  const recordTransactionLocally = (tx: BillingTransaction) => {
    try {
      const raw = window.localStorage.getItem(BILLING_TX_STORAGE_KEY);
      const all: BillingTransaction[] = raw ? JSON.parse(raw) : [];
      const updated = [tx, ...all.filter((t) => t.id !== tx.id)];
      window.localStorage.setItem(
        BILLING_TX_STORAGE_KEY,
        JSON.stringify(updated)
      );
      setTransactions((prev) => [tx, ...prev.filter((t) => t.id !== tx.id)]);
    } catch {}
  };

  // Persist campaigns
  const recordCampaignLocally = (camp: FeaturedCampaign) => {
    try {
      const raw = window.localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
      const all: FeaturedCampaign[] = raw ? JSON.parse(raw) : [];
      const updated = [camp, ...all.filter((c) => c.id !== camp.id)];
      window.localStorage.setItem(
        CAMPAIGNS_STORAGE_KEY,
        JSON.stringify(updated)
      );
      setCampaigns((prev) => [camp, ...prev.filter((c) => c.id !== camp.id)]);
    } catch {}
  };

  // Persist service orders
  const recordServiceOrderLocally = (order: MerchantServiceOrder) => {
    try {
      const raw = window.localStorage.getItem(SERVICE_ORDERS_STORAGE_KEY);
      const all: MerchantServiceOrder[] = raw ? JSON.parse(raw) : [];
      const updated = [order, ...all];
      window.localStorage.setItem(
        SERVICE_ORDERS_STORAGE_KEY,
        JSON.stringify(updated)
      );
      setServiceOrders((prev) => [order, ...prev]);
    } catch {}
  };

  // Selected Product & Price Calculation for Ad Preview
  const selectedProductToPromote = useMemo(
    () =>
      eligibleProducts.find((p) => p.id === adSelectedProductId) ||
      eligibleProducts[0] ||
      null,
    [eligibleProducts, adSelectedProductId]
  );

  const activePlacementConfig =
    placementConfigs[adPlacementTier] ||
    DEFAULT_SPONSORED_PLACEMENT_CONFIGS.CATEGORY_SPONSORED;

  const availableDurationPackages =
    adPlacementType === 'FEATURED_STORE'
      ? FEATURED_STORE_PACKAGES
      : activePlacementConfig.packages;

  const selectedDurationPackage =
    availableDurationPackages.find((p) => p.days === adDurationDays) ||
    availableDurationPackages[0];

  const calculatedBaseFeeInr = selectedDurationPackage?.priceInr || 99;
  const calculatedGstInr = Math.round(calculatedBaseFeeInr * 0.18 * 100) / 100;
  const calculatedTotalInr =
    Math.round((calculatedBaseFeeInr + calculatedGstInr) * 100) / 100;

  // Aggregate Campaign Performance Analytics
  const campaignAnalytics = useMemo(() => {
    const activeCount = campaigns.filter((c) => c.status === 'ACTIVE').length;
    const totalImpressions = campaigns.reduce(
      (sum, c) => sum + (Number(c.impressions) || 0),
      0
    );
    const totalClicks = campaigns.reduce(
      (sum, c) => sum + (Number(c.clicks) || 0),
      0
    );
    const ctrPercent =
      totalImpressions > 0
        ? ((totalClicks / totalImpressions) * 100).toFixed(2)
        : '0.00';
    const totalSpendInr = campaigns
      .filter((c) => c.paymentStatus !== 'FAILED' && c.status !== 'REJECTED')
      .reduce((sum, c) => sum + (Number(c.budgetInr) || 0), 0);

    return {
      activeCount,
      totalImpressions,
      totalClicks,
      ctrPercent,
      totalSpendInr,
    };
  }, [campaigns]);

  // Handle plan upgrade or switch
  const handleUpgradeOrSwitchPlan = async (targetTier: SubscriptionTierId) => {
    if (targetTier === subscription.planId) {
      setBannerMessage({
        text: `Your store is already subscribed to ${currentPlan.name}.`,
        type: 'error',
      });
      return;
    }

    setIsProcessingUpgrade(targetTier);
    setBannerMessage(null);

    try {
      const authHeaders = await buildAuthenticatedHeaders(true);
      const checkoutRes = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          sellerId: seller.id,
          storeId: store.id,
          planId: targetTier,
          billingCycle: isAnnualBilling ? 'ANNUAL' : 'MONTHLY',
          currency: 'INR',
        }),
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok || !checkoutData.success) {
        throw new Error(
          checkoutData.error || 'Failed to initiate checkout session'
        );
      }

      if (checkoutData.needsConfig) {
        setBannerMessage({
          text: 'The Razorpay payment gateway is currently being configured by the platform owner. Please try again in a few minutes or contact support.',
          type: 'error',
        });
        setIsProcessingUpgrade(null);
        return;
      }

      const { checkoutSession } = checkoutData;
      const { gatewayOptions } = checkoutSession;

      if (!(window as any).Razorpay) {
        throw new Error(
          'Razorpay SDK failed to load. Please refresh and try again.'
        );
      }

      const options = {
        ...gatewayOptions,
        handler: async (response: any) => {
          setIsProcessingUpgrade(targetTier);
          try {
            const verifyHeaders = await buildAuthenticatedHeaders(true);
            const verifyRes = await fetch('/api/billing/verify-payment', {
              method: 'POST',
              headers: verifyHeaders,
              body: JSON.stringify({
                sellerId: seller.id,
                storeId: store.id,
                planId: targetTier,
                billingCycle: isAnnualBilling ? 'ANNUAL' : 'MONTHLY',
                currency: 'INR',
                paymentGateway: 'RAZORPAY',
                gatewayPaymentId: response.razorpay_payment_id,
                gatewayOrderId: response.razorpay_order_id,
                gatewaySignature: response.razorpay_signature,
                invoiceNumber: checkoutSession.invoiceNumber,
                totalAmount: checkoutSession.totalAmount,
                taxAmount: checkoutSession.taxAmount,
                basePrice: checkoutSession.basePrice,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(
                verifyData.error || 'Payment verification failed'
              );
            }

            const newSub: MerchantSubscription = verifyData.subscription;
            saveMerchantSubscriptionToStorage(newSub);
            setSubscription(newSub);

            if (verifyData.transaction) {
              recordTransactionLocally(verifyData.transaction);
            }

            if (onRefreshEntitlements) {
              onRefreshEntitlements();
            }

            setBannerMessage({
              text: `Success! Your plan has been upgraded to ${SUBSCRIPTION_PLANS[targetTier].name}. All benefits and catalogue limits are immediately active.`,
              type: 'success',
            });
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : 'Verification failed';
            setBannerMessage({ text: msg, type: 'error' });
          } finally {
            setIsProcessingUpgrade(null);
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessingUpgrade(null);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Plan switch failed';
      setBannerMessage({ text: msg, type: 'error' });
      setIsProcessingUpgrade(null);
    }
  };

  // Handle Sponsored Campaign Launch & Payment Verification
  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adPlacementType === 'SPONSORED_PRODUCT' && !selectedProductToPromote) {
      setBannerMessage({
        text: 'Please select an eligible published product from your store to promote.',
        type: 'error',
      });
      return;
    }

    setIsLaunchingCampaign(true);
    setBannerMessage(null);

    try {
      const res = await fetch('/api/billing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'LAUNCH_CAMPAIGN',
          sellerId: seller.id,
          storeId: store.id,
          storeName: store.name,
          type: adPlacementType,
          placementTier:
            adPlacementType === 'SPONSORED_PRODUCT'
              ? adPlacementTier
              : undefined,
          targetProductId: selectedProductToPromote?.id,
          targetProductName: selectedProductToPromote?.name,
          categoryId: selectedProductToPromote?.categoryId || store.categoryId,
          categoryName: selectedProductToPromote?.category || store.category,
          cityId: store.cityId,
          cityName: store.cityName,
          durationDays: selectedDurationPackage.days,
          initiateRazorpayOrder: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initiate campaign order');
      }

      // If Razorpay live/test order was created by server, open Razorpay Checkout modal
      if (
        data.requiresRazorpayCheckout &&
        data.gatewayOptions &&
        (window as any).Razorpay
      ) {
        const options = {
          ...data.gatewayOptions,
          handler: async (rzpResponse: any) => {
            try {
              const verifyRes = await fetch('/api/billing/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'VERIFY_PAYMENT',
                  campaignId: data.campaignId || data.campaignDraft?.id,
                  campaignDraft: data.campaignDraft,
                  gatewayPaymentId: rzpResponse.razorpay_payment_id,
                  gatewayOrderId: rzpResponse.razorpay_order_id,
                  gatewaySignature: rzpResponse.razorpay_signature,
                }),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok || !verifyData.success) {
                throw new Error(
                  verifyData.error || 'Payment signature verification failed'
                );
              }
              recordCampaignLocally(verifyData.campaign);
              recordTransactionLocally(verifyData.transaction);
              setBannerMessage({
                text:
                  verifyData.message ||
                  'Payment verified! Your sponsored campaign is now live.',
                type: 'success',
              });
            } catch (verifyErr) {
              setBannerMessage({
                text:
                  verifyErr instanceof Error
                    ? verifyErr.message
                    : 'Payment verification failed',
                type: 'error',
              });
            } finally {
              setIsLaunchingCampaign(false);
            }
          },
          modal: {
            ondismiss: () => {
              setIsLaunchingCampaign(false);
            },
          },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        return;
      }

      // Direct verified activation
      if (data.campaign) recordCampaignLocally(data.campaign);
      if (data.transaction) recordTransactionLocally(data.transaction);

      setBannerMessage({
        text:
          data.message ||
          `Campaign launched! Your ${
            adPlacementType === 'FEATURED_STORE' ? 'store' : 'product'
          } is now boosted in ${store.cityName} with transparent "Sponsored" labeling.`,
        type: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Campaign launch failed';
      setBannerMessage({ text: msg, type: 'error' });
    } finally {
      setIsLaunchingCampaign(false);
    }
  };

  // Toggle Seller's Own Campaign Pause/Resume
  const handleToggleSellerCampaignStatus = async (camp: FeaturedCampaign) => {
    const nextStatus = camp.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const res = await fetch('/api/billing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SELLER_PAUSE_RESUME',
          campaignId: camp.id,
          sellerId: seller.id,
          storeId: store.id,
          status: nextStatus,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const updated: FeaturedCampaign = data.campaign || {
          ...camp,
          status: nextStatus,
        };
        recordCampaignLocally(updated);
        setBannerMessage({
          text: `Campaign "${camp.targetProductName || camp.storeName}" is now ${nextStatus.toLowerCase()}.`,
          type: 'success',
        });
      } else {
        setBannerMessage({
          text: data.error || 'Could not update campaign status.',
          type: 'error',
        });
      }
    } catch {}
  };

  // Handle service booking
  const handleBookService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceContactPhone.trim()) {
      setBannerMessage({
        text: 'Please provide a valid contact mobile number.',
        type: 'error',
      });
      return;
    }

    setIsBookingService(true);
    setBannerMessage(null);

    try {
      const res = await fetch('/api/billing/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId: seller.id,
          storeId: store.id,
          serviceType: selectedServiceType,
          contactPhone: serviceContactPhone.trim(),
          notes: serviceNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit service booking');
      }

      recordServiceOrderLocally(data.serviceOrder);
      recordTransactionLocally(data.transaction);
      setServiceNotes('');

      setBannerMessage({
        text: data.message || 'Service booked successfully.',
        type: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Service booking failed';
      setBannerMessage({ text: msg, type: 'error' });
    } finally {
      setIsBookingService(false);
    }
  };

  return (
    <div className="space-y-6">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
      {/* Top Banner Message */}
      {bannerMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start gap-3 ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-red-50 border border-red-200 text-red-900'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{bannerMessage.text}</div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
            Plans, Sponsored Campaigns &amp; Billing
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Promote products in {store.cityName}, manage your merchant
            subscription, and view GST tax invoices.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto overflow-x-auto max-w-full">
          {[
            { id: 'plan', label: 'Subscription Plan' },
            {
              id: 'advertising',
              label: `Sponsored Campaigns (${campaigns.length})`,
            },
            {
              id: 'services',
              label: `Assisted Services (${serviceOrders.length})`,
            },
            { id: 'invoices', label: `Invoices (${transactions.length})` },
            { id: 'fees', label: `Platform Fees (${fees.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                activeTab === tab.id
                  ? 'bg-white text-[#003B8E] font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: SUBSCRIPTION PLAN & QUOTA */}
      {activeTab === 'plan' && (
        <div className="space-y-6">
          {/* Current Plan Overview Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Current Store Plan
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide bg-[#003B8E] text-white">
                  {currentPlan.name}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {subscription.status}
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">
                {store.name}
              </h3>
              <p className="text-xs text-slate-600">{currentPlan.tagline}</p>
              <div className="text-[11px] text-slate-400">
                Billing Cycle: {(subscription.billingCycle || 'MONTHLY').toLowerCase()} ·
                Renewal on{' '}
                {new Date(subscription.currentPeriodEnd || Date.now()).toLocaleDateString()}
              </div>
            </div>

            {/* Quota Progress Meter */}
            <div className="w-full md:w-72 bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 tabular-nums">
                <span>Catalogue Quota</span>
                <span>
                  {quota.isUnlimited
                    ? `${products.length} (Unlimited)`
                    : `${products.length} / ${quota.maxAllowed} SKUs`}
                </span>
              </div>
              {!quota.isUnlimited && (
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-full ${
                      quota.isOverQuota
                        ? 'bg-red-500'
                        : quota.quotaPercent > 80
                          ? 'bg-amber-500'
                          : 'bg-[#003B8E]'
                    }`}
                    style={{ width: `${Math.min(100, quota.quotaPercent)}%` }}
                  />
                </div>
              )}
              <div className="text-[11px] text-slate-500">
                {quota.isUnlimited
                  ? 'No catalogue limit. Add as many products as you need.'
                  : quota.isOverQuota
                    ? 'Over quota: existing products remain active, but you cannot add new ones until you upgrade.'
                    : `${quota.remaining} slots remaining on ${currentPlan.name}.`}
              </div>
            </div>
          </div>

          {/* Plan Comparison & Upgrade Grid */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Available Plans
                </h3>
                <p className="text-xs text-slate-500">
                  Upgrade or switch anytime. 0% commission on all customer
                  orders across all tiers.
                </p>
              </div>

              {/* Annual switch */}
              <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-semibold">
                <span
                  className={
                    !isAnnualBilling
                      ? 'text-slate-900 font-bold'
                      : 'text-slate-500'
                  }
                >
                  Monthly
                </span>
                <button
                  type="button"
                  onClick={() => setIsAnnualBilling(!isAnnualBilling)}
                  aria-label="Toggle annual billing in dashboard"
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    isAnnualBilling ? 'bg-[#003B8E]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${
                      isAnnualBilling ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span
                  className={
                    isAnnualBilling
                      ? 'text-slate-900 font-bold'
                      : 'text-slate-500'
                  }
                >
                  Annual (Save 17%)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {(
                ['FREE', 'GROWTH', 'BUSINESS_PRO'] as SubscriptionTierId[]
              ).map((tierId) => {
                const plan = SUBSCRIPTION_PLANS[tierId];
                const isCurrent = subscription.planId === tierId;
                const price = isAnnualBilling
                  ? plan.annualPriceInr
                  : plan.monthlyPriceInr;
                const isUpgrading = isProcessingUpgrade === tierId;

                return (
                  <div
                    key={tierId}
                    className={`rounded-2xl p-5 border flex flex-col justify-between transition-all ${
                      isCurrent
                        ? 'bg-slate-50/70 border-slate-400 ring-1 ring-slate-400/50'
                        : tierId === 'GROWTH'
                          ? 'bg-white border-2 border-[#003B8E] shadow-md'
                          : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-extrabold text-base text-slate-900">
                          {plan.name}
                        </h4>
                        {isCurrent && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200 text-slate-800">
                            Active
                          </span>
                        )}
                        {!isCurrent && plan.badge && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#F96302] text-white">
                            {plan.badge}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                          {price === 0
                            ? '₹0'
                            : `₹${price.toLocaleString('en-IN')}`}
                        </span>
                        <span className="text-xs text-slate-500">
                          {price === 0
                            ? 'forever'
                            : isAnnualBilling
                              ? '/year'
                              : '/month'}
                        </span>
                      </div>

                      <ul className="mt-4 space-y-2 text-xs text-slate-700">
                        {plan.highlightedFeatures.map((feat, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100">
                      {isCurrent ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs cursor-default"
                        >
                          Current Plan
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(isProcessingUpgrade)}
                          onClick={() => handleUpgradeOrSwitchPlan(tierId)}
                          className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                            tierId === 'GROWTH'
                              ? 'bg-[#F96302] hover:bg-[#E05500] text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-[#003B8E] border border-slate-300'
                          }`}
                        >
                          {isUpgrading ? (
                            <span>Activating...</span>
                          ) : (
                            <>
                              <span>Switch to {plan.name}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SPONSORED PRODUCT LISTINGS & PROMOTIONAL CAMPAIGNS */}
      {activeTab === 'advertising' && (
        <div className="space-y-6">
          {/* Performance Analytics KPI Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F96302]" />
                <span>Active Campaigns</span>
              </div>
              <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">
                {campaignAnalytics.activeCount}
              </div>
              <div className="text-[11px] text-slate-500">
                Live in {store.cityName}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-[#003B8E]" />
                <span>Total Impressions</span>
              </div>
              <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">
                {campaignAnalytics.totalImpressions.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500">
                Verified buyer views
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5 text-emerald-600" />
                <span>Clicks &amp; CTR</span>
              </div>
              <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">
                {campaignAnalytics.totalClicks}{' '}
                <span className="text-xs font-semibold text-emerald-700">
                  ({campaignAnalytics.ctrPercent}%)
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Click-through rate
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
                <span>Total Ad Spend</span>
              </div>
              <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">
                ₹{campaignAnalytics.totalSpendInr.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500">
                Incl. 18% GST invoices
              </div>
            </div>
          </div>

          {/* Campaign Builder + Live Sponsored Preview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Campaign Configuration Form */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Promote a Product or Store in {store.cityName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select an eligible product, choose your placement tier and
                    duration, and review transparent pricing before payment.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-900 uppercase shrink-0">
                  Proposed Launch Rates
                </span>
              </div>

              <form onSubmit={handleLaunchCampaign} className="mt-5 space-y-5">
                {/* 1. Campaign Type */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    1. Choose Promotion Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAdPlacementType('SPONSORED_PRODUCT');
                        setAdDurationDays(7);
                      }}
                      className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        adPlacementType === 'SPONSORED_PRODUCT'
                          ? 'border-[#003B8E] bg-blue-50/60 ring-1 ring-[#003B8E]'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#F96302]" />
                        <span>Sponsored Product Listing</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Promote a specific item in Category, City, or Homepage
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAdPlacementType('FEATURED_STORE');
                        setAdDurationDays(7);
                      }}
                      className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        adPlacementType === 'FEATURED_STORE'
                          ? 'border-[#003B8E] bg-blue-50/60 ring-1 ring-[#003B8E]'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-[#003B8E]" />
                        <span>Featured Store Spotlight</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Highlight your entire storefront in {store.cityName}
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. Select Eligible Product (if Sponsored Product) */}
                {adPlacementType === 'SPONSORED_PRODUCT' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-800">
                        2. Select Eligible Store Product
                      </label>
                      {eligibleProducts.length === 0 ? (
                        <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">
                          You have no published, in-stock products eligible for
                          promotion. Please add or restock a product first.
                        </div>
                      ) : (
                        <select
                          value={
                            selectedProductToPromote?.id || adSelectedProductId
                          }
                          onChange={(e) =>
                            setAdSelectedProductId(e.target.value)
                          }
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900"
                        >
                          {eligibleProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — ₹{p.price} ({p.category} · Stock:{' '}
                              {p.stock})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* 3. Select Advertising Placement Tier */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-800">
                        3. Select Advertising Placement
                      </label>
                      <div className="space-y-2.5">
                        {(
                          [
                            'CATEGORY_SPONSORED',
                            'LOCAL_FEATURED',
                            'HOMEPAGE_SPONSORED',
                          ] as SponsoredPlacementTier[]
                        ).map((tierKey) => {
                          const cfg =
                            placementConfigs[tierKey] ||
                            DEFAULT_SPONSORED_PLACEMENT_CONFIGS[tierKey];
                          const isSelected = adPlacementTier === tierKey;
                          const startingPrice = cfg.packages[0]?.priceInr || 99;

                          return (
                            <button
                              key={tierKey}
                              type="button"
                              disabled={!cfg.isEnabled}
                              onClick={() => {
                                setAdPlacementTier(tierKey);
                                if (
                                  !cfg.packages.some(
                                    (pk) => pk.days === adDurationDays
                                  )
                                ) {
                                  setAdDurationDays(
                                    cfg.packages[0]?.days || 7
                                  );
                                }
                              }}
                              className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
                                !cfg.isEnabled
                                  ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                                  : isSelected
                                    ? 'border-[#003B8E] bg-blue-50/50 ring-1 ring-[#003B8E]'
                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-extrabold text-slate-900">
                                    {cfg.name}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                                    Badge: {cfg.badgeLabel}
                                  </span>
                                  {!cfg.isEnabled && (
                                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">
                                      Disabled by Admin
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-600">
                                  {cfg.description}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs font-extrabold font-mono text-[#003B8E]">
                                  From ₹{startingPrice}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  + 18% GST
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* 4. Select Duration */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    {adPlacementType === 'SPONSORED_PRODUCT' ? '4.' : '2.'}{' '}
                    Select Campaign Duration
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {availableDurationPackages.map((pkg) => (
                      <button
                        key={pkg.days}
                        type="button"
                        onClick={() => setAdDurationDays(pkg.days)}
                        className={`p-3 rounded-xl border text-center text-xs transition-all cursor-pointer tabular-nums ${
                          selectedDurationPackage?.days === pkg.days
                            ? 'border-[#003B8E] bg-[#003B8E] text-white font-bold shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="font-extrabold">{pkg.days} Days</div>
                        <div className="text-sm font-mono mt-0.5">
                          ₹{pkg.priceInr.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] opacity-80 mt-0.5">
                          {pkg.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Summary Box */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>
                      Base Campaign Fee ({selectedDurationPackage?.days} Days):
                    </span>
                    <span className="font-mono font-semibold text-slate-900">
                      ₹{calculatedBaseFeeInr.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Applicable GST (18%):</span>
                    <span className="font-mono font-semibold text-slate-900">
                      ₹{calculatedGstInr.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-extrabold text-slate-900">
                    <span>Total Payable Amount (INR):</span>
                    <span className="font-mono text-[#003B8E]">
                      ₹{calculatedTotalInr.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    isLaunchingCampaign ||
                    (adPlacementType === 'SPONSORED_PRODUCT' &&
                      !selectedProductToPromote)
                  }
                  className="w-full py-3 px-6 rounded-xl bg-[#F96302] hover:bg-[#E05500] disabled:bg-slate-300 text-white font-bold text-xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <Zap className="w-4 h-4" />
                  <span>
                    {isLaunchingCampaign
                      ? 'Verifying & Activating Campaign...'
                      : `Pay ₹${calculatedTotalInr.toLocaleString('en-IN')} & Launch Sponsored Campaign`}
                  </span>
                </button>
              </form>
            </div>

            {/* Right Column: Live Buyer-Facing Sponsored Card Preview */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Live Buyer Card Preview
                  </span>
                  <span className="text-[11px] font-semibold text-[#003B8E]">
                    {store.cityName} Discovery
                  </span>
                </div>

                {adPlacementType === 'SPONSORED_PRODUCT' &&
                selectedProductToPromote ? (
                  <div className="rounded-2xl border-2 border-amber-300/90 bg-white overflow-hidden shadow-md">
                    <div className="relative h-44 bg-slate-100">
                      <ProductStudioArtwork
                        preset={selectedProductToPromote.artworkPreset}
                        customImageUrl={selectedProductToPromote.customImageUrl}
                        alt={selectedProductToPromote.name}
                        className="w-full h-full"
                      />
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider shadow-xs inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>{activePlacementConfig.badgeLabel}</span>
                        </span>
                      </div>
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-slate-900/80 text-white text-[10px] font-semibold backdrop-blur-xs">
                          {selectedProductToPromote.category}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                          {selectedProductToPromote.deliveryMins} mins
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="text-[11px] font-semibold text-[#003B8E] truncate">
                        {store.name} · {store.neighborhood}
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 line-clamp-1">
                        {selectedProductToPromote.name}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {selectedProductToPromote.description}
                      </p>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-base font-extrabold font-mono text-slate-900">
                          ₹{selectedProductToPromote.price}
                        </span>
                        <span className="px-3 py-1.5 rounded-xl bg-[#F96302] text-white text-xs font-bold">
                          + Add
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl border-2 border-amber-300 bg-amber-50/30 space-y-2">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-extrabold uppercase">
                      Featured Store in {store.cityName}
                    </span>
                    <h4 className="text-base font-extrabold text-slate-900">
                      {store.name}
                    </h4>
                    <p className="text-xs text-slate-600">
                      {store.category} · {store.neighborhood}
                    </p>
                  </div>
                )}

                {/* Relevance & Trust Guarantee Box */}
                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-slate-700 space-y-1.5">
                  <div className="font-bold text-[#003B8E] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Citykart Relevance &amp; Trust Policy</span>
                  </div>
                  <p>
                    Sponsored listings are strictly scoped to{' '}
                    <strong>{store.cityName}</strong> and matching category or
                    search queries. Expired or out-of-stock products
                    automatically stop displaying.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Active & Past Campaigns History */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">
              Your Sponsored Campaigns &amp; Performance
            </h3>
            {campaigns.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
                No promotional campaigns launched yet. Select a product above to
                boost its visibility in {store.cityName}.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campaigns.map((camp) => {
                  const ctr =
                    camp.impressions > 0
                      ? ((camp.clicks / camp.impressions) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <div
                      key={camp.id}
                      className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#003B8E]">
                          {camp.placementLabel ||
                            (camp.type === 'FEATURED_STORE'
                              ? 'Featured Store'
                              : 'Sponsored Product')}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                              camp.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : camp.status === 'PAUSED'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : camp.status === 'REJECTED'
                                    ? 'bg-red-50 text-red-800 border-red-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {camp.status}
                          </span>
                          {camp.paymentStatus && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-50 text-[#003B8E] border border-blue-200">
                              {camp.paymentStatus}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {camp.type === 'SPONSORED_PRODUCT'
                            ? camp.targetProductName
                            : camp.storeName}
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                          City: {camp.cityName} · {camp.durationDays} Days ·
                          Total Paid: ₹{camp.budgetInr}
                        </div>
                        {camp.paymentReferenceId && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            Ref: {camp.paymentReferenceId}
                          </div>
                        )}
                      </div>

                      {camp.adminNotes && (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                          <strong>Admin Note:</strong> {camp.adminNotes}
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 tabular-nums">
                        <span>
                          Valid until{' '}
                          {new Date(camp.endDate || Date.now()).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900">
                            {camp.impressions} Views · {camp.clicks} Clicks (
                            {ctr}% CTR)
                          </span>
                          {(camp.status === 'ACTIVE' ||
                            camp.status === 'PAUSED') && (
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleSellerCampaignStatus(camp)
                              }
                              className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                            >
                              {camp.status === 'ACTIVE' ? (
                                <>
                                  <Pause className="w-3 h-3" />
                                  <span>Pause</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3" />
                                  <span>Resume</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ASSISTED ONBOARDING SERVICES */}
      {activeTab === 'services' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-base font-extrabold text-slate-900">
              Book Assisted Merchant Services
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Let our expert onboarding leads handle your catalogue
              transcription, bulk spreadsheet inventory imports, or branded
              custom domain setup.
            </p>

            <form
              onSubmit={handleBookService}
              className="mt-6 space-y-4 max-w-xl"
            >
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Select Service
                </label>
                <select
                  value={selectedServiceType}
                  onChange={(e) =>
                    setSelectedServiceType(
                      e.target.value as ValueAddedServiceType
                    )
                  }
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                >
                  {Object.values(VALUE_ADDED_SERVICES).map((srv) => (
                    <option key={srv.type} value={srv.type}>
                      {srv.title} — ₹{srv.priceInr} ({srv.billingFrequency})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {VALUE_ADDED_SERVICES[selectedServiceType].description}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  WhatsApp / Contact Phone
                </label>
                <input
                  type="text"
                  value={serviceContactPhone}
                  onChange={(e) => setServiceContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Notes or Custom Domain Name (Optional)
                </label>
                <textarea
                  rows={2}
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  placeholder="e.g. Please call between 2 PM and 5 PM, or enter shop.mybrand.com"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={isBookingService}
                className="py-2.5 px-5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
              >
                {isBookingService
                  ? 'Submitting...'
                  : `Book Service (₹${VALUE_ADDED_SERVICES[selectedServiceType].priceInr})`}
              </button>
            </form>
          </div>

          {/* Service Orders History */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">
              Your Service Orders
            </h3>
            {serviceOrders.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
                No services requested yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                {serviceOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {ord.title}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Booked on {new Date(ord.createdAt).toLocaleDateString()}{' '}
                        · Contact: {ord.contactPhone}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold font-mono tabular-nums text-slate-900">
                        ₹{ord.amountInr}
                      </span>
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 uppercase">
                        {ord.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: INVOICES & BILLING LEDGER */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              Official Invoices &amp; Tax Receipts
            </h3>
            <span className="text-xs text-slate-500">
              Includes 18% GST itemized
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500 space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-bold text-slate-700">
                No paid billing transactions yet
              </div>
              <p>
                Your invoices will appear here as soon as you upgrade to a paid
                tier or launch a sponsored product campaign.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-3 px-4 font-bold text-slate-900">
                      Invoice #
                    </th>
                    <th className="py-3 px-4 font-bold text-slate-900">Date</th>
                    <th className="py-3 px-4 font-bold text-slate-900">
                      Description
                    </th>
                    <th className="py-3 px-4 font-bold text-slate-900 text-right">
                      Amount (INR)
                    </th>
                    <th className="py-3 px-4 font-bold text-slate-900 text-center">
                      Status
                    </th>
                    <th className="py-3 px-4 font-bold text-slate-900 text-center">
                      Receipt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {tx.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        {tx.description}
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono tabular-nums text-slate-900">
                        ₹{tx.totalAmount}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setActiveReceipt(tx)}
                          className="font-bold text-[#003B8E] underline hover:text-[#002D6E] cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'fees' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              Platform Fee Ledger
            </h3>
          </div>
          {fees.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500 space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-bold text-slate-700">No platform fees yet</div>
              <p>Platform fees accrued on delivered orders will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-3 px-4 font-bold text-slate-900">Order ID</th>
                    <th className="py-3 px-4 font-bold text-slate-900">Date</th>
                    <th className="py-3 px-4 font-bold text-slate-900 text-right">Fee</th>
                    <th className="py-3 px-4 font-bold text-slate-900 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fees.map((fee) => (
                    <tr key={fee.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{fee.orderId}</td>
                      <td className="py-3 px-4 text-slate-600">{new Date(fee.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-right font-bold font-mono tabular-nums text-slate-900">₹{fee.totalFee}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${
                          fee.status === 'paid' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          fee.status === 'reserved_for_invoice' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {fee.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invoice Receipt Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#003B8E]">
                  Citykart Tax Invoice
                </span>
                <h4 className="font-mono text-sm font-extrabold text-slate-900">
                  {activeReceipt.invoiceNumber}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="text-xs space-y-2 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Billed To:</span>
                <span className="font-bold text-slate-900">
                  {store.name} ({seller.businessOwnerName})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span>
                  {new Date(activeReceipt.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Gateway:</span>
                <span>{activeReceipt.paymentGateway}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Description:</span>
                <span className="font-semibold">
                  {activeReceipt.description}
                </span>
              </div>
            </div>

            <hr className="border-slate-100" />

            <div className="space-y-1.5 text-xs tabular-nums">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Base fee):</span>
                <span>₹{activeReceipt.amount}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST (18% itemized):</span>
                <span>₹{activeReceipt.taxAmount}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-100">
                <span>Total Paid:</span>
                <span>₹{activeReceipt.totalAmount}</span>
              </div>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="w-full py-2.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
