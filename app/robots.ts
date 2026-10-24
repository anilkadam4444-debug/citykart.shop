import { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/lib/seo-config';

/**
 * Dynamic robots.txt Generator for Next.js App Router
 * Generates https://citykart.shop/robots.txt
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = SITE_CONFIG.siteUrl.replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/categories/',
          '/stores/',
          '/products/',
          '/about',
          '/how-it-works',
          '/seller-guide',
          '/contact',
          '/privacy',
          '/terms',
          '/delivery-returns',
        ],
        disallow: [
          '/api/',
          '/seller/dashboard/',
          '/seller/inventory',
          '/seller/orders',
          '/checkout',
          '/cart',
          '/*?*q=', // Disallow arbitrary search parameter crawl loops
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
