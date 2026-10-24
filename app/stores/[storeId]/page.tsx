import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, MapPin, Phone, ShoppingBag, Store as StoreIcon, Truck } from 'lucide-react';
import {
  AUTHORITATIVE_STORE_CATEGORIES,
  formatCurrency,
  INITIAL_PRODUCTS,
  INITIAL_STORES,
} from '@/lib/catalog-data';
import { CategoryIcon } from '@/components/category-icon';
import { ProductStudioArtwork } from '@/components/product-studio-artwork';
import { getCanonicalUrl, SITE_CONFIG } from '@/lib/seo-config';
import {
  generateBreadcrumbSchema,
  generateStoreLocalBusinessSchema,
} from '@/lib/seo-schema';

import { isStoreDeletedServer } from '@/lib/stores-registry';

interface StorePageProps {
  params: Promise<{ storeId: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: StorePageProps): Promise<Metadata> {
  const { storeId } = await params;
  if (await isStoreDeletedServer(storeId)) return {};
  const store = INITIAL_STORES.find((s) => s.id === storeId);
  if (!store) return {};


  const title = `${store.name} in ${store.cityName}, ${store.stateRegion || store.country} | Citykart`;
  const description = `${store.name} - ${store.specialty}. Located in ${store.neighborhood}, ${store.cityName}. Operating hours: ${store.operatingHours}. Direct local ordering on Citykart.`;
  const canonical = getCanonicalUrl(`/stores/${store.id}`);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    // Exclude demo stores from Google index to preserve search quality
    robots: {
      index: !store.isDemo,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_CONFIG.name,
      type: 'website',
    },
  };
}

export default async function StorePage({ params }: StorePageProps) {
  const { storeId } = await params;
  if (await isStoreDeletedServer(storeId)) {
    notFound();
  }
  const store = INITIAL_STORES.find((s) => s.id === storeId);

  if (!store) {
    notFound();
  }

  const categoryDef = AUTHORITATIVE_STORE_CATEGORIES.find(
    (c) => c.name === store.category || c.id === store.categoryId
  );
  const categorySlug = categoryDef?.slug || 'other-local-retail-stores';

  const storeProducts = INITIAL_PRODUCTS.filter(
    (p) => p.storeId === store.id
  );

  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: store.category, url: `/categories/${categorySlug}` },
    { name: store.name, url: `/stores/${store.id}` },
  ];

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbs);
  const localBusinessSchema = generateStoreLocalBusinessSchema(store);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />

      {/* Crawlable Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
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
            <span className="text-stone-300">/</span>
            <span className="text-xs font-semibold text-stone-600 truncate max-w-[200px] sm:max-w-none">
              {store.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/categories/${categorySlug}`}
              className="text-xs font-medium text-stone-600 hover:text-stone-900 inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{store.category}</span>
            </Link>
            <Link
              href="/"
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors"
            >
              Shop Local
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Semantic Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="text-xs text-stone-500">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-stone-900 hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-stone-300">
              /
            </li>
            <li>
              <Link
                href={`/categories/${categorySlug}`}
                className="hover:text-stone-900 hover:underline"
              >
                {store.category}
              </Link>
            </li>
            <li aria-hidden="true" className="text-stone-300">
              /
            </li>
            <li aria-current="page" className="font-semibold text-stone-900">
              {store.name}
            </li>
          </ol>
        </nav>

        {/* Store Profile Card */}
        <section className="bg-white border border-stone-200/90 rounded-2xl overflow-hidden shadow-xs">
          {store.coverImageUrl && (
            <div className="w-full h-44 sm:h-56 bg-[#F3EFEA] border-b border-stone-200 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={store.coverImageUrl}
                alt={`${store.name} storefront in ${store.cityName}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-600">
              <Link
                href={`/categories/${categorySlug}`}
                className="inline-flex items-center gap-1.5 hover:text-stone-900 hover:underline"
              >
                <CategoryIcon
                  categoryIdOrName={store.categoryId}
                  className="w-4 h-4 text-stone-700"
                />
                <span className="font-semibold">{store.category}</span>
              </Link>
              <span aria-hidden="true" className="text-stone-300">
                ·
              </span>
              <span>
                {store.neighborhood}, {store.cityName}, {store.country}
              </span>
              {store.isDemo && (
                <span className="px-2 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-[10px] font-semibold text-stone-600">
                  Demo Store
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
              {store.name}
            </h1>

            <p className="text-sm text-stone-600 max-w-3xl leading-relaxed">
              {store.specialty} · Located at {store.address}.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-stone-100 text-xs">
              <div className="flex items-start gap-2 text-stone-700">
                <Clock className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-stone-900">
                    Operating Hours
                  </span>
                  <span>{store.operatingHours}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-stone-700">
                <Truck className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-stone-900">
                    Local Delivery Coverage
                  </span>
                  <span>
                    {store.serviceArea.coveredLocalities.join(', ')} (
                    {store.serviceArea.maxRadiusKm} km radius)
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-stone-700">
                <MapPin className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-stone-900">
                    Address
                  </span>
                  <span>{store.address}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Store Catalog */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">
              Available Products from {store.name} ({storeProducts.length})
            </h2>
            <Link
              href="/"
              className="text-xs font-medium text-stone-600 hover:text-stone-900 underline"
            >
              Back to City Catalog
            </Link>
          </div>

          {storeProducts.length === 0 ? (
            <div className="bg-white border border-stone-200/90 rounded-2xl p-8 text-center text-xs text-stone-500">
              No products are currently listed in this store.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-5">
              {storeProducts.map((p) => (
                <article
                  key={p.id}
                  className="group bg-white border border-stone-200/90 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-stone-400 hover:shadow-md smooth-lift transition-all"
                >
                  <div>
                    <div className="relative aspect-[4/3] w-full bg-[#F3EFEA] overflow-hidden">
                      <ProductStudioArtwork
                        preset={p.artworkPreset}
                        customImageUrl={p.customImageUrl}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    </div>

                    <div className="p-3.5 sm:p-4 space-y-1.5">
                      <h3 className="text-xs sm:text-sm font-semibold text-stone-900 line-clamp-2 leading-snug min-h-[2.5rem]">
                        <Link
                          href={`/products/${p.id}`}
                          className="hover:text-stone-700"
                        >
                          {p.name}
                        </Link>
                      </h3>

                      <div className="text-[11px] text-stone-400 truncate">
                        {p.unit ? `${p.unit} · ` : ''}{p.category}
                      </div>
                    </div>
                  </div>

                  <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
                    <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-stone-900 tracking-tight">
                      {formatCurrency(p.price, p.currency)}
                    </div>

                    <Link
                      href={`/products/${p.id}`}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors inline-flex items-center gap-1"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>Details</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
