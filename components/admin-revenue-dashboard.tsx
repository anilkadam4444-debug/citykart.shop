'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  CreditCard,
  Users,
  Zap,
  Filter,
} from 'lucide-react';
import {
  BillingTransaction,
  calculatePlatformRevenueMetrics,
  FeaturedCampaign,
  MerchantServiceOrder,
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

export function AdminRevenueDashboard({ stores }: AdminRevenueDashboardProps) {
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('ALL');

  const allSubs = useMemo(() => {
    return loadMerchantSubscriptionsFromStorage();
  }, []);

  const transactions = useMemo<BillingTransaction[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(BILLING_TX_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  const campaigns = useMemo<FeaturedCampaign[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  useMemo<MerchantServiceOrder[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(SERVICE_ORDERS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  const availableCities = useMemo(() => {
    const cityMap = new Map<string, string>();
    stores.forEach((st) => {
      if (st.cityId && st.cityName) {
        cityMap.set(st.cityId, st.cityName);
      }
    });
    return Array.from(cityMap.entries()).map(([id, name]) => ({ id, name }));
  }, [stores]);

  const metrics = useMemo<PlatformRevenueMetrics>(() => {
    return calculatePlatformRevenueMetrics(
      stores,
      allSubs as Record<string, any>,
      transactions,
      selectedCityFilter
    );
  }, [allSubs, stores, transactions, selectedCityFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#003B8E] text-white">
              Super Admin Workspace
            </span>
            <span className="text-xs text-slate-500">Live Financial Ledger</span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
            Platform Revenue &amp; Monetization
          </h2>
          <p className="text-xs text-slate-500">
            Real metrics derived from merchant SaaS subscriptions, city advertising boosts, and onboarding services.
          </p>
        </div>

        {/* City Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-600 font-bold">Filter Locality:</span>
          <select
            value={selectedCityFilter}
            onChange={(e) => setSelectedCityFilter(e.target.value)}
            className="text-xs p-2 rounded-xl border border-slate-300 bg-white font-semibold"
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
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Monthly Recurring (MRR)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900">
            ₹{metrics.mrrInr.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            ARR Run-rate: ₹{metrics.arrInr.toLocaleString('en-IN')}/yr
          </div>
        </div>

        {/* Paid Subscribers */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Paid Store Subscribers</span>
            <Users className="w-4 h-4 text-[#003B8E]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900">
            {metrics.activePaidSubscriptions}
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {metrics.activeSubscribersByPlan.FREE} Free stores · 0% Churn
          </div>
        </div>

        {/* Ad Placements Revenue */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>City Ad Boosts</span>
            <Zap className="w-4 h-4 text-[#F96302]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900">
            ₹{metrics.totalAdCampaignRevenueInr.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {campaigns.length} campaigns booked
          </div>
        </div>

        {/* Gross Platform Revenue */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Gross Platform Billings</span>
            <CreditCard className="w-4 h-4 text-[#003B8E]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900">
            ₹{metrics.grossPlatformRevenueInr.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {metrics.transactionCount} ledger receipts generated
          </div>
        </div>
      </div>

      {/* Plan Tier Distribution & Revenue Streams Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tier Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900">Merchant Subscription Distribution</h3>
          <div className="space-y-3">
            {(
              [
                { tier: 'FREE' as SubscriptionTierId, color: 'bg-slate-400' },
                { tier: 'STARTER' as SubscriptionTierId, color: 'bg-sky-500' },
                { tier: 'GROWTH' as SubscriptionTierId, color: 'bg-[#003B8E]' },
                { tier: 'BUSINESS_PRO' as SubscriptionTierId, color: 'bg-[#F96302]' },
                { tier: 'ENTERPRISE' as SubscriptionTierId, color: 'bg-emerald-600' },
              ]
            ).map(({ tier, color }) => {
              const plan = SUBSCRIPTION_PLANS[tier];
              const count = metrics.activeSubscribersByPlan[tier] || 0;
              const priceLabel =
                plan.monthlyPriceInr === 0
                  ? '₹0/mo'
                  : `₹${plan.monthlyPriceInr.toLocaleString('en-IN')}/mo`;
              const total = stores.length || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={tier} className="space-y-1 text-xs tabular-nums">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-800">{plan.name} ({priceLabel})</span>
                    <span className="font-bold text-slate-900">{count} stores ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monetization Streams Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900">Platform Revenue Streams</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">Merchant SaaS Subscriptions</div>
                <div className="text-[11px] text-slate-500">Recurring monthly and annual merchant plans</div>
              </div>
              <div className="text-right font-extrabold font-mono tabular-nums text-slate-900">
                ₹{metrics.mrrInr.toLocaleString('en-IN')}/mo
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">Paid Ad Boosts (Featured Stores &amp; Products)</div>
                <div className="text-[11px] text-slate-500">City-targeted local promotion campaigns</div>
              </div>
              <div className="text-right font-extrabold font-mono tabular-nums text-slate-900">
                ₹{metrics.totalAdCampaignRevenueInr.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">Assisted Catalogue &amp; Domain Services</div>
                <div className="text-[11px] text-slate-500">Onboarding transcription, bulk imports, branded URLs</div>
              </div>
              <div className="text-right font-extrabold font-mono tabular-nums text-slate-900">
                ₹{metrics.totalServiceOrdersRevenueInr.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Transaction Ledger */}
      <div className="space-y-3">
        <h3 className="text-sm font-extrabold text-slate-900">Platform Ledger Transactions</h3>
        {transactions.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
            No transactions recorded yet in this workspace. All real payments will appear here with invoice numbers.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3 px-4 font-bold text-slate-900">Invoice</th>
                  <th className="py-3 px-4 font-bold text-slate-900">Store</th>
                  <th className="py-3 px-4 font-bold text-slate-900">Type</th>
                  <th className="py-3 px-4 font-bold text-slate-900">Description</th>
                  <th className="py-3 px-4 font-bold text-slate-900 text-right">Amount</th>
                  <th className="py-3 px-4 font-bold text-slate-900 text-center">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{tx.invoiceNumber}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{tx.storeId}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#003B8E]">
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{tx.description}</td>
                    <td className="py-3 px-4 text-right font-bold font-mono tabular-nums text-slate-900">₹{tx.totalAmount}</td>
                    <td className="py-3 px-4 text-center text-slate-500">
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
