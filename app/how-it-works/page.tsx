import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Check, MapPin, ShoppingBag, Truck } from 'lucide-react';
import { getCanonicalUrl } from '@/lib/seo-config';
import { generateBreadcrumbSchema } from '@/lib/seo-schema';

export const metadata: Metadata = {
  title: 'How Local Shopping Works | Citykart',
  description:
    'Discover how simple it is to shop from local stores on Citykart: select your city, browse 25 product categories, and receive rapid delivery with UPI or Cash on delivery.',
  alternates: {
    canonical: getCanonicalUrl('/how-it-works'),
  },
};

export default function HowItWorksPage() {
  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'How It Works', url: '/how-it-works' },
  ];
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbs);

  const steps = [
    {
      step: '01',
      title: 'Select or Confirm Your Delivery City',
      description:
        'Choose your city and neighborhood from the header location selector. Citykart instantly filters the entire catalog to show only stores and products that deliver to your specific locality.',
      icon: MapPin,
    },
    {
      step: '02',
      title: 'Browse 25 Categories & Popular Products',
      description:
        'Navigate the persistent category sidebar on desktop or mobile drawer. Discover popularity-ranked products, sorted by authentic order volume and fastest delivery times.',
      icon: ShoppingBag,
    },
    {
      step: '03',
      title: 'Add to Bag & Verify via Mobile OTP',
      description:
        'Add items to your cart across local merchants. When ready to checkout, enter your phone number and confirm your order securely via a one-time password (OTP). No passwords to remember.',
      icon: Check,
    },
    {
      step: '04',
      title: 'Doorstep Delivery with UPI or Cash',
      description:
        'Your local store receives the order instantly and packs it. A delivery partner brings it to your door in ~15 to 45 minutes. Pay via UPI QR code scan or cash upon inspecting your package.',
      icon: Truck,
    },
  ];

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
              How It Works
            </li>
          </ol>
        </nav>

        <section className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-10 shadow-xs space-y-8">
          <div className="space-y-2 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Buyer Guide
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
              How Local Shopping Works on Citykart
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed pt-1">
              Shop directly from your favorite neighborhood merchants with transparent pricing, zero hidden convenience fees, and door-to-door delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {steps.map((st) => {
              const Icon = st.icon;
              return (
                <div
                  key={st.step}
                  className="p-5 rounded-2xl bg-stone-50/70 border border-stone-200/80 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-stone-400">
                      Step {st.step}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-800">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h2 className="text-base font-bold text-stone-900">
                    {st.title}
                  </h2>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {st.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="pt-6 border-t border-stone-200 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-stone-900">
                Ready to explore local stores?
              </span>
              <p className="text-xs text-stone-500">
                Discover businesses serving your neighborhood today.
              </p>
            </div>
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-xs"
            >
              Start Shopping Now
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
