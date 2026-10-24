import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, MapPin, ShoppingBag, Store } from 'lucide-react';
import {
  AUTHORITATIVE_STORE_CATEGORIES,
  formatCurrency,
  INITIAL_PRODUCTS,
  INITIAL_STORES,
  Product,
} from '@/lib/catalog-data';
import { CategoryIcon } from '@/components/category-icon';
import { ProductStudioArtwork } from '@/components/product-studio-artwork';
import { getCanonicalUrl, getCategorySeo, SITE_CONFIG } from '@/lib/seo-config';
import {
  generateBreadcrumbSchema,
  generateCategoryCollectionSchema,
} from '@/lib/seo-schema';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = AUTHORITATIVE_STORE_CATEGORIES.find((c) => c.slug === slug);
  if (!category) return {};

  const seo = getCategorySeo(slug);
  const canonical = getCanonicalUrl(`/categories/${slug}`);

  return {
    title: seo.title,
    description: seo.metaDescription,
    keywords: seo.keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      title: seo.title,
      description: seo.metaDescription,
      url: canonical,
      siteName: SITE_CONFIG.name,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.metaDescription,
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = AUTHORITATIVE_STORE_CATEGORIES.find((c) => c.slug === slug);

  if (!category) {
    notFound();
  }

  const seo = getCategorySeo(slug);
  const matchingStores = INITIAL_STORES.filter(
    (s) => s.category === category.name || s.categoryId === category.id
  );
  const matchingProducts = INITIAL_PRODUCTS.filter(
    (p) => p.category === category.name || p.categoryId === category.id
  );

  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Categories', url: '/#categories' },
    { name: category.name, url: `/categories/${category.slug}` },
  ];

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbs);
  const collectionSchema = generateCategoryCollectionSchema(
    category.name,
    category.slug,
    matchingProducts
  );

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
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
              {category.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/#categories"
              className="text-xs font-medium text-stone-600 hover:text-stone-900 inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Categories</span>
            </Link>
            <Link
              href="/"
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors"
            >
              Shop in My City
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
              <Link href="/#categories" className="hover:text-stone-900 hover:underline">
                Categories
              </Link>
            </li>
            <li aria-hidden="true" className="text-stone-300">
              /
            </li>
            <li aria-current="page" className="font-semibold text-stone-900">
              {category.name}
            </li>
          </ol>
        </nav>

        {/* Category Hero Banner */}
        <section className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200/60">
                <CategoryIcon
                  categoryIdOrName={category.id}
                  className="w-4 h-4 text-stone-800"
                />
                <span>Category #{category.order} of 25</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
                {category.name}
              </h1>
              <p className="text-sm text-stone-600 leading-relaxed">
                {seo.metaDescription}
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-4 text-xs text-stone-500">
                <span>
                  {matchingStores.length} local store{matchingStores.length === 1 ? '' : 's'} serving your city
                </span>
                <span aria-hidden="true" className="text-stone-300">·</span>
                <span>
                  {matchingProducts.length} local product{matchingProducts.length === 1 ? '' : 's'} available
                </span>
                <span aria-hidden="true" className="text-stone-300">·</span>
                <span className="text-emerald-700 font-medium">Fast intra-city delivery</span>
              </div>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row gap-3">
              <Link
                href={`/?category=${encodeURIComponent(category.name)}`}
                className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold text-center transition-colors shadow-xs"
              >
                Browse Interactive Grid
              </Link>
            </div>
          </div>
        </section>

        {/* Local Stores in this Category */}
        {matchingStores.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-900">
                Featured Stores in {category.name}
              </h2>
              <span className="text-xs text-stone-500 font-mono">
                {matchingStores.length} store{matchingStores.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matchingStores.map((st) => (
                <article
                  key={st.id}
                  className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs hover:border-stone-400 transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                      <span className="inline-flex items-center gap-1 font-medium text-stone-700">
                        <MapPin className="w-3.5 h-3.5 text-stone-400" />
                        <span>{st.neighborhood}, {st.cityName}</span>
                      </span>
                      {st.isDemo && (
                        <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-medium">
                          Demo Store
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-stone-900">
                      <Link
                        href={`/stores/${st.id}`}
                        className="hover:underline hover:text-stone-700"
                      >
                        {st.name}
                      </Link>
                    </h3>
                    <p className="text-xs text-stone-600 line-clamp-2">
                      {st.specialty}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-stone-500 font-mono text-[11px]">
                      Hours: {st.operatingHours}
                    </span>
                    <Link
                      href={`/stores/${st.id}`}
                      className="font-semibold text-stone-900 hover:underline inline-flex items-center gap-1"
                    >
                      <span>View Store</span>
                      <ArrowRight className="w-3 h-3 text-stone-400" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Products in this Category */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">
              Popular Products in {category.name}
            </h2>
            <span className="text-xs text-stone-500 font-mono">
              {matchingProducts.length} item{matchingProducts.length === 1 ? '' : 's'}
            </span>
          </div>

          {matchingProducts.length === 0 ? (
            <div className="bg-white border border-stone-200/90 rounded-2xl p-8 text-center text-xs text-stone-500">
              No products listed in this category yet. Local sellers can add products anytime.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-5">
              {matchingProducts.map((p) => (
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
                      <div className="flex items-center justify-between gap-1.5 text-[11px] text-stone-500">
                        <Link
                          href={`/stores/${p.storeId}`}
                          className="hover:text-stone-900 hover:underline truncate font-medium inline-flex items-center gap-1"
                        >
                          <Store className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="truncate">{p.storeName}</span>
                        </Link>
                        <span className="font-mono text-[10px] text-stone-500 bg-stone-100/90 px-1.5 py-0.5 rounded">
                          {p.deliveryMins}m
                        </span>
                      </div>

                      <h3 className="text-xs sm:text-sm font-semibold text-stone-900 line-clamp-2 leading-snug min-h-[2.5rem]">
                        <Link
                          href={`/products/${p.id}`}
                          className="hover:text-stone-700"
                        >
                          {p.name}
                        </Link>
                      </h3>

                      <div className="text-[11px] text-stone-400 truncate">
                        {p.unit ? `${p.unit} · ` : ''}{p.city}
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

        {/* Other Categories Internal Linking Grid */}
        <section className="pt-8 border-t border-stone-200 space-y-4">
          <h2 className="text-base font-bold text-stone-900">
            Explore All 25 Local Shopping Categories
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {AUTHORITATIVE_STORE_CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className={`p-2.5 rounded-xl border text-xs font-medium transition-colors flex items-center gap-2 ${
                  cat.slug === slug
                    ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                    : 'bg-white text-stone-700 border-stone-200/90 hover:bg-stone-50 hover:border-stone-400'
                }`}
              >
                <CategoryIcon
                  categoryIdOrName={cat.id}
                  className={`w-3.5 h-3.5 shrink-0 ${
                    cat.slug === slug ? 'text-white' : 'text-stone-600'
                  }`}
                />
                <span className="truncate">{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
