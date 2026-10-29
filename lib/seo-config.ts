export const SITE_CONFIG = {
  name: 'Citykart',
  defaultTitle: 'Citykart | Global Intra-City Local Commerce Platform',
  titleTemplate: '%s | Citykart Intra-City Commerce',
  defaultDescription:
    'Hyperlocal intra-city commerce connecting verified neighborhood stores across major cities with real-time inventory and Cash/UPI on delivery.',
  siteUrl: 'https://citykart.shop',
  supportEmail: 'support@citykart.shop',
  defaultLocale: 'en_IN',
  social: {
    twitterHandle: '@CitykartShop',
  },
};

export function getCanonicalUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_CONFIG.siteUrl}${cleanPath}`;
}

export function getCategorySeo(categoryName: string) {
  const description = `Shop fresh ${categoryName} directly from verified neighborhood merchants in your city. Cash or UPI on delivery.`;
  return {
    title: `${categoryName} | Local Merchants on Citykart`,
    description,
    metaDescription: description,
    keywords: [
      categoryName,
      `${categoryName} near me`,
      `local ${categoryName} delivery`,
      'Citykart',
      'intra-city commerce',
    ],
    canonicalUrl: getCanonicalUrl(`/categories/${encodeURIComponent(categoryName.toLowerCase())}`),
  };
}

