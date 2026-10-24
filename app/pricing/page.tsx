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
  ShieldCheck,
  Zap,
  Sparkles,
  ShoppingBag,
  Store,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Percent,
  TrendingUp,
} from 'lucide-react';
import { SUBSCRIPTION_PLANS, SubscriptionTierId, VALUE_ADDED_SERVICES } from '@/lib/revenue-model';

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
    SUBSCRIPTION_PLANS.FREE,
    SUBSCRIPTION_PLANS.GROWTH,
    SUBSCRIPTION_PLANS.BUSINESS_PRO,
  ];

  return (
    <div className="w-full min-h-dvh flex flex-col bg-[#FAF9F6] text-stone-900">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-xs border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Image
              src="/citykart-logo.png"
              alt="Citykart"
              width={150}
              height={38}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <Link
              href="/seller-guide"
              className="text-stone-600 hover:text-stone-900 hidden sm:inline transition-colors"
            >
              Seller Guide
            </Link>
            <Link
              href="/seller"
              className="px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 font-medium text-stone-700 transition-colors"
            >
              For Sellers
            </Link>
            <Link
              href="/seller/dashboard"
              className="px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-medium transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-xs font-semibold text-stone-800 tracking-wide uppercase">
            <Percent className="w-3.5 h-3.5 text-emerald-700" />
            <span>0% Commission · 100% Yours</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-950">
            Predictable Pricing for Local Retailers
          </h1>
          <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
            Keep every rupee of your customer orders. Choose a simple, transparent subscription plan
            tailored to your shop’s catalogue size and growth ambitions.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <span className={`text-xs sm:text-sm font-medium ${!isAnnual ? 'text-stone-950 font-semibold' : 'text-stone-500'}`}>
              Monthly billing
            </span>
            <button
              type="button"
              onClick={() => setIsAnnual(!isAnnual)}
              aria-label="Toggle annual billing"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isAnnual ? 'bg-stone-900' : 'bg-stone-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isAnnual ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs sm:text-sm font-medium ${isAnnual ? 'text-stone-950 font-semibold' : 'text-stone-500'}`}>
                Annual billing
              </span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
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
              <div
                key={plan.id}
                className={`relative rounded-2xl flex flex-col justify-between p-6 sm:p-8 transition-all ${
                  isGrowth
                    ? 'bg-white border-2 border-stone-900 shadow-xl ring-1 ring-stone-900/10'
                    : 'bg-white border border-stone-200 shadow-xs hover:border-stone-300'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-stone-900 text-white shadow-xs">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-stone-950">{plan.name}</h3>
                    <p className="text-xs text-stone-500 min-h-[32px]">{plan.tagline}</p>
                  </div>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-stone-950 tracking-tight">
                      {price === 0 ? '₹0' : `₹${price.toLocaleString('en-IN')}`}
                    </span>
                    <span className="text-xs font-medium text-stone-500">{price === 0 ? 'forever' : periodLabel}</span>
                  </div>
                  {isAnnual && price > 0 && (
                    <div className="text-[11px] text-emerald-700 font-medium mt-1">
                      Billed annually (equivalent to ₹{Math.round(price / 12)}/mo)
                    </div>
                  )}

                  <hr className="my-6 border-stone-100" />

                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-stone-900 uppercase tracking-wider">
                      Included with this plan:
                    </div>
                    <ul className="space-y-2.5 text-xs text-stone-700">
                      {plan.highlightedFeatures.map((feat, idx) => (
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
                    className={`w-full py-3 px-4 rounded-xl text-center text-xs sm:text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 ${
                      isGrowth
                        ? 'bg-stone-900 hover:bg-stone-800 text-white shadow-sm'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-900 border border-stone-200'
                    }`}
                  >
                    <span>{plan.id === 'FREE' ? 'Get Started Free' : `Choose ${plan.name}`}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <section className="mt-20 space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-stone-950">
              Detailed Plan Feature Comparison
            </h2>
            <p className="text-xs sm:text-sm text-stone-500">
              Compare capabilities side by side. Upgrade or downgrade at any time with no penalties.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70">
                  <th className="py-4 px-6 font-semibold text-stone-900 w-2/5">Features & Capabilities</th>
                  <th className="py-4 px-4 font-bold text-stone-900 text-center w-1/5">Free</th>
                  <th className="py-4 px-4 font-bold text-stone-950 text-center w-1/5 bg-stone-100/50">Growth (Most Popular)</th>
                  <th className="py-4 px-4 font-bold text-stone-900 text-center w-1/5">Business Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {COMPARISON_FEATURES.map((feat, idx) => (
                  <tr key={idx} className="hover:bg-stone-50/40 transition-colors">
                    <td className="py-3 px-6 text-stone-800 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{feat.name}</span>
                        {feat.tooltip && (
                          <span title={feat.tooltip} className="cursor-help text-stone-400 hover:text-stone-600">
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
                          <X className="w-4 h-4 text-stone-300 mx-auto" />
                        )
                      ) : (
                        <span className="font-semibold text-stone-700">{feat.free}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center bg-stone-50/30">
                      {typeof feat.growth === 'boolean' ? (
                        feat.growth ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-stone-300 mx-auto" />
                        )
                      ) : (
                        <span className="font-bold text-stone-950">{feat.growth}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {typeof feat.pro === 'boolean' ? (
                        feat.pro ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-stone-300 mx-auto" />
                        )
                      ) : (
                        <span className="font-bold text-stone-950">{feat.pro}</span>
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-xs font-semibold text-stone-800 uppercase tracking-wide">
              <Zap className="w-3.5 h-3.5 text-amber-700" />
              <span>Assisted Onboarding</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-stone-950">
              Optional Onboarding & Growth Services
            </h2>
            <p className="text-xs sm:text-sm text-stone-500">
              Short on time? Let our onboarding specialists digitise your shop inventory and setup custom branding.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Object.values(VALUE_ADDED_SERVICES).map((srv) => (
              <div key={srv.type} className="bg-white rounded-xl border border-stone-200 p-5 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-base font-bold text-stone-950">₹{srv.priceInr}</span>
                    <span className="text-[10px] font-medium text-stone-500 uppercase">{srv.billingFrequency}</span>
                  </div>
                  <h3 className="font-semibold text-sm text-stone-900 mt-2">{srv.title}</h3>
                  <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">{srv.description}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                  <span>Turnaround: {srv.turnaroundDays}d</span>
                  <Link
                    href={`/seller/dashboard?section=billing&tab=services&service=${srv.type}`}
                    className="font-medium text-stone-900 hover:underline"
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
            <h2 className="text-2xl font-bold tracking-tight text-stone-950">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-stone-500">
              Transparent answers to common questions from local shop owners.
            </p>
          </div>

          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="py-4">
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between text-left gap-4 font-semibold text-xs sm:text-sm text-stone-900 hover:text-stone-700 cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-stone-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="mt-2.5 text-xs text-stone-600 leading-relaxed pr-8">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="mt-16 p-8 sm:p-12 rounded-3xl bg-stone-900 text-white text-center space-y-4 shadow-xl">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Ready to bring your local store online?
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 max-w-xl mx-auto leading-relaxed">
            Register your shop in under 3 minutes with mobile OTP. Start completely free with zero commission on all your customer orders.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/seller"
              className="px-6 py-3 rounded-xl bg-white hover:bg-stone-100 text-stone-950 font-bold text-xs sm:text-sm shadow-sm inline-flex items-center gap-2 transition-colors"
            >
              <Store className="w-4 h-4" />
              <span>Register Your Store Free</span>
            </Link>
            <Link
              href="/"
              className="px-5 py-3 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 text-white font-medium text-xs sm:text-sm transition-colors"
            >
              Explore Buyer Marketplace
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <div>© {new Date().getFullYear()} Citykart. All rights reserved. Zero commission hyperlocal commerce.</div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-stone-900">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-stone-900">Privacy Policy</Link>
            <Link href="/seller-guide" className="hover:text-stone-900">Seller Guide</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
