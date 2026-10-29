import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, MapPin, ShoppingBag, Truck, ShieldCheck } from 'lucide-react';
import {
  AUTHORITATIVE_STORE_CATEGORIES,
  formatCurrency,
  INITIAL_PRODUCTS,
  INITIAL_STORES,
} from '@/lib/catalog-data';
import { CategoryIcon } from '@/components/category-icon';
import { ProductStudioArtwork } from '@/components/product-studio-artwork';
import { StoreRatingBadge } from '@/components/store-star-rating';
import { getCanonicalUrl, SITE_CONFIG } from '@/lib/seo-config';
import {
  generateBreadcrumbSchema,
  generateStoreLocalBusinessSchema,
} from '@/lib/seo-schema';

import { isStoreDeletedServer } from '@/lib/stores-registry';
import {
  serverProductOverridesRegistry,
  serverStoreOverridesRegistry,
} from '@/lib/super-admin-auth';

interface StorePageProps {
  params: Promise<{ storeId: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: StorePageProps): Promise<Metadata> {
  const { storeId } = await params;
  if (await isStoreDeletedServer(storeId)) return {};
  const storeOverride = serverStoreOverridesRegistry.get(storeId);
  if (storeOverride?.isSuspended || storeOverride?.isActive === false) return {};
  const store = INITIAL_STORES.find((s) => s.id === storeId);
  if (!store || store.isSuspended || !store.isActive) return {};

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
  const storeOverride = serverStoreOverridesRegistry.get(storeId);
  const store = INITIAL_STORES.find((s) => s.id === storeId);

  if (
    !store ||
    store.isSuspended ||
    !store.isActive ||
    storeOverride?.isSuspended ||
    storeOverride?.isActive === false
  ) {
    notFound();
  }

  const categoryDef = AUTHORITATIVE_STORE_CATEGORIES.find(
    (c) => c.name === store.category || c.id === store.categoryId
  );
  const categorySlug = categoryDef?.slug || 'other-local-retail-stores';

  const storeProducts = INITIAL_PRODUCTS.filter((p) => {
    if (p.storeId !== store.id) return false;
    const prodOverride = serverProductOverridesRegistry.get(p.id);
    if (p.adminUnpublished || prodOverride?.adminUnpublished) return false;
    return true;
  });

  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: store.category, url: `/categories/${categorySlug}` },
    { name: store.name, url: `/stores/${store.id}` },
  ];

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbs);
  const localBusinessSchema = generateStoreLocalBusinessSchema(store);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
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
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 group"
            >
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
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-700 truncate max-w-[200px] sm:max-w-none">
              {store.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/categories/${categorySlug}`}
              className="text-xs font-semibold text-slate-600 hover:text-[#003B8E] inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{store.category}</span>
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-xs font-bold text-white bg-[#003B8E] hover:bg-[#002D6E] rounded-xl transition-colors shadow-xs"
            >
              Shop Local
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Semantic Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-[#003B8E] hover:underline font-medium">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-300">
              /
            </li>
            <li>
              <Link
                href={`/categories/${categorySlug}`}
                className="hover:text-[#003B8E] hover:underline font-medium"
              >
                {store.category}
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-300">
              /
            </li>
            <li aria-current="page" className="font-bold text-slate-900">
              {store.name}
            </li>
          </ol>
        </nav>

        {/* Store Profile Card */}
        <section className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs">
          {store.coverImageUrl && (
            <div className="w-full h-44 sm:h-56 bg-slate-100 border-b border-slate-200 overflow-hidden">
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
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              <Link
                href={`/categories/${categorySlug}`}
                className="inline-flex items-center gap-1.5 text-[#003B8E] bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-200/60 hover:bg-blue-100/70 transition-colors"
              >
                <CategoryIcon
                  categoryIdOrName={store.categoryId}
                  className="w-4 h-4 text-[#003B8E]"
                />
                <span className="font-bold">{store.category}</span>
              </Link>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-[#003B8E]" />
                {store.neighborhood}, {store.cityName}, {store.country}
              </span>
              {store.isDemo ? (
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600">
                  Demo Store
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800 inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Verified Partner
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {store.name}
              </h1>
              <StoreRatingBadge
                storeId={store.id}
                fallbackRating={store.rating}
                fallbackReviewsCount={store.reviewsCount}
                size="md"
              />
            </div>

            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
              {store.specialty} · Located at {store.address}.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
              <div className="flex items-start gap-2.5 text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                <Clock className="w-4 h-4 text-[#003B8E] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-slate-900">
                    Operating Hours
                  </span>
                  <span className="font-mono tabular-nums">{store.operatingHours}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                <Truck className="w-4 h-4 text-[#003B8E] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-slate-900">
                    Local Delivery Coverage
                  </span>
                  <span>
                    {store.serviceArea.coveredLocalities.join(', ')} (
                    {store.serviceArea.maxRadiusKm} km radius)
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                <MapPin className="w-4 h-4 text-[#003B8E] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-slate-900">
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
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Available Products from {store.name} <span className="tabular-nums text-slate-500">({storeProducts.length})</span>
            </h2>
            <Link
              href="/"
              className="text-xs font-bold text-[#003B8E] hover:underline"
            >
              Back to City Catalog
            </Link>
          </div>

          {storeProducts.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center text-xs text-slate-500">
              No products are currently listed in this store.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-5">
              {storeProducts.map((p) => (
                <article
                  key={p.id}
                  className="group bg-white border border-slate-200/90 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-[#003B8E]/40 hover:shadow-md smooth-lift transition-all"
                >
                  <div>
                    <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                      <ProductStudioArtwork
                        preset={p.artworkPreset}
                        customImageUrl={p.customImageUrl}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    </div>

                    <div className="p-3.5 sm:p-4 space-y-1.5">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug min-h-[2.5rem]">
                        <Link
                          href={`/products/${p.id}`}
                          className="hover:text-[#003B8E]"
                        >
                          {p.name}
                        </Link>
                      </h3>

                      <div className="text-[11px] text-slate-400 truncate font-medium">
                        {p.unit ? `${p.unit} · ` : ''}{p.category}
                      </div>
                    </div>
                  </div>

                  <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="text-sm sm:text-base font-extrabold font-mono tabular-nums text-slate-900 tracking-tight">
                      {formatCurrency(p.price, p.currency)}
                    </div>

                    <Link
                      href={`/products/${p.id}`}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-[#F96302] hover:bg-[#E05500] rounded-xl transition-colors inline-flex items-center gap-1 shadow-2xs"
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
