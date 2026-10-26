

export type CityHub = string;

export type StoreCategoryName =
  | 'Grocery & Daily Essentials'
  | 'Fruits & Vegetables'
  | 'Fashion & Clothing'
  | 'Electronics & Mobile Accessories'
  | 'Pharmacy & Healthcare Products'
  | 'Bakery, Sweets & Desserts'
  | 'Restaurants & Food'
  | 'Furniture & Home Decor'
  | 'Hardware, Electricals & Plumbing'
  | 'Beauty & Personal Care'
  | 'Footwear & Bags'
  | 'Books, Stationery & Office Supplies'
  | 'Toys, Games & Baby Products'
  | 'Jewellery & Watches'
  | 'Automotive & Two-Wheeler Accessories'
  | 'Pet Supplies'
  | 'Sports & Fitness'
  | 'Home & Kitchen Appliances'
  | 'Gifts, Flowers & Handicrafts'
  | 'Fabrics, Tailoring & Textiles'
  | 'Agriculture & Gardening'
  | 'Household & Cleaning Supplies'
  | 'Handicrafts & Local Products'
  | 'Party & Celebration Supplies'
  | 'Other Local Retail Stores';

export type StoreCategoryId =
  | 'cat-01-grocery-daily-essentials'
  | 'cat-02-fruits-vegetables'
  | 'cat-03-fashion-clothing'
  | 'cat-04-electronics-mobile-accessories'
  | 'cat-05-pharmacy-healthcare-products'
  | 'cat-06-bakery-sweets-desserts'
  | 'cat-07-restaurants-food'
  | 'cat-08-furniture-home-decor'
  | 'cat-09-hardware-electricals-plumbing'
  | 'cat-10-beauty-personal-care'
  | 'cat-11-footwear-bags'
  | 'cat-12-books-stationery-office-supplies'
  | 'cat-13-toys-games-baby-products'
  | 'cat-14-jewellery-watches'
  | 'cat-15-automotive-two-wheeler-accessories'
  | 'cat-16-pet-supplies'
  | 'cat-17-sports-fitness'
  | 'cat-18-home-kitchen-appliances'
  | 'cat-19-gifts-flowers-handicrafts'
  | 'cat-20-fabrics-tailoring-textiles'
  | 'cat-21-agriculture-gardening'
  | 'cat-22-household-cleaning-supplies'
  | 'cat-23-handicrafts-local-products'
  | 'cat-24-party-celebration-supplies'
  | 'cat-25-other-local-retail-stores';

export type ArtworkPreset =
  | 'brass_lamp'
  | 'espresso_machine'
  | 'hinoki_serum'
  | 'field_headphones'
  | 'ceramic_pourover'
  | 'matcha_ceremonial'
  | 'linen_jacket'
  | 'sourdough_kit'
  | 'leather_totebag';

export interface CategoryDefinition {
  id: StoreCategoryId;
  slug: string;
  order: number;
  name: StoreCategoryName;
  iconName: string;
  defaultArtworkPreset: ArtworkPreset;
  isActive: boolean;
}

/**
 * Single authoritative category configuration for URBANDIRECT (1–25).
 * Reused across all seller-facing and customer-facing workflows.
 */
export const AUTHORITATIVE_STORE_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'cat-01-grocery-daily-essentials',
    slug: 'grocery-daily-essentials',
    order: 1,
    name: 'Grocery & Daily Essentials',
    iconName: 'ShoppingBasket',
    defaultArtworkPreset: 'matcha_ceremonial',
    isActive: true,
  },
  {
    id: 'cat-02-fruits-vegetables',
    slug: 'fruits-vegetables',
    order: 2,
    name: 'Fruits & Vegetables',
    iconName: 'Apple',
    defaultArtworkPreset: 'sourdough_kit',
    isActive: true,
  },
  {
    id: 'cat-03-fashion-clothing',
    slug: 'fashion-clothing',
    order: 3,
    name: 'Fashion & Clothing',
    iconName: 'Shirt',
    defaultArtworkPreset: 'linen_jacket',
    isActive: true,
  },
  {
    id: 'cat-04-electronics-mobile-accessories',
    slug: 'electronics-mobile-accessories',
    order: 4,
    name: 'Electronics & Mobile Accessories',
    iconName: 'Headphones',
    defaultArtworkPreset: 'field_headphones',
    isActive: true,
  },
  {
    id: 'cat-05-pharmacy-healthcare-products',
    slug: 'pharmacy-healthcare-products',
    order: 5,
    name: 'Pharmacy & Healthcare Products',
    iconName: 'HeartPulse',
    defaultArtworkPreset: 'hinoki_serum',
    isActive: true,
  },
  {
    id: 'cat-06-bakery-sweets-desserts',
    slug: 'bakery-sweets-desserts',
    order: 6,
    name: 'Bakery, Sweets & Desserts',
    iconName: 'Croissant',
    defaultArtworkPreset: 'sourdough_kit',
    isActive: true,
  },
  {
    id: 'cat-07-restaurants-food',
    slug: 'restaurants-food',
    order: 7,
    name: 'Restaurants & Food',
    iconName: 'UtensilsCrossed',
    defaultArtworkPreset: 'sourdough_kit',
    isActive: true,
  },
  {
    id: 'cat-08-furniture-home-decor',
    slug: 'furniture-home-decor',
    order: 8,
    name: 'Furniture & Home Decor',
    iconName: 'Lamp',
    defaultArtworkPreset: 'brass_lamp',
    isActive: true,
  },
  {
    id: 'cat-09-hardware-electricals-plumbing',
    slug: 'hardware-electricals-plumbing',
    order: 9,
    name: 'Hardware, Electricals & Plumbing',
    iconName: 'Wrench',
    defaultArtworkPreset: 'brass_lamp',
    isActive: true,
  },
  {
    id: 'cat-10-beauty-personal-care',
    slug: 'beauty-personal-care',
    order: 10,
    name: 'Beauty & Personal Care',
    iconName: 'Sparkles',
    defaultArtworkPreset: 'hinoki_serum',
    isActive: true,
  },
  {
    id: 'cat-11-footwear-bags',
    slug: 'footwear-bags',
    order: 11,
    name: 'Footwear & Bags',
    iconName: 'Briefcase',
    defaultArtworkPreset: 'leather_totebag',
    isActive: true,
  },
  {
    id: 'cat-12-books-stationery-office-supplies',
    slug: 'books-stationery-office-supplies',
    order: 12,
    name: 'Books, Stationery & Office Supplies',
    iconName: 'BookOpen',
    defaultArtworkPreset: 'ceramic_pourover',
    isActive: true,
  },
  {
    id: 'cat-13-toys-games-baby-products',
    slug: 'toys-games-baby-products',
    order: 13,
    name: 'Toys, Games & Baby Products',
    iconName: 'Blocks',
    defaultArtworkPreset: 'ceramic_pourover',
    isActive: true,
  },
  {
    id: 'cat-14-jewellery-watches',
    slug: 'jewellery-watches',
    order: 14,
    name: 'Jewellery & Watches',
    iconName: 'Watch',
    defaultArtworkPreset: 'brass_lamp',
    isActive: true,
  },
  {
    id: 'cat-15-automotive-two-wheeler-accessories',
    slug: 'automotive-two-wheeler-accessories',
    order: 15,
    name: 'Automotive & Two-Wheeler Accessories',
    iconName: 'Car',
    defaultArtworkPreset: 'field_headphones',
    isActive: true,
  },
  {
    id: 'cat-16-pet-supplies',
    slug: 'pet-supplies',
    order: 16,
    name: 'Pet Supplies',
    iconName: 'PawPrint',
    defaultArtworkPreset: 'matcha_ceremonial',
    isActive: true,
  },
  {
    id: 'cat-17-sports-fitness',
    slug: 'sports-fitness',
    order: 17,
    name: 'Sports & Fitness',
    iconName: 'Dumbbell',
    defaultArtworkPreset: 'leather_totebag',
    isActive: true,
  },
  {
    id: 'cat-18-home-kitchen-appliances',
    slug: 'home-kitchen-appliances',
    order: 18,
    name: 'Home & Kitchen Appliances',
    iconName: 'Coffee',
    defaultArtworkPreset: 'espresso_machine',
    isActive: true,
  },
  {
    id: 'cat-19-gifts-flowers-handicrafts',
    slug: 'gifts-flowers-handicrafts',
    order: 19,
    name: 'Gifts, Flowers & Handicrafts',
    iconName: 'Gift',
    defaultArtworkPreset: 'ceramic_pourover',
    isActive: true,
  },
  {
    id: 'cat-20-fabrics-tailoring-textiles',
    slug: 'fabrics-tailoring-textiles',
    order: 20,
    name: 'Fabrics, Tailoring & Textiles',
    iconName: 'Scissors',
    defaultArtworkPreset: 'linen_jacket',
    isActive: true,
  },
  {
    id: 'cat-21-agriculture-gardening',
    slug: 'agriculture-gardening',
    order: 21,
    name: 'Agriculture & Gardening',
    iconName: 'Sprout',
    defaultArtworkPreset: 'ceramic_pourover',
    isActive: true,
  },
  {
    id: 'cat-22-household-cleaning-supplies',
    slug: 'household-cleaning-supplies',
    order: 22,
    name: 'Household & Cleaning Supplies',
    iconName: 'SprayCan',
    defaultArtworkPreset: 'hinoki_serum',
    isActive: true,
  },
  {
    id: 'cat-23-handicrafts-local-products',
    slug: 'handicrafts-local-products',
    order: 23,
    name: 'Handicrafts & Local Products',
    iconName: 'Palette',
    defaultArtworkPreset: 'ceramic_pourover',
    isActive: true,
  },
  {
    id: 'cat-24-party-celebration-supplies',
    slug: 'party-celebration-supplies',
    order: 24,
    name: 'Party & Celebration Supplies',
    iconName: 'PartyPopper',
    defaultArtworkPreset: 'brass_lamp',
    isActive: true,
  },
  {
    id: 'cat-25-other-local-retail-stores',
    slug: 'other-local-retail-stores',
    order: 25,
    name: 'Other Local Retail Stores',
    iconName: 'Store',
    defaultArtworkPreset: 'leather_totebag',
    isActive: true,
  },
];

export const STORE_CATEGORIES: StoreCategoryName[] =
  AUTHORITATIVE_STORE_CATEGORIES.map((c) => c.name);

export type ProductCategory = 'All Categories' | StoreCategoryName;

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'All Categories',
  ...STORE_CATEGORIES,
];

export function getCategoryByIdOrName(
  identifier?: string | null
): CategoryDefinition {
  if (!identifier) return AUTHORITATIVE_STORE_CATEGORIES[0];
  const found = AUTHORITATIVE_STORE_CATEGORIES.find(
    (c) =>
      c.id === identifier ||
      c.slug === identifier ||
      c.name.toLowerCase() === identifier.toLowerCase()
  );
  return found || AUTHORITATIVE_STORE_CATEGORIES[24];
}

export type LocalityClassification = 'CITY' | 'TOWN' | 'VILLAGE' | 'LOCALITY';
export type LocationDataSource =
  | 'VERIFIED_DIRECTORY'
  | 'GEOCODED'
  | 'USER_PROVIDED';
export type LocationVerificationStatus =
  | 'VERIFIED'
  | 'USER_PROVIDED_UNVERIFIED'
  | 'INCOMPLETE';



import {
  CityDef as GlobalCityRecord,
  CURATED_CANONICAL_CITIES as GLOBAL_CITY_DIRECTORY,
} from './global-locations-data';

import {
  normalizeCityToken,
  normalizeCityId,
  calculateDistanceKm,
  resolveNearestCityFromCoordinates,
} from './location-service';

export {
  normalizeCityToken,
  normalizeCityId,
  calculateDistanceKm,
  resolveNearestCityFromCoordinates,
};


export type { GlobalCityRecord };
export { GLOBAL_CITY_DIRECTORY };


export interface SellerProfile {
  id: string;
  businessOwnerName: string;
  phoneE164?: string;
  phoneCountryCode?: string;
  phoneVerified?: boolean;
  migrationRequired?: boolean;
  email?: string;
  role: 'SELLER';
  storeIds: string[];
  isDemo?: boolean;
  demoBatchId?: string;
}

export interface UserAccount {
  id: string;
  uid?: string;
  phoneE164: string;
  maskedPhone: string;
  countryCode: string;
  fullName: string;
  roles: ('BUYER' | 'SELLER' | 'ADMIN' | 'PARTNER')[];
  role?: 'super_admin' | 'admin' | 'partner' | 'buyer' | 'seller';
  phoneVerified?: boolean;
  sellerId?: string;
  storeIds: string[];
  createdAt: string;
  isAdmin?: boolean;
  isPartner?: boolean;
  partnerId?: string;
  assignedCityId?: string;
  assignedCityName?: string;
  accountStatus?: 'ACTIVE' | 'SUSPENDED';
  suspensionReason?: string;
  suspendedAt?: string;
}

export type DeliveryScopeType = 'CUSTOM_LOCALITIES' | 'CITY_WIDE' | 'RADIUS_KM';

export interface SellerServiceArea {
  scopeType: DeliveryScopeType;
  coveredLocalities: string[];
  maxRadiusKm: number;
  sellerDeliveryFee: number;
  freeDeliveryAbove: number;
  fulfillmentNote: string;
}

export interface LocalStore {
  id: string;
  sellerId: string;
  ownerUid?: string;
  sellerName: string;
  phone?: string;
  name: string;
  categoryId: StoreCategoryId;
  category: StoreCategoryName;
  description?: string;
  countryCode?: string;
  country: string;
  stateRegion: string;
  district?: string;
  localityType?: 'CITY' | 'TOWN' | 'VILLAGE' | 'LOCALITY';
  cityId: string;
  cityName: string;
  postalCode?: string;
  servedCityIds?: string[];
  city: string; // Display hub string e.g. 'Mumbai · Bandra' or 'Pune · Kothrud'
  neighborhood: string;
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  locationVerified?: boolean;
  locationSource?: 'VERIFIED_DIRECTORY' | 'GEOCODED' | 'USER_PROVIDED';
  verificationStatus?: 'VERIFIED' | 'USER_PROVIDED_UNVERIFIED' | 'INCOMPLETE';
  operatingHours: string;
  avgDispatchMins: number;
  rating: number;
  verifiedSince: string;
  specialty: string;
  upiHandle: string;
  activeSkus: number;
  isActive: boolean;
  isSuspended?: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  currency?: string;
  coverImageUrl?: string;
  logoUrl?: string;
  isDemo?: boolean;
  demoBatchId?: string;
  createdAt?: string;
  serviceArea: SellerServiceArea;
}

export interface Product {
  id: string;
  sellerId: string;
  ownerUid?: string;
  storeId: string;
  storeName: string;
  sku: string;
  name: string;
  categoryId: StoreCategoryId;
  category: StoreCategoryName;
  price: number;
  deliveryCharge?: number;
  currency?: string;
  unit?: string;
  city: string;
  neighborhood: string;
  distanceKm: number;
  deliveryMins: number;
  stock: number;
  stockNote?: string;
  isAvailable: boolean;
  adminUnpublished?: boolean;
  unpublishReason?: string;
  unpublishedAt?: string;
  rating: number;
  reviewsCount: number;
  description: string;
  dimensions: string;
  materials: string;
  variants: string[];
  statusNote: string;
  artworkPreset: ArtworkPreset;
  customImageUrl?: string;
  isDemo?: boolean;
  demoBatchId?: string;
  createdAt?: string;
  orderCount?: number;
  quantitySold?: number;
  lastOrderedAt?: string;
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/**
 * Formats numeric product and order prices using Indian Rupee (INR) number formatting
 * (e.g., ₹120, ₹799, ₹4,999) by default while supporting international currency codes.
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'INR'
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const normalizedCurrency = (currencyCode || 'INR').toUpperCase();
  if (normalizedCurrency === 'INR') {
    return inrFormatter.format(Math.round(safeAmount));
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return inrFormatter.format(Math.round(safeAmount));
  }
}

export interface CustomerShoppingLocation {
  mode: 'UNSET' | 'GLOBAL_ALL' | 'SELECTED_LOCATION';
  country: string;
  countryCode?: string;
  stateRegion: string;
  district?: string;
  localityType?: LocalityClassification;
  cityId?: string;
  city: string;
  locality: string;
  postalCode?: string;
}

export interface DeliveryEligibilityResult {
  isDeliverable: boolean;
  statusLabel: string;
  reasonDetail: string;
}

/**
 * Checks whether a store has complete, structured location data.
 * Never fabricates missing city information.
 */
export function isStoreLocationComplete(store: LocalStore): boolean {
  return Boolean(
    store.locationVerified !== false &&
      store.country &&
      store.country.trim().length > 0 &&
      store.cityName &&
      store.cityName.trim().length > 0 &&
      store.address &&
      store.address.trim().length > 0
  );
}

/**
 * Mandatory Business Rule: Strict City-Based Store Eligibility.
 * Returns true ONLY if the store is active, has complete structured location data,
 * and belongs to (or is explicitly configured to serve) the buyer's selected city.
 */
export function isStoreEligibleForSelectedCity(
  store: LocalStore,
  customerLocation: CustomerShoppingLocation
): boolean {
  if (!store.isActive || store.isSuspended) return false;
  if (!isStoreLocationComplete(store)) return false;

  if (
    customerLocation.mode !== 'SELECTED_LOCATION' ||
    !customerLocation.city.trim()
  ) {
    return false;
  }

  const buyerCityToken = normalizeCityToken(customerLocation.city);
  const storeCityToken = normalizeCityToken(store.cityName);

  const buyerCityId =
    customerLocation.cityId ||
    normalizeCityId(
      customerLocation.country,
      customerLocation.stateRegion,
      customerLocation.city
    );

  // Check exact normalized city ID match or servedCityIds cross-city configuration
  if (store.cityId === buyerCityId) {
    return true;
  }
  if (store.servedCityIds && store.servedCityIds.includes(buyerCityId)) {
    return true;
  }

  // Check normalized city name + country match
  if (buyerCityToken === storeCityToken) {
    if (!customerLocation.country.trim()) return true;
    const buyerCountryToken = normalizeCityToken(customerLocation.country);
    const storeCountryToken = normalizeCityToken(store.country);
    const storeCodeToken = normalizeCityToken(store.countryCode || '');
    return (
      buyerCountryToken === storeCountryToken ||
      buyerCountryToken === storeCodeToken
    );
  }

  // Check if servedCityIds contains any entry ending with `-<buyerCityToken>`
  if (
    store.servedCityIds &&
    store.servedCityIds.some((id) => id.endsWith(`-${buyerCityToken}`))
  ) {
    return true;
  }

  return false;
}

/**
 * Evaluates whether a specific independent store serves the customer's selected location
 * and specific neighborhood/delivery address within that city.
 * Never fabricates availability: checks exact city and configured service area localities.
 */
export function evaluateStoreDeliveryEligibility(
  store: LocalStore,
  customerLocation: CustomerShoppingLocation
): DeliveryEligibilityResult {
  if (!store.isActive) {
    return {
      isDeliverable: false,
      statusLabel: 'Store Currently Closed',
      reasonDetail: 'This store has paused new orders.',
    };
  }

  if (!isStoreLocationComplete(store)) {
    return {
      isDeliverable: false,
      statusLabel: 'Store Location Incomplete',
      reasonDetail:
        'This store must complete its city and address details before accepting orders.',
    };
  }

  if (
    customerLocation.mode === 'UNSET' ||
    customerLocation.mode === 'GLOBAL_ALL' ||
    !customerLocation.city.trim()
  ) {
    const localitiesText =
      store.serviceArea.scopeType === 'CITY_WIDE'
        ? `All of ${store.cityName}`
        : store.serviceArea.coveredLocalities.join(', ');
    return {
      isDeliverable: false,
      statusLabel: `Select your city to check delivery`,
      reasonDetail: `Serves ${store.cityName} (${localitiesText})`,
    };
  }

  const cityEligible = isStoreEligibleForSelectedCity(store, customerLocation);

  if (!cityEligible) {
    return {
      isDeliverable: false,
      statusLabel: `Does not serve ${customerLocation.city}`,
      reasonDetail: `This store only delivers in ${store.cityName}, ${store.country} (${store.serviceArea.coveredLocalities.join(', ')})`,
    };
  }

  // City matches; now check neighborhood/locality coverage within the selected city
  const normCustomerLocality = customerLocation.locality.trim().toLowerCase();
  if (store.serviceArea.scopeType === 'CITY_WIDE') {
    return {
      isDeliverable: true,
      statusLabel: `Delivers across ${store.cityName}`,
      reasonDetail: `Store delivers city-wide in ${store.cityName} (~${store.avgDispatchMins} mins)`,
    };
  }

  if (!normCustomerLocality) {
    return {
      isDeliverable: true,
      statusLabel: `Serves ${store.cityName} (${store.serviceArea.coveredLocalities.slice(0, 3).join(', ')})`,
      reasonDetail: `Delivers to: ${store.serviceArea.coveredLocalities.join(', ')}`,
    };
  }

  const localityMatched = store.serviceArea.coveredLocalities.some((loc) => {
    const normLoc = loc.trim().toLowerCase();
    return (
      normLoc.includes(normCustomerLocality) ||
      normCustomerLocality.includes(normLoc)
    );
  });

  if (localityMatched) {
    return {
      isDeliverable: true,
      statusLabel: `Delivers to ${customerLocation.locality}, ${store.cityName}`,
      reasonDetail: `Within store's ${store.serviceArea.maxRadiusKm} km delivery area (~${store.avgDispatchMins} mins)`,
    };
  }

  return {
    isDeliverable: false,
    statusLabel: `Limited delivery areas in ${store.cityName}`,
    reasonDetail: `In ${store.cityName}, this store delivers to: ${store.serviceArea.coveredLocalities.join(', ')}`,
  };
}

export interface CityScopedCatalogResult {
  requiresCitySelection: boolean;
  eligibleStoresInCity: LocalStore[];
  filteredStores: LocalStore[];
  filteredProducts: Product[];
  categoryStoreCounts: Record<StoreCategoryId, number>;
  categoryProductCounts: Record<StoreCategoryId, number>;
  unverifiedStores: LocalStore[];
}

/**
 * Data-access / backend query engine that enforces strict city-based discovery.
 * Never returns stores or products from unrelated cities.
 */
export function queryCityScopedCatalog(params: {
  stores: LocalStore[];
  products: Product[];
  customerLocation: CustomerShoppingLocation;
  selectedCategory?: ProductCategory;
  searchQuery?: string;
  onlyDeliverableToLocality?: boolean;
}): CityScopedCatalogResult {
  const {
    stores,
    products,
    customerLocation,
    selectedCategory = 'All Categories',
    searchQuery = '',
    onlyDeliverableToLocality = false,
  } = params;

  const emptyCategoryCounts = AUTHORITATIVE_STORE_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat.id] = 0;
      return acc;
    },
    {} as Record<StoreCategoryId, number>
  );

  const unverifiedStores = stores.filter((s) => !isStoreLocationComplete(s));

  if (
    customerLocation.mode !== 'SELECTED_LOCATION' ||
    !customerLocation.city.trim()
  ) {
    return {
      requiresCitySelection: true,
      eligibleStoresInCity: [],
      filteredStores: [],
      filteredProducts: [],
      categoryStoreCounts: {...emptyCategoryCounts},
      categoryProductCounts: {...emptyCategoryCounts},
      unverifiedStores,
    };
  }

  // 1. Identify all active, verified stores eligible to serve the buyer's selected city
  const eligibleStoresInCity = stores.filter((store) => {
    if (!isStoreEligibleForSelectedCity(store, customerLocation)) {
      return false;
    }
    if (onlyDeliverableToLocality && customerLocation.locality.trim()) {
      return evaluateStoreDeliveryEligibility(store, customerLocation)
        .isDeliverable;
    }
    return true;
  });

  const eligibleStoreMap = new Map<string, LocalStore>(
    eligibleStoresInCity.map((s) => [s.id, s])
  );

  // 2. Identify all published products belonging strictly to eligible stores in the selected city
  const eligibleProductsInCity = products.filter(
    (product) =>
      eligibleStoreMap.has(product.storeId) && !product.adminUnpublished
  );

  // 3. Calculate city-specific category counts from eligible local stores & products
  const categoryStoreCounts = {...emptyCategoryCounts};
  const categoryProductCounts = {...emptyCategoryCounts};

  for (const cat of AUTHORITATIVE_STORE_CATEGORIES) {
    const matchingStores = eligibleStoresInCity.filter(
      (store) =>
        store.categoryId === cat.id ||
        store.category === cat.name ||
        eligibleProductsInCity.some(
          (p) =>
            p.storeId === store.id &&
            (p.categoryId === cat.id || p.category === cat.name)
        )
    );
    categoryStoreCounts[cat.id] = matchingStores.length;

    const matchingProducts = eligibleProductsInCity.filter(
      (p) => p.categoryId === cat.id || p.category === cat.name
    );
    categoryProductCounts[cat.id] = matchingProducts.length;
  }

  const query = searchQuery.trim().toLowerCase();

  // 4. Filter stores within the selected city by category and search query
  const filteredStores = eligibleStoresInCity.filter((store) => {
    if (
      selectedCategory !== 'All Categories' &&
      store.category !== selectedCategory
    ) {
      const hasProductInCategory = eligibleProductsInCity.some(
        (p) => p.storeId === store.id && p.category === selectedCategory
      );
      if (!hasProductInCategory) return false;
    }

    if (query) {
      const storeProductsText = eligibleProductsInCity
        .filter((p) => p.storeId === store.id)
        .map((p) => `${p.name} ${p.category} ${p.description}`)
        .join(' ');
      const hay =
        `${store.name} ${store.category} ${store.cityName} ${store.neighborhood} ${store.specialty} ${storeProductsText}`.toLowerCase();
      return hay.includes(query);
    }

    return true;
  });

  // 5. Filter products strictly within eligible stores in the selected city
  const filteredProducts = eligibleProductsInCity.filter((product) => {
    const parentStore = eligibleStoreMap.get(product.storeId);
    if (!parentStore) return false;

    if (
      selectedCategory !== 'All Categories' &&
      product.category !== selectedCategory
    ) {
      return false;
    }

    if (query) {
      const hay =
        `${product.name} ${product.storeName} ${product.neighborhood} ${product.category} ${product.description} ${parentStore.specialty}`.toLowerCase();
      return hay.includes(query);
    }

    return true;
  });

  return {
    requiresCitySelection: false,
    eligibleStoresInCity,
    filteredStores,
    filteredProducts,
    categoryStoreCounts,
    categoryProductCounts,
    unverifiedStores,
  };
}

export interface CartItem {
  product: Product;
  variant: string;
  quantity: number;
  platformFee: number;
}

export type PaymentMethod =
  | 'UPI_ON_DELIVERY'
  | 'CASH_ON_DELIVERY'
  | 'TAP_ON_DELIVERY';

export type OrderStatus =
  | 'NEW'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REJECTED';

export interface OrderStatusHistoryEvent {
  status: OrderStatus;
  timestamp: string;
  note?: string;
  actor: 'BUYER' | 'SELLER' | 'SYSTEM';
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'DISPUTED';

export type DeliveryPinLifecycleStatus =
  | 'ACTIVE'
  | 'VERIFIED'
  | 'EXPIRED'
  | 'LOCKED'
  | 'INVALIDATED';

export type PinNotificationChannelStatus =
  | 'DELIVERED_IN_APP_AND_FCM'
  | 'DELIVERED_IN_APP_ONLY'
  | 'SMS_SENT'
  | 'SMS_PROVIDER_NOT_CONFIGURED'
  | 'FAILED';

export interface DeliveryPinPublicInfo {
  status: DeliveryPinLifecycleStatus;
  pinVersion: number;
  createdAt: string;
  expiresAt: string;
  verifiedAt?: string;
  verifiedByActor?: string;
  verifiedByRole?: 'SELLER' | 'DELIVERY_AGENT' | 'ADMIN';
  attemptsUsed: number;
  maxAttempts: number;
  remainingAttempts?: number;
  lastResentAt?: string;
  resendCount: number;
  notificationStatus: PinNotificationChannelStatus;
  notificationDetail?: string;
  unifiedNotificationDispatched?: boolean;
}

export interface BuyerUnifiedOrderNotification {
  title: string;
  body: string;
  smsText: string;
  safetyInstructions: string;
  sellerPhone: string;
  estimatedDeliveryMins: number;
  pushStatus: string;
  smsStatus: PinNotificationChannelStatus;
  dispatchedAt: string;
}

export interface SellerUnifiedOrderNotification {
  title: string;
  body: string;
  smsText: string;
  sellerPhone: string;
  buyerFullName: string;
  buyerPhone: string;
  buyerFullAddress: string;
  deliveryNotes?: string;
  pushStatus: string;
  smsStatus: PinNotificationChannelStatus;
  dispatchedAt: string;
}

export interface OrderRecord {
  id: string;
  createdAt: string;
  createdAtIso?: string;
  storeId: string;
  storeName: string;
  sellerId: string;
  sellerPhone?: string;
  buyerUid?: string;
  sellerUid?: string;
  idempotencyKey?: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  totalPlatformFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  upiId?: string;
  paymentStatus?: PaymentStatus;
  paymentCollectedAt?: string;
  paymentCollectedBy?: string;
  paymentCollectionMethod?: PaymentMethod;
  paymentReferenceNote?: string;
  customer: {
    fullName: string;
    phone: string;
    country: string;
    stateRegion: string;
    address: string;
    city: string;
    locality: string;
    postalCode: string;
    notes: string;
  };
  currentStepIndex: number;
  orderStatus:
    | 'NEW'
    | 'CONFIRMED'
    | 'PREPARING'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'REJECTED';
  deliveredAt?: string;
  deliveredByActor?: string;
  deliveryPinVerified?: boolean;
  deliveryPinInfo?: DeliveryPinPublicInfo;
  sellerUnifiedNotification?: SellerUnifiedOrderNotification;
  /**
   * Transient buyer-only fields attached ONLY to immediate buyer order creation
   * or authenticated buyer-only PIN responses. Always stripped from seller/public queries.
   */
  buyerDeliveryPin?: string;
  buyerOrderAccessToken?: string;
  buyerUnifiedNotification?: BuyerUnifiedOrderNotification;
  statusHistory?: OrderStatusHistoryEvent[];
  cancellationReason?: string;
  rejectionReason?: string;
  isDemo?: boolean;
  isTest?: boolean;
  estimatedMins: number;
  termsAcknowledged?: boolean;
  termsVersion?: string;
  termsAcknowledgedAt?: string;
  termsDocumentId?: string;
  checkoutAcknowledgementVersion?: string;
  adminNotes?: Array<{
    id: string;
    note: string;
    createdAt: string;
    adminUid: string;
  }>;
}

export const ORDER_STEPS = [
  'Order Received',
  'Preparing',
  'Out for Delivery',
  'Delivered',
] as const;

export const CITY_HUBS: string[] = [
  'Pune, Maharashtra',
  'Mumbai, Maharashtra',
  'Nanded, Maharashtra',
  'Bengaluru, Karnataka',
  'London, Greater London',
  'Tokyo, Tokyo Metropolis',
  'New York, New York',
];


// Initial static data moved to dedicated library to reduce file size and parsing overhead
export {
  INITIAL_SELLERS,
  INITIAL_STORES,
  INITIAL_PRODUCTS,
  INITIAL_USER_ACCOUNTS,
} from './initial-data';
