'use client';

import React, {useState} from 'react';
import {
  Check,
  Plus,
  RotateCcw,
  Upload,
  Store,
  Settings,
  Shield,
  Truck,
  Home,
  Package,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Phone,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
  Globe,
  Navigation,
  CreditCard,
  TrendingUp,
  Bell,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useUrbanDirect } from '@/components/urbandirect-provider';
import {
  ArtworkPreset,
  AUTHORITATIVE_STORE_CATEGORIES,
  CategoryDefinition,
  DeliveryScopeType,
  formatCurrency,
  getCategoryByIdOrName,
  GlobalCityRecord,
  isStoreLocationComplete,
  LocalityClassification,
  LocalStore,
  LocationDataSource,
  LocationVerificationStatus,
  normalizeCityId,
  OrderRecord,
  Product,
  SellerProfile,
  StoreCategoryId,
  StoreCategoryName,
  UserAccount,
} from '@/lib/catalog-data';
import {
  getCountryRecordByCodeOrName,
  INTERNATIONAL_COUNTRIES,
} from '@/lib/countries-data';
import {ProductStudioArtwork} from './product-studio-artwork';
import {CategoryIcon} from './category-icon';
import {SellerPlansBilling} from './seller-plans-billing';
import {AdminRevenueDashboard} from './admin-revenue-dashboard';
import {AdminLocationManager} from './admin-location-manager';
import {CascadingLocationSelector} from './cascading-location-selector';
import {checkProductQuota} from '@/lib/entitlements';

interface MerchantStudioProps {
  mode?: 'DASHBOARD' | 'ONBOARDING_ONLY';
  initialSection?:
    | 'home'
    | 'orders'
    | 'products'
    | 'add-product'
    | 'my-store'
    | 'store-hours'
    | 'billing'
    | 'admin-revenue'
    | 'admin-locations'
    | 'onboarding'
    | 'settings';
  sellers: SellerProfile[];
  stores: LocalStore[];
  products: Product[];
  orders: OrderRecord[];
  categories: CategoryDefinition[];
  authenticatedUser?: UserAccount | null;
  onOpenAuthModal?: (options?: {
    requireSellerOnboarding?: boolean;
    legacySellerId?: string;
  }) => void;
  onAddSellerAndStore: (seller: SellerProfile, store: LocalStore) => void;
  onOnboardingComplete?: (
    store: LocalStore,
    goToAddProduct: boolean
  ) => void;
  onUpdateStoreSettings: (updatedStore: LocalStore) => void;
  onDeleteStore?: (
    storeId: string,
    storeNameConfirm: string
  ) => Promise<{ success: boolean; message?: string }>;
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (updatedProduct: Product) => void;
  onDeleteProduct?: (productId: string) => void;
  onUpdateStock: (
    productId: string,
    newStock: number,
    actorSellerId: string,
    isAdmin: boolean
  ) => void;
  onUpdateOrderStep: (
    orderId: string,
    nextStep: number,
    nextStatus?: OrderRecord['orderStatus']
  ) => void;
  onToggleCategoryStatus?: (categoryId: StoreCategoryId) => void;
  onBackToShopping?: () => void;
}

interface DraftProductState {
  name: string;
  sku: string;
  categoryId: StoreCategoryId;
  category: StoreCategoryName;
  price: string;
  storeId: string;
  deliveryMins: string;
  stock: string;
  description: string;
  dimensions: string;
  materials: string;
  variantsRaw: string;
  statusNote: string;
  artworkPreset: ArtworkPreset;
  customImageUrl: string;
}

const STORAGE_KEY = 'urbandirect_product_draft_v3';

const DEFAULT_DRAFT: DraftProductState = {
  name: 'Cast-Iron Stove Kettle (1.2L)',
  sku: 'UD-HKA-208',
  categoryId: 'cat-18-home-kitchen-appliances',
  category: 'Home & Kitchen Appliances',
  price: '175',
  storeId: 'store-1',
  deliveryMins: '25',
  stock: '12',
  description:
    'Heavy cast-iron kettle that keeps water hot for tea and coffee. Delivered directly from our shop.',
  dimensions: '19 cm wide × 16 cm high · 1.85 kg',
  materials: 'Cast iron',
  variantsRaw: 'Matte Black, Textured Iron',
  statusNote: 'In stock',
  artworkPreset: 'ceramic_pourover',
  customImageUrl: '',
};

const ARTWORK_OPTIONS: {id: ArtworkPreset; label: string}[] = [
  {id: 'ceramic_pourover', label: 'Kitchen & Ceramic Vessel'},
  {id: 'brass_lamp', label: 'Home & Lighting'},
  {id: 'espresso_machine', label: 'Appliance & Coffee Maker'},
  {id: 'hinoki_serum', label: 'Personal Care & Bottle'},
  {id: 'field_headphones', label: 'Electronics & Headphones'},
  {id: 'matcha_ceremonial', label: 'Grocery & Pantry Tin'},
  {id: 'linen_jacket', label: 'Clothing & Jacket'},
  {id: 'sourdough_kit', label: 'Bakery & Fresh Food'},
  {id: 'leather_totebag', label: 'Bags & Accessories'},
];

const ORDER_STATUS_LABELS: Record<
  number,
  {label: string; nextAction: string; nextButtonLabel: string | null}
> = {
  0: {
    label: 'New order',
    nextAction: 'Pack the items in your shop and mark this order as Preparing.',
    nextButtonLabel: 'Start preparing order',
  },
  1: {
    label: 'Preparing',
    nextAction:
      'Send the order with your delivery person to the customer’s address.',
    nextButtonLabel: 'Send out for delivery',
  },
  2: {
    label: 'Out for delivery',
    nextAction:
      'Collect payment at the customer’s door and mark the order as Completed.',
    nextButtonLabel: 'Mark as completed',
  },
  3: {
    label: 'Completed',
    nextAction: 'This order has been delivered and paid.',
    nextButtonLabel: null,
  },
};

export function MerchantStudio({
  mode = 'DASHBOARD',
  initialSection = 'home',
  sellers,
  stores,
  products,
  orders,
  categories,
  authenticatedUser,
  onOpenAuthModal,
  onAddSellerAndStore,
  onOnboardingComplete,
  onUpdateStoreSettings,
  onDeleteStore,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateStock,
  onUpdateOrderStep,
  onToggleCategoryStatus,
  onBackToShopping,
}: MerchantStudioProps) {
  const {
    sellerNotifications = [],
    unreadNotificationCount = 0,
    handleMarkNotificationRead,
    handleClearNotifications,
    handleDeleteStore: providerHandleDeleteStore,
    userOwnedStores = [],
  } = useUrbanDirect();

  const [workspaceRole, setWorkspaceRole] = useState<
    'SELLER' | 'PLATFORM_ADMIN'
  >('SELLER');
  const resolvedAuthenticatedSeller = sellers.find(
    (s) =>
      s.id === authenticatedUser?.sellerId ||
      (Boolean(s.phoneE164) && s.phoneE164 === authenticatedUser?.phoneE164)
  );
  const [activeSellerId, setActiveSellerId] = useState<string>(
    resolvedAuthenticatedSeller?.id ||
      authenticatedUser?.sellerId ||
      sellers[0]?.id ||
      'seller-1'
  );

  const [activeSection, setActiveSection] = useState<
    | 'home'
    | 'orders'
    | 'notifications'
    | 'products'
    | 'add-product'
    | 'my-store'
    | 'store-hours'
    | 'billing'
    | 'admin-revenue'
    | 'admin-locations'
    | 'onboarding'
    | 'settings'
  >(mode === 'ONBOARDING_ONLY' ? 'onboarding' : initialSection);

  const [sellerOrderFilter, setSellerOrderFilter] = useState<'ALL' | 'NEW' | 'PREPARING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [showAdvancedProductFields, setShowAdvancedProductFields] =
    useState<boolean>(false);

  const [draft, setDraft] = useState<DraftProductState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<DraftProductState>;
          const resolvedCat = getCategoryByIdOrName(
            parsed.categoryId || parsed.category
          );
          return {
            ...DEFAULT_DRAFT,
            ...parsed,
            categoryId: resolvedCat.id,
            category: resolvedCat.name,
          };
        }
      } catch {
        // Ignore storage access errors
      }
    }
    return DEFAULT_DRAFT;
  });

  const [lastSavedAt, setLastSavedAt] = useState<string>(
    'Draft saved automatically'
  );
  const [publishBanner, setPublishBanner] = useState<string | null>(null);
  const [demoSyncStatus, setDemoSyncStatus] = useState<string | null>(null);
  const [isSyncingDemo, setIsSyncingDemo] = useState<boolean>(false);

  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [isPublishingProduct, setIsPublishingProduct] = useState<boolean>(false);
  const [isSubmittingOnboarding, setIsSubmittingOnboarding] = useState<boolean>(false);

  const handleSeedNandedDemo = async () => {
    setIsSyncingDemo(true);
    setDemoSyncStatus(null);
    try {
      const res = await fetch('/api/admin/seed-nanded-demo', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'seed'}),
      });
      const data = await res.json();
      if (data.ok) {
        setDemoSyncStatus(
          `Seeded ${data.storesWritten} Nanded demo stores and ${data.productsWritten} Nanded demo products into Firestore (urbandirectintracity).`
        );
      } else {
        setDemoSyncStatus(`Error: ${data.error || 'Could not seed demo data'}`);
      }
    } catch {
      setDemoSyncStatus('Network error while communicating with Firestore seeder.');
    } finally {
      setIsSyncingDemo(false);
    }
  };

  const handleRemoveNandedDemo = async () => {
    setIsSyncingDemo(true);
    setDemoSyncStatus(null);
    try {
      const res = await fetch('/api/admin/seed-nanded-demo', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'remove'}),
      });
      const data = await res.json();
      if (data.ok) {
        setDemoSyncStatus(
          `Removed ${data.storesRemoved} Nanded demo stores and ${data.productsRemoved} Nanded demo products (batch: ${data.demoBatchId}) from Firestore.`
        );
      } else {
        setDemoSyncStatus(`Error: ${data.error || 'Could not remove demo data'}`);
      }
    } catch {
      setDemoSyncStatus('Network error while removing demo batch.');
    } finally {
      setIsSyncingDemo(false);
    }
  };

  const isAdmin =
    workspaceRole === 'PLATFORM_ADMIN' &&
    Boolean(authenticatedUser?.roles.includes('ADMIN'));
  const activeSeller =
    sellers.find((s) => s.id === activeSellerId) || sellers[0];

  const authorizedStores = isAdmin
    ? stores
    : stores.filter((s) => s.sellerId === activeSellerId);

  const primarySellerStore = authorizedStores[0] || stores[0];

  const authorizedProducts = isAdmin
    ? products
    : products.filter((p) => p.sellerId === activeSellerId);

  const authorizedOrders = isAdmin
    ? orders
    : orders.filter((o) => o.sellerId === activeSellerId);

  // Store Details Editor State
  const [settingsName, setSettingsName] = useState<string>(
    primarySellerStore?.name || ''
  );
  const [settingsSpecialty, setSettingsSpecialty] = useState<string>(
    primarySellerStore?.specialty || ''
  );
  const [settingsCategoryId, setSettingsCategoryId] = useState<StoreCategoryId>(
    primarySellerStore?.categoryId || 'cat-01-grocery-daily-essentials'
  );
  const [settingsCountry, setSettingsCountry] = useState<string>(
    primarySellerStore?.country || 'India'
  );
  const [settingsCountryCode, setSettingsCountryCode] = useState<string>(
    primarySellerStore?.countryCode || 'IN'
  );
  const [settingsStateRegion, setSettingsStateRegion] = useState<string>(
    primarySellerStore?.stateRegion || ''
  );
  const [settingsDistrict, setSettingsDistrict] = useState<string>(
    primarySellerStore?.district || ''
  );
  const [settingsLocalityType, setSettingsLocalityType] =
    useState<LocalityClassification>(
      primarySellerStore?.localityType || 'CITY'
    );
  const [settingsCityName, setSettingsCityName] = useState<string>(
    primarySellerStore?.cityName || ''
  );
  const [settingsNeighborhood, setSettingsNeighborhood] = useState<string>(
    primarySellerStore?.neighborhood || ''
  );
  const [settingsPostalCode, setSettingsPostalCode] = useState<string>(
    primarySellerStore?.postalCode || ''
  );
  const [settingsAddress, setSettingsAddress] = useState<string>(
    primarySellerStore?.address || ''
  );
  const [settingsLat, setSettingsLat] = useState<string>(
    primarySellerStore?.coordinates
      ? String(primarySellerStore.coordinates.lat)
      : ''
  );
  const [settingsLng, setSettingsLng] = useState<string>(
    primarySellerStore?.coordinates
      ? String(primarySellerStore.coordinates.lng)
      : ''
  );
  const [settingsLocationSource, setSettingsLocationSource] =
    useState<LocationDataSource>(
      primarySellerStore?.locationSource || 'VERIFIED_DIRECTORY'
    );
  const [settingsVerificationStatus, setSettingsVerificationStatus] =
    useState<LocationVerificationStatus>(
      primarySellerStore?.verificationStatus || 'VERIFIED'
    );
  const [settingsOperatingHours, setSettingsOperatingHours] = useState<string>(
    primarySellerStore?.operatingHours || '9:00 AM – 8:00 PM'
  );
  const [settingsScopeType, setSettingsScopeType] = useState<DeliveryScopeType>(
    primarySellerStore?.serviceArea.scopeType || 'CUSTOM_LOCALITIES'
  );
  const [settingsLocalitiesRaw, setSettingsLocalitiesRaw] = useState<string>(
    primarySellerStore?.serviceArea.coveredLocalities.join(', ') || ''
  );
  const [settingsRadiusKm, setSettingsRadiusKm] = useState<string>(
    String(primarySellerStore?.serviceArea.maxRadiusKm || 5)
  );
  const [settingsFulfillmentNote, setSettingsFulfillmentNote] =
    useState<string>(primarySellerStore?.serviceArea.fulfillmentNote || '');
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  // Store Deletion Danger Zone State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingStore, setIsDeletingStore] = useState<boolean>(false);

  const isOwnerOfCurrentStore = Boolean(
    (primarySellerStore && userOwnedStores?.some((s) => s.id === primarySellerStore.id)) ||
    (primarySellerStore?.ownerUid && authenticatedUser?.uid === primarySellerStore.ownerUid) ||
    (primarySellerStore?.sellerId && authenticatedUser?.sellerId === primarySellerStore.sellerId) ||
    isAdmin
  );

  const handleExecuteStoreDeletion = async () => {
    if (!primarySellerStore) return;
    if (deleteConfirmationInput.trim() !== primarySellerStore.name.trim()) {
      setDeleteError(`Please type "${primarySellerStore.name}" exactly to confirm.`);
      return;
    }

    setIsDeletingStore(true);
    setDeleteError(null);

    try {
      const deleteFn = onDeleteStore || providerHandleDeleteStore;
      if (!deleteFn) {
        setDeleteError('Store deletion capability is not available.');
        setIsDeletingStore(false);
        return;
      }

      const result = await deleteFn(primarySellerStore.id, deleteConfirmationInput.trim());
      if (!result.success) {
        setDeleteError(result.message || 'Failed to delete store.');
        setIsDeletingStore(false);
        return;
      }

      // Deletion successful
      setIsDeleteDialogOpen(false);
      setDeleteConfirmationInput('');
      setActiveSection('onboarding');
      if (onBackToShopping) {
        setTimeout(() => {
          onBackToShopping();
        }, 1200);
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete store.');
    } finally {
      setIsDeletingStore(false);
    }
  };

  const renderStoreDeletionDangerZone = () => {
    if (!isOwnerOfCurrentStore || !primarySellerStore) return null;

    const storeProductsCount = authorizedProducts.filter(
      (p) => p.storeId === primarySellerStore.id
    ).length;

    return (
      <div className="p-6 rounded-2xl bg-rose-50/70 border border-rose-200/90 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-rose-950">
              Danger Zone: Permanently Delete Store &amp; Remove All Products
            </h4>
            <p className="text-xs text-rose-900/80 leading-relaxed">
              Permanently remove <strong>{primarySellerStore.name}</strong> from Citykart worldwide.
              All listed products ({storeProductsCount} items) will be instantly erased from buyer discovery,
              category browsing, search indexes, and active carts globally.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white/80 border border-rose-200 text-xs text-rose-950 space-y-2">
          <div className="font-semibold text-rose-900">
            What happens when you delete this store:
          </div>
          <ul className="space-y-1.5 list-disc list-inside text-rose-800/90 pl-1">
            <li>
              The store storefront at{' '}
              <code className="font-mono text-[11px] bg-rose-100/70 px-1 py-0.5 rounded">
                /stores/{primarySellerStore.id}
              </code>{' '}
              will permanently return 404 Not Found.
            </li>
            <li>
              All products belonging to this store will disappear globally across all countries, states, and city discovery pages.
            </li>
            <li>
              Customers will no longer be able to find, browse, or purchase any of these products.
            </li>
            <li>
              Store-specific images, logos, banners, and files will be permanently deleted where safe to remove.
            </li>
            <li>
              <strong>Historical orders &amp; financial records:</strong> Existing orders, payment records, invoices, disputes, and tax receipts are strictly preserved as required by law.
            </li>
            <li>
              <strong>Permanent and irreversible:</strong> This action cannot be easily undone or restored once confirmed.
            </li>
          </ul>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-rose-700 font-medium">
            Store ID: <span className="font-mono">{primarySellerStore.id}</span> · Location:{' '}
            {primarySellerStore.cityName}, {primarySellerStore.stateRegion || primarySellerStore.country}
          </div>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmationInput('');
              setDeleteError(null);
              setIsDeleteDialogOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Store Permanently</span>
          </button>
        </div>
      </div>
    );
  };



  const syncSellerStoreSettings = (targetSellerId: string) => {
    const sellerStore =
      stores.find((s) => s.sellerId === targetSellerId) || stores[0];
    if (sellerStore) {
      setSettingsName(sellerStore.name);
      setSettingsSpecialty(sellerStore.specialty);
      setSettingsCategoryId(sellerStore.categoryId);
      setSettingsCountry(sellerStore.country);
      setSettingsCountryCode(sellerStore.countryCode || '');
      setSettingsStateRegion(sellerStore.stateRegion);
      setSettingsDistrict(sellerStore.district || '');
      setSettingsLocalityType(sellerStore.localityType || 'CITY');
      setSettingsCityName(sellerStore.cityName);
      setSettingsNeighborhood(sellerStore.neighborhood);
      setSettingsPostalCode(sellerStore.postalCode || '');
      setSettingsAddress(sellerStore.address);
      setSettingsLat(
        sellerStore.coordinates ? String(sellerStore.coordinates.lat) : ''
      );
      setSettingsLng(
        sellerStore.coordinates ? String(sellerStore.coordinates.lng) : ''
      );
      setSettingsLocationSource(
        sellerStore.locationSource || 'VERIFIED_DIRECTORY'
      );
      setSettingsVerificationStatus(
        sellerStore.verificationStatus || 'VERIFIED'
      );
      setSettingsOperatingHours(sellerStore.operatingHours);
      setSettingsScopeType(sellerStore.serviceArea.scopeType);
      setSettingsLocalitiesRaw(
        sellerStore.serviceArea.coveredLocalities.join(', ')
      );
      setSettingsRadiusKm(String(sellerStore.serviceArea.maxRadiusKm));
      setSettingsFulfillmentNote(sellerStore.serviceArea.fulfillmentNote);
      setDraft((prev) => ({...prev, storeId: sellerStore.id}));
    }
  };

  // Guided 6-Step Seller Onboarding Wizard State (Mobile OTP Only — No Email/Password)
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [newOwnerName, setNewOwnerName] = useState(
    authenticatedUser?.fullName || ''
  );
  const [newOwnerPhone, setNewOwnerPhone] = useState(
    authenticatedUser?.phoneE164 || ''
  );
  const [storeName, setStoreName] = useState('');
  const [storeCategoryId, setStoreCategoryId] = useState<StoreCategoryId>(
    'cat-01-grocery-daily-essentials'
  );
  const [storeSpecialty, setStoreSpecialty] = useState('');
  const [storeCountry, setStoreCountry] = useState('India');
  const [storeCountryCode, setStoreCountryCode] = useState('IN');
  const [storeStateRegion, setStoreStateRegion] = useState('');
  const [storeDistrict, setStoreDistrict] = useState('');
  const [storeLocalityType, setStoreLocalityType] =
    useState<LocalityClassification>('CITY');
  const [storeCityName, setStoreCityName] = useState('');
  const [storeNeighborhood, setStoreNeighborhood] = useState('');
  const [storePostalCode, setStorePostalCode] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeLat, setStoreLat] = useState('');
  const [storeLng, setStoreLng] = useState('');
  const [storeLocationSource, setStoreLocationSource] =
    useState<LocationDataSource>('USER_PROVIDED');
  const [storeScopeType, setStoreScopeType] =
    useState<DeliveryScopeType>('CUSTOM_LOCALITIES');
  const [storeCoveredLocalities, setStoreCoveredLocalities] = useState('');
  const [storeRadiusKm, setStoreRadiusKm] = useState('6');
  const [storeOperatingHours, setStoreOperatingHours] =
    useState('9:00 AM – 9:00 PM');
  const [storeDispatchMins, setStoreDispatchMins] = useState('30');
  const [storeUpi, setStoreUpi] = useState('');

  // Worldwide Place Search State for Seller Store Location (Onboarding & My Store)
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<
    GlobalCityRecord[]
  >([]);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);
  const [hasSearchedLocationOnce, setHasSearchedLocationOnce] = useState(false);
  const [manualLocationMode, setManualLocationMode] = useState(false);

  const handleSearchWorldwideLocation = async (
    queryText: string,
    countryFilter?: string
  ) => {
    setLocationSearchQuery(queryText);
    const trimmed = queryText.trim();
    if (trimmed.length < 2) {
      setLocationSearchResults([]);
      setHasSearchedLocationOnce(false);
      return;
    }

    setIsSearchingLocations(true);
    try {
      const params = new URLSearchParams({q: trimmed});
      if (countryFilter) {
        params.set('country', countryFilter);
      }
      const res = await fetch(`/api/location/search?${params.toString()}`);
      const data = (await res.json()) as {results?: GlobalCityRecord[]};
      setLocationSearchResults(data.results || []);
      setHasSearchedLocationOnce(true);
    } catch {
      setLocationSearchResults([]);
      setHasSearchedLocationOnce(true);
    } finally {
      setIsSearchingLocations(false);
    }
  };

  const applySuggestedLocationToOnboarding = (loc: GlobalCityRecord) => {
    setStoreCountry(loc.country);
    setStoreCountryCode(loc.countryCode || '');
    setStoreStateRegion(loc.stateRegion);
    setStoreDistrict(loc.district || '');
    setStoreLocalityType(loc.localityType || 'CITY');
    setStoreCityName(loc.cityName);
    if (!storeNeighborhood.trim() && loc.defaultLocality) {
      setStoreNeighborhood(loc.defaultLocality);
    }
    if (loc.postalCodes && loc.postalCodes.length > 0 && !storePostalCode) {
      setStorePostalCode(loc.postalCodes[0]);
    }
    setStoreLat(String(loc.coordinates.lat));
    setStoreLng(String(loc.coordinates.lng));
    setStoreLocationSource(loc.locationSource || 'VERIFIED_DIRECTORY');
    setLocationSearchResults([]);
    setLocationSearchQuery('');
    setHasSearchedLocationOnce(false);
  };

  const applySuggestedLocationToSettings = (loc: GlobalCityRecord) => {
    setSettingsCountry(loc.country);
    setSettingsCountryCode(loc.countryCode || '');
    setSettingsStateRegion(loc.stateRegion);
    setSettingsDistrict(loc.district || '');
    setSettingsLocalityType(loc.localityType || 'CITY');
    setSettingsCityName(loc.cityName);
    if (!settingsNeighborhood.trim() && loc.defaultLocality) {
      setSettingsNeighborhood(loc.defaultLocality);
    }
    if (loc.postalCodes && loc.postalCodes.length > 0 && !settingsPostalCode) {
      setSettingsPostalCode(loc.postalCodes[0]);
    }
    setSettingsLat(String(loc.coordinates.lat));
    setSettingsLng(String(loc.coordinates.lng));
    setSettingsLocationSource(loc.locationSource || 'VERIFIED_DIRECTORY');
    setSettingsVerificationStatus('VERIFIED');
    setLocationSearchResults([]);
    setLocationSearchQuery('');
    setHasSearchedLocationOnce(false);
  };

  const handleDetectStoreCoordinates = (target: 'onboarding' | 'settings') => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latStr = pos.coords.latitude.toFixed(5);
        const lngStr = pos.coords.longitude.toFixed(5);
        if (target === 'onboarding') {
          setStoreLat(latStr);
          setStoreLng(lngStr);
        } else {
          setSettingsLat(latStr);
          setSettingsLng(lngStr);
        }
      },
      () => {
        // Ignore geolocation denial; manual entry remains available
      },
      {enableHighAccuracy: false, timeout: 8000}
    );
  };

  const onboardingCountryMeta =
    getCountryRecordByCodeOrName(storeCountryCode || storeCountry) ||
    INTERNATIONAL_COUNTRIES[0];
  const settingsCountryMeta =
    getCountryRecordByCodeOrName(settingsCountryCode || settingsCountry) ||
    INTERNATIONAL_COUNTRIES[0];

  const updateDraftField = <K extends keyof DraftProductState>(
    field: K,
    value: DraftProductState[K]
  ) => {
    setDraft((prev) => {
      const next = {...prev, [field]: value};
      if (field === 'categoryId') {
        const catDef = getCategoryByIdOrName(String(value));
        next.categoryId = catDef.id;
        next.category = catDef.name;
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        const timeStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        setLastSavedAt(`Saved at ${timeStr}`);
      } catch {
        // Ignore quota errors
      }
      return next;
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploadError(null);

    // Validate file size (Max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setImageUploadError('Image file exceeds 5 MB. Please choose a smaller photo.');
      return;
    }

    // Validate image format
    const validFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!validFormats.includes(file.type)) {
      setImageUploadError('Unsupported file type. Please upload a JPG, PNG, WEBP, or SVG photo.');
      return;
    }

    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateDraftField('customImageUrl', reader.result);
      }
      setIsUploadingImage(false);
    };
    reader.onerror = () => {
      setImageUploadError('Could not read image file. Please try selecting a different photo.');
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleClearCustomImage = () => {
    updateDraftField('customImageUrl', '');
    setImageUploadError(null);
  };

  const handleResetDraft = () => {
    const targetStoreId = primarySellerStore?.id || DEFAULT_DRAFT.storeId;
    const nextDraft = {...DEFAULT_DRAFT, storeId: targetStoreId};
    setDraft(nextDraft);
    setImageUploadError(null);
    setProductFormError(null);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDraft));
      setLastSavedAt('Sample product loaded');
    } catch {
      // Ignore
    }
  };

  const selectedStore =
    authorizedStores.find((s) => s.id === draft.storeId) || primarySellerStore;

  const handlePublishProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setProductFormError(null);

    if (!draft.name.trim()) {
      setProductFormError('Please enter a product name.');
      return;
    }
    if (!selectedStore) {
      setProductFormError('No active store selected for this product.');
      return;
    }
    if (!isAdmin && selectedStore.sellerId !== activeSellerId) {
      setProductFormError('You are not authorized to add products to this store.');
      return;
    }

    const numPrice = Number(draft.price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setProductFormError('Product price must be a positive amount in INR (₹).');
      return;
    }

    const numStock = Number(draft.stock);
    if (isNaN(numStock) || numStock < 0) {
      setProductFormError('Available stock quantity cannot be negative.');
      return;
    }

    setIsPublishingProduct(true);
    try {
      const parsedPrice = Math.max(1, numPrice);
      const parsedStock = Math.max(0, numStock);
      const parsedDelivery = Math.max(10, Number(draft.deliveryMins) || 30);
      const variantsList = draft.variantsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const catDef = getCategoryByIdOrName(draft.categoryId || draft.category);

      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        sellerId: selectedStore.sellerId,
        storeId: selectedStore.id,
        storeName: selectedStore.name,
        sku:
          draft.sku.trim() || `UD-ITEM-${Math.floor(100 + Math.random() * 899)}`,
        name: draft.name.trim(),
        categoryId: catDef.id,
        category: catDef.name,
        price: parsedPrice,
        city: selectedStore.city,
        neighborhood: selectedStore.neighborhood,
        distanceKm: 1.5,
        deliveryMins: parsedDelivery,
        stock: parsedStock,
        isAvailable: parsedStock > 0,
        rating: 5.0,
        reviewsCount: 1,
        description:
          draft.description.trim() ||
          `Available from ${selectedStore.name} with local delivery.`,
        dimensions: draft.dimensions.trim() || 'Standard size',
        materials: draft.materials.trim() || 'Local store item',
        variants: variantsList.length > 0 ? variantsList : ['Standard'],
        statusNote: parsedStock > 0 ? 'In stock' : 'Out of stock',
        artworkPreset: draft.artworkPreset,
        customImageUrl: draft.customImageUrl || undefined,
      };

      onAddProduct(newProduct);
      setPublishBanner(
        `Product added successfully. "${newProduct.name}" is now available in your store.`
      );
      setActiveSection('products');
      setTimeout(() => setPublishBanner(null), 5000);
    } catch {
      setProductFormError('Failed to publish product. Please check your inputs and try again.');
    } finally {
      setIsPublishingProduct(false);
    }
  };

  const handleSaveStoreSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!primarySellerStore) return;
    if (!isAdmin && primarySellerStore.sellerId !== activeSellerId) return;

    const catDef = getCategoryByIdOrName(settingsCategoryId);
    const coveredList = settingsLocalitiesRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const nextCountry = settingsCountry.trim();
    const nextStateRegion = settingsStateRegion.trim() || nextCountry;
    const nextDistrict = settingsDistrict.trim() || undefined;
    const nextCityName = settingsCityName.trim();
    const nextNeighborhood =
      settingsNeighborhood.trim() || primarySellerStore.neighborhood;
    const nextPostalCode = settingsPostalCode.trim() || undefined;
    const nextAddress = settingsAddress.trim();
    const nextCityId =
      nextCountry && nextCityName
        ? normalizeCityId(nextCountry, nextStateRegion, nextCityName, nextDistrict)
        : '';

    const parsedLat = Number(settingsLat);
    const parsedLng = Number(settingsLng);
    const hasCoords =
      settingsLat.trim() !== '' &&
      settingsLng.trim() !== '' &&
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLng);

    const isComplete = Boolean(nextCountry && nextCityName && nextAddress);
    const resolvedVerificationStatus: LocationVerificationStatus = !isComplete
      ? 'INCOMPLETE'
      : settingsLocationSource === 'USER_PROVIDED'
        ? 'USER_PROVIDED_UNVERIFIED'
        : settingsVerificationStatus === 'INCOMPLETE'
          ? 'VERIFIED'
          : settingsVerificationStatus;

    const updated: LocalStore = {
      ...primarySellerStore,
      name: settingsName.trim() || primarySellerStore.name,
      specialty: settingsSpecialty.trim() || catDef.name,
      categoryId: catDef.id,
      category: catDef.name,
      country: nextCountry,
      countryCode: settingsCountryCode || settingsCountryMeta.code,
      stateRegion: nextStateRegion,
      district: nextDistrict,
      localityType: settingsLocalityType,
      cityId: nextCityId,
      cityName: nextCityName,
      servedCityIds: nextCityId ? [nextCityId] : [],
      city:
        nextCityName && nextNeighborhood
          ? `${nextCityName} · ${nextNeighborhood}`
          : nextCityName,
      neighborhood: nextNeighborhood,
      postalCode: nextPostalCode,
      address: nextAddress,
      coordinates: hasCoords ? {lat: parsedLat, lng: parsedLng} : undefined,
      locationVerified: isComplete,
      locationSource: settingsLocationSource,
      verificationStatus: resolvedVerificationStatus,
      operatingHours: settingsOperatingHours.trim() || '9:00 AM – 8:00 PM',
      serviceArea: {
        ...primarySellerStore.serviceArea,
        scopeType: settingsScopeType,
        coveredLocalities:
          coveredList.length > 0
            ? coveredList
            : [nextNeighborhood, nextCityName].filter(Boolean),
        maxRadiusKm: Math.max(1, Number(settingsRadiusKm) || 5),
        fulfillmentNote:
          settingsFulfillmentNote.trim() ||
          'Delivered directly by our store within our delivery areas',
      },
    };

    onUpdateStoreSettings(updated);
    setSettingsSavedMsg('Your store details and delivery areas have been saved.');
    setTimeout(() => setSettingsSavedMsg(null), 4000);
  };

  // Guided Onboarding Step Validation (Mobile OTP-only; no email/password)
  const effectiveOwnerName =
    newOwnerName.trim() || authenticatedUser?.fullName || '';
  const effectiveOwnerPhone =
    authenticatedUser?.phoneE164 || newOwnerPhone.trim();

  const handleNextOnboardingStep = () => {
    setOnboardingError(null);
    if (onboardingStep === 1) {
      if (!effectiveOwnerName || !effectiveOwnerPhone) {
        setOnboardingError(
          'Please enter your full name and verified mobile number to continue.'
        );
        return;
      }
    } else if (onboardingStep === 2) {
      if (!storeName.trim()) {
        setOnboardingError('Please enter your store name to continue.');
        return;
      }
    } else if (onboardingStep === 3) {
      if (
        !storeCountry.trim() ||
        !storeCityName.trim() ||
        !storeAddress.trim()
      ) {
        setOnboardingError(
          'Please enter your country, city/town/village, and street address.'
        );
        return;
      }
    }
    setOnboardingStep((s) => Math.min(6, s + 1));
  };

  const handleFinishStoreOnboarding = async (goToAddProduct: boolean) => {
    setIsSubmittingOnboarding(true);
    try {
      const catDef = getCategoryByIdOrName(storeCategoryId);
      const newSellerId = authenticatedUser?.sellerId || `seller-${Date.now()}`;
      const newStoreId = `store-${Date.now()}`;
      const resolvedNeighborhood =
        storeNeighborhood.trim() || storeCityName.trim();
      const cityHubLabel = `${storeCityName.trim()} · ${resolvedNeighborhood}`;

      const coveredList = storeCoveredLocalities
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const newSeller: SellerProfile = {
        id: newSellerId,
        businessOwnerName: effectiveOwnerName || `${storeName.trim()} Owner`,
        phoneE164: effectiveOwnerPhone || '+919820000000',
        phoneCountryCode: onboardingCountryMeta.code,
        phoneVerified: true,
        role: 'SELLER',
        storeIds: [newStoreId],
      };

      const resolvedState = storeStateRegion.trim() || storeCountry.trim();
      const resolvedDistrict = storeDistrict.trim() || undefined;
      const resolvedCityId = normalizeCityId(
        storeCountry.trim(),
        resolvedState,
        storeCityName.trim(),
        resolvedDistrict
      );
      const parsedLat = Number(storeLat);
      const parsedLng = Number(storeLng);
      const hasCoords =
        storeLat.trim() !== '' &&
        storeLng.trim() !== '' &&
        Number.isFinite(parsedLat) &&
        Number.isFinite(parsedLng);

      const isManualEntry = storeLocationSource === 'USER_PROVIDED';

      const newStore: LocalStore = {
        id: newStoreId,
        sellerId: newSellerId,
        sellerName: newSeller.businessOwnerName,
        name: storeName.trim(),
        categoryId: catDef.id,
        category: catDef.name,
        country: storeCountry.trim(),
        countryCode: storeCountryCode || onboardingCountryMeta.code,
        stateRegion: resolvedState,
        district: resolvedDistrict,
        localityType: storeLocalityType,
        cityId: resolvedCityId,
        cityName: storeCityName.trim(),
        servedCityIds: [resolvedCityId],
        city: cityHubLabel,
        neighborhood: resolvedNeighborhood,
        postalCode: storePostalCode.trim() || undefined,
        address: storeAddress.trim(),
        coordinates: hasCoords ? {lat: parsedLat, lng: parsedLng} : undefined,
        locationVerified: Boolean(
          storeCountry.trim() && storeCityName.trim() && storeAddress.trim()
        ),
        locationSource: storeLocationSource,
        verificationStatus: isManualEntry
          ? 'USER_PROVIDED_UNVERIFIED'
          : 'VERIFIED',
        operatingHours: storeOperatingHours.trim() || '9:00 AM – 9:00 PM',
        avgDispatchMins: Math.max(10, Number(storeDispatchMins) || 30),
        rating: 5.0,
        verifiedSince: '2026',
        specialty: storeSpecialty.trim() || catDef.name,
        upiHandle: storeUpi.trim() || 'Pay on delivery',
        activeSkus: 0,
        isActive: true,
        serviceArea: {
          scopeType: storeScopeType,
          coveredLocalities:
            coveredList.length > 0
              ? coveredList
              : [resolvedNeighborhood, storeCityName.trim()],
          maxRadiusKm: Math.max(1, Number(storeRadiusKm) || 6),
          sellerDeliveryFee: 5,
          freeDeliveryAbove: 100,
          fulfillmentNote: `Delivered by ${storeName.trim()} across ${
            coveredList.length > 0
              ? coveredList.join(', ')
              : resolvedNeighborhood
          }`,
        },
      };

      await onAddSellerAndStore(newSeller, newStore);
      setActiveSellerId(newSeller.id);
      setSettingsName(newStore.name);
      setSettingsSpecialty(newStore.specialty);
      setSettingsCategoryId(newStore.categoryId);
      setSettingsCountry(newStore.country);
      setSettingsCountryCode(newStore.countryCode || '');
      setSettingsStateRegion(newStore.stateRegion);
      setSettingsDistrict(newStore.district || '');
      setSettingsLocalityType(newStore.localityType || 'CITY');
      setSettingsCityName(newStore.cityName);
      setSettingsNeighborhood(newStore.neighborhood);
      setSettingsPostalCode(newStore.postalCode || '');
      setSettingsAddress(newStore.address);
      setSettingsLat(
        newStore.coordinates ? String(newStore.coordinates.lat) : ''
      );
      setSettingsLng(
        newStore.coordinates ? String(newStore.coordinates.lng) : ''
      );
      setSettingsLocationSource(newStore.locationSource || 'USER_PROVIDED');
      setSettingsVerificationStatus(
        newStore.verificationStatus || 'USER_PROVIDED_UNVERIFIED'
      );
      setSettingsOperatingHours(newStore.operatingHours);
      setSettingsLocalitiesRaw(newStore.serviceArea.coveredLocalities.join(', '));
      updateDraftField('storeId', newStore.id);
      updateDraftField('categoryId', newStore.categoryId);

      setPublishBanner(
        `Welcome! "${newStore.name}" is now open in ${newStore.cityName}, ${newStore.country}.`
      );
      setOnboardingStep(1);
      if (onOnboardingComplete) {
        onOnboardingComplete(newStore, goToAddProduct);
      } else {
        setActiveSection(goToAddProduct ? 'add-product' : 'home');
      }
    } finally {
      setIsSubmittingOnboarding(false);
    }
  };

  // Dashboard Summary Counts (from actual store data)
  const newOrdersCount = authorizedOrders.filter(
    (o) => o.currentStepIndex === 0
  ).length;
  const activeDeliveryOrdersCount = authorizedOrders.filter(
    (o) => o.currentStepIndex === 1 || o.currentStepIndex === 2
  ).length;
  const outOfStockProducts = authorizedProducts.filter(
    (p) => !p.isAvailable || p.stock <= 0
  );

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
      {/* Top Bar of Seller Dashboard / Store Setup */}
      <div className="px-6 py-4 bg-[#FAF9F6] border-b border-stone-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-stone-500">
              {mode === 'ONBOARDING_ONLY'
                ? 'New Store Registration'
                : 'Seller Dashboard'}
            </div>
            <h2 className="text-base font-semibold text-stone-900">
              {mode === 'ONBOARDING_ONLY'
                ? 'Open your store on Citykart'
                : isAdmin
                  ? 'All Stores & Categories (Admin)'
                  : primarySellerStore?.name || 'Your Local Store'}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {mode === 'DASHBOARD' && authenticatedUser?.roles.includes('ADMIN') && (
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="seller-switcher" className="text-stone-600">
                Store account:
              </label>
              <select
                id="seller-switcher"
                value={isAdmin ? 'ADMIN' : activeSellerId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'ADMIN') {
                    setWorkspaceRole('PLATFORM_ADMIN');
                  } else {
                    setWorkspaceRole('SELLER');
                    setActiveSellerId(val);
                    syncSellerStoreSettings(val);
                  }
                }}
                className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900"
              >
                {sellers.map((seller) => {
                  const st = stores.find((s) => s.sellerId === seller.id);
                  return (
                    <option key={seller.id} value={seller.id}>
                      {st?.name} ({st?.cityName || 'Unverified location'}) —{' '}
                      {seller.businessOwnerName} ({seller.phoneE164})
                    </option>
                  );
                })}
                <option value="ADMIN">
                  Platform Administrator (All Stores)
                </option>
              </select>
            </div>
          )}

          {authenticatedUser && (
            <div className="px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-300 rounded-lg inline-flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-700" />
              <span className="font-mono">{authenticatedUser.phoneE164}</span>
            </div>
          )}

          {onBackToShopping && (
            <button
              type="button"
              onClick={onBackToShopping}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            >
              ← Back to shopping
            </button>
          )}
        </div>
      </div>

      {/* Legacy Account Mobile OTP Migration Alert */}
      {mode === 'DASHBOARD' &&
        activeSeller?.migrationRequired &&
        !activeSeller.phoneVerified && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Mobile OTP verification required:</strong> This legacy
                store account must link and verify a mobile phone number via OTP
                to publish updates.
              </span>
            </div>
            {onOpenAuthModal && (
              <button
                type="button"
                onClick={() =>
                  onOpenAuthModal({
                    requireSellerOnboarding: true,
                    legacySellerId: activeSeller.id,
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-amber-900 text-white font-medium cursor-pointer shrink-0"
              >
                Verify mobile number with OTP
              </button>
            )}
          </div>
        )}

      {/* Main Layout: Clear Left Sidebar on Desktop (in DASHBOARD mode) + Content Area */}
      <div
        className={
          mode === 'ONBOARDING_ONLY'
            ? 'p-6 sm:p-8'
            : 'grid grid-cols-1 lg:grid-cols-12 min-h-[580px]'
        }
      >
        {/* Left Navigation Sidebar (Shown in DASHBOARD mode) */}
        {mode === 'DASHBOARD' && (
          <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-stone-200 bg-[#FAF9F6]/60 p-4">
            <nav
              aria-label="Store management navigation"
              className="flex lg:flex-col gap-1 overflow-x-auto"
            >
              {[
                {id: 'home', label: 'Home', icon: Home},
                {
                  id: 'orders',
                  label: `Orders (${authorizedOrders.length})`,
                  icon: ShoppingBag,
                },
                {
                  id: 'notifications',
                  label: unreadNotificationCount > 0 ? `Notifications (${unreadNotificationCount})` : 'Notifications',
                  icon: Bell,
                  hasBadge: unreadNotificationCount > 0,
                },
                {
                  id: 'products',
                  label: `Products (${authorizedProducts.length})`,
                  icon: Package,
                },
                {
                  id: 'billing',
                  label: 'Plans & Billing',
                  icon: CreditCard,
                },
                ...(isAdmin
                  ? [
                      {
                        id: 'admin-revenue',
                        label: 'Platform Revenue',
                        icon: TrendingUp,
                      },
                      {
                        id: 'admin-locations',
                        label: 'Global Locations',
                        icon: Globe,
                      },
                    ]
                  : []),
                {id: 'my-store', label: 'My Store', icon: Store},
                {id: 'store-hours', label: 'Store Hours', icon: Clock},
                {id: 'settings', label: 'Settings', icon: Settings},
              ].map((item) => {
                const Icon = item.icon;
                const isCurrent =
                  activeSection === item.id ||
                  (item.id === 'products' && activeSection === 'add-product');
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setActiveSection(
                        item.id as
                          | 'home'
                          | 'orders'
                          | 'notifications'
                          | 'products'
                          | 'my-store'
                          | 'store-hours'
                          | 'billing'
                          | 'admin-revenue'
                          | 'admin-locations'
                          | 'settings'
                      )
                    }
                    className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isCurrent
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-700 hover:bg-stone-200/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    {item.hasBadge && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Quick Primary Action inside Sidebar */}
            <div className="hidden lg:block mt-6 pt-6 border-t border-stone-200 space-y-2">
              <button
                type="button"
                onClick={() => setActiveSection('add-product')}
                className="w-full py-2.5 px-4 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add product</span>
              </button>
            </div>
          </aside>
        )}

        {/* Right Main Content Panel */}
        <div
          className={
            mode === 'ONBOARDING_ONLY'
              ? 'max-w-2xl mx-auto'
              : 'lg:col-span-9 p-6 sm:p-8'
          }
        >
          {publishBanner && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4 text-xs text-emerald-900">
              <div className="flex items-center gap-2 font-medium">
                <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{publishBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setPublishBanner(null)}
                className="text-emerald-800 underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* SECTION 1: SELLER DASHBOARD HOME */}
          {activeSection === 'home' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-stone-900">
                    Welcome back, {activeSeller?.businessOwnerName}
                  </h3>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Here is what is happening at{' '}
                    <strong>{primarySellerStore?.name}</strong> today.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSection('add-product')}
                  className="px-4 py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5 self-start cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add product</span>
                </button>
              </div>

              {/* Simple, Useful Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => setActiveSection('orders')}
                  className="p-4 rounded-xl bg-[#FAF9F6] border border-stone-200 text-left hover:border-stone-400 transition-colors cursor-pointer"
                >
                  <div className="text-xs text-stone-500">
                    New orders to prepare
                  </div>
                  <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-stone-900">
                    {newOrdersCount}
                  </div>
                  <div className="mt-2 text-xs text-stone-700 underline">
                    View orders →
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('orders')}
                  className="p-4 rounded-xl bg-[#FAF9F6] border border-stone-200 text-left hover:border-stone-400 transition-colors cursor-pointer"
                >
                  <div className="text-xs text-stone-500">
                    Being prepared or out for delivery
                  </div>
                  <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-stone-900">
                    {activeDeliveryOrdersCount}
                  </div>
                  <div className="mt-2 text-xs text-stone-700 underline">
                    Update delivery status →
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('orders')}
                  className="p-4 rounded-xl bg-[#FAF9F6] border border-stone-200 text-left hover:border-stone-400 transition-colors cursor-pointer"
                >
                  <div className="text-xs text-stone-500">Total orders</div>
                  <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-stone-900">
                    {authorizedOrders.length}
                  </div>
                  <div className="mt-2 text-xs text-stone-600">
                    Since store opened
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('products')}
                  className="p-4 rounded-xl bg-[#FAF9F6] border border-stone-200 text-left hover:border-stone-400 transition-colors cursor-pointer"
                >
                  <div className="text-xs text-stone-500">
                    Out of stock products
                  </div>
                  <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-stone-900">
                    {outOfStockProducts.length}
                  </div>
                  <div className="mt-2 text-xs text-stone-700 underline">
                    Manage products →
                  </div>
                </button>
              </div>

              {/* Store Status & Delivery Coverage Card */}
              {primarySellerStore && (
                <div className="p-5 rounded-xl bg-[#FAF9F6] border border-stone-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-stone-900">
                        Store status:{' '}
                        {primarySellerStore.isActive
                          ? 'Open for orders'
                          : 'Temporarily closed'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('my-store')}
                      className="text-xs font-medium text-stone-700 underline hover:text-stone-900 cursor-pointer"
                    >
                      Edit store details
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-stone-600 pt-2 border-t border-stone-200/80">
                    <div>
                      <span className="font-medium text-stone-900 block">
                        Category
                      </span>
                      <span>{primarySellerStore.category}</span>
                    </div>
                    <div>
                      <span className="font-medium text-stone-900 block">
                        Where you deliver
                      </span>
                      <span>
                        {primarySellerStore.cityName} (
                        {primarySellerStore.serviceArea.coveredLocalities.join(
                          ', '
                        )}
                        )
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-stone-900 block">
                        Opening hours
                      </span>
                      <span>{primarySellerStore.operatingHours}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Out of stock alert if any */}
              {outOfStockProducts.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      <strong>{outOfStockProducts.length} product(s)</strong>{' '}
                      are currently out of stock (
                      {outOfStockProducts.map((p) => p.name).join(', ')}).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('products')}
                    className="px-3 py-1.5 bg-amber-900 text-white rounded-md font-medium cursor-pointer shrink-0"
                  >
                    Update stock
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: ORDER MANAGEMENT */}
          {activeSection === 'orders' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-stone-900">
                    Customer orders
                  </h3>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Manage incoming orders, prepare items, track delivery progress, and update status.
                  </p>
                </div>

                {/* Seller Order Status Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {[
                    { id: 'ALL', label: `All (${authorizedOrders.length})` },
                    {
                      id: 'NEW',
                      label: `New (${
                        authorizedOrders.filter((o) => (o.orderStatus || 'NEW') === 'NEW')
                          .length
                      })`,
                    },
                    {
                      id: 'PREPARING',
                      label: `Preparing (${
                        authorizedOrders.filter((o) =>
                          ['CONFIRMED', 'PREPARING'].includes(o.orderStatus || '')
                        ).length
                      })`,
                    },
                    {
                      id: 'IN_TRANSIT',
                      label: `In Transit (${
                        authorizedOrders.filter(
                          (o) => o.orderStatus === 'OUT_FOR_DELIVERY'
                        ).length
                      })`,
                    },
                    {
                      id: 'COMPLETED',
                      label: `Completed (${
                        authorizedOrders.filter((o) => o.orderStatus === 'DELIVERED')
                          .length
                      })`,
                    },
                    {
                      id: 'CANCELLED',
                      label: `Cancelled / Rejected (${
                        authorizedOrders.filter((o) =>
                          ['CANCELLED', 'REJECTED'].includes(o.orderStatus || '')
                        ).length
                      })`,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSellerOrderFilter(tab.id as typeof sellerOrderFilter)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        sellerOrderFilter === tab.id
                          ? 'bg-stone-900 text-white shadow-xs'
                          : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const filtered = authorizedOrders.filter((ord) => {
                  const status = ord.orderStatus || 'NEW';
                  if (sellerOrderFilter === 'NEW') return status === 'NEW';
                  if (sellerOrderFilter === 'PREPARING')
                    return status === 'CONFIRMED' || status === 'PREPARING';
                  if (sellerOrderFilter === 'IN_TRANSIT')
                    return status === 'OUT_FOR_DELIVERY';
                  if (sellerOrderFilter === 'COMPLETED') return status === 'DELIVERED';
                  if (sellerOrderFilter === 'CANCELLED')
                    return status === 'CANCELLED' || status === 'REJECTED';
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-10 rounded-xl bg-[#FAF9F6] border border-stone-200 text-center">
                      <h4 className="text-sm font-semibold text-stone-900">
                        No orders in this view
                      </h4>
                      <p className="mt-1 text-xs text-stone-500">
                        {sellerOrderFilter === 'ALL'
                          ? 'When customers place an order from your store, it will appear here.'
                          : `No orders matching status "${sellerOrderFilter}".`}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {filtered.map((ord) => {
                      const status = ord.orderStatus || 'NEW';
                      const isNewOrder = status === 'NEW';
                      const isCancelled = status === 'CANCELLED' || status === 'REJECTED';

                      return (
                        <div
                          key={ord.id}
                          className={`p-5 rounded-xl border space-y-4 transition-all ${
                            isNewOrder
                              ? 'bg-amber-50/40 border-amber-300 ring-2 ring-amber-100'
                              : isCancelled
                              ? 'bg-stone-50 border-stone-200 opacity-80'
                              : 'bg-[#FAF9F6] border-stone-200'
                          }`}
                        >
                          {/* Order Header & Actions */}
                          <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-stone-200">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold font-mono text-stone-900 bg-stone-200 px-2 py-0.5 rounded">
                                  Order #{ord.id}
                                </span>
                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                  status === 'NEW'
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : status === 'CONFIRMED'
                                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                                    : status === 'PREPARING'
                                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                    : status === 'OUT_FOR_DELIVERY'
                                    ? 'bg-purple-100 text-purple-800 border-purple-300'
                                    : status === 'DELIVERED'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-red-100 text-red-800 border-red-300'
                                }`}>
                                  {status}
                                </span>
                                {ord.isDemo && (
                                  <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                    Demo Order
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-stone-600 mt-1">
                                Placed: {ord.createdAt} · Payment:{' '}
                                <strong className="text-stone-900">
                                  {formatCurrency(ord.total)}
                                </strong>{' '}
                                (
                                {ord.paymentMethod === 'UPI_ON_DELIVERY'
                                  ? 'UPI on Delivery'
                                  : ord.paymentMethod === 'CASH_ON_DELIVERY'
                                  ? 'Cash on Delivery'
                                  : 'Card tap'}
                                )
                              </div>
                            </div>

                            {/* Status Controller / Accept-Reject Controls */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {isNewOrder ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateOrderStep(ord.id, 1, 'CONFIRMED')
                                    }
                                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                                  >
                                    Accept Order
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRejectingOrderId(ord.id)}
                                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <select
                                  id={`status-${ord.id}`}
                                  value={status}
                                  disabled={isCancelled}
                                  onChange={(e) => {
                                    const val = e.target.value as OrderRecord['orderStatus'];
                                    const mappedStep =
                                      val === 'NEW' || val === 'CONFIRMED'
                                        ? 0
                                        : val === 'PREPARING'
                                        ? 1
                                        : val === 'OUT_FOR_DELIVERY'
                                        ? 2
                                        : 3;
                                    onUpdateOrderStep(ord.id, mappedStep, val);
                                  }}
                                  className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-stone-400"
                                >
                                  <option value="NEW">New</option>
                                  <option value="CONFIRMED">Confirmed</option>
                                  <option value="PREPARING">Preparing</option>
                                  <option value="OUT_FOR_DELIVERY">
                                    Out for delivery
                                  </option>
                                  <option value="DELIVERED">Delivered</option>
                                  <option value="CANCELLED">Cancelled</option>
                                  <option value="REJECTED">Rejected</option>
                                </select>
                              )}
                            </div>
                          </div>

                          {/* Customer & Items Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1 bg-white p-3 rounded-lg border border-stone-200">
                              <div className="font-bold text-stone-900 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-stone-500" />
                                Customer Address
                              </div>
                              <div className="font-semibold text-stone-800">
                                {ord.customer.fullName}
                              </div>
                              <div className="text-stone-600 inline-flex items-center gap-1 font-mono">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <a
                                  href={`tel:${ord.customer.phone}`}
                                  className="hover:underline text-emerald-800 font-bold"
                                >
                                  {ord.customer.phone}
                                </a>
                              </div>
                              <div className="text-stone-600">
                                {ord.customer.address}, {ord.customer.locality},{' '}
                                {ord.customer.city} — {ord.customer.postalCode}
                              </div>
                              {ord.customer.notes && (
                                <div className="text-amber-800 font-medium pt-1 border-t border-stone-100 mt-1">
                                  Delivery Note: &quot;{ord.customer.notes}&quot;
                                </div>
                              )}
                            </div>

                            <div className="space-y-1.5 bg-white p-3 rounded-lg border border-stone-200">
                              <div className="font-bold text-stone-900 flex items-center gap-1">
                                <Package className="w-3.5 h-3.5 text-stone-500" />
                                Items to Pack ({ord.items.reduce((s, i) => s + i.quantity, 0)})
                              </div>
                              <div className="divide-y divide-stone-100">
                                {ord.items.map((item, idx) => (
                                  <div
                                    key={`${item.product.id}-${idx}`}
                                    className="py-1 flex justify-between text-stone-700 text-xs"
                                  >
                                    <span>
                                      <strong>{item.quantity}×</strong> {item.product.name}{' '}
                                      <span className="text-stone-400">({item.variant})</span>
                                    </span>
                                    <span className="font-mono font-semibold">
                                      {formatCurrency(
                                        item.product.price * item.quantity,
                                        item.product.currency || 'INR'
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="pt-2 border-t border-stone-200 flex justify-between font-bold text-stone-900">
                                <span>Order Total</span>
                                <span>{formatCurrency(ord.total)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Order Reason Notes if Cancelled/Rejected */}
                          {(ord.cancellationReason || ord.rejectionReason) && (
                            <div className="p-3 bg-red-50 rounded-lg text-xs text-red-800 border border-red-200">
                              <strong>
                                {ord.orderStatus === 'REJECTED'
                                  ? 'Rejection Note'
                                  : 'Cancellation Note'}:
                              </strong>{' '}
                              {ord.rejectionReason || ord.cancellationReason}
                            </div>
                          )}

                          {/* Quick Workflow Action Button */}
                          {!isCancelled && status !== 'DELIVERED' && (
                            <div className="pt-2 border-t border-stone-200 flex items-center justify-end gap-2">
                              {status === 'CONFIRMED' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateOrderStep(ord.id, 1, 'PREPARING')
                                  }
                                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                  Start Preparing Items
                                </button>
                              )}
                              {status === 'PREPARING' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateOrderStep(ord.id, 2, 'OUT_FOR_DELIVERY')
                                  }
                                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                  Dispatch Out for Delivery
                                </button>
                              )}
                              {status === 'OUT_FOR_DELIVERY' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateOrderStep(ord.id, 3, 'DELIVERED')
                                  }
                                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                  Mark Order Delivered & Paid
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Reject Order Modal */}
              {rejectingOrderId && (
                <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
                    <h4 className="text-base font-bold text-stone-900">
                      Reject Order #{rejectingOrderId}
                    </h4>
                    <p className="text-xs text-stone-600">
                      Please state why you are rejecting this order. The customer will be
                      notified.
                    </p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. Item out of stock, store closed, location out of delivery zone"
                      rows={3}
                      className="w-full text-xs p-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingOrderId(null);
                          setRejectReason('');
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 border border-stone-200 hover:bg-stone-100"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateOrderStep(rejectingOrderId, -1, 'REJECTED');
                          setRejectingOrderId(null);
                          setRejectReason('');
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION: IN-APP SELLER NOTIFICATIONS */}
          {activeSection === 'notifications' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-stone-900 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-stone-800" />
                    <span>In-App Order Alerts</span>
                    {unreadNotificationCount > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                        {unreadNotificationCount} unread
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Real-time notifications for new customer orders, cancellations, and order updates.
                  </p>
                </div>

                {sellerNotifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearNotifications}
                    className="px-3.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 text-xs font-medium cursor-pointer self-start sm:self-auto"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {sellerNotifications.length === 0 ? (
                <div className="p-10 rounded-xl bg-[#FAF9F6] border border-stone-200 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                    <Bell className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-stone-900">
                    No order alerts yet
                  </h4>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    When buyers place orders with your store, instant order alerts and status update notifications will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sellerNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                        !notif.isRead
                          ? 'bg-amber-50/60 border-amber-300 shadow-xs'
                          : 'bg-[#FAF9F6] border-stone-200 opacity-90'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-stone-900">
                            {notif.title}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {new Date(notif.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-stone-700">{notif.message}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        {!notif.isRead && (
                          <button
                            type="button"
                            onClick={() => handleMarkNotificationRead(notif.id)}
                            className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 border border-stone-200 rounded-md bg-white cursor-pointer"
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            handleMarkNotificationRead(notif.id);
                            setActiveSection('orders');
                          }}
                          className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          View Order
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: PRODUCT MANAGEMENT LIST */}
          {activeSection === 'products' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-stone-900">
                    Manage products
                  </h3>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Update prices, change available stock, or add new products
                    to your store.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSection('add-product')}
                  className="px-4 py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5 self-start cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add product</span>
                </button>
              </div>

              {authorizedProducts.length === 0 ? (
                <div className="p-10 rounded-xl bg-[#FAF9F6] border border-stone-200 text-center">
                  <h4 className="text-sm font-semibold text-stone-900">
                    Nothing here yet.
                  </h4>
                  <p className="mt-1 text-xs text-stone-500">
                    Add your first product so nearby customers can start
                    ordering from your store.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveSection('add-product')}
                    className="mt-4 px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-medium cursor-pointer"
                  >
                    + Add your first product
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {authorizedProducts.map((prod) => {
                    const inStock = prod.isAvailable && prod.stock > 0;
                    return (
                      <div
                        key={prod.id}
                        className="p-4 rounded-xl bg-[#FAF9F6] border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-stone-200">
                            <ProductStudioArtwork
                              preset={prod.artworkPreset}
                              customImageUrl={prod.customImageUrl}
                              alt={prod.name}
                              className="w-full h-full"
                            />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-stone-900 truncate">
                              {prod.name}
                            </h4>
                            <div className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5">
                              <CategoryIcon
                                categoryIdOrName={
                                  prod.categoryId || prod.category
                                }
                                className="w-3.5 h-3.5"
                              />
                              <span className="truncate">{prod.category}</span>
                            </div>
                            <div
                              className={`text-xs font-medium mt-1 ${
                                inStock ? 'text-emerald-800' : 'text-red-700'
                              }`}
                            >
                              {inStock
                                ? `In stock (${prod.stock} available)`
                                : 'Out of stock'}
                            </div>
                          </div>
                        </div>

                        {/* Simple Price & Stock Controls */}
                        <div className="flex flex-wrap items-center gap-4">
                          <div>
                            <label
                              htmlFor={`price-${prod.id}`}
                              className="block text-[11px] text-stone-500 mb-0.5"
                            >
                              Price (₹)
                            </label>
                            <input
                              id={`price-${prod.id}`}
                              type="number"
                              min="1"
                              value={prod.price}
                              onChange={(e) => {
                                const nextPrice = Math.max(
                                  1,
                                  Number(e.target.value) || 1
                                );
                                onUpdateProduct({...prod, price: nextPrice});
                              }}
                              className="w-24 px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-lg font-mono tabular-nums"
                            />
                          </div>

                          <div>
                            <span className="block text-[11px] text-stone-500 mb-0.5">
                              Available stock
                            </span>
                            <div className="inline-flex items-center bg-white border border-stone-300 rounded-lg">
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateStock(
                                    prod.id,
                                    Math.max(0, prod.stock - 1),
                                    activeSellerId,
                                    isAdmin
                                  )
                                }
                                className="px-2.5 py-1 text-xs hover:bg-stone-100 cursor-pointer"
                              >
                                -
                              </button>
                              <span className="w-8 text-center text-xs font-mono tabular-nums font-semibold">
                                {prod.stock}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateStock(
                                    prod.id,
                                    prod.stock + 1,
                                    activeSellerId,
                                    isAdmin
                                  )
                                }
                                className="px-2.5 py-1 text-xs hover:bg-stone-100 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              onUpdateStock(
                                prod.id,
                                inStock ? 0 : 10,
                                activeSellerId,
                                isAdmin
                              )
                            }
                            className="px-3 py-1.5 text-xs font-medium border border-stone-300 rounded-lg bg-white hover:bg-stone-100 cursor-pointer mt-4 sm:mt-0"
                          >
                            {inStock ? 'Mark out of stock' : 'Mark in stock'}
                          </button>

                          {onDeleteProduct && (
                            <button
                              type="button"
                              onClick={() => onDeleteProduct(prod.id)}
                              className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-700 rounded-lg bg-white hover:bg-red-50 cursor-pointer mt-4 sm:mt-0"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECTION 4: SIMPLE ADD PRODUCT FORM */}
          {activeSection === 'add-product' && (
            <div className="space-y-6">
              {(() => {
                const addQuota = checkProductQuota(
                  selectedStore?.id || primarySellerStore?.id || '',
                  authorizedProducts.length
                );
                return !addQuota.canAdd ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950">
                    <div>
                      <strong>Catalogue limit reached ({addQuota.currentCount} / {addQuota.maxAllowed} products on {addQuota.planName}):</strong>
                      <p className="mt-0.5 text-stone-600">
                        Existing products remain visible and active, but you cannot add new items until you upgrade your plan.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('billing')}
                      className="px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-medium shrink-0 cursor-pointer"
                    >
                      Upgrade plan →
                    </button>
                  </div>
                ) : null;
              })()}

              <div className="flex items-center justify-between gap-4">
                <div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('products')}
                    className="text-xs text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 mb-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to products</span>
                  </button>
                  <h3 className="text-xl font-semibold text-stone-900">
                    Add a product to {selectedStore?.name}
                  </h3>
                </div>
                <span className="text-xs text-stone-500 font-mono">
                  {lastSavedAt}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <form
                  onSubmit={handlePublishProduct}
                  className="lg:col-span-7 space-y-4"
                >
                  {productFormError && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{productFormError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-stone-900 mb-1">
                      Product Name *
                    </label>
                    <p className="text-[11px] text-stone-500 mb-1.5">
                      Enter a clear title for buyers, including brand or unit weight (e.g. Organic Whole Wheat Atta 5kg).
                    </p>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Fresh Farm Whole Milk (1 Litre)"
                      value={draft.name}
                      onChange={(e) => updateDraftField('name', e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-900 mb-1">
                        Price (INR ₹) *
                      </label>
                      <p className="text-[11px] text-stone-500 mb-1.5">
                        Retail selling price charged to local buyers.
                      </p>
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="e.g. 65"
                        value={draft.price}
                        onChange={(e) =>
                          updateDraftField('price', e.target.value)
                        }
                        className="w-full px-3.5 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg font-mono tabular-nums focus:outline-none focus:border-stone-900 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-900 mb-1">
                        Quantity in Stock *
                      </label>
                      <p className="text-[11px] text-stone-500 mb-1.5">
                        Units ready for immediate delivery.
                      </p>
                      <input
                        type="number"
                        min="0"
                        required
                        placeholder="e.g. 15"
                        value={draft.stock}
                        onChange={(e) =>
                          updateDraftField('stock', e.target.value)
                        }
                        className="w-full px-3.5 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg font-mono tabular-nums focus:outline-none focus:border-stone-900 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-900 mb-1">
                      Store Category *
                    </label>
                    <p className="text-[11px] text-stone-500 mb-1.5">
                      Assign to one of the 25 official Citykart product categories.
                    </p>
                    <select
                      value={draft.categoryId}
                      onChange={(e) =>
                        updateDraftField(
                          'categoryId',
                          e.target.value as StoreCategoryId
                        )
                      }
                      className="w-full px-3.5 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 focus:bg-white"
                    >
                      {AUTHORITATIVE_STORE_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.order}. {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-900 mb-1">
                        Product Photo / Image
                      </label>
                      <p className="text-[11px] text-stone-500 mb-1.5">
                        Upload custom image (Max 5MB JPG, PNG, WEBP).
                      </p>

                      {imageUploadError && (
                        <div className="mb-2 p-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-800">
                          {imageUploadError}
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium text-stone-700 bg-[#FAF9F6] hover:bg-stone-100 border border-stone-300 rounded-lg cursor-pointer transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {isUploadingImage
                              ? 'Uploading image...'
                              : draft.customImageUrl
                              ? 'Change uploaded photo'
                              : 'Upload photo from device'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingImage}
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>

                        {draft.customImageUrl && (
                          <div className="flex items-center justify-between px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900">
                            <span className="font-medium">Photo uploaded successfully</span>
                            <button
                              type="button"
                              onClick={handleClearCustomImage}
                              className="text-emerald-800 underline hover:text-emerald-950 font-semibold cursor-pointer"
                            >
                              Remove photo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-900 mb-1">
                        Or Studio Artwork Preset
                      </label>
                      <p className="text-[11px] text-stone-500 mb-1.5">
                        High-resolution 3D studio background style.
                      </p>
                      <select
                        value={draft.artworkPreset}
                        onChange={(e) =>
                          updateDraftField(
                            'artworkPreset',
                            e.target.value as ArtworkPreset
                          )
                        }
                        className="w-full px-3.5 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 focus:bg-white"
                      >
                        {ARTWORK_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-900 mb-1">
                      Product Description
                    </label>
                    <p className="text-[11px] text-stone-500 mb-1.5">
                      Describe ingredients, freshness, storage tips, or origin details for your buyers.
                    </p>
                    <textarea
                      rows={3}
                      placeholder="e.g. Sourced daily from local organic farms. Delivered within 30 minutes in temperature-preserving packaging."
                      value={draft.description}
                      onChange={(e) =>
                        updateDraftField('description', e.target.value)
                      }
                      className="w-full px-3.5 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 focus:bg-white"
                    />
                  </div>

                  {/* Collapsible Advanced Options */}
                  <div className="pt-2 border-t border-stone-200">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedProductFields((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 cursor-pointer"
                    >
                      {showAdvancedProductFields ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {showAdvancedProductFields
                          ? 'Hide extra fields (variants, delivery estimate)'
                          : 'Show extra fields (variants, delivery estimate)'}
                      </span>
                    </button>

                    {showAdvancedProductFields && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-[#FAF9F6] border border-stone-200">
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Available Variants / Options (comma-separated)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Small (250g), Medium (500g), Large (1kg)"
                            value={draft.variantsRaw}
                            onChange={(e) =>
                              updateDraftField('variantsRaw', e.target.value)
                            }
                            className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Estimated Delivery Dispatch Time (minutes)
                          </label>
                          <input
                            type="number"
                            min="10"
                            max="180"
                            value={draft.deliveryMins}
                            onChange={(e) =>
                              updateDraftField('deliveryMins', e.target.value)
                            }
                            className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isPublishingProduct || isUploadingImage}
                      className="px-5 py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white text-xs font-medium transition-colors inline-flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      {isPublishingProduct ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Publishing product...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Publish product to store</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      className="px-3 py-2 text-xs text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Load sample item</span>
                    </button>
                  </div>
                </form>

                {/* Live Preview */}
                <div className="lg:col-span-5 bg-[#FAF9F6] border border-stone-200 rounded-xl p-5">
                  <div className="text-xs font-medium text-stone-600 mb-3">
                    How customers will see your product
                  </div>
                  <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                    <div className="aspect-[4/3] w-full">
                      <ProductStudioArtwork
                        preset={draft.artworkPreset}
                        customImageUrl={draft.customImageUrl || undefined}
                        alt={draft.name || 'Product preview'}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="p-4 space-y-1.5">
                      <div className="text-xs text-stone-500">
                        {draft.category} · {selectedStore?.name}
                      </div>
                      <h4 className="text-base font-semibold text-stone-900">
                        {draft.name || 'Product name'}
                      </h4>
                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-sm font-semibold font-mono tabular-nums text-stone-900">
                          {formatCurrency(Number(draft.price || 0))}
                        </span>
                        <span className="text-xs text-emerald-800 font-medium">
                          In stock ({draft.stock || 0})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: MY STORE (EDIT STORE DETAILS & CHOOSE WHERE YOU DELIVER) */}
          {activeSection === 'my-store' && primarySellerStore && (
            <div className="max-w-2xl space-y-10">
              <form
                onSubmit={handleSaveStoreSettings}
                className="space-y-5"
              >
              <div>
                <h3 className="text-xl font-semibold text-stone-900">
                  Edit store details
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  Update your store information, opening hours, and the areas
                  where you deliver.
                </p>
              </div>

              {settingsSavedMsg && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
                  {settingsSavedMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-800 mb-1">
                    Store name
                  </label>
                  <input
                    type="text"
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-800 mb-1">
                    Store category
                  </label>
                  <select
                    value={settingsCategoryId}
                    onChange={(e) =>
                      setSettingsCategoryId(e.target.value as StoreCategoryId)
                    }
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                  >
                    {AUTHORITATIVE_STORE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.order}. {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-800 mb-1">
                  Short store description
                </label>
                <input
                  type="text"
                  value={settingsSpecialty}
                  onChange={(e) => setSettingsSpecialty(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-stone-200 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900">
                      Worldwide store location & address
                    </h4>
                    <p className="text-xs text-stone-500">
                      Register a city, small town, district, village, or locality anywhere in the world.
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                      settingsVerificationStatus === 'VERIFIED'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : settingsVerificationStatus ===
                            'USER_PROVIDED_UNVERIFIED'
                          ? 'bg-stone-100 border-stone-300 text-stone-800'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    {settingsVerificationStatus === 'VERIFIED'
                      ? 'Verified place'
                      : settingsVerificationStatus === 'USER_PROVIDED_UNVERIFIED'
                        ? 'Manual town/village entry (Active)'
                        : 'Incomplete location'}
                  </span>
                </div>

                {!isStoreLocationComplete(primarySellerStore) && (
                  <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      Your store is missing structured city/town/village or address details
                      and cannot appear in buyer location results until completed.
                    </span>
                  </div>
                )}

                {/* Cascading Global Location Selector: Country -> State/Region -> City/Town */}
                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-stone-200">
                  <CascadingLocationSelector
                    selectedCountry={settingsCountry}
                    selectedStateRegion={settingsStateRegion}
                    selectedCity={settingsCityName}
                    selectedLocality={settingsNeighborhood}
                    selectedDistrict={settingsDistrict}
                    selectedPostalCode={settingsPostalCode}
                    selectedLocalityType={settingsLocalityType}
                    onChange={(loc) => {
                      setSettingsCountry(loc.country);
                      if (loc.countryCode) setSettingsCountryCode(loc.countryCode);
                      setSettingsStateRegion(loc.stateRegion);
                      setSettingsDistrict(loc.district || '');
                      setSettingsCityName(loc.city);
                      setSettingsLocalityType(loc.localityType || 'CITY');
                      setSettingsNeighborhood(loc.locality || '');
                      if (loc.postalCode) setSettingsPostalCode(loc.postalCode);
                      setSettingsLocationSource(
                        loc.source === 'NOMINATIM'
                          ? 'GEOCODED'
                          : 'VERIFIED_DIRECTORY'
                      );
                      setSettingsVerificationStatus('VERIFIED');
                    }}
                    allowLocalityInput={true}
                    showMissingLocationButton={true}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-800 mb-1">
                    Full store street address *
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsAddress}
                    onChange={(e) => setSettingsAddress(e.target.value)}
                    placeholder="Example: Shop 9, Near Bus Stand"
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      Opening hours
                    </label>
                    <input
                      type="text"
                      value={settingsOperatingHours}
                      onChange={(e) =>
                        setSettingsOperatingHours(e.target.value)
                      }
                      placeholder="Example: 9:00 AM – 9:00 PM"
                      className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      Map latitude (Optional)
                    </label>
                    <input
                      type="text"
                      value={settingsLat}
                      onChange={(e) => setSettingsLat(e.target.value)}
                      placeholder="e.g., 18.1507"
                      className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      Map longitude (Optional)
                    </label>
                    <input
                      type="text"
                      value={settingsLng}
                      onChange={(e) => setSettingsLng(e.target.value)}
                      placeholder="e.g., 74.5768"
                      className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-200 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-stone-900">
                    Choose where you deliver
                  </h4>
                  <p className="text-xs text-stone-500">
                    You arrange delivery to customers in these areas. Customers
                    outside these areas will see that your store does not
                    deliver to them.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      Where do you deliver?
                    </label>
                    <select
                      value={settingsScopeType}
                      onChange={(e) =>
                        setSettingsScopeType(
                          e.target.value as DeliveryScopeType
                        )
                      }
                      className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                    >
                      <option value="CUSTOM_LOCALITIES">
                        Selected neighborhoods / nearby villages
                      </option>
                      <option value="CITY_WIDE">
                        All of {settingsCityName || primarySellerStore.cityName}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      Maximum delivery distance (km)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={settingsRadiusKm}
                      onChange={(e) => setSettingsRadiusKm(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-800 mb-1">
                    Neighborhoods or nearby villages you deliver to in{' '}
                    {settingsCityName || primarySellerStore.cityName}{' '}
                    (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={settingsLocalitiesRaw}
                    onChange={(e) => setSettingsLocalitiesRaw(e.target.value)}
                    placeholder="Example: Main Bazaar, Station Road, MIDC Area"
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Save store details
              </button>
            </form>

            {renderStoreDeletionDangerZone()}
          </div>
        )}

          {/* SECTION 5B: STORE HOURS & AVAILABILITY */}
          {activeSection === 'store-hours' && primarySellerStore && (
            <div className="max-w-xl space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-stone-900">
                  Store hours & availability
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  Control when your store accepts customer orders, set your
                  daily opening hours, and configure your average delivery time.
                </p>
              </div>

              {settingsSavedMsg && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
                  {settingsSavedMsg}
                </div>
              )}

              <div className="p-5 rounded-xl bg-[#FAF9F6] border border-stone-200 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-stone-900">
                    Store status:{' '}
                    {primarySellerStore.isActive
                      ? 'Open for orders'
                      : 'Temporarily closed'}
                  </div>
                  <p className="text-xs text-stone-600 mt-0.5">
                    {primarySellerStore.isActive
                      ? 'Customers in your city can currently discover your store and place orders.'
                      : 'Your store is paused and will not accept new orders until reopened.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const updated: LocalStore = {
                      ...primarySellerStore,
                      isActive: !primarySellerStore.isActive,
                    };
                    onUpdateStoreSettings(updated);
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                    primarySellerStore.isActive
                      ? 'border border-stone-300 bg-white hover:bg-stone-100 text-stone-800'
                      : 'bg-stone-900 hover:bg-stone-800 text-white'
                  }`}
                >
                  {primarySellerStore.isActive
                    ? 'Pause store orders'
                    : 'Reopen store'}
                </button>
              </div>

              <form onSubmit={handleSaveStoreSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-stone-800 mb-1">
                    Daily opening & closing hours
                  </label>
                  <input
                    type="text"
                    value={settingsOperatingHours}
                    onChange={(e) => setSettingsOperatingHours(e.target.value)}
                    placeholder="Example: 9:00 AM – 9:00 PM"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-800 mb-1">
                    Delivery fulfillment note shown to customers
                  </label>
                  <input
                    type="text"
                    value={settingsFulfillmentNote}
                    onChange={(e) => setSettingsFulfillmentNote(e.target.value)}
                    placeholder="Example: Same-hour delivery by our shop staff across Nanded"
                    className="w-full px-3.5 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  Save store hours
                </button>
              </form>
            </div>
          )}

          {/* SECTION 6: GUIDED STEP-BY-STEP "OPEN YOUR STORE" WIZARD (STEPS 1 TO 6) */}
          {activeSection === 'onboarding' && (
            <div className="max-w-xl space-y-6">
              <div>
                <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                  <span className="font-semibold text-stone-900">
                    Open your store — Step {onboardingStep} of 6
                  </span>
                  <span>Progress saved automatically</span>
                </div>
                <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-stone-900 transition-transform duration-200 origin-left"
                    style={{transform: `scaleX(${onboardingStep / 6})`}}
                  />
                </div>
              </div>

              {onboardingError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                  {onboardingError}
                </div>
              )}

              {/* Step 1: Your account (Mobile Number & OTP Verification Only) */}
              {onboardingStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900">
                      Step 1: Your mobile-verified account
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Citykart uses mobile number and OTP verification only. No email or password is required.
                    </p>
                  </div>

                  {authenticatedUser ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-950">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>
                          Mobile number verified via OTP:{' '}
                          <strong className="font-mono">
                            {authenticatedUser.phoneE164}
                          </strong>
                        </span>
                      </div>
                      {onOpenAuthModal && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenAuthModal({requireSellerOnboarding: true})
                          }
                          className="text-emerald-900 underline cursor-pointer shrink-0"
                        >
                          Change number
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <span className="text-stone-700">
                        Verify your mobile number with a one-time password (OTP) to link your seller account.
                      </span>
                      {onOpenAuthModal && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenAuthModal({requireSellerOnboarding: true})
                          }
                          className="px-3.5 py-2 rounded-lg bg-stone-900 text-white font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Verify mobile via OTP</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      Your full name *
                    </label>
                    <input
                      type="text"
                      placeholder="Example: Priya Sharma"
                      value={newOwnerName || authenticatedUser?.fullName || ''}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      Verified mobile number (with country code) *
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      placeholder="Example: +91 98200 11223"
                      value={
                        authenticatedUser?.phoneE164 || newOwnerPhone
                      }
                      onChange={(e) => setNewOwnerPhone(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Your store */}
              {onboardingStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900">
                      Step 2: Your store
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">
                      What is your store called and what do you sell?
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      What is your store called? *
                    </label>
                    <input
                      type="text"
                      placeholder="Example: Green Valley Fresh Mart"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      What does your store sell? (Choose category 1–25) *
                    </label>
                    <select
                      value={storeCategoryId}
                      onChange={(e) =>
                        setStoreCategoryId(e.target.value as StoreCategoryId)
                      }
                      className="w-full px-3 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                    >
                      {AUTHORITATIVE_STORE_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.order}. {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      Short description of your store (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Example: Fresh fruits, vegetables, and daily groceries"
                      value={storeSpecialty}
                      onChange={(e) => setStoreSpecialty(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Worldwide Store Location (Cities, Small Towns, Districts, Villages) */}
              {onboardingStep === 3 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-stone-900">
                        Step 3: Your store location (Worldwide)
                      </h3>
                      <p className="text-xs text-stone-600 mt-0.5">
                        Register from any country, state, district, city, small town, or village worldwide.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDetectStoreCoordinates('onboarding')}
                      className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-[#FAF9F6] hover:bg-stone-100 text-[11px] font-medium text-stone-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Use current GPS coordinates</span>
                    </button>
                  </div>

                  {/* Cascading Global Location Selector: Country -> State/Region -> City/Town */}
                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-stone-200">
                    <CascadingLocationSelector
                      selectedCountry={storeCountry}
                      selectedStateRegion={storeStateRegion}
                      selectedCity={storeCityName}
                      selectedLocality={storeNeighborhood}
                      selectedDistrict={storeDistrict}
                      selectedPostalCode={storePostalCode}
                      selectedLocalityType={storeLocalityType}
                      onChange={(loc) => {
                        setStoreCountry(loc.country);
                        if (loc.countryCode) setStoreCountryCode(loc.countryCode);
                        setStoreStateRegion(loc.stateRegion);
                        setStoreDistrict(loc.district || '');
                        setStoreCityName(loc.city);
                        setStoreLocalityType(loc.localityType || 'CITY');
                        setStoreNeighborhood(loc.locality || '');
                        if (loc.postalCode) setStorePostalCode(loc.postalCode);
                        setStoreLocationSource(
                          loc.source === 'NOMINATIM'
                            ? 'GEOCODED'
                            : 'VERIFIED_DIRECTORY'
                        );
                      }}
                      allowLocalityInput={true}
                      showMissingLocationButton={true}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      Full store street address &amp; landmark *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Example: Shop 4, Near Gram Panchayat Office, Station Road"
                      value={storeAddress}
                      onChange={(e) => setStoreAddress(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs bg-white border border-stone-300 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-800 mb-1">
                        Map latitude (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 18.1507"
                        value={storeLat}
                        onChange={(e) => setStoreLat(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-800 mb-1">
                        Map longitude (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 74.5768"
                        value={storeLng}
                        onChange={(e) => setStoreLng(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Where you deliver */}
              {onboardingStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900">
                      Step 4: Choose where you deliver
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">
                      You are responsible for delivering orders to customers in
                      your chosen areas.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      Which areas can you deliver to?
                    </label>
                    <select
                      value={storeScopeType}
                      onChange={(e) =>
                        setStoreScopeType(e.target.value as DeliveryScopeType)
                      }
                      className="w-full px-3 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                    >
                      <option value="CUSTOM_LOCALITIES">
                        Specific nearby neighborhoods or villages
                      </option>
                      <option value="CITY_WIDE">
                        All of {storeCityName || 'my town / city'}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      List the neighborhoods, wards, or nearby villages you deliver to (comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder={`Example: ${storeNeighborhood || 'Main Bazaar'}, Station Road, Market Area`}
                      value={storeCoveredLocalities}
                      onChange={(e) =>
                        setStoreCoveredLocalities(e.target.value)
                      }
                      className="w-full px-3 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-800 mb-1">
                        Maximum distance (km)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={storeRadiusKm}
                        onChange={(e) => setStoreRadiusKm(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-800 mb-1">
                        Typical delivery time (minutes)
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="180"
                        value={storeDispatchMins}
                        onChange={(e) => setStoreDispatchMins(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Your store details */}
              {onboardingStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900">
                      Step 5: Opening hours & payment
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">
                      When is your store open for orders?
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      Opening hours
                    </label>
                    <input
                      type="text"
                      placeholder="Example: 9:00 AM – 9:00 PM"
                      value={storeOperatingHours}
                      onChange={(e) => setStoreOperatingHours(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-800 mb-1">
                      UPI ID for receiving payments on delivery (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Example: yourshop@okicici"
                      value={storeUpi}
                      onChange={(e) => setStoreUpi(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Step 6: Review and finish */}
              {onboardingStep === 6 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900">
                      Step 6: Review and open your store
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Everything is ready! Review your store summary below.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-stone-200 space-y-2 text-xs">
                    <div>
                      <span className="text-stone-500">Store owner: </span>
                      <strong className="text-stone-900">
                        {effectiveOwnerName} ({effectiveOwnerPhone})
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-500">Store name: </span>
                      <strong className="text-stone-900">{storeName}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500">Category: </span>
                      <strong className="text-stone-900">
                        {getCategoryByIdOrName(storeCategoryId).name}
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-500">Location: </span>
                      <strong className="text-stone-900">
                        {storeAddress}
                        {storeNeighborhood ? `, ${storeNeighborhood}` : ''},{' '}
                        {storeCityName}
                        {storeDistrict ? ` (${storeDistrict})` : ''},{' '}
                        {storeStateRegion || storeCountry}, {storeCountry}
                        {storePostalCode ? ` — ${storePostalCode}` : ''}
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-500">Delivering to: </span>
                      <strong className="text-stone-900">
                        {storeCoveredLocalities ||
                          storeNeighborhood ||
                          storeCityName}{' '}
                        (up to {storeRadiusKm} km)
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-500">Opening hours: </span>
                      <strong className="text-stone-900">
                        {storeOperatingHours}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Wizard Navigation Buttons */}
              <div className="pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
                {onboardingStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setOnboardingStep((s) => Math.max(1, s - 1))}
                    className="px-4 py-2.5 rounded-lg border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-100 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                ) : (
                  <div />
                )}

                {onboardingStep < 6 ? (
                  <button
                    type="button"
                    onClick={handleNextOnboardingStep}
                    className="px-5 py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Save and continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={isSubmittingOnboarding}
                      onClick={() => handleFinishStoreOnboarding(true)}
                      className="px-5 py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {isSubmittingOnboarding ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Opening store...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Open store & add first product</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingOnboarding}
                      onClick={() => handleFinishStoreOnboarding(false)}
                      className="px-4 py-2.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-50 text-xs font-medium text-stone-800 cursor-pointer"
                    >
                      Finish setup
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 7: SETTINGS & ADMIN CATEGORY OVERVIEW */}
          {activeSection === 'settings' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-stone-900">
                  Account & platform settings
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  Manage your mobile-OTP verified seller account or view the 25 official store
                  categories.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-stone-200 space-y-2 text-xs">
                <div className="font-semibold text-stone-900">
                  Signed-in store owner (Mobile OTP Authentication)
                </div>
                <div>Name: {activeSeller?.businessOwnerName}</div>
                <div>
                  Verified Mobile:{' '}
                  <span className="font-mono">{activeSeller?.phoneE164}</span>{' '}
                  {activeSeller?.phoneVerified ? (
                    <span className="text-emerald-800 font-medium">
                      (OTP Verified)
                    </span>
                  ) : (
                    <span className="text-amber-800 font-medium">
                      (Pending OTP Verification)
                    </span>
                  )}
                </div>
                <div>Assigned store: {primarySellerStore?.name}</div>
              </div>

              {/* Danger Zone: Permanently Delete Store */}
              {renderStoreDeletionDangerZone()}

              {/* Demo Dataset Management Card (Nanded 25-Category Demo Batch) */}
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-stone-200 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-stone-900">
                      Nanded 25-Category Demonstration Dataset (isDemo: true)
                    </div>
                    <p className="text-stone-600 mt-0.5">
                      Batch ID:{' '}
                      <code className="font-mono bg-stone-200/70 px-1.5 py-0.5 rounded">
                        nanded-25-cat-demo-v1
                      </code>{' '}
                      · 50 Nanded Demo Stores &amp; 75 INR-Priced Products across all 25 categories in Firebase project{' '}
                      <code className="font-mono bg-stone-200/70 px-1.5 py-0.5 rounded">
                        urbandirectintracity
                      </code>
                      .
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isSyncingDemo}
                      onClick={handleSeedNandedDemo}
                      className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-medium cursor-pointer disabled:opacity-50"
                    >
                      {isSyncingDemo
                        ? 'Syncing...'
                        : 'Seed / Refresh Nanded Demo in Firestore'}
                    </button>
                    <button
                      type="button"
                      disabled={isSyncingDemo}
                      onClick={handleRemoveNandedDemo}
                      className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 font-medium cursor-pointer disabled:opacity-50"
                    >
                      Remove Demo Records Only
                    </button>
                  </div>
                </div>
                {demoSyncStatus && (
                  <div className="p-2.5 rounded-lg bg-white border border-stone-200 text-stone-800 font-medium">
                    {demoSyncStatus}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-stone-900">
                    All 25 official store categories
                  </h4>
                  <span className="text-xs text-stone-500">
                    {isAdmin ? 'Click to pause/enable' : 'Available for stores'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-2.5 rounded-lg border border-stone-200 bg-[#FAF9F6] flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <CategoryIcon
                          categoryIdOrName={cat.id}
                          className="w-3.5 h-3.5 text-stone-700 shrink-0"
                        />
                        <span className="truncate">
                          {cat.order}. {cat.name}
                        </span>
                      </span>
                      {isAdmin && onToggleCategoryStatus && (
                        <button
                          type="button"
                          onClick={() => onToggleCategoryStatus(cat.id)}
                          className="text-[11px] underline text-stone-600 hover:text-stone-900 cursor-pointer shrink-0"
                        >
                          {cat.isActive ? 'Enabled' : 'Paused'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 8: PLANS & BILLING */}
          {activeSection === 'billing' && activeSeller && primarySellerStore && (
            <SellerPlansBilling
              seller={activeSeller}
              store={primarySellerStore}
              products={authorizedProducts}
            />
          )}

          {/* SECTION 9: PLATFORM REVENUE & MONETIZATION (SUPER ADMIN) */}
          {activeSection === 'admin-revenue' && (
            <AdminRevenueDashboard sellers={sellers} stores={stores} />
          )}

          {/* SECTION 10: GLOBAL LOCATION MANAGEMENT (SUPER ADMIN) */}
          {activeSection === 'admin-locations' && (
            <AdminLocationManager stores={stores} />
          )}
        </div>
      </div>

      {/* Explicit Store Deletion Confirmation Modal */}
      {isDeleteDialogOpen && primarySellerStore && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-store-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl border border-rose-300 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-rose-50 border-b border-rose-200 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 id="delete-store-modal-title" className="text-base font-semibold text-rose-950">
                  Permanently Delete &quot;{primarySellerStore.name}&quot;?
                </h3>
                <p className="text-xs text-rose-900/80 mt-0.5">
                  This action is permanent and cannot be reversed.
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                <div className="text-stone-500 font-medium">Store identified for permanent deletion:</div>
                <div className="text-sm font-semibold text-stone-900">{primarySellerStore.name}</div>
                <div className="text-stone-600 text-[11px]">
                  Category: {primarySellerStore.category} · City: {primarySellerStore.cityName} · Address: {primarySellerStore.address}
                </div>
                <div className="text-stone-700 text-[11px] font-medium pt-1">
                  Catalog impact:{' '}
                  <span className="text-rose-700 font-bold">
                    {authorizedProducts.filter((p) => p.storeId === primarySellerStore.id).length} products
                  </span>{' '}
                  will be removed from the active global marketplace.
                </div>
              </div>

              <div className="space-y-1.5 text-stone-700">
                <div className="font-semibold text-stone-900">Explicit consequences:</div>
                <ul className="list-disc list-inside space-y-1 text-stone-600">
                  <li>Your store and catalog will instantly disappear from public discovery worldwide.</li>
                  <li>Customers can no longer find or purchase any items from this store.</li>
                  <li>Active buyer cart items for this store will be invalidated.</li>
                  <li>Store-specific images and assets will be purged where safe.</li>
                  <li>Completed order, refund, invoice, and tax records will remain safely archived for legal compliance.</li>
                </ul>
              </div>

              {deleteError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              {/* Explicit Confirmation Input */}
              <div className="pt-2 border-t border-stone-200 space-y-2">
                <label className="block text-xs font-semibold text-stone-900">
                  To confirm permanent deletion, please type{' '}
                  <span className="select-all font-mono text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 font-bold">
                    {primarySellerStore.name}
                  </span>{' '}
                  below:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  disabled={isDeletingStore}
                  placeholder={`Type "${primarySellerStore.name}" to confirm`}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  autoFocus
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeleteConfirmationInput('');
                  setDeleteError(null);
                }}
                disabled={isDeletingStore}
                className="px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-200/70 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteStoreDeletion}
                disabled={
                  isDeletingStore ||
                  deleteConfirmationInput.trim() !== primarySellerStore.name.trim()
                }
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                {isDeletingStore ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting store &amp; products...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Delete Store</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
