import { MetadataRoute } from 'next';
import { AUTHORITATIVE_STORE_CATEGORIES } from '@/lib/catalog-data';
import { getCanonicalUrl, SITE_CONFIG } from '@/lib/seo-config';

/**
 * Dynamic XML Sitemap Generator for Next.js App Router
 * Generates https://citykart.shop/sitemap.xml
 * Strictly adheres to Google Search Central quality & canonical rules.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const currentDate = new Date();

  // 1. Core Homepage
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: getCanonicalUrl('/'),
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: getCanonicalUrl('/about'),
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: getCanonicalUrl('/how-it-works'),
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: getCanonicalUrl('/pricing'),
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: getCanonicalUrl('/seller'),
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: getCanonicalUrl('/partner'),
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: getCanonicalUrl('/seller-guide'),
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: getCanonicalUrl('/contact'),
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: getCanonicalUrl('/privacy'),
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: getCanonicalUrl('/terms'),
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: getCanonicalUrl('/delivery-returns'),
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // 2. Canonical 25 Category Landing Pages (High Priority Public Routes)
  const categoryRoutes: MetadataRoute.Sitemap = AUTHORITATIVE_STORE_CATEGORIES.map(
    (cat) => ({
      url: getCanonicalUrl(`/categories/${cat.slug}`),
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    })
  );

  // 3. Genuine Public Stores & Products (Excluding Demo / Test Records)
  // Note: Only non-demo, verified public stores are emitted in the canonical indexable sitemap.
  const dynamicStoreRoutes: MetadataRoute.Sitemap = [];
  const dynamicProductRoutes: MetadataRoute.Sitemap = [];

  // In production, when non-demo stores are fetched from Firestore, they get added here.
  // Fictional demo stores with isDemo: true are strictly excluded per Google Guidelines.

  return [...staticRoutes, ...categoryRoutes, ...dynamicStoreRoutes, ...dynamicProductRoutes];
}
