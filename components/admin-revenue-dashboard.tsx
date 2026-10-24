'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  CreditCard,
  Users,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  FileText,
  Zap,
  Filter,
} from 'lucide-react';
import {
  BillingTransaction,
  FeaturedCampaign,
  MerchantServiceOrder,
  MerchantSubscription,
  PlatformRevenueMetrics,
  SUBSCRIPTION_PLANS,
  SubscriptionTierId,
} from '@/lib/revenue-model';
import {
  BILLING_TX_STORAGE_KEY,
  CAMPAIGNS_STORAGE_KEY,
  loadMerchantSubscriptionsFromStorage,
  SERVICE_ORDERS_STORAGE_KEY,
} from '@/lib/entitlements';
import { LocalStore, SellerProfile } from '@/lib/catalog-data';

interface AdminRevenueDashboardProps {
  sellers: SellerProfile[];
  stores: LocalStore[];
}

export function AdminRevenueDashboard({ sellers, stores }: AdminRevenueDashboardProps) {
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('ALL');

  // Load actual subscriptions
  const allSubs = useMemo(() => {
    const rawSubs = loadMerchantSubscriptionsFromStorage();
    return rawSubs;
  }, []);

  // Load actual billing transactions
  const transactions = useMemo<BillingTransaction[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(BILLING_TX_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  // Load actual ad campaigns
  const campaigns = useMemo<FeaturedCampaign[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  // Load actual service orders
  const serviceOrders = useMemo<MerchantServiceOrder[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(SERVICE_ORDERS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  // Unique cities from stores for filtering
  const availableCities = useMemo(() => {
    const cityMap = new Map<string, string>();
    stores.forEach((st) => {
      if (st.cityId && st.cityName) {
        cityMap.set(st.cityId, st.cityName);
      }
    });
    return Array.from(cityMap.entries()).map(([id, name]) => ({ id, name }));
  }, [stores]);

  // Compute actual metrics
  const metrics = useMemo<PlatformRevenueMetrics>(() => {
    const storeSubList: MerchantSubscription[] = Object.values(allSubs);

    const activeSubscribersByPlan: Record<SubscriptionTierId, number> = {
      FREE: 0,
      GROWTH: 0,
      BUSINESS_PRO: 0,
    };

    let mrrInr = 0;
    let arrInr = 0;
    let paidSubscriberCount = 0;

    // Filter stores by selected city if any
    const eligibleStoreIds = new Set(
      selectedCityFilter === 'ALL'
        ? stores.map((s) => s.id)
        : stores.filter((s) => s.cityId === selectedCityFilter).map((s) => s.id)
    );

    // Count store tiers
    stores.forEach((st) => {
      if (eligibleStoreIds.has(st.id)) {
        const sub = allSubs[st.id];
        const tier = (sub?.planId || 'FREE') as SubscriptionTierId;
        activeSubscribersByPlan[tier] = (activeSubscribersByPlan[tier] || 0) + 1;

        if (sub && sub.status === 'ACTIVE') {
          paidSubscriberCount += 1;
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

    const cityFilteredTransactions = selectedCityFilter === 'ALL'
      ? transactions
      : transactions.filter((tx) => eligibleStoreIds.has(tx.storeId));

    let totalAdCampaignRevenueInr = 0;
    let totalServiceOrdersRevenueInr = 0;
    let grossPlatformRevenueInr = 0;

    cityFilteredTransactions.forEach((tx) => {
      if (tx.status === 'SUCCESS') {
        grossPlatformRevenueInr += tx.totalAmount;
        if (tx.type === 'AD_CAMPAIGN') {
          totalAdCampaignRevenueInr += tx.totalAmount;
        } else if (tx.type === 'SERVICE_ORDER') {
          totalServiceOrdersRevenueInr += tx.totalAmount;
        }
      }
    });

    return {
      mrrInr,
      arrInr,
      totalSubscribers: stores.length,
      activeSubscribersByPlan,
      monthlyPaidChurnRatePercent: 0, // 0% churn on fresh platform
      totalAdCampaignRevenueInr,
      totalServiceOrdersRevenueInr,
      grossPlatformRevenueInr,
      transactionCount: cityFilteredTransactions.length,
    };
  }, [allSubs, stores, transactions, selectedCityFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-900 text-white">
              Super Admin Workspace
            </span>
            <span className="text-xs text-stone-500">Live Financial Ledger</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-stone-950 mt-1">
            Platform Revenue & Monetization
          </h2>
          <p className="text-xs text-stone-500">
            Real metrics derived from merchant SaaS subscriptions, city advertising boosts, and onboarding services.
          </p>
        </div>

        {/* City Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-stone-500" />
          <span className="text-stone-600 font-medium">Filter Locality:</span>
          <select
            value={selectedCityFilter}
            onChange={(e) => setSelectedCityFilter(e.target.value)}
            className="text-xs p-2 rounded-lg border border-stone-300 bg-white font-medium"
          >
            <option value="ALL">All Global Cities ({stores.length} stores)</option>
            {availableCities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 uppercase tracking-wider">
            <span>Monthly Recurring (MRR)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-stone-950">
            ₹{metrics.mrrInr.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-stone-500">
            ARR Run-rate: ₹{metrics.arrInr.toLocaleString('en-IN')}/yr
          </div>
        </div>

        {/* Paid Subscribers */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 uppercase tracking-wider">
            <span>Paid Store Subscribers</span>
            <Users className="w-4 h-4 text-stone-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-stone-950">
            {metrics.activeSubscribersByPlan.GROWTH + metrics.activeSubscribersByPlan.BUSINESS_PRO}
          </div>
          <div className="text-[11px] text-stone-500">
            {metrics.activeSubscribersByPlan.FREE} Free stores · 0% Churn
          </div>
        </div>

        {/* Ad Placements Revenue */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 uppercase tracking-wider">
            <span>City Ad Boosts</span>
            <Zap className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-stone-950">
            ₹{metrics.totalAdCampaignRevenueInr.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-stone-500">
            {campaigns.length} campaigns booked
          </div>
        </div>

        {/* Gross Platform Revenue */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 uppercase tracking-wider">
            <span>Gross Platform Billings</span>
            <CreditCard className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-stone-950">
            ₹{metrics.grossPlatformRevenueInr.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-stone-500">
            {metrics.transactionCount} ledger receipts generated
          </div>
        </div>
      </div>

      {/* Plan Tier Distribution & Revenue Streams Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tier Breakdown */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-stone-950">Merchant Subscription Distribution</h3>
          <div className="space-y-3">
            {[
              {
                tier: 'FREE' as SubscriptionTierId,
                name: 'Starter Merchant',
                count: metrics.activeSubscribersByPlan.FREE,
                color: 'bg-stone-300',
                price: '₹299/mo',
              },
              {
                tier: 'GROWTH' as SubscriptionTierId,
                name: 'Growth Merchant',
                count: metrics.activeSubscribersByPlan.GROWTH,
                color: 'bg-stone-900',
                price: '₹699/mo',
              },
              {
                tier: 'BUSINESS_PRO' as SubscriptionTierId,
                name: 'Business Pro',
                count: metrics.activeSubscribersByPlan.BUSINESS_PRO,
                color: 'bg-amber-600',
                price: '₹1,499/mo',
              },
            ].map((p) => {
              const total = stores.length || 1;
              const pct = Math.round((p.count / total) * 100);
              return (
                <div key={p.tier} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-stone-800">{p.name} ({p.price})</span>
                    <span className="font-bold text-stone-950">{p.count} stores ({pct}%)</span>
                  </div>
                  <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${p.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monetization Streams Breakdown */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-stone-950">Platform Revenue Streams</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/60 flex items-center justify-between">
              <div>
                <div className="font-semibold text-stone-900">Merchant SaaS Subscriptions</div>
                <div className="text-[11px] text-stone-500">Recurring monthly and annual merchant plans</div>
              </div>
              <div className="text-right font-bold text-stone-950">
                ₹{metrics.mrrInr.toLocaleString('en-IN')}/mo
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/60 flex items-center justify-between">
              <div>
                <div className="font-semibold text-stone-900">Paid Ad Boosts (Featured Stores & Products)</div>
                <div className="text-[11px] text-stone-500">City-targeted local promotion campaigns</div>
              </div>
              <div className="text-right font-bold text-stone-950">
                ₹{metrics.totalAdCampaignRevenueInr.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/60 flex items-center justify-between">
              <div>
                <div className="font-semibold text-stone-900">Assisted Catalogue & Domain Services</div>
                <div className="text-[11px] text-stone-500">Onboarding transcription, bulk imports, branded URLs</div>
              </div>
              <div className="text-right font-bold text-stone-950">
                ₹{metrics.totalServiceOrdersRevenueInr.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Transaction Ledger */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-stone-950">Platform Ledger Transactions</h3>
        {transactions.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-stone-200 text-center text-xs text-stone-500">
            No transactions recorded yet in this workspace. All real payments will appear here with invoice numbers.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70">
                  <th className="py-3 px-4 font-semibold text-stone-900">Invoice</th>
                  <th className="py-3 px-4 font-semibold text-stone-900">Store</th>
                  <th className="py-3 px-4 font-semibold text-stone-900">Type</th>
                  <th className="py-3 px-4 font-semibold text-stone-900">Description</th>
                  <th className="py-3 px-4 font-semibold text-stone-900 text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold text-stone-900 text-center">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-stone-50/50">
                    <td className="py-3 px-4 font-mono font-semibold text-stone-900">{tx.invoiceNumber}</td>
                    <td className="py-3 px-4 font-medium text-stone-800">{tx.storeId}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-800">
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-700">{tx.description}</td>
                    <td className="py-3 px-4 text-right font-bold text-stone-950">₹{tx.totalAmount}</td>
                    <td className="py-3 px-4 text-center text-stone-500">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
