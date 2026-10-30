import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, ShieldCheck, ShoppingBag, Store as StoreIcon, Truck } from 'lucide-react';
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
  generateProductSchema,
} from '@/lib/seo-schema';

import {
  isStoreDeletedServer,
  serverDeletedProductsRegistry,
  serverProductsRegistry,
  serverStoresRegistry,
} from '@/lib/stores-registry';
import {
  serverProductOverridesRegistry,
  serverStoreOverridesRegistry,
} from '@/lib/super-admin-auth';

interface ProductPageProps {
  params: Promise<{ productId: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { productId } = await params;
  if (serverDeletedProductsRegistry.has(productId)) return {};
  const product =
    serverProductsRegistry.get(productId) ||
    INITIAL_PRODUCTS.find((p) => p.id === productId);
  if (!product) return {};
  if (await isStoreDeletedServer(product.storeId)) return {};
  const prodOverride = serverProductOverridesRegistry.get(product.id);
  const storeOverride = serverStoreOverridesRegistry.get(product.storeId);
  if (
    product.adminUnpublished ||
    prodOverride?.adminUnpublished ||
    storeOverride?.isSuspended
  ) {
    return {};
  }

  const store =
    serverStoresRegistry.get(product.storeId) ||
    INITIAL_STORES.find((s) => s.id === product.storeId);
  if (store?.isSuspended) return {};

  const title = `${product.name} - ${formatCurrency(product.price, product.currency)} | ${product.storeName} | Citykart`;
  const description = `Buy ${product.name} from ${product.storeName} in ${product.city}. Direct local delivery in ~${product.deliveryMins} mins. Cash and UPI on delivery available.`;
  const canonical = getCanonicalUrl(`/products/${product.id}`);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    // Exclude products from demo stores from Google index to preserve search quality
    robots: {
      index: !store?.isDemo,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_CONFIG.name,
      type: 'website',
      images: product.customImageUrl
        ? [{ url: product.customImageUrl, alt: product.name }]
        : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { productId } = await params;
  if (serverDeletedProductsRegistry.has(productId)) {
    notFound();
  }
  const product =
    serverProductsRegistry.get(productId) ||
    INITIAL_PRODUCTS.find((p) => p.id === productId);

  if (!product || (await isStoreDeletedServer(product.storeId))) {
    notFound();
  }

  const prodOverride = serverProductOverridesRegistry.get(product.id);
  const storeOverride = serverStoreOverridesRegistry.get(product.storeId);
  const store =
    serverStoresRegistry.get(product.storeId) ||
    INITIAL_STORES.find((s) => s.id === product.storeId);

  if (
    product.adminUnpublished ||
    prodOverride?.adminUnpublished ||
    store?.isSuspended ||
    storeOverride?.isSuspended ||
    storeOverride?.isActive === false
  ) {
    notFound();
  }
  const categoryDef = AUTHORITATIVE_STORE_CATEGORIES.find(
    (c) => c.name === product.category || c.id === product.categoryId
  );
  const categorySlug = categoryDef?.slug || 'other-local-retail-stores';

  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: product.category, url: `/categories/${categorySlug}` },
    { name: product.storeName, url: `/stores/${product.storeId}` },
    { name: product.name, url: `/products/${product.id}` },
  ];

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbs);
  const productSchema = generateProductSchema(product, store);

  const inStock = product.isAvailable && product.stock > 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
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
              {product.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/stores/${product.storeId}`}
              className="text-xs font-semibold text-slate-600 hover:text-[#003B8E] inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Store</span>
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Semantic Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
          <ol className="flex items-center gap-1.5 flex-wrap">
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
                {product.category}
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-300">
              /
            </li>
            <li>
              <Link
                href={`/stores/${product.storeId}`}
                className="hover:text-[#003B8E] hover:underline font-medium"
              >
                {product.storeName}
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-300">
              /
            </li>
            <li aria-current="page" className="font-bold text-slate-900 truncate max-w-[260px]">
              {product.name}
            </li>
          </ol>
        </nav>

        {/* Product Purchase View (Contiguous Module) */}
        <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs grid grid-cols-1 md:grid-cols-12">
          {/* Left: Product Artwork / Photography */}
          <div className="md:col-span-6 bg-slate-100 p-6 sm:p-10 flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-200">
            <div className="relative aspect-[4/3] w-full max-w-md rounded-2xl overflow-hidden shadow-sm border border-slate-200/60 bg-white">
              <ProductStudioArtwork
                preset={product.artworkPreset}
                customImageUrl={product.customImageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Right: Purchasing Details */}
          <div className="md:col-span-6 p-6 sm:p-10 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                <Link
                  href={`/categories/${categorySlug}`}
                  className="inline-flex items-center gap-1.5 text-[#003B8E] bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-200/60 hover:bg-blue-100/70 transition-colors"
                >
                  <CategoryIcon
                    categoryIdOrName={product.categoryId}
                    className="w-3.5 h-3.5 text-[#003B8E]"
                  />
                  <span>{product.category}</span>
                </Link>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <Link
                  href={`/stores/${product.storeId}`}
                  className="inline-flex items-center gap-1.5 font-bold text-slate-900 hover:text-[#003B8E] hover:underline"
                >
                  <StoreIcon className="w-3.5 h-3.5 text-[#003B8E]" />
                  <span>{product.storeName}</span>
                </Link>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {product.name}
              </h1>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 tracking-tight">
                  {formatCurrency(product.price, product.currency)}
                </span>
                {product.unit && (
                  <span className="text-xs text-slate-500 font-mono">
                    per {product.unit}
                  </span>
                )}
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                    inStock
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {inStock ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed pt-3 border-t border-slate-100">
                {product.description ||
                  `Fresh and authentic ${product.name} procured directly from ${product.storeName}. Available for local neighborhood delivery in ${product.city}.`}
              </p>

              {/* Delivery & Payment Badges */}
              <div className="space-y-2.5 pt-3 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-[#003B8E] shrink-0" />
                  <span>
                    Estimated local delivery:{' '}
                    <strong className="text-slate-900 font-mono tabular-nums">
                      ~{product.deliveryMins} mins
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-[#003B8E] shrink-0" />
                  <span>
                    Serving local address in{' '}
                    <strong className="text-slate-900">{product.city}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium text-slate-700">Cash on Delivery &amp; UPI at doorstep available</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
              <Link
                href={`/?product=${product.id}`}
                className="flex-1 py-3.5 px-5 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white text-xs sm:text-sm font-bold text-center transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Order in {product.city} (Live Storefront)</span>
              </Link>
              <Link
                href={`/stores/${product.storeId}`}
                className="py-3.5 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#003B8E] text-xs sm:text-sm font-bold text-center transition-colors flex items-center justify-center"
              >
                View Store
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
