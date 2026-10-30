import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, MapPin, ShoppingBag, Store, ShieldCheck } from 'lucide-react';
import {
  AUTHORITATIVE_STORE_CATEGORIES,
  formatCurrency,
  INITIAL_PRODUCTS,
  INITIAL_STORES,
} from '@/lib/catalog-data';
import { CategoryIcon } from '@/components/category-icon';
import { ProductStudioArtwork } from '@/components/product-studio-artwork';
import { StoreRatingBadge } from '@/components/store-star-rating';
import { getCanonicalUrl, getCategorySeo, SITE_CONFIG } from '@/lib/seo-config';
import {
  generateBreadcrumbSchema,
  generateCategoryCollectionSchema,
} from '@/lib/seo-schema';
import { getAllServerProducts, getAllServerStores } from '@/lib/stores-registry';

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
  const allStores = getAllServerStores();
  const allProducts = getAllServerProducts();
  const matchingStores = (allStores.length > 0 ? allStores : INITIAL_STORES).filter(
    (s) => s.category === category.name || s.categoryId === category.id
  );
  const matchingProducts = (allProducts.length > 0 ? allProducts : INITIAL_PRODUCTS).filter(
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
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
              {category.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/#categories"
              className="text-xs font-semibold text-slate-600 hover:text-[#003B8E] inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Categories</span>
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-xs font-bold text-white bg-[#003B8E] hover:bg-[#002D6E] rounded-xl transition-colors shadow-xs"
            >
              Shop in My City
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
              <Link href="/#categories" className="hover:text-[#003B8E] hover:underline font-medium">
                Categories
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-300">
              /
            </li>
            <li aria-current="page" className="font-bold text-slate-900">
              {category.name}
            </li>
          </ol>
        </nav>

        {/* Category Hero Banner */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#003B8E] bg-blue-50/80 px-3 py-1 rounded-lg border border-blue-200/70">
                <CategoryIcon
                  categoryIdOrName={category.id}
                  className="w-4 h-4 text-[#003B8E]"
                />
                <span>Verified Local Department</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {category.name}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                {seo.metaDescription}
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                <span className="tabular-nums">
                  {matchingStores.length} local store{matchingStores.length === 1 ? '' : 's'} serving your city
                </span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="tabular-nums">
                  {matchingProducts.length} local product{matchingProducts.length === 1 ? '' : 's'} available
                </span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Fast intra-city delivery</span>
                </span>
              </div>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row gap-3">
              <Link
                href={`/?category=${encodeURIComponent(category.name)}`}
                className="px-5 py-3 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white text-xs font-bold text-center transition-colors shadow-xs"
              >
                Browse Interactive City Catalog
              </Link>
            </div>
          </div>
        </section>

        {/* Local Stores in this Category */}
        {matchingStores.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Featured Stores in {category.name}
              </h2>
              <span className="text-xs font-bold text-slate-500 tabular-nums bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                {matchingStores.length} store{matchingStores.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matchingStores.map((st) => (
                <article
                  key={st.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-[#003B8E]/40 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#003B8E]">
                        <MapPin className="w-3.5 h-3.5 text-[#003B8E]" />
                        <span>{st.neighborhood}, {st.cityName}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <StoreRatingBadge
                          storeId={st.id}
                          fallbackRating={st.rating}
                          fallbackReviewsCount={st.reviewsCount}
                          size="xs"
                        />
                        {st.isDemo && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                            Demo Store
                          </span>
                        )}
                      </div>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      <Link
                        href={`/stores/${st.id}`}
                        className="hover:underline hover:text-[#003B8E]"
                      >
                        {st.name}
                      </Link>
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {st.specialty}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono tabular-nums text-[11px]">
                      Hours: {st.operatingHours}
                    </span>
                    <Link
                      href={`/stores/${st.id}`}
                      className="font-bold text-[#003B8E] hover:underline inline-flex items-center gap-1"
                    >
                      <span>View Store</span>
                      <ArrowRight className="w-3.5 h-3.5" />
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
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Popular Products in {category.name}
            </h2>
            <span className="text-xs font-bold text-slate-500 tabular-nums bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
              {matchingProducts.length} item{matchingProducts.length === 1 ? '' : 's'}
            </span>
          </div>

          {matchingProducts.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center text-xs text-slate-500">
              No products listed in this category yet. Local sellers can add products anytime.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-5">
              {matchingProducts.map((p) => (
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
                      <div className="flex items-center justify-between gap-1.5 text-[11px] text-slate-500">
                        <Link
                          href={`/stores/${p.storeId}`}
                          className="hover:text-[#003B8E] hover:underline truncate font-semibold text-slate-700 inline-flex items-center gap-1"
                        >
                          <Store className="w-3 h-3 text-[#003B8E] shrink-0" />
                          <span className="truncate">{p.storeName}</span>
                        </Link>
                        <span className="font-mono tabular-nums text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {p.deliveryMins}m
                        </span>
                      </div>

                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug min-h-[2.5rem]">
                        <Link
                          href={`/products/${p.id}`}
                          className="hover:text-[#003B8E]"
                        >
                          {p.name}
                        </Link>
                      </h3>

                      <div className="text-[11px] text-slate-400 truncate font-medium">
                        {p.unit ? `${p.unit} · ` : ''}{p.city}
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

        {/* Other Categories Internal Linking Grid */}
        <section className="pt-8 border-t border-slate-200 space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
            Explore All Local Shopping Categories
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {AUTHORITATIVE_STORE_CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className={`p-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 ${
                  cat.slug === slug
                    ? 'bg-[#003B8E] text-white border-[#003B8E] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <CategoryIcon
                  categoryIdOrName={cat.id}
                  className={`w-3.5 h-3.5 shrink-0 ${
                    cat.slug === slug ? 'text-white' : 'text-[#003B8E]'
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
