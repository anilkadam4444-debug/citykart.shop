import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, MapPin, ShieldCheck, ShoppingBag, Store as StoreIcon, Truck } from 'lucide-react';
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

import { isStoreDeletedServer } from '@/lib/stores-registry';

interface ProductPageProps {
  params: Promise<{ productId: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { productId } = await params;
  const product = INITIAL_PRODUCTS.find((p) => p.id === productId);
  if (!product) return {};
  if (await isStoreDeletedServer(product.storeId)) return {};

  const store = INITIAL_STORES.find((s) => s.id === product.storeId);

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
  const product = INITIAL_PRODUCTS.find((p) => p.id === productId);

  if (!product || (await isStoreDeletedServer(product.storeId))) {
    notFound();
  }

  const store = INITIAL_STORES.find((s) => s.id === product.storeId);
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
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900">
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
              {product.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/stores/${product.storeId}`}
              className="text-xs font-medium text-stone-600 hover:text-stone-900 inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Store</span>
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Semantic Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="text-xs text-stone-500">
          <ol className="flex items-center gap-1.5 flex-wrap">
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
                {product.category}
              </Link>
            </li>
            <li aria-hidden="true" className="text-stone-300">
              /
            </li>
            <li>
              <Link
                href={`/stores/${product.storeId}`}
                className="hover:text-stone-900 hover:underline"
              >
                {product.storeName}
              </Link>
            </li>
            <li aria-hidden="true" className="text-stone-300">
              /
            </li>
            <li aria-current="page" className="font-semibold text-stone-900 truncate max-w-[260px]">
              {product.name}
            </li>
          </ol>
        </nav>

        {/* Product Purchase View (Contiguous Module) */}
        <div className="bg-white border border-stone-200/90 rounded-2xl overflow-hidden shadow-xs grid grid-cols-1 md:grid-cols-12">
          {/* Left: Product Artwork / Photography */}
          <div className="md:col-span-6 bg-[#F3EFEA] p-6 sm:p-10 flex items-center justify-center border-b md:border-b-0 md:border-r border-stone-200">
            <div className="relative aspect-[4/3] w-full max-w-md rounded-xl overflow-hidden shadow-xs">
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
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-600">
                <Link
                  href={`/categories/${categorySlug}`}
                  className="inline-flex items-center gap-1.5 text-stone-700 hover:text-stone-900 hover:underline"
                >
                  <CategoryIcon
                    categoryIdOrName={product.categoryId}
                    className="w-3.5 h-3.5"
                  />
                  <span>{product.category}</span>
                </Link>
                <span aria-hidden="true" className="text-stone-300">
                  ·
                </span>
                <Link
                  href={`/stores/${product.storeId}`}
                  className="inline-flex items-center gap-1 font-semibold text-stone-900 hover:underline"
                >
                  <StoreIcon className="w-3.5 h-3.5 text-stone-500" />
                  <span>{product.storeName}</span>
                </Link>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
                {product.name}
              </h1>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold font-mono tabular-nums text-stone-900 tracking-tight">
                  {formatCurrency(product.price, product.currency)}
                </span>
                {product.unit && (
                  <span className="text-xs text-stone-500 font-mono">
                    per {product.unit}
                  </span>
                )}
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    inStock
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {inStock ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>

              <p className="text-sm text-stone-600 leading-relaxed pt-2 border-t border-stone-100">
                {product.description ||
                  `Fresh and authentic ${product.name} procured directly from ${product.storeName}. Available for local neighborhood delivery in ${product.city}.`}
              </p>

              {/* Delivery & Payment Badges */}
              <div className="space-y-2 pt-2 text-xs text-stone-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-stone-500 shrink-0" />
                  <span>
                    Estimated local delivery:{' '}
                    <strong className="text-stone-900 font-mono">
                      ~{product.deliveryMins} mins
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-stone-500 shrink-0" />
                  <span>
                    Serving local address in{' '}
                    <strong className="text-stone-900">{product.city}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cash on Delivery & UPI at doorstep available</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row gap-3">
              <Link
                href="/"
                className="flex-1 py-3 px-5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold text-center transition-colors shadow-xs flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Order in {product.city}</span>
              </Link>
              <Link
                href={`/stores/${product.storeId}`}
                className="py-3 px-5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-semibold text-center transition-colors"
              >
                View More from Store
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
