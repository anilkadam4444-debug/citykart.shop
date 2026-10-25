'use client';

import Script from 'next/script';
import React, { useState } from 'react';
import {
  Check,
  Zap,
  FileText,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

// Extend window interface for Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}

import {
  BillingTransaction,
  FeaturedCampaign,
  FEATURED_STORE_PACKAGES,
  MerchantServiceOrder,
  MerchantSubscription,
  SPONSORED_PRODUCT_PACKAGES,
  SUBSCRIPTION_PLANS,
  SubscriptionTierId,
  VALUE_ADDED_SERVICES,
  ValueAddedServiceType,
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

interface SellerPlansBillingProps {
  seller: SellerProfile;
  store: LocalStore;
  products: Product[];
  initialTab?: 'plan' | 'advertising' | 'services' | 'invoices';
  initialUpgradeTier?: SubscriptionTierId | null;
  onRefreshEntitlements?: () => void;
}

export function SellerPlansBilling({
  seller,
  store,
  products,
  initialTab = 'plan',
  onRefreshEntitlements,
}: SellerPlansBillingProps) {
  const [activeTab, setActiveTab] = useState<'plan' | 'advertising' | 'services' | 'invoices'>(initialTab);
  const [subscription, setSubscription] = useState<MerchantSubscription>(() =>
    getStoreSubscription(store.id, seller.id)
  );

  const [isAnnualBilling, setIsAnnualBilling] = useState(
    subscription.billingCycle === 'ANNUAL'
  );

  const [transactions, setTransactions] = useState<BillingTransaction[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(BILLING_TX_STORAGE_KEY);
      if (raw) {
        const all = JSON.parse(raw) as BillingTransaction[];
        return all.filter((t) => t.storeId === store.id || t.sellerId === seller.id);
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
        return all.filter((c) => c.storeId === store.id || c.sellerId === seller.id);
      }
    } catch {}
    return [];
  });

  const [serviceOrders, setServiceOrders] = useState<MerchantServiceOrder[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(SERVICE_ORDERS_STORAGE_KEY);
      if (raw) {
        const all = JSON.parse(raw) as MerchantServiceOrder[];
        return all.filter((s) => s.storeId === store.id || s.sellerId === seller.id);
      }
    } catch {}
    return [];
  });

  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Ad Campaign State
  const [adPlacementType, setAdPlacementType] = useState<'FEATURED_STORE' | 'SPONSORED_PRODUCT'>('FEATURED_STORE');
  const [adSelectedProductId, setAdSelectedProductId] = useState<string>(products[0]?.id || '');
  const [adDurationDays, setAdDurationDays] = useState<number>(7);
  const [isLaunchingCampaign, setIsLaunchingCampaign] = useState(false);

  // New Service Booking State
  const [selectedServiceType, setSelectedServiceType] = useState<ValueAddedServiceType>('CATALOGUE_SETUP');
  const [serviceContactPhone, setServiceContactPhone] = useState(seller.phoneE164 || '');
  const [serviceNotes, setServiceNotes] = useState('');
  const [isBookingService, setIsBookingService] = useState(false);

  // Invoice Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<BillingTransaction | null>(null);

  const quota = checkProductQuota(store.id, products.length, subscription.planId);
  const currentPlan = SUBSCRIPTION_PLANS[subscription.planId] || SUBSCRIPTION_PLANS.FREE;

  // Persist updated transactions
  const recordTransactionLocally = (tx: BillingTransaction) => {
    try {
      const raw = window.localStorage.getItem(BILLING_TX_STORAGE_KEY);
      const all: BillingTransaction[] = raw ? JSON.parse(raw) : [];
      const updated = [tx, ...all];
      window.localStorage.setItem(BILLING_TX_STORAGE_KEY, JSON.stringify(updated));
      setTransactions((prev) => [tx, ...prev]);
    } catch {}
  };

  // Persist campaigns
  const recordCampaignLocally = (camp: FeaturedCampaign) => {
    try {
      const raw = window.localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
      const all: FeaturedCampaign[] = raw ? JSON.parse(raw) : [];
      const updated = [camp, ...all];
      window.localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(updated));
      setCampaigns((prev) => [camp, ...prev]);
    } catch {}
  };

  // Persist service orders
  const recordServiceOrderLocally = (order: MerchantServiceOrder) => {
    try {
      const raw = window.localStorage.getItem(SERVICE_ORDERS_STORAGE_KEY);
      const all: MerchantServiceOrder[] = raw ? JSON.parse(raw) : [];
      const updated = [order, ...all];
      window.localStorage.setItem(SERVICE_ORDERS_STORAGE_KEY, JSON.stringify(updated));
      setServiceOrders((prev) => [order, ...prev]);
    } catch {}
  };

  // Handle plan upgrade or switch
  const handleUpgradeOrSwitchPlan = async (targetTier: SubscriptionTierId) => {
    if (targetTier === subscription.planId) {
      setBannerMessage({ text: `Your store is already subscribed to ${currentPlan.name}.`, type: 'error' });
      return;
    }

    setIsProcessingUpgrade(targetTier);
    setBannerMessage(null);

    try {

      const checkoutRes = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error(checkoutData.error || 'Failed to initiate checkout session');
      }

      if (checkoutData.needsConfig) {
        setBannerMessage({ 
          text: 'The Razorpay payment gateway is currently being configured by the platform owner. Please try again in a few minutes or contact support.', 
          type: 'error' 
        });
        setIsProcessingUpgrade(null);
        return;
      }

      const { checkoutSession } = checkoutData;
      const { gatewayOptions } = checkoutSession;


      // Real Razorpay Integration
      if (!(window as any).Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please refresh and try again.');
      }

      const options = {
        ...gatewayOptions,
        handler: async (response: any) => {
          // This callback is executed when payment is successful
          setIsProcessingUpgrade(targetTier);
          try {
            const verifyRes = await fetch('/api/billing/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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
              throw new Error(verifyData.error || 'Payment verification failed');
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
            const msg = err instanceof Error ? err.message : 'Verification failed';
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


  // Handle ad campaign launch
  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLaunchingCampaign(true);
    setBannerMessage(null);

    try {
      const targetProduct = adPlacementType === 'SPONSORED_PRODUCT'
        ? products.find((p) => p.id === adSelectedProductId)
        : undefined;

      const res = await fetch('/api/billing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId: seller.id,
          storeId: store.id,
          storeName: store.name,
          type: adPlacementType,
          targetProductId: targetProduct?.id,
          targetProductName: targetProduct?.name,
          cityId: store.cityId,
          cityName: store.cityName,
          durationDays: adDurationDays,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create campaign');
      }

      recordCampaignLocally(data.campaign);
      recordTransactionLocally(data.transaction);

      setBannerMessage({
        text: `Campaign launched! Your ${adPlacementType === 'FEATURED_STORE' ? 'store' : 'product'} is now boosted in ${store.cityName} with transparent badge labeling.`,
        type: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Campaign launch failed';
      setBannerMessage({ text: msg, type: 'error' });
    } finally {
      setIsLaunchingCampaign(false);
    }
  };

  // Handle service booking
  const handleBookService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceContactPhone.trim()) {
      setBannerMessage({ text: 'Please provide a valid contact mobile number.', type: 'error' });
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
            Plans, Billing &amp; Growth Tools
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your merchant subscription, catalogue quota, city ad boosts, and invoices.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto overflow-x-auto max-w-full">
          {[
            { id: 'plan', label: 'Subscription Plan' },
            { id: 'advertising', label: `Ad Boosts (${campaigns.length})` },
            { id: 'services', label: `Assisted Services (${serviceOrders.length})` },
            { id: 'invoices', label: `Invoices (${transactions.length})` },
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
              <h3 className="text-lg font-extrabold text-slate-900">{store.name}</h3>
              <p className="text-xs text-slate-600">{currentPlan.tagline}</p>
              <div className="text-[11px] text-slate-400">
                Billing Cycle: {subscription.billingCycle.toLowerCase()} · Renewal on{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
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
                <h3 className="text-base font-extrabold text-slate-900">Available Plans</h3>
                <p className="text-xs text-slate-500">
                  Upgrade or switch anytime. 0% commission on all customer orders across all tiers.
                </p>
              </div>

              {/* Annual switch */}
              <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-semibold">
                <span className={!isAnnualBilling ? 'text-slate-900 font-bold' : 'text-slate-500'}>Monthly</span>
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
                <span className={isAnnualBilling ? 'text-slate-900 font-bold' : 'text-slate-500'}>
                  Annual (Save 17%)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {(['FREE', 'GROWTH', 'BUSINESS_PRO'] as SubscriptionTierId[]).map((tierId) => {
                const plan = SUBSCRIPTION_PLANS[tierId];
                const isCurrent = subscription.planId === tierId;
                const price = isAnnualBilling ? plan.annualPriceInr : plan.monthlyPriceInr;
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
                        <h4 className="font-extrabold text-base text-slate-900">{plan.name}</h4>
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
                          {price === 0 ? '₹0' : `₹${price.toLocaleString('en-IN')}`}
                        </span>
                        <span className="text-xs text-slate-500">
                          {price === 0 ? 'forever' : isAnnualBilling ? '/year' : '/month'}
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

      {/* TAB 2: ADVERTISING BOOSTS */}
      {activeTab === 'advertising' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-base font-extrabold text-slate-900">
              Boost Your Store or Products in {store.cityName}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Ethical, high-visibility placements. Boosted stores and products appear prominently to local buyers with transparent &ldquo;Featured&rdquo; or &ldquo;Sponsored&rdquo; badges.
            </p>

            <form onSubmit={handleLaunchCampaign} className="mt-6 space-y-4 max-w-xl">
              {/* Placement Type */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">Placement Objective</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdPlacementType('FEATURED_STORE')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      adPlacementType === 'FEATURED_STORE'
                        ? 'border-[#003B8E] bg-blue-50/60 ring-1 ring-[#003B8E]'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-900">Featured Store</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Top ranking on city home &amp; store lists</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdPlacementType('SPONSORED_PRODUCT')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      adPlacementType === 'SPONSORED_PRODUCT'
                        ? 'border-[#003B8E] bg-blue-50/60 ring-1 ring-[#003B8E]'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-900">Sponsored Product</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Spotlight a specific item in product grid</div>
                  </button>
                </div>
              </div>

              {/* If Sponsored Product: Pick product */}
              {adPlacementType === 'SPONSORED_PRODUCT' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">Select Product to Promote</label>
                  {products.length === 0 ? (
                    <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">
                      You need to add products to your store before promoting one.
                    </div>
                  ) : (
                    <select
                      value={adSelectedProductId}
                      onChange={(e) => setAdSelectedProductId(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (₹{p.price})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Duration & Budget */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">Campaign Duration &amp; Package</label>
                <div className="grid grid-cols-3 gap-3">
                  {(adPlacementType === 'FEATURED_STORE' ? FEATURED_STORE_PACKAGES : SPONSORED_PRODUCT_PACKAGES).map(
                    (pkg) => (
                      <button
                        key={pkg.days}
                        type="button"
                        onClick={() => setAdDurationDays(pkg.days)}
                        className={`p-2.5 rounded-xl border text-center text-xs transition-all cursor-pointer tabular-nums ${
                          adDurationDays === pkg.days
                            ? 'border-[#003B8E] bg-[#003B8E] text-white font-bold'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="font-bold">{pkg.days} Days</div>
                        <div className="text-[11px] opacity-80 mt-0.5">₹{pkg.priceInr}</div>
                      </button>
                    )
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLaunchingCampaign || (adPlacementType === 'SPONSORED_PRODUCT' && products.length === 0)}
                className="mt-2 py-3 px-6 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <Zap className="w-4 h-4" />
                <span>{isLaunchingCampaign ? 'Activating Boost...' : 'Launch Boost Campaign'}</span>
              </button>
            </form>
          </div>

          {/* Active Campaigns List */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">Your Advertising Campaigns</h3>
            {campaigns.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
                No active promotional campaigns yet. Launch a Featured Store boost above to increase your store discoverability.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {campaigns.map((camp) => (
                  <div key={camp.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#003B8E]">
                        {camp.type === 'FEATURED_STORE' ? 'Featured Store' : 'Sponsored Product'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                        {camp.status}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {camp.type === 'SPONSORED_PRODUCT' ? camp.targetProductName : camp.storeName}
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      Target Area: {camp.cityName} · {camp.durationDays} Days (Budget: ₹{camp.budgetInr})
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 tabular-nums">
                      <span>Live until {new Date(camp.endDate).toLocaleDateString()}</span>
                      <span className="font-bold text-slate-900">{camp.impressions} Views · {camp.clicks} Clicks</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ASSISTED ONBOARDING SERVICES */}
      {activeTab === 'services' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-base font-extrabold text-slate-900">Book Assisted Merchant Services</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Let our expert onboarding leads handle your catalogue transcription, bulk spreadsheet inventory imports, or branded custom domain setup.
            </p>

            <form onSubmit={handleBookService} className="mt-6 space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">Select Service</label>
                <select
                  value={selectedServiceType}
                  onChange={(e) => setSelectedServiceType(e.target.value as ValueAddedServiceType)}
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
                <label className="block text-xs font-bold text-slate-800">WhatsApp / Contact Phone</label>
                <input
                  type="text"
                  value={serviceContactPhone}
                  onChange={(e) => setServiceContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">Notes or Custom Domain Name (Optional)</label>
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
                {isBookingService ? 'Submitting...' : `Book Service (₹${VALUE_ADDED_SERVICES[selectedServiceType].priceInr})`}
              </button>
            </form>
          </div>

          {/* Service Orders History */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">Your Service Orders</h3>
            {serviceOrders.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
                No services requested yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                {serviceOrders.map((ord) => (
                  <div key={ord.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{ord.title}</div>
                      <div className="text-[11px] text-slate-500">
                        Booked on {new Date(ord.createdAt).toLocaleDateString()} · Contact: {ord.contactPhone}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold font-mono tabular-nums text-slate-900">₹{ord.amountInr}</span>
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
            <h3 className="text-sm font-extrabold text-slate-900">Official Invoices &amp; Tax Receipts</h3>
            <span className="text-xs text-slate-500">Includes 18% GST itemized</span>
          </div>

          {transactions.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500 space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-bold text-slate-700">No paid billing transactions yet</div>
              <p>Your invoices will appear here as soon as you upgrade to a paid tier or launch a city ad campaign.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-3 px-4 font-bold text-slate-900">Invoice #</th>
                    <th className="py-3 px-4 font-bold text-slate-900">Date</th>
                    <th className="py-3 px-4 font-bold text-slate-900">Description</th>
                    <th className="py-3 px-4 font-bold text-slate-900 text-right">Amount (INR)</th>
                    <th className="py-3 px-4 font-bold text-slate-900 text-center">Status</th>
                    <th className="py-3 px-4 font-bold text-slate-900 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{tx.invoiceNumber}</td>
                      <td className="py-3 px-4 text-slate-600">{new Date(tx.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-slate-800">{tx.description}</td>
                      <td className="py-3 px-4 text-right font-bold font-mono tabular-nums text-slate-900">₹{tx.totalAmount}</td>
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

      {/* Invoice Receipt Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#003B8E]">Citykart Tax Invoice</span>
                <h4 className="font-mono text-sm font-extrabold text-slate-900">{activeReceipt.invoiceNumber}</h4>
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
                <span className="font-bold text-slate-900">{store.name} ({seller.businessOwnerName})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span>{new Date(activeReceipt.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Gateway:</span>
                <span>{activeReceipt.paymentGateway}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Description:</span>
                <span className="font-semibold">{activeReceipt.description}</span>
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
