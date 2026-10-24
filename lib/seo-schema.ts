import { LocalStore, Product } from './catalog-data';
import { getCanonicalUrl, SITE_CONFIG } from './seo-config';

/**
 * Standard Schema.org JSON-LD Generators for Citykart
 * Compliant with Google Search Rich Results guidelines.
 */

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: getCanonicalUrl(item.url),
    })),
  };
}

export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.siteUrl,
    description: SITE_CONFIG.defaultDescription,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_CONFIG.siteUrl}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_CONFIG.name,
    legalName: 'Citykart Intra-City Commerce Platform',
    url: SITE_CONFIG.siteUrl,
    logo: `${SITE_CONFIG.siteUrl}/citykart-logo.png`,
    description: SITE_CONFIG.defaultDescription,
    email: SITE_CONFIG.supportEmail,
    foundingDate: '2024',
    sameAs: [
      'https://twitter.com/CitykartShop',
      'https://www.linkedin.com/company/citykartshop',
    ],
  };
}

export function generateCategoryCollectionSchema(
  categoryName: string,
  categorySlug: string,
  products: Product[] = []
) {
  const categoryUrl = getCanonicalUrl(`/categories/${categorySlug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${categoryName} from Local Stores`,
    description: `Discover and shop ${categoryName.toLowerCase()} from verified local stores on Citykart.`,
    url: categoryUrl,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.slice(0, 16).map((product, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: getCanonicalUrl(`/products/${product.id}`),
        name: product.name,
      })),
    },
  };
}

export function generateProductSchema(product: Product, store?: LocalStore) {
  const productUrl = getCanonicalUrl(`/products/${product.id}`);
  const storeUrl = store ? getCanonicalUrl(`/stores/${store.id}`) : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description:
      product.description ||
      `${product.name} available at ${product.storeName} in ${product.city}. Direct local delivery.`,
    image: product.customImageUrl || `${SITE_CONFIG.siteUrl}/assets/product-placeholder.jpg`,
    sku: product.id,
    category: product.category,
    brand: {
      '@type': 'Brand',
      name: product.storeName,
    },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: product.currency || 'INR',
      price: product.price,
      priceValidUntil: '2026-12-31',
      availability:
        product.isAvailable && product.stock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'LocalBusiness',
        name: product.storeName,
        url: storeUrl,
      },
    },
  };
}

export function generateStoreLocalBusinessSchema(store: LocalStore) {
  const storeUrl = getCanonicalUrl(`/stores/${store.id}`);

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: store.name,
    description: store.specialty,
    url: storeUrl,
    image: store.coverImageUrl || `${SITE_CONFIG.siteUrl}/assets/store-placeholder.jpg`,
    priceRange: '₹₹',
    address: {
      '@type': 'PostalAddress',
      streetAddress: store.address,
      addressLocality: store.neighborhood || store.cityName,
      addressRegion: store.stateRegion || undefined,
      addressCountry: store.country || 'India',
    },
    openingHours: store.operatingHours || 'Mo-Su 09:00-21:00',
    servesCuisine: store.category === 'Restaurants & Food' ? 'Local' : undefined,
  };
}
