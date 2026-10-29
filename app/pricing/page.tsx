'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Check,
  X,
  HelpCircle,
  ArrowRight,
  Zap,
  Store,
  ChevronDown,
  ChevronUp,
  Percent,
} from 'lucide-react';
import { TiltCard } from '@/components/tilt-card';
import { SUBSCRIPTION_PLANS, VALUE_ADDED_SERVICES } from '@/lib/revenue-model';

interface ComparisonFeature {
  name: string;
  category: string;
  free: string | boolean;
  growth: string | boolean;
  pro: string | boolean;
  tooltip?: string;
}

const COMPARISON_FEATURES: ComparisonFeature[] = [
  {
    category: 'Core Commerce & Catalog',
    name: 'Active Product Listings (SKUs)',
    free: '20 products',
    growth: '150 products',
    pro: '500 SKUs',
    tooltip: 'Number of active products displayed simultaneously in your store catalogue.',
  },
  {
    category: 'Core Commerce & Catalog',
    name: 'Order Commission Rate',
    free: '0% (Zero)',
    growth: '0% (Zero)',
    pro: '0% (Zero)',
    tooltip: 'You keep 100% of customer order amounts. Citykart takes no cut on your sales.',
  },
  {
    category: 'Core Commerce & Catalog',
    name: 'Direct Customer Payment (UPI / Cash)',
    free: true,
    growth: true,
    pro: true,
    tooltip: 'Direct payment to your personal or business UPI QR code and cash-on-delivery.',
  },
  {
    category: 'Core Commerce & Catalog',
    name: 'Hyperlocal City & Locality Discovery',
    free: true,
    growth: true,
    pro: true,
  },
  {
    category: 'Visibility & Merchandising',
    name: 'Search & Category Boost Priority',
    free: 'Standard',
    growth: 'Priority Boost',
    pro: 'Top Spotlight',
  },
  {
    category: 'Visibility & Merchandising',
    name: 'Store Promotional & Discount Banners',
    free: false,
    growth: true,
    pro: true,
  },
  {
    category: 'Visibility & Merchandising',
    name: 'Citykart Gold Verified Badge',
    free: false,
    growth: false,
    pro: true,
    tooltip: 'Distinctive trust badge displayed next to your store name across city listings.',
  },
  {
    category: 'Analytics & Tools',
    name: 'Sales & Inventory Tracking',
    free: 'Basic view',
    growth: 'Detailed metrics',
    pro: 'Advanced insights',
  },
  {
    category: 'Analytics & Tools',
    name: 'Customer Repeat & Retention Cohorts',
    free: false,
    growth: false,
    pro: true,
  },
  {
    category: 'Analytics & Tools',
    name: 'AI Store Assistant (Copy & Tags)',
    free: false,
    growth: false,
    pro: true,
  },
  {
    category: 'Scale & Operations',
    name: 'Staff & Manager Sub-Accounts',
    free: '1 Login',
    growth: '1 Login',
    pro: 'Up to 5 Staff',
  },
  {
    category: 'Scale & Operations',
    name: 'Custom Domain Readiness',
    free: false,
    growth: false,
    pro: true,
  },
  {
    category: 'Support & SLAs',
    name: 'Merchant Support Channel',
    free: 'Community Forum',
    growth: 'Priority WhatsApp',
    pro: 'Dedicated Account Lead',
  },
];

const FAQS = [
  {
    q: 'Do you charge any commission on my sales?',
    a: 'No. Never. Citykart is built on a pure subscription model. You keep 100% of your sales revenue. Customers pay directly to your shop UPI or cash upon delivery, with zero platform deduction or hidden payment processing cuts.',
  },
  {
    q: 'How does payment collection work?',
    a: 'When customers place an order, they pay directly to you. In India, they scan your shop UPI QR code or pay cash to your delivery executive at their door. You maintain complete control over your cash flow with zero waiting period.',
  },
  {
    q: 'Can I start on the Free plan and upgrade later?',
    a: 'Yes, absolutely. You can start completely free with up to 20 products. As your catalogue and local customer demand grow, you can upgrade to Growth or Business Pro instantly from your Seller Dashboard.',
  },
  {
    q: 'What happens to my products if I downgrade?',
    a: 'We never delete your product data. If you downgrade from Growth to Free with 40 products, all 40 products remain safe in your dashboard and visible. However, you will not be able to add new items until your catalogue is within the 20-product limit or you re-upgrade.',
  },
  {
    q: 'Can I cancel or switch billing cycles anytime?',
    a: 'Yes. You can switch between monthly and annual billing, or cancel anytime from your Seller Dashboard. If canceled, your plan remains active until the end of your prepaid billing period.',
  },
  {
    q: 'Do you offer assistance with catalogue setup?',
    a: 'Yes! We offer assisted catalogue digitisation for ₹499 (up to 50 items) where our team transcribes your paper menu or price list, and bulk spreadsheet imports for ₹299.',
  },
];

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const plans = [
    SUBSCRIPTION_PLANS?.FREE,
    SUBSCRIPTION_PLANS?.GROWTH,
    SUBSCRIPTION_PLANS?.BUSINESS_PRO,
  ].filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="w-full min-h-dvh flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Image
              src="/citykart-icon.png"
              alt="Citykart"
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
              priority
            />
            <span className="text-lg font-extrabold tracking-tight leading-none">
              <span className="text-[#003B8E]">City</span>
              <span className="text-[#F96302]">kart</span>
              <span className="text-[10px] font-bold text-slate-400">.shop</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <Link
              href="/seller-guide"
              className="font-semibold text-slate-600 hover:text-[#003B8E] hidden sm:inline transition-colors"
            >
              Seller Guide
            </Link>
            <Link
              href="/seller"
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 transition-colors"
            >
              For Sellers
            </Link>
            <Link
              href="/seller/dashboard"
              className="px-3.5 py-1.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white font-bold transition-colors shadow-2xs"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-xs font-bold text-[#003B8E] tracking-wide uppercase">
            <Percent className="w-3.5 h-3.5 text-[#F96302]" />
            <span>0% Commission · 100% Yours</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Predictable Pricing for Local Retailers
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Keep every rupee of your customer orders. Choose a simple, transparent subscription plan
            tailored to your shop’s catalogue size and growth ambitions.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <span className={`text-xs sm:text-sm ${!isAnnual ? 'text-slate-900 font-bold' : 'text-slate-500 font-medium'}`}>
              Monthly billing
            </span>
            <button
              type="button"
              onClick={() => setIsAnnual(!isAnnual)}
              aria-label="Toggle annual billing"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isAnnual ? 'bg-[#003B8E]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isAnnual ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs sm:text-sm ${isAnnual ? 'text-slate-900 font-bold' : 'text-slate-500 font-medium'}`}>
                Annual billing
              </span>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Save ~17%
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {plans.map((plan) => {
            const isGrowth = plan.id === 'GROWTH';
            const price = isAnnual ? plan.annualPriceInr : plan.monthlyPriceInr;
            const periodLabel = isAnnual ? '/year' : '/month';

            return (
              <TiltCard
                key={plan.id}
                maxTilt={5}
                scale={1.015}
                className={`relative rounded-3xl flex flex-col justify-between p-6 sm:p-8 transition-all ${
                  isGrowth
                    ? 'bg-white border-2 border-[#003B8E] shadow-xl ring-1 ring-[#003B8E]/10'
                    : 'bg-white border border-slate-200 shadow-xs hover:border-slate-300'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-[#F96302] text-white shadow-xs">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-extrabold text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 min-h-[32px]">{plan.tagline}</p>
                  </div>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold font-mono tabular-nums text-slate-900 tracking-tight">
                      {price === 0 ? '₹0' : `₹${price.toLocaleString('en-IN')}`}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{price === 0 ? 'forever' : periodLabel}</span>
                  </div>
                  {isAnnual && price > 0 && (
                    <div className="text-[11px] text-emerald-700 font-bold mt-1 tabular-nums">
                      Billed annually (equivalent to ₹{Math.round(price / 12)}/mo)
                    </div>
                  )}

                  <hr className="my-6 border-slate-100" />

                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Included with this plan:
                    </div>
                    <ul className="space-y-2.5 text-xs text-slate-700">
                      {(plan.highlightedFeatures || []).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 pt-4">
                  <Link
                    href={plan.id === 'FREE' ? '/seller' : `/seller/dashboard?section=billing&upgrade=${plan.id}`}
                    className={`w-full py-3.5 px-4 rounded-xl text-center text-xs sm:text-sm font-bold transition-all inline-flex items-center justify-center gap-1.5 ${
                      isGrowth
                        ? 'bg-[#F96302] hover:bg-[#E05500] text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-[#003B8E] border border-slate-200'
                    }`}
                  >
                    <span>{plan.id === 'FREE' ? 'Get Started Free' : `Choose ${plan.name}`}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </TiltCard>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <section className="mt-20 space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Detailed Plan Feature Comparison
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Compare capabilities side by side. Upgrade or downgrade at any time with no penalties.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-4 px-6 font-bold text-slate-900 w-2/5">Features &amp; Capabilities</th>
                  <th className="py-4 px-4 font-bold text-slate-900 text-center w-1/5">Free</th>
                  <th className="py-4 px-4 font-extrabold text-[#003B8E] text-center w-1/5 bg-blue-50/50">Growth (Most Popular)</th>
                  <th className="py-4 px-4 font-bold text-slate-900 text-center w-1/5">Business Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COMPARISON_FEATURES.map((feat, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-6 text-slate-800 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span>{feat.name}</span>
                        {feat.tooltip && (
                          <span title={feat.tooltip} className="cursor-help text-slate-400 hover:text-slate-600">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {typeof feat.free === 'boolean' ? (
                        feat.free ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-slate-300 mx-auto" />
                        )
                      ) : (
                        <span className="font-semibold text-slate-700">{feat.free}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center bg-blue-50/20">
                      {typeof feat.growth === 'boolean' ? (
                        feat.growth ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-slate-300 mx-auto" />
                        )
                      ) : (
                        <span className="font-bold text-[#003B8E]">{feat.growth}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {typeof feat.pro === 'boolean' ? (
                        feat.pro ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-slate-300 mx-auto" />
                        )
                      ) : (
                        <span className="font-bold text-slate-900">{feat.pro}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Value-Added Services Section */}
        <section className="mt-20 space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-xs font-bold text-[#F96302] uppercase tracking-wide">
              <Zap className="w-3.5 h-3.5 text-[#F96302]" />
              <span>Assisted Onboarding</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Optional Onboarding &amp; Growth Services
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Short on time? Let our onboarding specialists digitise your shop inventory and setup custom branding.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Object.values(VALUE_ADDED_SERVICES).map((srv) => (
              <div key={srv.type} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-xs hover:border-[#003B8E]/40 transition-colors">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-base font-extrabold font-mono tabular-nums text-slate-900">₹{srv.priceInr}</span>
                    <span className="text-[10px] font-bold text-[#003B8E] bg-blue-50 px-2 py-0.5 rounded uppercase">{srv.billingFrequency}</span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 mt-2">{srv.title}</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{srv.description}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Turnaround: {srv.turnaroundDays}d</span>
                  <Link
                    href={`/seller/dashboard?section=billing&tab=services&service=${srv.type}`}
                    className="font-bold text-[#F96302] hover:underline"
                  >
                    Request →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-20 max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Transparent answers to common questions from local shop owners.
            </p>
          </div>

          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="py-4">
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between text-left gap-4 font-bold text-xs sm:text-sm text-slate-900 hover:text-[#003B8E] cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="mt-2.5 text-xs text-slate-600 leading-relaxed pr-8">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="mt-16 p-8 sm:p-12 rounded-3xl bg-[#003B8E] text-white text-center space-y-4 shadow-xl">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Ready to bring your local store online?
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 max-w-xl mx-auto leading-relaxed">
            Register your shop in under 3 minutes with mobile OTP. Start completely free with zero commission on all your customer orders.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/seller"
              className="px-6 py-3.5 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white font-bold text-xs sm:text-sm shadow-sm inline-flex items-center gap-2 transition-colors"
            >
              <Store className="w-4 h-4" />
              <span>Register Your Store Free</span>
            </Link>
            <Link
              href="/"
              className="px-5 py-3.5 rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm transition-colors"
            >
              Explore Buyer Marketplace
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>© {new Date().getFullYear()} Citykart.shop. All rights reserved. Zero commission hyperlocal commerce.</div>
          <div className="flex items-center gap-4 font-medium">
            <Link href="/terms" className="hover:text-[#003B8E]">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-[#003B8E]">Privacy Policy</Link>
            <Link href="/seller-guide" className="hover:text-[#003B8E]">Seller Guide</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
