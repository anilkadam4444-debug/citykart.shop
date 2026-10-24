import {
  NANDED_DEMO_PRODUCTS,
  NANDED_DEMO_SELLERS,
  NANDED_DEMO_STORES,
} from './nanded-demo-data';

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

export interface GlobalCityRecord {
  cityId: string;
  cityName: string;
  district?: string;
  stateRegion: string;
  country: string;
  countryCode: string;
  postalCode?: string;
  postalCodes?: string[];
  localityType?: LocalityClassification;
  locationSource?: LocationDataSource;
  defaultLocality: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export function normalizeCityToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeCityId(
  country: string,
  stateRegion: string,
  cityName: string,
  district?: string
): string {
  const c = normalizeCityToken(country || 'global');
  const s = normalizeCityToken(stateRegion || 'region');
  const city = normalizeCityToken(cityName || 'city');
  void district;
  return `${c}-${s}-${city}`;
}

export const GLOBAL_CITY_DIRECTORY: GlobalCityRecord[] = [
  {
    cityId: 'india-maharashtra-pune',
    cityName: 'Pune',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    defaultLocality: 'Kothrud',
    coordinates: {lat: 18.5204, lng: 73.8567},
  },
  {
    cityId: 'india-maharashtra-mumbai',
    cityName: 'Mumbai',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    defaultLocality: 'Bandra West',
    coordinates: {lat: 19.076, lng: 72.8777},
  },
  {
    cityId: 'india-maharashtra-nanded',
    cityName: 'Nanded',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    defaultLocality: 'Vazirabad',
    coordinates: {lat: 19.1383, lng: 77.321},
  },
  {
    cityId: 'india-karnataka-bengaluru',
    cityName: 'Bengaluru',
    stateRegion: 'Karnataka',
    country: 'India',
    countryCode: 'IN',
    defaultLocality: 'Indiranagar',
    coordinates: {lat: 12.9716, lng: 77.5946},
  },
  {
    cityId: 'united-kingdom-greater-london-london',
    cityName: 'London',
    stateRegion: 'Greater London',
    country: 'United Kingdom',
    countryCode: 'GB',
    defaultLocality: 'Shoreditch',
    coordinates: {lat: 51.5072, lng: -0.1276},
  },
  {
    cityId: 'japan-tokyo-metropolis-tokyo',
    cityName: 'Tokyo',
    stateRegion: 'Tokyo Metropolis',
    country: 'Japan',
    countryCode: 'JP',
    defaultLocality: 'Shibuya',
    coordinates: {lat: 35.6762, lng: 139.6503},
  },
  {
    cityId: 'united-states-new-york-new-york',
    cityName: 'New York',
    stateRegion: 'New York',
    country: 'United States',
    countryCode: 'US',
    defaultLocality: 'SoHo',
    coordinates: {lat: 40.7128, lng: -74.006},
  },
  {
    cityId: 'india-delhi-new-delhi',
    cityName: 'New Delhi',
    stateRegion: 'Delhi',
    country: 'India',
    countryCode: 'IN',
    defaultLocality: 'Connaught Place',
    coordinates: {lat: 28.6139, lng: 77.209},
  },
  {
    cityId: 'india-telangana-hyderabad',
    cityName: 'Hyderabad',
    stateRegion: 'Telangana',
    country: 'India',
    countryCode: 'IN',
    defaultLocality: 'Banjara Hills',
    coordinates: {lat: 17.385, lng: 78.4867},
  },
  {
    cityId: 'canada-ontario-toronto',
    cityName: 'Toronto',
    stateRegion: 'Ontario',
    country: 'Canada',
    countryCode: 'CA',
    defaultLocality: 'Queen West',
    coordinates: {lat: 43.6532, lng: -79.3832},
  },
  {
    cityId: 'australia-new-south-wales-sydney',
    cityName: 'Sydney',
    stateRegion: 'New South Wales',
    country: 'Australia',
    countryCode: 'AU',
    defaultLocality: 'Surry Hills',
    coordinates: {lat: -33.8688, lng: 151.2093},
  },
  {
    cityId: 'singapore-central-region-singapore',
    cityName: 'Singapore',
    stateRegion: 'Central Region',
    country: 'Singapore',
    countryCode: 'SG',
    defaultLocality: 'Tiong Bahru',
    coordinates: {lat: 1.3521, lng: 103.8198},
  },
  {
    cityId: 'united-arab-emirates-dubai-dubai',
    cityName: 'Dubai',
    stateRegion: 'Dubai',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    defaultLocality: 'Downtown Dubai',
    coordinates: {lat: 25.2048, lng: 55.2708},
  },
  {
    cityId: 'france-ile-de-france-paris',
    cityName: 'Paris',
    stateRegion: 'Île-de-France',
    country: 'France',
    countryCode: 'FR',
    defaultLocality: 'Le Marais',
    coordinates: {lat: 48.8566, lng: 2.3522},
  },
  {
    cityId: 'india-maharashtra-baramati',
    cityName: 'Baramati',
    district: 'Pune District',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    postalCode: '413102',
    localityType: 'TOWN',
    defaultLocality: 'Bhigwan Road',
    coordinates: {lat: 18.1518, lng: 74.5777},
  },
  {
    cityId: 'india-maharashtra-loha',
    cityName: 'Loha',
    district: 'Nanded District',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    postalCode: '431708',
    localityType: 'TOWN',
    defaultLocality: 'Main Market Loha',
    coordinates: {lat: 18.9675, lng: 77.1052},
  },
  {
    cityId: 'united-kingdom-north-yorkshire-whitby',
    cityName: 'Whitby',
    district: 'North Yorkshire',
    stateRegion: 'England',
    country: 'United Kingdom',
    countryCode: 'GB',
    postalCode: 'YO21',
    localityType: 'TOWN',
    defaultLocality: 'Harbour Side',
    coordinates: {lat: 54.4858, lng: -0.6206},
  },
  {
    cityId: 'japan-nagano-hakuba',
    cityName: 'Hakuba',
    district: 'Kitaazumi District',
    stateRegion: 'Nagano',
    country: 'Japan',
    countryCode: 'JP',
    postalCode: '399-9301',
    localityType: 'VILLAGE',
    defaultLocality: 'Happo',
    coordinates: {lat: 36.6982, lng: 137.8619},
  },
  {
    cityId: 'australia-new-south-wales-byron-bay',
    cityName: 'Byron Bay',
    district: 'Byron Shire',
    stateRegion: 'New South Wales',
    country: 'Australia',
    countryCode: 'AU',
    postalCode: '2481',
    localityType: 'TOWN',
    defaultLocality: 'Jonson Street',
    coordinates: {lat: -28.6474, lng: 153.602},
  },
];

function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function resolveNearestCityFromCoordinates(
  lat: number,
  lng: number
): {
  cityRecord: GlobalCityRecord;
  distanceKm: number;
  isUncertain: boolean;
} {
  let closest = GLOBAL_CITY_DIRECTORY[0];
  let minDistance = Infinity;

  for (const record of GLOBAL_CITY_DIRECTORY) {
    const dist = calculateDistanceKm(
      lat,
      lng,
      record.coordinates.lat,
      record.coordinates.lng
    );
    if (dist < minDistance) {
      minDistance = dist;
      closest = record;
    }
  }

  return {
    cityRecord: closest,
    distanceKm: Math.round(minDistance * 10) / 10,
    isUncertain: minDistance > 40,
  };
}

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
  roles: ('BUYER' | 'SELLER' | 'ADMIN')[];
  sellerId?: string;
  storeIds: string[];
  createdAt: string;
  isAdmin?: boolean;
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
  currency?: string;
  unit?: string;
  city: string;
  neighborhood: string;
  distanceKm: number;
  deliveryMins: number;
  stock: number;
  stockNote?: string;
  isAvailable: boolean;
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
  if (!store.isActive) return false;
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

  // 2. Identify all products belonging strictly to eligible stores in the selected city
  const eligibleProductsInCity = products.filter((product) =>
    eligibleStoreMap.has(product.storeId)
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

export interface OrderRecord {
  id: string;
  createdAt: string;
  createdAtIso?: string;
  storeId: string;
  storeName: string;
  sellerId: string;
  buyerUid?: string;
  sellerUid?: string;
  idempotencyKey?: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  upiId?: string;
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
}

export const CITY_HUBS: string[] = [
  'Pune, Maharashtra',
  'Mumbai, Maharashtra',
  'Nanded, Maharashtra',
  'Bengaluru, Karnataka',
  'London, Greater London',
  'Tokyo, Tokyo Metropolis',
  'New York, New York',
];

export const INITIAL_SELLERS: SellerProfile[] = [
  {
    id: 'seller-1',
    businessOwnerName: 'Kenji Takahashi',
    phoneE164: '+819012345678',
    phoneVerified: true,
    email: 'kenji@atelierkobo.jp',
    role: 'SELLER',
    storeIds: ['store-1'],
  },
  {
    id: 'seller-2',
    businessOwnerName: 'Rohan Deshmukh',
    phoneE164: '+919820451290',
    phoneVerified: true,
    email: 'rohan@palihillroastery.in',
    role: 'SELLER',
    storeIds: ['store-2'],
  },
  {
    id: 'seller-3',
    businessOwnerName: 'Clara Vance',
    phoneE164: '+447700900412',
    phoneVerified: true,
    email: 'clara@redchurchaudio.co.uk',
    role: 'SELLER',
    storeIds: ['store-3', 'store-8'],
  },
  {
    id: 'seller-4',
    businessOwnerName: 'Elena Rostova',
    phoneE164: '+12125550194',
    phoneVerified: true,
    email: 'elena@mercerapothecary.com',
    role: 'SELLER',
    storeIds: ['store-4'],
  },
  {
    id: 'seller-5',
    businessOwnerName: 'Meera Krishnan',
    // Existing legacy account lacking a verified phone number — flagged for phone OTP migration
    phoneVerified: false,
    migrationRequired: true,
    email: 'meera@100ftcraftloom.in',
    role: 'SELLER',
    storeIds: ['store-5'],
  },
  {
    id: 'seller-6',
    businessOwnerName: 'Siddharth Kulkarni',
    phoneE164: '+919823011223',
    phoneVerified: true,
    email: 'siddharth@deccanprovisions.in',
    role: 'SELLER',
    storeIds: ['store-6'],
  },
  {
    id: 'seller-7',
    businessOwnerName: 'Amol Chavan',
    phoneE164: '+919422177889',
    phoneVerified: true,
    email: 'amol@marathwadatech.in',
    role: 'SELLER',
    storeIds: ['store-7'],
  },
  ...NANDED_DEMO_SELLERS,
];

export const INITIAL_USER_ACCOUNTS: UserAccount[] = [
  {
    id: 'user-seller-2',
    phoneE164: '+919820451290',
    maskedPhone: '+91 •••••• 1290',
    countryCode: 'IN',
    fullName: 'Rohan Deshmukh',
    roles: ['BUYER', 'SELLER'],
    sellerId: 'seller-2',
    storeIds: ['store-2'],
    createdAt: '2022-04-10',
  },
  {
    id: 'user-seller-6',
    phoneE164: '+919823011223',
    maskedPhone: '+91 •••••• 1223',
    countryCode: 'IN',
    fullName: 'Siddharth Kulkarni',
    roles: ['BUYER', 'SELLER'],
    sellerId: 'seller-6',
    storeIds: ['store-6'],
    createdAt: '2023-08-19',
  },
  {
    id: 'user-seller-7',
    phoneE164: '+919422177889',
    maskedPhone: '+91 •••••• 7889',
    countryCode: 'IN',
    fullName: 'Amol Chavan',
    roles: ['BUYER', 'SELLER'],
    sellerId: 'seller-7',
    storeIds: ['store-7'],
    createdAt: '2024-01-12',
  },
  {
    id: 'user-seller-3',
    phoneE164: '+447700900412',
    maskedPhone: '+44 •••••• 0412',
    countryCode: 'GB',
    fullName: 'Clara Vance',
    roles: ['BUYER', 'SELLER'],
    sellerId: 'seller-3',
    storeIds: ['store-3', 'store-8'],
    createdAt: '2023-05-02',
  },
  {
    id: 'user-seller-1',
    phoneE164: '+819012345678',
    maskedPhone: '+81 •••••• 5678',
    countryCode: 'JP',
    fullName: 'Kenji Takahashi',
    roles: ['BUYER', 'SELLER'],
    sellerId: 'seller-1',
    storeIds: ['store-1'],
    createdAt: '2023-02-15',
  },
  {
    id: 'user-seller-4',
    phoneE164: '+12125550194',
    maskedPhone: '+1 •••••• 0194',
    countryCode: 'US',
    fullName: 'Elena Rostova',
    roles: ['BUYER', 'SELLER'],
    sellerId: 'seller-4',
    storeIds: ['store-4'],
    createdAt: '2023-06-21',
  },
  // Existing Buyer-only account (Case 2: Existing buyer account with no registered store)
  {
    id: 'user-buyer-1',
    phoneE164: '+919820111222',
    maskedPhone: '+91 •••••• 1222',
    countryCode: 'IN',
    fullName: 'Priya Sharma',
    roles: ['BUYER'],
    storeIds: [],
    createdAt: '2025-01-15',
  },
  // Seller account with no completed store yet (Case 4: Seller who started registration but hasn't finished store setup)
  {
    id: 'user-seller-incomplete-1',
    phoneE164: '+919820333444',
    maskedPhone: '+91 •••••• 3444',
    countryCode: 'IN',
    fullName: 'Vikram Joshi',
    roles: ['BUYER', 'SELLER'],
    sellerId: 'seller-incomplete-1',
    storeIds: [],
    createdAt: '2025-02-01',
  },
  // Nanded Demo Store Owner Accounts (so any Nanded demo store owner can sign in via OTP)
  ...NANDED_DEMO_SELLERS.filter((s) => Boolean(s.phoneE164)).map((s) => ({
    id: `user-${s.id}`,
    phoneE164: s.phoneE164!,
    maskedPhone: `+91 •••••• ${s.phoneE164!.slice(-4)}`,
    countryCode: s.phoneCountryCode || 'IN',
    fullName: s.businessOwnerName,
    roles: ['BUYER', 'SELLER'] as ('BUYER' | 'SELLER' | 'ADMIN')[],
    sellerId: s.id,
    storeIds: s.storeIds,
    createdAt: '2025-01-01',
  })),
];

export const INITIAL_STORES: LocalStore[] = [
  {
    id: 'store-1',
    sellerId: 'seller-1',
    sellerName: 'Kenji Takahashi',
    name: 'Atelier Kobo & Light',
    categoryId: 'cat-08-furniture-home-decor',
    category: 'Furniture & Home Decor',
    countryCode: 'JP',
    country: 'Japan',
    stateRegion: 'Tokyo Metropolis',
    cityId: 'japan-tokyo-metropolis-tokyo',
    cityName: 'Tokyo',
    servedCityIds: ['japan-tokyo-metropolis-tokyo'],
    city: 'Tokyo · Shibuya',
    neighborhood: 'Tomigaya 2-Chome',
    address: '2-14-8 Tomigaya, Shibuya-ku',
    coordinates: {lat: 35.6664, lng: 139.6882},
    locationVerified: true,
    operatingHours: '09:00 – 20:00 JST',
    avgDispatchMins: 26,
    rating: 4.9,
    verifiedSince: '2023',
    specialty: 'Architectural Lighting & Home Decor',
    upiHandle: 'atelierkobo@globalpay',
    activeSkus: 48,
    isActive: true,
    serviceArea: {
      scopeType: 'CUSTOM_LOCALITIES',
      coveredLocalities: [
        'Shibuya',
        'Tomigaya',
        'Yoyogi',
        'Harajuku',
        'Daikanyama',
        'Ebisu',
      ],
      maxRadiusKm: 5,
      sellerDeliveryFee: 8,
      freeDeliveryAbove: 120,
      fulfillmentNote:
        'Seller bicycle & micro-van courier within Shibuya-ku and Meguro-ku',
    },
  },
  {
    id: 'store-2',
    sellerId: 'seller-2',
    sellerName: 'Rohan Deshmukh',
    name: 'Pali Hill Roastery & Provision',
    categoryId: 'cat-01-grocery-daily-essentials',
    category: 'Grocery & Daily Essentials',
    countryCode: 'IN',
    country: 'India',
    stateRegion: 'Maharashtra',
    cityId: 'india-maharashtra-mumbai',
    cityName: 'Mumbai',
    servedCityIds: ['india-maharashtra-mumbai'],
    city: 'Mumbai · Bandra',
    neighborhood: 'Pali Naka, Bandra West',
    address: '14 Union Park Road, Pali Hill',
    coordinates: {lat: 19.0663, lng: 72.8262},
    locationVerified: true,
    operatingHours: '07:30 – 21:30 IST',
    avgDispatchMins: 24,
    rating: 4.9,
    verifiedSince: '2022',
    specialty: 'Single-Estate Coffee, Hearth Bakery & Daily Essentials',
    upiHandle: 'palihillroast@okicici',
    activeSkus: 64,
    isActive: true,
    serviceArea: {
      scopeType: 'CUSTOM_LOCALITIES',
      coveredLocalities: [
        'Bandra',
        'Bandra West',
        'Bandra East',
        'Pali Hill',
        'Khar',
        'Santacruz',
        'Juhu',
      ],
      maxRadiusKm: 6,
      sellerDeliveryFee: 5,
      freeDeliveryAbove: 80,
      fulfillmentNote:
        'Direct store runner delivery across Bandra, Khar, and Santacruz',
    },
  },
  {
    id: 'store-3',
    sellerId: 'seller-3',
    sellerName: 'Clara Vance',
    name: 'Redchurch Acoustic & Tech Lab',
    categoryId: 'cat-04-electronics-mobile-accessories',
    category: 'Electronics & Mobile Accessories',
    countryCode: 'GB',
    country: 'United Kingdom',
    stateRegion: 'Greater London',
    cityId: 'united-kingdom-greater-london-london',
    cityName: 'London',
    servedCityIds: ['united-kingdom-greater-london-london'],
    city: 'London · Shoreditch',
    neighborhood: 'Boundary Street',
    address: '42 Redchurch St, Shoreditch E2',
    coordinates: {lat: 51.5245, lng: -0.0749},
    locationVerified: true,
    operatingHours: '10:00 – 19:00 GMT',
    avgDispatchMins: 32,
    rating: 4.8,
    verifiedSince: '2024',
    specialty: 'Studio Audio, Mobile DACs & Precision Electronics',
    upiHandle: 'redchurchaudio@ukfast',
    activeSkus: 31,
    isActive: true,
    serviceArea: {
      scopeType: 'CUSTOM_LOCALITIES',
      coveredLocalities: [
        'Shoreditch',
        'Hoxton',
        'Hackney',
        'Bethnal Green',
        'Spitalfields',
        'Islington',
      ],
      maxRadiusKm: 7,
      sellerDeliveryFee: 8,
      freeDeliveryAbove: 120,
      fulfillmentNote:
        'Insured seller cargo bike courier across East & Central London',
    },
  },
  {
    id: 'store-4',
    sellerId: 'seller-4',
    sellerName: 'Elena Rostova',
    name: 'Mercer Botanical Apothecary',
    categoryId: 'cat-10-beauty-personal-care',
    category: 'Beauty & Personal Care',
    countryCode: 'US',
    country: 'United States',
    stateRegion: 'New York',
    cityId: 'united-states-new-york-new-york',
    cityName: 'New York',
    servedCityIds: ['united-states-new-york-new-york'],
    city: 'New York · SoHo',
    neighborhood: 'Mercer & Broome',
    address: '118 Mercer St, SoHo NY',
    coordinates: {lat: 40.7239, lng: -73.9997},
    locationVerified: true,
    operatingHours: '10:00 – 20:00 EST',
    avgDispatchMins: 29,
    rating: 4.9,
    verifiedSince: '2023',
    specialty: 'Cold-Pressed Botanical Skincare & Personal Care',
    upiHandle: 'mercerapothecary@nycpay',
    activeSkus: 52,
    isActive: true,
    serviceArea: {
      scopeType: 'CUSTOM_LOCALITIES',
      coveredLocalities: [
        'SoHo',
        'Tribeca',
        'Greenwich Village',
        'NoHo',
        'Lower East Side',
        'Chelsea',
      ],
      maxRadiusKm: 6,
      sellerDeliveryFee: 8,
      freeDeliveryAbove: 120,
      fulfillmentNote:
        'Same-hour local messenger service across Lower Manhattan',
    },
  },
  {
    id: 'store-5',
    sellerId: 'seller-5',
    sellerName: 'Meera Krishnan',
    name: '100ft Craft & Loom Studio',
    categoryId: 'cat-03-fashion-clothing',
    category: 'Fashion & Clothing',
    countryCode: 'IN',
    country: 'India',
    stateRegion: 'Karnataka',
    cityId: 'india-karnataka-bengaluru',
    cityName: 'Bengaluru',
    servedCityIds: ['india-karnataka-bengaluru'],
    city: 'Bengaluru · Indiranagar',
    neighborhood: 'HAL 2nd Stage',
    address: '718 12th Main Rd, Indiranagar',
    coordinates: {lat: 12.9719, lng: 77.6412},
    locationVerified: true,
    operatingHours: '09:30 – 21:00 IST',
    avgDispatchMins: 22,
    rating: 4.9,
    verifiedSince: '2023',
    specialty: 'Handloom Apparel, Tailored Textiles & Craftware',
    upiHandle: 'craftloom100ft@okaxis',
    activeSkus: 79,
    isActive: true,
    serviceArea: {
      scopeType: 'CUSTOM_LOCALITIES',
      coveredLocalities: [
        'Indiranagar',
        'Domlur',
        'Ulsoor',
        'Koramangala',
        'MG Road',
        'CV Raman Nagar',
      ],
      maxRadiusKm: 8,
      sellerDeliveryFee: 4,
      freeDeliveryAbove: 75,
      fulfillmentNote:
        'In-house EV two-wheeler dispatch from 12th Main Indiranagar',
    },
  },
  {
    id: 'store-6',
    sellerId: 'seller-6',
    sellerName: 'Siddharth Kulkarni',
    name: 'Deccan Farm & Daily Provisions',
    categoryId: 'cat-01-grocery-daily-essentials',
    category: 'Grocery & Daily Essentials',
    countryCode: 'IN',
    country: 'India',
    stateRegion: 'Maharashtra',
    cityId: 'india-maharashtra-pune',
    cityName: 'Pune',
    servedCityIds: ['india-maharashtra-pune'],
    city: 'Pune · Kothrud',
    neighborhood: 'Kothrud & Deccan Gymkhana',
    address: 'Shop 9, Karve Road, Kothrud, Pune',
    coordinates: {lat: 18.5074, lng: 73.8077},
    locationVerified: true,
    operatingHours: '06:30 – 21:30 IST',
    avgDispatchMins: 20,
    rating: 4.9,
    verifiedSince: '2023',
    specialty: 'Farm-Fresh A2 Milk, Organic Groceries & Daily Essentials',
    upiHandle: 'deccanprovisions@okicici',
    activeSkus: 56,
    isActive: true,
    serviceArea: {
      scopeType: 'CUSTOM_LOCALITIES',
      coveredLocalities: [
        'Kothrud',
        'Deccan Gymkhana',
        'Shivajinagar',
        'Erandwane',
        'Aundh',
        'Baner',
        'Koregaon Park',
      ],
      maxRadiusKm: 8,
      sellerDeliveryFee: 3,
      freeDeliveryAbove: 50,
      fulfillmentNote:
        'Chilled morning and evening store delivery across Pune neighborhoods',
    },
  },
  {
    id: 'store-7',
    sellerId: 'seller-7',
    sellerName: 'Amol Chavan',
    name: 'Marathwada Mobile & Tech Accessories',
    categoryId: 'cat-04-electronics-mobile-accessories',
    category: 'Electronics & Mobile Accessories',
    countryCode: 'IN',
    country: 'India',
    stateRegion: 'Maharashtra',
    cityId: 'india-maharashtra-nanded',
    cityName: 'Nanded',
    servedCityIds: ['india-maharashtra-nanded'],
    city: 'Nanded · Vazirabad',
    neighborhood: 'Vazirabad Main Market',
    address: 'Plot 12, Station Road, Vazirabad, Nanded',
    coordinates: {lat: 19.1485, lng: 77.3193},
    locationVerified: true,
    operatingHours: '09:30 – 21:00 IST',
    avgDispatchMins: 25,
    rating: 4.8,
    verifiedSince: '2024',
    specialty: 'Fast Chargers, Mobile Accessories, Audio & Smart Gadgets',
    upiHandle: 'marathwadatech@oksbi',
    activeSkus: 42,
    isActive: true,
    serviceArea: {
      scopeType: 'CITY_WIDE',
      coveredLocalities: [
        'Vazirabad',
        'Shivaji Nagar',
        'VIP Road',
        'Taroda Naka',
        'Anand Nagar',
        'CIDCO Nanded',
      ],
      maxRadiusKm: 7,
      sellerDeliveryFee: 2,
      freeDeliveryAbove: 40,
      fulfillmentNote:
        'Same-day store runner delivery across Nanded city limits',
    },
  },
  {
    id: 'store-8',
    sellerId: 'seller-3',
    sellerName: 'Clara Vance',
    name: 'Spitalfields Hearth Bakery & Sweet Shop',
    categoryId: 'cat-06-bakery-sweets-desserts',
    category: 'Bakery, Sweets & Desserts',
    countryCode: 'GB',
    country: 'United Kingdom',
    stateRegion: 'Greater London',
    cityId: 'united-kingdom-greater-london-london',
    cityName: 'London',
    servedCityIds: ['united-kingdom-greater-london-london'],
    city: 'London · Shoreditch',
    neighborhood: 'Brushfield Street, Spitalfields',
    address: '19 Brushfield St, Spitalfields E1',
    coordinates: {lat: 51.5195, lng: -0.0757},
    locationVerified: true,
    operatingHours: '07:00 – 18:30 GMT',
    avgDispatchMins: 25,
    rating: 4.9,
    verifiedSince: '2023',
    specialty: 'Artisan Sourdough Bakery, Pastries & Fresh Desserts',
    upiHandle: 'spitalfieldsbakery@ukfast',
    activeSkus: 28,
    isActive: true,
    serviceArea: {
      scopeType: 'CUSTOM_LOCALITIES',
      coveredLocalities: [
        'Shoreditch',
        'Spitalfields',
        'Bethnal Green',
        'Hackney',
        'Islington',
        'City of London',
      ],
      maxRadiusKm: 6,
      sellerDeliveryFee: 6,
      freeDeliveryAbove: 60,
      fulfillmentNote:
        'Warm bicycle bakery box delivery across East & Central London',
    },
  },
  ...NANDED_DEMO_STORES,
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    sellerId: 'seller-1',
    storeId: 'store-1',
    storeName: 'Atelier Kobo & Light',
    sku: 'UD-FHD-014',
    name: 'Tadao Brushed Brass Table Lamp',
    categoryId: 'cat-08-furniture-home-decor',
    category: 'Furniture & Home Decor',
    price: 240,
    city: 'Tokyo · Shibuya',
    neighborhood: 'Tomigaya',
    distanceKm: 1.8,
    deliveryMins: 28,
    stock: 7,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 128,
    description:
      'Machined from solid unlacquered Japanese brass with a stepless rotary warm-dimming dial (2200K–3000K). Dispatched directly from our Tomigaya showroom with full protective crate packaging.',
    dimensions: '28 cm H × 22 cm Diameter · 2.4 kg',
    materials:
      'Solid Unlacquered Brass, Hand-Spun Aluminum Diffuser, Braided Linen Cord',
    variants: [
      'Raw Brushed Brass',
      'Smoked Bronze Patina',
      'Matte Anodized Silver',
    ],
    statusNote: 'In stock',
    artworkPreset: 'brass_lamp',
  },
  {
    id: 'prod-2',
    sellerId: 'seller-2',
    storeId: 'store-2',
    storeName: 'Pali Hill Roastery & Provision',
    sku: 'UD-HKA-089',
    name: 'Monolith Manual Lever Espresso Press',
    categoryId: 'cat-18-home-kitchen-appliances',
    category: 'Home & Kitchen Appliances',
    price: 385,
    city: 'Mumbai · Bandra',
    neighborhood: 'Pali Hill',
    distanceKm: 1.4,
    deliveryMins: 24,
    stock: 5,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 94,
    description:
      'Precision manual 9-bar extraction press calibrated at our Bandra roastery. Features a liquid-filled pressure gauge, 58mm commercial stainless portafilter, and zero-plastic thermal chamber.',
    dimensions: '34 cm H × 16 cm W × 24 cm D · 4.1 kg',
    materials:
      '304 Surgical Stainless Steel, Walnut Lever Handle, Brass Piston',
    variants: ['Brushed Steel & Walnut', 'Matte Obsidian & Oak'],
    statusNote: 'In stock',
    artworkPreset: 'espresso_machine',
  },
  {
    id: 'prod-3',
    sellerId: 'seller-4',
    storeId: 'store-4',
    storeName: 'Mercer Botanical Apothecary',
    sku: 'UD-BPC-032',
    name: 'Hinoki & Vetiver Barrier Repair Serum',
    categoryId: 'cat-10-beauty-personal-care',
    category: 'Beauty & Personal Care',
    price: 68,
    city: 'New York · SoHo',
    neighborhood: 'Mercer St',
    distanceKm: 2.1,
    deliveryMins: 30,
    stock: 19,
    isAvailable: true,
    rating: 4.8,
    reviewsCount: 215,
    description:
      'Cold-compounded in small batches at our Mercer Street lab. Combines Japanese Hinoki cypress distillate, wild-harvested Haitian vetiver root, and 5% bio-fermented squalane in UV-protective amber glass.',
    dimensions: '50 ml / 1.7 fl oz Heavy Amber Dropper Flacon',
    materials:
      'Wild Hinoki Distillate, Plant Squalane, Niacinamide, Amber Apothecary Glass',
    variants: ['50 ml Standard Flacon', '100 ml Studio Refill'],
    statusNote: 'In stock',
    artworkPreset: 'hinoki_serum',
  },
  {
    id: 'prod-4',
    sellerId: 'seller-3',
    storeId: 'store-3',
    storeName: 'Redchurch Acoustic & Tech Lab',
    sku: 'UD-EMA-019',
    name: 'Reference Field Monitor Headphones & USB-C DAC',
    categoryId: 'cat-04-electronics-mobile-accessories',
    category: 'Electronics & Mobile Accessories',
    price: 310,
    city: 'London · Shoreditch',
    neighborhood: 'Redchurch St',
    distanceKm: 2.5,
    deliveryMins: 34,
    stock: 6,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 83,
    description:
      'Open-back planar magnetic studio headphones hand-matched in Shoreditch. Includes modular magnetic lambskin earpads, CNC-milled aluminum yokes, and a mobile USB-C lossless DAC adapter.',
    dimensions: '32 Ohms Impedance · 98 dB/mW · 340g Weight',
    materials: 'CNC 6061 Aluminum, Memory Lambskin, 50mm Planar Transducer',
    variants: ['Natural Titanium Gray', 'Anodized Slate Black'],
    statusNote: 'In stock',
    artworkPreset: 'field_headphones',
  },
  {
    id: 'prod-5',
    sellerId: 'seller-1',
    storeId: 'store-1',
    storeName: 'Atelier Kobo & Light',
    sku: 'UD-GDE-054',
    name: 'First-Harvest Uji Ceremonial Matcha Tin',
    categoryId: 'cat-01-grocery-daily-essentials',
    category: 'Grocery & Daily Essentials',
    price: 54,
    city: 'Tokyo · Shibuya',
    neighborhood: 'Tomigaya',
    distanceKm: 1.8,
    deliveryMins: 26,
    stock: 24,
    isAvailable: true,
    rating: 5.0,
    reviewsCount: 162,
    description:
      'Stone-milled to 5 microns from shade-grown Samidori tencha leaves in Uji, kept cold-stored at 4°C in our Shibuya vault until the moment our courier picks up your intra-city order.',
    dimensions: '40g Nitrogen-Flushed Double-Lid Pewter Canister',
    materials: '100% First-Flush Uji Tencha (Cultivar: Samidori)',
    variants: [
      '40g Canister',
      '80g Tea Master Tin',
      '40g + Bamboo Chasen Whisk',
    ],
    statusNote: 'In stock',
    artworkPreset: 'matcha_ceremonial',
  },
  {
    id: 'prod-6',
    sellerId: 'seller-5',
    storeId: 'store-5',
    storeName: '100ft Craft & Loom Studio',
    sku: 'UD-FAC-077',
    name: 'Kora Heavyweight Handloom Chore Jacket',
    categoryId: 'cat-03-fashion-clothing',
    category: 'Fashion & Clothing',
    price: 165,
    city: 'Bengaluru · Indiranagar',
    neighborhood: '12th Main Rd',
    distanceKm: 1.2,
    deliveryMins: 22,
    stock: 9,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 109,
    description:
      'Woven on wooden shuttle looms using 11oz unbleached organic Deccan cotton. Features natural river-shell corozo buttons, reinforced gusseted utility pockets, and French-felled interior seams.',
    dimensions: 'Relaxed Boxy Fit · Pre-Washed Zero Shrinkage',
    materials:
      '100% Unbleached Organic Handloom Cotton (380 GSM), Corozo Nut Buttons',
    variants: [
      'Undyed Raw Ecru · Size M',
      'Undyed Raw Ecru · Size L',
      'Natural Indigo Vat · Size L',
    ],
    statusNote: 'In stock',
    artworkPreset: 'linen_jacket',
  },
  {
    id: 'prod-7',
    sellerId: 'seller-5',
    storeId: 'store-5',
    storeName: '100ft Craft & Loom Studio',
    sku: 'UD-HLP-103',
    name: 'Hasami Porcelain Ribbed Pour-Over Carafe',
    categoryId: 'cat-23-handicrafts-local-products',
    category: 'Handicrafts & Local Products',
    price: 92,
    city: 'Bengaluru · Indiranagar',
    neighborhood: '12th Main Rd',
    distanceKm: 1.2,
    deliveryMins: 24,
    stock: 14,
    isAvailable: true,
    rating: 4.8,
    reviewsCount: 74,
    description:
      'High-fired stoneware dripper and thermal server engineered with 24 internal spiral ribs for uniform laminar extraction flow. Stacks cleanly as a single architectural cylinder.',
    dimensions: '600 ml Capacity · 18.5 cm Stacked Height',
    materials: 'Amakusa Porcelain Stoneware, Raw Matte Exterior Glaze',
    variants: ['Warm Travertine Clay', 'Charcoal Iron Glaze'],
    statusNote: 'In stock',
    artworkPreset: 'ceramic_pourover',
  },
  {
    id: 'prod-8',
    sellerId: 'seller-2',
    storeId: 'store-2',
    storeName: 'Pali Hill Roastery & Provision',
    sku: 'UD-BSD-118',
    name: 'Heritage Emmer Sourdough & Cultured Butter Provision',
    categoryId: 'cat-06-bakery-sweets-desserts',
    category: 'Bakery, Sweets & Desserts',
    price: 38,
    city: 'Mumbai · Bandra',
    neighborhood: 'Pali Hill',
    distanceKm: 1.4,
    deliveryMins: 24,
    stock: 11,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 187,
    description:
      '36-hour cold-fermented Khapli (Emmer) country loaf baked on stone hearth at 06:00 AM daily, paired with a 200g wheel of sea-salted cultured A2 farm butter and smoked Maldon flakes.',
    dimensions: '850g Hearth Boule + 200g Cultured Butter Crock',
    materials:
      'Organic Stoneground Emmer & Red Wheat, Wild Levain, Cultured Cream',
    variants: ['Whole Boule (Unsliced)', 'Thick Country Slice (14mm)'],
    statusNote: 'In stock',
    artworkPreset: 'sourdough_kit',
  },
  {
    id: 'prod-9',
    sellerId: 'seller-3',
    storeId: 'store-3',
    storeName: 'Redchurch Acoustic & Tech Lab',
    sku: 'UD-FWB-142',
    name: 'Bridle Leather Architectural Market Tote',
    categoryId: 'cat-11-footwear-bags',
    category: 'Footwear & Bags',
    price: 225,
    city: 'London · Shoreditch',
    neighborhood: 'Redchurch St',
    distanceKm: 2.5,
    deliveryMins: 32,
    stock: 4,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 61,
    description:
      'Cut from a single hide of 3.2mm vegetable-tanned English bridle leather with solid sand-cast brass rivets and a suspended padded 16-inch laptop sleeve inside.',
    dimensions: '38 cm W × 36 cm H × 14 cm Gusset',
    materials:
      'Full-Grain Vegetable-Tanned Bridle Leather, Solid Brass Hardware',
    variants: ['Havana Espresso Brown', 'Saddle Tan', 'Pitch Black'],
    statusNote: 'In stock',
    artworkPreset: 'leather_totebag',
  },
  {
    id: 'prod-10',
    sellerId: 'seller-6',
    storeId: 'store-6',
    storeName: 'Deccan Farm & Daily Provisions',
    sku: 'UD-GDE-201',
    name: 'Gir Farm A2 Fresh Whole Milk & Cultured Ghee Pack',
    categoryId: 'cat-01-grocery-daily-essentials',
    category: 'Grocery & Daily Essentials',
    price: 12,
    city: 'Pune · Kothrud',
    neighborhood: 'Kothrud',
    distanceKm: 1.1,
    deliveryMins: 20,
    stock: 32,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 142,
    description:
      'Fresh morning-milked A2 Gir cow milk bottled in sanitized glass at our Mulshi farm and delivered chilled across Pune within hours.',
    dimensions: '1 Liter Glass Bottle + 250 ml Bilona Ghee Jar',
    materials: '100% Pure A2 Cow Milk, Returnable Glass Bottle',
    variants: ['1L Fresh Milk Bottle', '1L Milk + 250ml Ghee Combo'],
    statusNote: 'In stock',
    artworkPreset: 'matcha_ceremonial',
  },
  {
    id: 'prod-11',
    sellerId: 'seller-6',
    storeId: 'store-6',
    storeName: 'Deccan Farm & Daily Provisions',
    sku: 'UD-FV-204',
    name: 'Mulshi Valley Organic Harvest Vegetable & Fruit Basket',
    categoryId: 'cat-02-fruits-vegetables',
    category: 'Fruits & Vegetables',
    price: 18,
    city: 'Pune · Kothrud',
    neighborhood: 'Deccan Gymkhana',
    distanceKm: 1.3,
    deliveryMins: 22,
    stock: 18,
    isAvailable: true,
    rating: 4.8,
    reviewsCount: 89,
    description:
      'Daily harvested seasonal vegetables, leafy greens, and orchard fruits sourced from Mulshi and Maval farmers for Pune households.',
    dimensions: '4.5 kg Assorted Daily Family Basket',
    materials: 'Certified Chemical-Free Local Produce',
    variants: ['Standard Family Box (4.5 kg)', 'Compact Weekly Box (2.5 kg)'],
    statusNote: 'In stock',
    artworkPreset: 'sourdough_kit',
  },
  {
    id: 'prod-12',
    sellerId: 'seller-7',
    storeId: 'store-7',
    storeName: 'Marathwada Mobile & Tech Accessories',
    sku: 'UD-EMA-301',
    name: '65W GaN Fast Charger & Braided USB-C Mobile Accessories Kit',
    categoryId: 'cat-04-electronics-mobile-accessories',
    category: 'Electronics & Mobile Accessories',
    price: 29,
    city: 'Nanded · Vazirabad',
    neighborhood: 'Vazirabad',
    distanceKm: 0.9,
    deliveryMins: 25,
    stock: 22,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 64,
    description:
      'Dual-port 65W Gallium Nitride fast wall charger with a 2-meter Kevlar-braided 100W USB-C cable and protective phone stand. In stock at our Vazirabad store in Nanded.',
    dimensions: 'Dual USB-C + USB-A Fast Charger + 2m Cable',
    materials: 'Fire-Retardant Polycarbonate, Braided Nylon Mobile Cable',
    variants: ['Matte Black Kit', 'Glacier White Kit'],
    statusNote: 'In stock',
    artworkPreset: 'field_headphones',
  },
  {
    id: 'prod-13',
    sellerId: 'seller-3',
    storeId: 'store-8',
    storeName: 'Spitalfields Hearth Bakery & Sweet Shop',
    sku: 'UD-BSD-402',
    name: 'East London Cardamom Morning Buns & Country Sourdough Box',
    categoryId: 'cat-06-bakery-sweets-desserts',
    category: 'Bakery, Sweets & Desserts',
    price: 26,
    city: 'London · Shoreditch',
    neighborhood: 'Spitalfields',
    distanceKm: 1.6,
    deliveryMins: 25,
    stock: 15,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 112,
    description:
      'Freshly baked in our Spitalfields deck ovens every morning. Includes one organic heritage wheat sourdough loaf and four laminated brown-butter cardamom buns.',
    dimensions: '1 Sourdough Loaf (800g) + 4 Morning Buns',
    materials: 'Organic Stoneground British Flour, Cultured Butter, Cardamom',
    variants: ['Classic Cardamom & Sourdough', 'Cinnamon Brioche & Sourdough'],
    statusNote: 'In stock',
    artworkPreset: 'sourdough_kit',
  },
  {
    id: 'prod-14',
    sellerId: 'seller-6',
    storeId: 'store-6',
    storeName: 'Deccan Farm & Daily Provisions',
    sku: 'UD-GDE-209',
    name: 'Indrayani Hand-Pounded Unpolished Rice (5 kg)',
    categoryId: 'cat-01-grocery-daily-essentials',
    category: 'Grocery & Daily Essentials',
    price: 15,
    city: 'Pune · Kothrud',
    neighborhood: 'Kothrud',
    distanceKm: 1.1,
    deliveryMins: 22,
    stock: 28,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 96,
    description:
      'Fragrant single-origin Indrayani rice cultivated in Maval taluka near Pune. Gently milled to retain natural bran nutrients and delivered in breathable cotton sacks.',
    dimensions: '5 kg Stitched Cotton Provision Bag',
    materials: '100% Single-Origin Maval Indrayani Rice',
    variants: ['5 kg Bag', '10 kg Family Sack'],
    statusNote: 'In stock',
    artworkPreset: 'matcha_ceremonial',
  },
  {
    id: 'prod-15',
    sellerId: 'seller-6',
    storeId: 'store-6',
    storeName: 'Deccan Farm & Daily Provisions',
    sku: 'UD-BSD-212',
    name: 'Kolhapuri Organic Jaggery & Roasted Peanut Ladoo Box',
    categoryId: 'cat-06-bakery-sweets-desserts',
    category: 'Bakery, Sweets & Desserts',
    price: 11,
    city: 'Pune · Kothrud',
    neighborhood: 'Kothrud',
    distanceKm: 1.1,
    deliveryMins: 20,
    stock: 24,
    isAvailable: true,
    rating: 4.8,
    reviewsCount: 63,
    description:
      'Hand-rolled daily using chemical-free golden Kolhapuri jaggery, slow-roasted Sahyadri groundnuts, and green cardamom.',
    dimensions: '500g Tin Box (16 Pieces)',
    materials: 'Organic Sugarcane Jaggery, Roasted Groundnuts, Cardamom',
    variants: ['500g Tin', '1 kg Gift Box'],
    statusNote: 'In stock',
    artworkPreset: 'sourdough_kit',
  },
  {
    id: 'prod-16',
    sellerId: 'seller-6',
    storeId: 'store-6',
    storeName: 'Deccan Farm & Daily Provisions',
    sku: 'UD-HKA-215',
    name: 'Hand-Seasoned Bhigwan Clay Curd & Slow-Cook Pot',
    categoryId: 'cat-18-home-kitchen-appliances',
    category: 'Home & Kitchen Appliances',
    price: 22,
    city: 'Pune · Kothrud',
    neighborhood: 'Deccan Gymkhana',
    distanceKm: 1.3,
    deliveryMins: 25,
    stock: 14,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 48,
    description:
      'Traditional unglazed terracotta handi crafted by potters in Pune district for setting thick probiotic curd and slow-simmering dals.',
    dimensions: '2.2 Liter Capacity · Lid Included',
    materials: 'Natural Riverbed Terracotta Clay',
    variants: ['2.2L Standard Handi', '1.2L Curd Setter'],
    statusNote: 'In stock',
    artworkPreset: 'ceramic_pourover',
  },
  {
    id: 'prod-17',
    sellerId: 'seller-6',
    storeId: 'store-6',
    storeName: 'Deccan Farm & Daily Provisions',
    sku: 'UD-BPC-219',
    name: 'Cold-Pressed Wood-Ghani Coconut & Sesame Oil Duo',
    categoryId: 'cat-10-beauty-personal-care',
    category: 'Beauty & Personal Care',
    price: 19,
    city: 'Pune · Kothrud',
    neighborhood: 'Kothrud',
    distanceKm: 1.1,
    deliveryMins: 20,
    stock: 21,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 77,
    description:
      'Extracted below 38°C in a traditional lakdi ghani press in Kothrud. Ideal for culinary use, hair nourishment, and daily skincare.',
    dimensions: '2 × 500 ml Amber Glass Bottles',
    materials: '100% Raw Cold-Pressed Coconut & White Sesame',
    variants: ['Duo Pack (2 × 500ml)', 'Coconut Oil Only (1L)'],
    statusNote: 'In stock',
    artworkPreset: 'hinoki_serum',
  },
  {
    id: 'prod-18',
    sellerId: 'seller-2',
    storeId: 'store-2',
    storeName: 'Pali Hill Roastery & Provision',
    sku: 'UD-GDE-124',
    name: 'Chikmagalur Single-Estate Microlot Whole Bean Coffee',
    categoryId: 'cat-01-grocery-daily-essentials',
    category: 'Grocery & Daily Essentials',
    price: 24,
    city: 'Mumbai · Bandra',
    neighborhood: 'Pali Hill',
    distanceKm: 1.4,
    deliveryMins: 22,
    stock: 35,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 154,
    description:
      'Small-batch roasted every Tuesday and Friday at our Pali Hill roastery. Notes of dark cacao, roasted hazelnut, and jaggery.',
    dimensions: '250g Valved Roastery Pouch',
    materials: '100% Shade-Grown Arabica (1,450m Elevation)',
    variants: ['Whole Bean (250g)', 'Espresso Grind (250g)', 'Pour-Over Grind (250g)'],
    statusNote: 'In stock',
    artworkPreset: 'matcha_ceremonial',
  },
  {
    id: 'prod-19',
    sellerId: 'seller-2',
    storeId: 'store-2',
    storeName: 'Pali Hill Roastery & Provision',
    sku: 'UD-HKA-129',
    name: 'Borosilicate Double-Wall Pour-Over Server & Dripper Set',
    categoryId: 'cat-18-home-kitchen-appliances',
    category: 'Home & Kitchen Appliances',
    price: 64,
    city: 'Mumbai · Bandra',
    neighborhood: 'Bandra West',
    distanceKm: 1.4,
    deliveryMins: 24,
    stock: 12,
    isAvailable: true,
    rating: 4.8,
    reviewsCount: 68,
    description:
      'Hand-blown laboratory-grade borosilicate glass carafe with aglazed ceramic cone dripper and 100 unbleached paper filters.',
    dimensions: '600 ml Carafe + V02 Ceramic Cone',
    materials: 'Borosilicate Glass, High-Fired Stoneware',
    variants: ['Clear Glass & Matte Black Cone', 'Smoked Glass & Ivory Cone'],
    statusNote: 'In stock',
    artworkPreset: 'ceramic_pourover',
  },
  {
    id: 'prod-20',
    sellerId: 'seller-2',
    storeId: 'store-2',
    storeName: 'Pali Hill Roastery & Provision',
    sku: 'UD-FWB-133',
    name: 'Waxed Canvas & Saddle Leather Barista Utility Apron',
    categoryId: 'cat-03-fashion-clothing',
    category: 'Fashion & Clothing',
    price: 78,
    city: 'Mumbai · Bandra',
    neighborhood: 'Pali Hill',
    distanceKm: 1.4,
    deliveryMins: 25,
    stock: 9,
    isAvailable: true,
    rating: 4.9,
    reviewsCount: 41,
    description:
      'Water-repellent 14oz waxed cotton canvas apron with cross-back leather straps, brass quick-release buckles, and towel loop.',
    dimensions: 'Adjustable Unisex Fit · 82 cm Length',
    materials: '14oz Waxed Cotton Canvas, Full-Grain Harness Leather',
    variants: ['Olive Drab & Tan', 'Charcoal & Espresso'],
    statusNote: 'In stock',
    artworkPreset: 'linen_jacket',
  },
  {
    id: 'prod-21',
    sellerId: 'seller-7',
    storeId: 'store-7',
    storeName: 'Marathwada Mobile & Tech Accessories',
    sku: 'UD-EMA-308',
    name: 'MagSafe Aluminum Desk Charging Stand & 10000mAh Power Bank',
    categoryId: 'cat-04-electronics-mobile-accessories',
    category: 'Electronics & Mobile Accessories',
    price: 42,
    city: 'Nanded · Vazirabad',
    neighborhood: 'Vazirabad',
    distanceKm: 0.9,
    deliveryMins: 25,
    stock: 16,
    isAvailable: true,
    rating: 4.8,
    reviewsCount: 52,
    description:
      'Foldable CNC aluminum magnetic wireless charging stand paired with a slim 10,000mAh snap-on battery pack with 20W USB-C PD output.',
    dimensions: '10,000mAh Capacity · Qi2 / MagSafe Compatible',
    materials: 'Anodized Aluminum Alloy, Soft-Touch Silicone Pad',
    variants: ['Space Gray', 'Natural Silver'],
    statusNote: 'In stock',
    artworkPreset: 'field_headphones',
  },
  ...NANDED_DEMO_PRODUCTS,
];

