import { AUTHORITATIVE_STORE_CATEGORIES, CategoryDefinition } from './catalog-data';

/**
 * Citykart Canonical SEO Configuration
 * Centralized metadata, canonical URL resolution, and structured data utilities.
 */
export const SITE_CONFIG = {
  name: 'Citykart',
  tagline: 'Discover Local. Shop Direct. Delivered in Your City.',
  defaultTitle: 'Citykart | Shop Local Stores & Products Near You',
  titleTemplate: '%s | Citykart',
  defaultDescription:
    'Discover local stores and products on Citykart. Explore nearby retailers, compare products, and shop directly from verified businesses serving your city.',
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://citykart.shop',
  defaultLocale: 'en_IN',
  supportEmail: 'support@citykart.shop',
  foundingYear: 2024,
  currency: 'INR',
  social: {
    twitterHandle: '@CitykartShop',
  },
};

export function getCanonicalUrl(path: string = ''): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_CONFIG.siteUrl.replace(/\/$/, '')}${cleanPath}`;
}

export interface CategorySeoMeta {
  title: string;
  metaDescription: string;
  keywords: string[];
}

export const CATEGORY_SEO_DESCRIPTIONS: Record<string, CategorySeoMeta> = {
  'grocery-daily-essentials': {
    title: 'Grocery & Daily Essentials from Local Stores | Citykart',
    metaDescription:
      'Order fresh staples, pantry goods, dairy, snacks, and daily household essentials from verified local grocery stores with fast neighborhood delivery.',
    keywords: ['grocery stores near me', 'local supermarket delivery', 'daily essentials online', 'pantry staples'],
  },
  'fruits-vegetables': {
    title: 'Fresh Fruits & Vegetables from Local Mandi & Vendors | Citykart',
    metaDescription:
      'Buy farm-fresh seasonal vegetables, organic greens, and fresh fruits from local markets and greengrocers delivered directly to your doorstep.',
    keywords: ['fresh fruits vegetables', 'local mandi online', 'organic produce delivery', 'vegetable vendors'],
  },
  'fashion-clothing': {
    title: 'Fashion & Clothing from Local Boutiques & Apparel Stores | Citykart',
    metaDescription:
      'Explore apparel, ethnic wear, casual fashion, and festive clothing from local clothing boutiques and neighborhood tailors in your city.',
    keywords: ['local fashion boutiques', 'ethnic wear near me', 'menswear womenswear local', 'clothing stores'],
  },
  'electronics-mobile-accessories': {
    title: 'Electronics & Mobile Accessories from Local Retailers | Citykart',
    metaDescription:
      'Find smartphone chargers, audio gear, cables, smart accessories, and electronics from authorized local tech stores with warranty & genuine bills.',
    keywords: ['mobile accessories shop near me', 'electronics stores', 'chargers earphones local', 'gadgets delivery'],
  },
  'pharmacy-healthcare-products': {
    title: 'Pharmacy & Healthcare Products from Licensed Chemists | Citykart',
    metaDescription:
      'Order OTC medicines, first-aid essentials, wellness products, and healthcare supplies from licensed local pharmacies in your area.',
    keywords: ['pharmacy delivery near me', 'local medical store', 'first aid wellness products', 'chemists online'],
  },
  'bakery-sweets-desserts': {
    title: 'Bakery, Sweets & Desserts from Local Confectioners | Citykart',
    metaDescription:
      'Fresh artisanal breads, cakes, traditional sweets, pastries, and festive mithai from beloved local bakeries and sweetshops.',
    keywords: ['local bakery delivery', 'fresh cakes pastries', 'mithai sweets shop', 'artisan breads'],
  },
  'restaurants-food': {
    title: 'Restaurants & Local Food from Neighborhood Kitchens | Citykart',
    metaDescription:
      'Discover authentic local food, meal platters, snacks, and neighborhood cuisine prepared fresh by independent local restaurants.',
    keywords: ['local restaurants food', 'order dinner lunch local', 'authentic city cuisine', 'neighborhood eateries'],
  },
  'furniture-home-decor': {
    title: 'Furniture & Home Decor from Local Craftsmen & Showrooms | Citykart',
    metaDescription:
      'Shop handcrafted wooden furniture, home decor accents, lighting, and furnishings from verified local interior showrooms and artisans.',
    keywords: ['furniture store near me', 'home decor local', 'woodcraft furnishings', 'lighting accents'],
  },
  'hardware-electricals-plumbing': {
    title: 'Hardware, Electricals & Plumbing Supplies | Citykart',
    metaDescription:
      'Procure tools, switches, electrical fittings, pipes, sanitaryware, and repair supplies from verified local hardware merchants.',
    keywords: ['hardware store near me', 'electrical supplies local', 'plumbing fittings tools', 'sanitaryware'],
  },
  'beauty-personal-care': {
    title: 'Beauty & Personal Care from Local Cosmetic Stores | Citykart',
    metaDescription:
      'Skin care, hair care, natural cosmetics, fragrances, and grooming products from trusted local beauty retailers in your city.',
    keywords: ['beauty products local', 'skincare cosmetics near me', 'personal care supplies', 'grooming stores'],
  },
  'footwear-bags': {
    title: 'Footwear & Bags from Local Shoe Stores & Leathercrafts | Citykart',
    metaDescription:
      'Find formal shoes, casual sneakers, sandals, luggage, and backpacks from local footwear retailers and leather goods specialists.',
    keywords: ['shoe store near me', 'footwear shops local', 'backpacks luggage handbags', 'sandals sneakers'],
  },
  'books-stationery-office-supplies': {
    title: 'Books, Stationery & Office Supplies from Local Bookshops | Citykart',
    metaDescription:
      'School notebooks, educational books, art materials, and office stationery from neighborhood bookstores and stationers.',
    keywords: ['stationery shop near me', 'local bookstore', 'office supplies school books', 'art materials'],
  },
  'toys-games-baby-products': {
    title: 'Toys, Games & Baby Products from Local Toy Stores | Citykart',
    metaDescription:
      'Safe baby care essentials, educational board games, toys, and nursery supplies from authorized local retailers.',
    keywords: ['toy store near me', 'baby care products local', 'board games kids toys', 'nursery supplies'],
  },
  'jewellery-watches': {
    title: 'Jewellery & Watches from Certified Local Jewellers | Citykart',
    metaDescription:
      'Fine jewellery, silver ornaments, fashion accessories, and wristwatches from reputable local jewellers and horology stores.',
    keywords: ['local jewellers near me', 'silver ornaments jewellery', 'wristwatches store', 'fashion accessories'],
  },
  'automotive-two-wheeler-accessories': {
    title: 'Automotive & Two-Wheeler Accessories from Local Auto Spares | Citykart',
    metaDescription:
      'Helmets, bike accessories, lubricants, car care items, and spare parts from verified local automotive shops.',
    keywords: ['auto accessories near me', 'bike helmets spares local', 'car care accessories', 'two wheeler parts'],
  },
  'pet-supplies': {
    title: 'Pet Supplies, Food & Accessories from Local Pet Stores | Citykart',
    metaDescription:
      'Nutritious pet food, treats, grooming products, toys, and pet accessories from caring local pet shops in your community.',
    keywords: ['pet shop near me', 'pet food delivery local', 'dog cat supplies accessories', 'pet grooming products'],
  },
  'sports-fitness': {
    title: 'Sports & Fitness Equipment from Local Sporting Goods | Citykart',
    metaDescription:
      'Cricket gear, workout accessories, activewear, gym equipment, and sports goods from experienced local sports shops.',
    keywords: ['sports shop near me', 'cricket equipment local', 'fitness workout gear', 'sporting goods store'],
  },
  'home-kitchen-appliances': {
    title: 'Home & Kitchen Appliances from Authorized Local Dealers | Citykart',
    metaDescription:
      'Blenders, induction stoves, cookware, water purifiers, and home appliances with manufacturer warranty from local dealers.',
    keywords: ['kitchen appliances near me', 'home appliances local', 'cookware cookware dealers', 'blenders purifiers'],
  },
  'gifts-flowers-handicrafts': {
    title: 'Gifts, Flowers & Handicrafts from Local Florists & Artisans | Citykart',
    metaDescription:
      'Fresh flower bouquets, celebratory gifts, artisanal souvenirs, and custom gift hampers crafted by local florists and artisans.',
    keywords: ['florist near me', 'fresh flowers delivery local', 'custom gifts handicrafts', 'celebration bouquets'],
  },
  'fabrics-tailoring-textiles': {
    title: 'Fabrics, Tailoring & Textiles from Traditional Cloth Merchants | Citykart',
    metaDescription:
      'Handloom cottons, silk fabrics, dress materials, and custom tailoring services from established local textile houses.',
    keywords: ['fabric store near me', 'tailoring cloth merchants local', 'handloom textiles dress materials', 'silks cottons'],
  },
  'agriculture-gardening': {
    title: 'Agriculture & Gardening Supplies from Local Krishi Kendras | Citykart',
    metaDescription:
      'Quality seeds, organic fertilizers, gardening tools, potting soil, and plant care products from verified agricultural suppliers.',
    keywords: ['gardening supplies near me', 'krishi kendra local', 'plant seeds fertilizers', 'farming tools'],
  },
  'household-cleaning-supplies': {
    title: 'Household & Cleaning Supplies from Local Distributors | Citykart',
    metaDescription:
      'Eco-friendly cleaning agents, sanitizers, floor cleaners, detergents, and household maintenance goods from neighborhood suppliers.',
    keywords: ['cleaning supplies near me', 'detergents sanitizers local', 'household essentials', 'floor cleaners'],
  },
  'handicrafts-local-products': {
    title: 'Handicrafts & Local Products from Regional Artisans | Citykart',
    metaDescription:
      'Authentic regional arts, clay pottery, brassware, traditional textiles, and locally produced heritage specialties.',
    keywords: ['local handicrafts near me', 'regional artisans products', 'clay pottery brassware', 'traditional souvenirs'],
  },
  'party-celebration-supplies': {
    title: 'Party & Celebration Supplies from Local Party Stores | Citykart',
    metaDescription:
      'Balloons, birthday decorations, party tableware, candles, and celebration accessories from neighborhood event suppliers.',
    keywords: ['party supplies near me', 'birthday decorations local', 'balloons tableware celebration', 'event decorations'],
  },
  'other-local-retail-stores': {
    title: 'Other Local Retail Stores & Specialty Shops | Citykart',
    metaDescription:
      'Discover unique specialty shops, niche merchants, and independent neighborhood retailers on the Citykart intra-city platform.',
    keywords: ['local retail shops', 'specialty merchants near me', 'independent neighborhood stores', 'shop local'],
  },
};

/**
 * Returns canonical category SEO metadata by category slug.
 */
export function getCategorySeo(slug: string): CategorySeoMeta {
  if (CATEGORY_SEO_DESCRIPTIONS[slug]) {
    return CATEGORY_SEO_DESCRIPTIONS[slug];
  }

  const found = AUTHORITATIVE_STORE_CATEGORIES.find((c) => c.slug === slug);
  if (found) {
    return {
      title: `${found.name} | Citykart`,
      metaDescription: `Shop ${found.name.toLowerCase()} from local stores in your area. Fast neighborhood delivery and direct local commerce on Citykart.`,
      keywords: [found.name.toLowerCase(), 'shop local', 'local stores near me'],
    };
  }

  return {
    title: 'Local Shopping Categories | Citykart',
    metaDescription: SITE_CONFIG.defaultDescription,
    keywords: ['local shopping', 'categories', 'city retail'],
  };
}
