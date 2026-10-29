import { SITE_CONFIG, getCanonicalUrl } from './seo-config';

export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.siteUrl,
    description: SITE_CONFIG.defaultDescription,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_CONFIG.siteUrl}/?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.siteUrl,
    logo: `${SITE_CONFIG.siteUrl}/images/logo.png`,
    sameAs: ['https://twitter.com/CitykartShop'],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+918329306616',
      contactType: 'customer service',
      areaServed: 'IN',
      availableLanguage: ['en', 'hi', 'mr'],
    },
  };
}

export function generateBreadcrumbSchema(items: { name: string; item?: string; url?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: it.name,
      item: getCanonicalUrl(it.item || it.url || '/'),
    })),
  };
}

export function generateCategoryCollectionSchema(
  categoryName: string,
  description?: string,
  _items?: unknown[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: categoryName,
    description: description || `Browse ${categoryName} from verified local merchants.`,
    url: getCanonicalUrl(`/categories/${encodeURIComponent(categoryName.toLowerCase())}`),
  };
}

export function generateProductSchema(
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    currency?: string;
    storeName?: string;
  },
  _store?: { name?: string } | null
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: product.currency || 'INR',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: _store?.name || product.storeName || SITE_CONFIG.name,
      },
    },
  };
}

export function generateStoreLocalBusinessSchema(store: {
  id: string;
  name: string;
  address: string;
  city: string;
  phone?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: store.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: store.address,
      addressLocality: store.city,
      addressCountry: 'IN',
    },
    telephone: store.phone || '+918329306616',
    priceRange: '₹₹',
  };
}
