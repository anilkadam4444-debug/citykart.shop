import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, PackagePlus, Store, Truck } from 'lucide-react';
import { getCanonicalUrl } from '@/lib/seo-config';
import { generateBreadcrumbSchema } from '@/lib/seo-schema';

export const metadata: Metadata = {
  title: 'How to Open a Store & Sell Locally | Citykart Seller Guide',
  description:
    'Step-by-step guide for local retailers and shopkeepers to list their business on Citykart, configure local delivery radiuses, and start receiving direct orders.',
  alternates: {
    canonical: getCanonicalUrl('/seller-guide'),
  },
};

export default function SellerGuidePage() {
  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Seller Guide', url: '/seller-guide' },
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
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-stone-600 hover:text-stone-900 inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Shopping</span>
            </Link>
            <Link
              href="/seller"
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors"
            >
              Open Your Store
            </Link>
          </div>
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
              Seller Guide
            </li>
          </ol>
        </nav>

        <section className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-10 shadow-xs space-y-8">
          <div className="space-y-2 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Merchant Onboarding
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
              How to Open and Grow Your Store on Citykart
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed pt-1">
              Join local merchants who are expanding their daily sales and serving customers across their city through Citykart.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-800">
                <Store className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-stone-900">1. Instant Mobile Sign-Up</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Register using your mobile number and verified OTP. No complicated paperwork to get started.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-800">
                <PackagePlus className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-stone-900">2. Upload Your Products</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Select your category from the 25 approved retail categories, set prices, units, and inventory levels with autosave.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-800">
                <Truck className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-stone-900">3. Set Delivery Area</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Configure your operating hours, delivery radius (e.g., 5–15 km), and covered neighborhoods in your city.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-stone-100 space-y-4 text-xs text-stone-600 leading-relaxed">
            <h2 className="text-base font-extrabold text-stone-900">
              Seller Terms & Core Responsibilities
            </h2>
            <p>
              By registering a store on Citykart, independent sellers agree to uphold marketplace service standards and acknowledge their sole operational responsibility for:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 font-medium text-stone-800">
              <li>Maintaining accurate product listings, descriptions, prices, and stock availability.</li>
              <li>Promptly reviewing incoming orders and accepting or rejecting them in compliance with applicable law and platform policies.</li>
              <li>Safe packaging, order preparation, and accurate fulfillment.</li>
              <li>Arranging and completing doorstep delivery or store pickup within promised timeframes.</li>
              <li>Proactive customer communication regarding order status, stock changes, or delivery updates.</li>
              <li>Fulfilling applicable cancellation, return, replacement, and refund requests in accordance with statutory consumer rights and Citykart published policies.</li>
              <li>Compliance with applicable trade, tax, consumer-protection, licensing, and product-safety laws.</li>
              <li>Resolving product- and fulfillment-related customer inquiries and complaints directly and in good faith.</li>
            </ul>
          </div>

          <div className="pt-6 border-t border-stone-100 space-y-3 text-xs text-stone-600 leading-relaxed">
            <h2 className="text-base font-bold text-stone-900">Direct Payment at Doorstep</h2>
            <p>
              Merchants retain full control of their customer relations. Customers pay directly via Cash on Delivery, UPI QR scan, or Card Tap upon receiving their order, ensuring complete transparency and zero delayed payouts.
            </p>
          </div>

          <div className="pt-6 border-t border-stone-200 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-stone-900">
                Ready to take your shop online?
              </span>
              <p className="text-xs text-stone-500">
                Create your store profile in less than 3 minutes.
              </p>
            </div>
            <Link
              href="/seller"
              className="px-5 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-xs inline-flex items-center gap-1.5"
            >
              <span>Register as a Seller</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
