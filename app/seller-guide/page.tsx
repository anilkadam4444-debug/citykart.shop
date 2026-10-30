import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, PackagePlus, Store, Truck } from 'lucide-react';
import { getCanonicalUrl, SITE_CONFIG } from '@/lib/seo-config';
import {
  generateBreadcrumbSchema,
  generateSellerGuideHowToSchema,
} from '@/lib/seo-schema';

const SELLER_GUIDE_URL = getCanonicalUrl('/seller-guide');
const SELLER_GUIDE_TITLE = 'How to Open a Store & Sell Locally | Citykart Seller Guide';
const SELLER_GUIDE_DESCRIPTION =
  'Step-by-step guide for local retailers and shopkeepers to list their store on Citykart, set delivery radiuses, and receive 0% commission direct orders.';

export const metadata: Metadata = {
  title: SELLER_GUIDE_TITLE,
  description: SELLER_GUIDE_DESCRIPTION,
  keywords: [
    'sell on Citykart',
    'open online store locally',
    'local merchant onboarding',
    'hyperlocal seller guide',
    '0% commission local marketplace',
    'neighborhood shop online delivery',
    'Citykart seller registration',
    'intra-city commerce',
  ],
  authors: [{ name: SITE_CONFIG.name, url: SITE_CONFIG.siteUrl }],
  creator: SITE_CONFIG.name,
  publisher: SITE_CONFIG.name,
  category: 'Ecommerce & Merchant Guide',
  alternates: {
    canonical: SELLER_GUIDE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'article',
    locale: SITE_CONFIG.defaultLocale,
    url: SELLER_GUIDE_URL,
    siteName: SITE_CONFIG.name,
    title: SELLER_GUIDE_TITLE,
    description: SELLER_GUIDE_DESCRIPTION,
    images: [
      {
        url: `${SITE_CONFIG.siteUrl}/citykart-logo.png`,
        width: 1200,
        height: 630,
        alt: 'Citykart Seller Guide — Open and Grow Your Local Store Online',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE_CONFIG.social.twitterHandle,
    creator: SITE_CONFIG.social.twitterHandle,
    title: SELLER_GUIDE_TITLE,
    description:
      'List your neighborhood shop on Citykart in under 3 minutes. Upload products, set your local delivery radius, and receive direct UPI or Cash payments.',
    images: [`${SITE_CONFIG.siteUrl}/citykart-logo.png`],
  },
};

export default function SellerGuidePage() {
  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Seller Guide', url: '/seller-guide' },
  ];
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbs);
  const howToSchema = generateSellerGuideHowToSchema();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
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
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-bold text-slate-700 hover:text-[#003B8E] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Shopping</span>
            </Link>
            <Link
              href="/seller"
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#F96302] rounded-xl hover:bg-[#E05500] transition-colors shadow-2xs"
            >
              Open Your Store
            </Link>
          </div>
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
              Seller Guide
            </li>
          </ol>
        </nav>

        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-xs space-y-8">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 text-[11px] font-bold uppercase tracking-wider text-[#003B8E]">
              Merchant Onboarding
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              How to Open and Grow Your Store on Citykart
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed pt-1">
              Join local merchants who are expanding their daily sales and serving customers across their city through Citykart.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#003B8E]">
                <Store className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">1. Instant Mobile Sign-Up</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Register using your mobile number and verified OTP. No complicated paperwork to get started.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#F96302]">
                <PackagePlus className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">2. Upload Your Products</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Select your category from the 25 approved retail categories, set prices, units, and inventory levels with autosave.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-700">
                <Truck className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">3. Set Delivery Area</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Configure your operating hours, delivery radius (e.g., 5–15 km), and covered neighborhoods in your city.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 space-y-4 text-xs text-slate-600 leading-relaxed">
            <h2 className="text-base font-extrabold text-slate-900">
              Seller Terms & Core Responsibilities
            </h2>
            <p>
              By registering a store on Citykart, independent sellers agree to uphold marketplace service standards and acknowledge their sole operational responsibility for:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 font-medium text-slate-800">
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

          <div className="pt-6 border-t border-slate-100 space-y-3 text-xs text-slate-600 leading-relaxed">
            <h2 className="text-base font-bold text-slate-900">Direct Payment at Doorstep</h2>
            <p>
              Merchants retain full control of their customer relations. Customers pay directly via Cash on Delivery, UPI QR scan, or Card Tap upon receiving their order, ensuring complete transparency and zero delayed payouts.
            </p>
          </div>

          <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-900">
                Ready to take your shop online?
              </span>
              <p className="text-xs text-slate-500">
                Create your store profile in less than 3 minutes.
              </p>
            </div>
            <Link
              href="/seller"
              className="px-5 py-2.5 rounded-xl bg-[#F96302] text-white text-xs font-bold hover:bg-[#E05500] transition-colors shadow-xs inline-flex items-center gap-1.5"
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
