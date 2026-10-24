import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Shield, Store, Truck } from 'lucide-react';
import { getCanonicalUrl } from '@/lib/seo-config';
import { generateBreadcrumbSchema } from '@/lib/seo-schema';

export const metadata: Metadata = {
  title: 'About Citykart | Global Intra-City Local Commerce Platform',
  description:
    'Learn about Citykart, the hyperlocal marketplace connecting neighborhood stores with city buyers through real-time inventory and direct doorstep delivery.',
  alternates: {
    canonical: getCanonicalUrl('/about'),
  },
  openGraph: {
    title: 'About Citykart | Global Intra-City Local Commerce Platform',
    description:
      'Learn about Citykart, the hyperlocal marketplace connecting neighborhood stores with city buyers.',
    url: getCanonicalUrl('/about'),
  },
};

export default function AboutPage() {
  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'About Citykart', url: '/about' },
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
              About Citykart
            </li>
          </ol>
        </nav>

        <section className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-10 shadow-xs space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Our Mission
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
              Empowering Local Commerce in Every City Worldwide
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed pt-2">
              Citykart is an intra-city commerce marketplace engineered to connect verified, independent retailers directly with local consumers. We believe cities thrive when local merchants possess modern digital tools to showcase their catalogs, receive local orders, and deliver to their neighbors in minutes rather than days.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6 border-t border-stone-100">
            <div className="space-y-2">
              <Store className="w-5 h-5 text-stone-900" />
              <h2 className="text-sm font-bold text-stone-900">Local Merchant First</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Direct relationships between neighborhood shopkeepers and buyers, preserving local heritage and community retail.
              </p>
            </div>

            <div className="space-y-2">
              <Truck className="w-5 h-5 text-stone-900" />
              <h2 className="text-sm font-bold text-stone-900">Minutes, Not Days</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Hyperlocal dispatch straight from neighborhood shops within 15 to 45 minutes, reducing long-distance transit emissions.
              </p>
            </div>

            <div className="space-y-2">
              <Shield className="w-5 h-5 text-stone-900" />
              <h2 className="text-sm font-bold text-stone-900">Trust on Delivery</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Inspect items upon arrival with flexible Cash on Delivery and contactless UPI payment options at your door.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-stone-100 space-y-3 text-xs text-stone-600 leading-relaxed">
            <h2 className="text-base font-bold text-stone-900">Platform Structure</h2>
            <p>
              Citykart supports 25 standardized retail categories across grocery, fruits & vegetables, electronics, fashion, medicines, home appliances, and local specialty goods. Sellers manage their inventory using our mobile-first seller dashboard, while buyers enjoy a fluid, map-free, city-filtered product discovery experience.
            </p>
          </div>

          <div className="pt-6 border-t border-stone-200 flex flex-wrap gap-4">
            <Link
              href="/seller-guide"
              className="px-4 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-xs"
            >
              How to Open a Store
            </Link>
            <Link
              href="/how-it-works"
              className="px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 text-xs font-semibold hover:bg-stone-100 transition-colors"
            >
              How Shopping Works
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
