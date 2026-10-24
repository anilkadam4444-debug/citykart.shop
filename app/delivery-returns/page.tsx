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
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/90 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 group"
          >
            <Image
              src="/citykart-logo.png"
              alt="Citykart"
              width={150}
              height={38}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-stone-600 hover:text-stone-900 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Shopping</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <nav aria-label="Breadcrumb" className="text-xs text-stone-500">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-stone-900 hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-stone-300">/</li>
            <li aria-current="page" className="font-semibold text-stone-900">
              Delivery & Returns
            </li>
          </ol>
        </nav>

        <section className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-10 shadow-xs space-y-8">
          <div className="space-y-2 border-b border-stone-100 pb-5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
              Delivery, Order Tracking & Returns
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed pt-1">
              Clear, transparent policies for neighborhood doorstep fulfillment across all Citykart partner stores.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <Clock className="w-5 h-5 text-stone-900" />
              <h2 className="text-sm font-bold text-stone-900">15–45 Min Delivery</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Orders are fulfilled directly from neighborhood shops in your city, eliminating multi-day transit hubs.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <ShieldCheck className="w-5 h-5 text-stone-900" />
              <h2 className="text-sm font-bold text-stone-900">Inspect at Doorstep</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Open and verify your package before paying via Cash on Delivery or scanning the courier’s UPI QR code.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <RotateCcw className="w-5 h-5 text-stone-900" />
              <h2 className="text-sm font-bold text-stone-900">Immediate Returns</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                If an item is incorrect or damaged upon arrival, return it directly to the delivery person with zero penalty.
              </p>
            </div>
          </div>

          <div className="space-y-5 text-xs text-stone-600 leading-relaxed pt-4 border-t border-stone-100">
            <h2 className="text-sm font-bold text-stone-900">1. Delivery Coverage & Fees</h2>
            <p>
              Delivery coverage is determined by each local store&apos;s configured service radius (typically 5 to 15 kilometers within the city). Delivery charges, if any, are clearly listed by the store in the order breakdown before you confirm your order.
            </p>

            <h2 className="text-sm font-bold text-stone-900 pt-2">2. Order Tracking in Real Time</h2>
            <p>
              Customers can monitor their orders in real-time through the &quot;My Orders&quot; section in the top header. The tracker updates across four discrete stages: (1) Order received, (2) Preparing & packing at shop, (3) Out for delivery, and (4) Completed & paid.
            </p>

            <h2 className="text-sm font-bold text-stone-900 pt-2">3. Cancellations & Replacements</h2>
            <p>
              Orders can be canceled free of charge before the store marks the package as &quot;Out for delivery&quot;. If an item is missing or damaged, the store will dispatch a replacement during the same business day or adjust the payable balance.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
