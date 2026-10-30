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

export function generateSellerGuideHowToSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Open and Grow Your Store on Citykart',
    description:
      'Step-by-step guide for local retailers and shopkeepers to list their store on Citykart, set delivery radiuses, and receive 0% commission direct orders.',
    url: getCanonicalUrl('/seller-guide'),
    totalTime: 'PT3M',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Instant Mobile Sign-Up',
        text: 'Register using your mobile number and verified OTP with zero complicated paperwork.',
        url: getCanonicalUrl('/seller'),
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Upload Your Products',
        text: 'Select your category from the 25 approved retail categories, set prices, units, and inventory levels with autosave.',
        url: getCanonicalUrl('/seller-guide'),
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Set Delivery Area',
        text: 'Configure your operating hours, delivery radius (5–15 km), and covered neighborhoods in your city.',
        url: getCanonicalUrl('/seller-guide'),
      },
    ],
    publisher: {
      '@type': 'Organization',
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_CONFIG.siteUrl}/citykart-logo.png`,
      },
    },
  };
}

export function generateTermsWebPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Terms and Conditions & Marketplace Policies | Citykart',
    description:
      'Review the official Terms and Conditions governing customer orders, independent seller responsibilities, local delivery, and COD/UPI payments on Citykart.',
    url: getCanonicalUrl('/terms'),
    inLanguage: 'en-IN',
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_CONFIG.siteUrl}/citykart-logo.png`,
      },
    },
  };
}

