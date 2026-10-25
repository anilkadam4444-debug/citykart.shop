import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Clock, RotateCcw, ShieldCheck } from 'lucide-react';
import { getCanonicalUrl } from '@/lib/seo-config';
import { generateBreadcrumbSchema } from '@/lib/seo-schema';

export const metadata: Metadata = {
  title: 'Delivery, Order Tracking & Returns Policy | Citykart',
  description:
    'Understand Citykart’s intra-city delivery times, doorstep inspection policy, and straightforward refund or replacement guidelines for local orders.',
  alternates: {
    canonical: getCanonicalUrl('/delivery-returns'),
  },
};

export default function DeliveryReturnsPage() {
  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Delivery & Returns', url: '/delivery-returns' },
  ];
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbs);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 group"
          >
            <div className="relative w-8 h-8 rounded-lg bg-[#003B8E]/5 border border-[#003B8E]/15 flex items-center justify-center overflow-hidden shrink-0">
              <Image
                src="/citykart-icon.png"
                alt="Citykart"
                width={26}
                height={26}
                className="w-6 h-6 object-contain"
                referrerPolicy="no-referrer"
                priority
              />
            </div>
            <div className="flex items-baseline tracking-tight leading-none">
              <span className="text-lg font-extrabold text-[#003B8E]">City</span>
              <span className="text-lg font-extrabold text-[#F96302]">kart</span>
              <span className="text-[11px] font-bold text-slate-400 ml-0.5">.shop</span>
            </div>
          </Link>
          <Link
            href="/"
            className="text-xs font-bold text-slate-700 hover:text-[#003B8E] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Shopping</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-[#003B8E] hover:underline font-medium">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-300">/</li>
            <li aria-current="page" className="font-bold text-slate-900">
              Delivery & Returns
            </li>
          </ol>
        </nav>

        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-xs space-y-8">
          <div className="space-y-2 border-b border-slate-100 pb-5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Delivery, Order Tracking & Returns
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed pt-1">
              Clear, transparent policies for neighborhood doorstep fulfillment across all Citykart partner stores.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200/80 flex items-center justify-center text-[#003B8E]">
                <Clock className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">15–45 Min Delivery</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Orders are fulfilled directly from neighborhood shops in your city, eliminating multi-day transit hubs.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Inspect at Doorstep</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Open and verify your package before paying via Cash on Delivery or scanning the courier’s UPI QR code.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
              <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#F96302]">
                <RotateCcw className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Immediate Returns</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                If an item is incorrect or damaged upon arrival, return it directly to the delivery person with zero penalty.
              </p>
            </div>
          </div>

          <div className="space-y-5 text-xs text-slate-600 leading-relaxed pt-4 border-t border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">1. Delivery Coverage & Fees</h2>
            <p>
              Delivery coverage is determined by each local store&apos;s configured service radius (typically 5 to 15 kilometers within the city). Delivery charges, if any, are clearly listed by the store in the order breakdown before you confirm your order.
            </p>

            <h2 className="text-sm font-bold text-slate-900 pt-2">2. Order Tracking in Real Time</h2>
            <p>
              Customers can monitor their orders in real-time through the &quot;My Orders&quot; section in the top header. The tracker updates across four discrete stages: (1) Order received, (2) Preparing & packing at shop, (3) Out for delivery, and (4) Completed & paid.
            </p>

            <h2 className="text-sm font-bold text-slate-900 pt-2">3. Cancellations & Replacements</h2>
            <p>
              Orders can be canceled free of charge before the store marks the package as &quot;Out for delivery&quot;. If an item is missing or damaged, the store will dispatch a replacement during the same business day or adjust the payable balance.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
