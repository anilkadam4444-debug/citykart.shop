'use client';

export const dynamic = 'force-dynamic';

import React, {useState, useMemo} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Check,
  X,
  MapPin,
  Clock,
  QrCode,
  Truck,
  Store,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Phone,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  CustomerShoppingLocation,
  formatCurrency,
  isStoreEligibleForSelectedCity,
  OrderRecord,
  Product,
  ProductCategory,
  queryCityScopedCatalog,
} from '@/lib/catalog-data';
import {ProductStudioArtwork} from '@/components/product-studio-artwork';
import {ProductDetailModal} from '@/components/product-detail-modal';
import {CartCheckoutDrawer} from '@/components/cart-checkout-drawer';
import {CategoryIcon} from '@/components/category-icon';
import {LocationSelectorModal} from '@/components/location-selector-modal';
import {
  BuyerLeftSidebar,
  ProductSortOption,
} from '@/components/buyer-left-sidebar';
import {rankProductsByPopularity} from '@/lib/product-popularity';
import {
  INITIAL_DEMO_ORDER,
  useUrbanDirect,
} from '@/components/urbandirect-provider';
import { CAMPAIGNS_STORAGE_KEY } from '@/lib/entitlements';
import { FeaturedCampaign } from '@/lib/revenue-model';

type BuyerViewMode = 'BUYER_HOME' | 'STORE_PAGE' | 'MY_ORDERS';

export default function UrbanDirectPlatform() {
  const {
    isMounted,
    stores,
    products,
    orders,
    categories,
    customerLocation,
    hasSelectedCity,
    isLocationModalOpen,
    setIsLocationModalOpen,
    handleConfirmBuyerLocation: confirmLocationInContext,
    authenticatedUser,
    openOtpAuthModal,
    handleSignOutOtpSession,
    cart,
    totalCartItems,
    totalCartValue,
    handleAddToCart: addToCartInContext,
    handleUpdateCartQuantity,
    handleRemoveCartItem,
    handlePlaceOrder: placeOrderInContext,
    showToast,
  } = useUrbanDirect();

  // Public homepage (/) is strictly buyer-first: BUYER_HOME, STORE_PAGE, or MY_ORDERS
  const [viewMode, setViewMode] = useState<BuyerViewMode>('BUYER_HOME');
  const [viewedStoreId, setViewedStoreId] = useState<string | null>(null);
  const [storeSearchQuery, setStoreSearchQuery] = useState<string>('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] =
    useState<boolean>(false);

  const [onlyDeliverableToMe, setOnlyDeliverableToMe] =
    useState<boolean>(false);
  const [selectedStoreFilterId, setSelectedStoreFilterId] =
    useState<string>('ALL');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<ProductSortOption>('POPULARITY');

  // Buyer Search & Category Browsing State
  const [selectedCategory, setSelectedCategory] =
    useState<ProductCategory>('All Categories');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart Drawer & Product Detail Modal State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerInitialStep, setDrawerInitialStep] = useState<
    'cart' | 'checkout'
  >('cart');
  const [activePdpProduct, setActivePdpProduct] = useState<Product | null>(
    null
  );

  // Active Order selection for "My Orders" tracker
  const [activeOrderId, setActiveOrderId] = useState<string>(
    INITIAL_DEMO_ORDER.id
  );

  // Active Sponsored Products & Featured Stores Advertising Campaigns
  const activeCampaigns = useMemo<FeaturedCampaign[]>(() => {
    if (!isMounted || typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
      if (raw) {
        const all = JSON.parse(raw) as FeaturedCampaign[];
        const now = new Date().toISOString();
        return all.filter((c) => c.status === 'ACTIVE' && c.endDate >= now);
      }
    } catch {}
    return [];
  }, [isMounted]);

  const sponsoredProductIds = useMemo(() => {
    const set = new Set<string>();
    activeCampaigns.forEach((c) => {
      if (c.type === 'SPONSORED_PRODUCT' && c.targetProductId) {
        set.add(c.targetProductId);
      }
    });
    return set;
  }, [activeCampaigns]);

  const featuredStoreIds = useMemo(() => {
    const set = new Set<string>();
    activeCampaigns.forEach((c) => {
      if (c.type === 'FEATURED_STORE') {
        set.add(c.storeId);
      }
    });
    return set;
  }, [activeCampaigns]);

  const shouldShowLocationModal =
    isMounted &&
    (isLocationModalOpen ||
      (!hasSelectedCity &&
        (viewMode === 'BUYER_HOME' || viewMode === 'STORE_PAGE')));

  const handleConfirmBuyerLocation = (newLoc: CustomerShoppingLocation) => {
    confirmLocationInContext(newLoc);
    setSelectedStoreFilterId('ALL');

    if (viewMode === 'STORE_PAGE' && viewedStoreId) {
      const currentStore = stores.find((s) => s.id === viewedStoreId);
      if (
        currentStore &&
        !isStoreEligibleForSelectedCity(currentStore, newLoc)
      ) {
        setViewMode('BUYER_HOME');
        setViewedStoreId(null);
      }
    }
  };

  // Data-Access Level Strict City-Scoped Catalog Query
  const cityCatalog = useMemo(
    () =>
      queryCityScopedCatalog({
        stores,
        products,
        customerLocation,
        selectedCategory,
        searchQuery,
        onlyDeliverableToLocality: onlyDeliverableToMe,
      }),
    [
      stores,
      products,
      customerLocation,
      selectedCategory,
      searchQuery,
      onlyDeliverableToMe,
    ]
  );

  const {
    requiresCitySelection,
    eligibleStoresInCity,
    filteredStores,
    filteredProducts: baseFilteredProducts,
    categoryStoreCounts,
    categoryProductCounts,
  } = cityCatalog;

  const totalCityProductsCount = useMemo(() => {
    if (!hasSelectedCity) return 0;
    const eligibleIds = new Set(eligibleStoresInCity.map((s) => s.id));
    return products.filter((p) => eligibleIds.has(p.storeId)).length;
  }, [hasSelectedCity, eligibleStoresInCity, products]);

  const eligibleStoreIdSet = useMemo(() => {
    return new Set(eligibleStoresInCity.map((s) => s.id));
  }, [eligibleStoresInCity]);

  // Rank city-eligible products primarily by genuine order popularity (most ordered first)
  const {
    rankedProducts: popularityRankedProducts,
    popularityByProductId,
    hasValidOrderHistory,
  } = useMemo(() => {
    return rankProductsByPopularity({
      products: baseFilteredProducts,
      orders,
      eligibleStoreIds: eligibleStoreIdSet,
    });
  }, [baseFilteredProducts, orders, eligibleStoreIdSet]);

  // Apply sidebar Store Filter, Stock Filter, and user-selected Sort Option
  const filteredProducts = useMemo(() => {
    let list = popularityRankedProducts;
    if (selectedStoreFilterId !== 'ALL') {
      list = list.filter((p) => p.storeId === selectedStoreFilterId);
    }
    if (inStockOnly) {
      list = list.filter((p) => p.isAvailable && p.stock > 0);
    }
    if (sortBy === 'PRICE_ASC') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'PRICE_DESC') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortBy === 'DELIVERY_FASTEST') {
      list = [...list].sort((a, b) => a.deliveryMins - b.deliveryMins);
    }
    // 'POPULARITY' and 'RECOMMENDED' retain popularityRankedProducts order
    return list;
  }, [popularityRankedProducts, selectedStoreFilterId, inStockOnly, sortBy]);

  const selectedStoreFilterName = useMemo(() => {
    if (selectedStoreFilterId === 'ALL') return null;
    const match = stores.find((s) => s.id === selectedStoreFilterId);
    return match ? match.name : null;
  }, [stores, selectedStoreFilterId]);

  // Currently Viewed Store (Strictly Checked Against Selected City)
  const activeViewedStore = useMemo(() => {
    if (!viewedStoreId || !hasSelectedCity) return null;
    const candidate = stores.find((s) => s.id === viewedStoreId);
    if (!candidate) return null;
    if (!isStoreEligibleForSelectedCity(candidate, customerLocation)) {
      return null;
    }
    return candidate;
  }, [stores, viewedStoreId, hasSelectedCity, customerLocation]);

  const activeViewedStoreProducts = useMemo(() => {
    if (!activeViewedStore) return [];
    const q = storeSearchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (p.storeId !== activeViewedStore.id) return false;
      if (
        selectedCategory !== 'All Categories' &&
        p.category !== selectedCategory
      ) {
        return false;
      }
      if (inStockOnly && (!p.isAvailable || p.stock <= 0)) {
        return false;
      }
      if (q) {
        return `${p.name} ${p.category} ${p.description}`
          .toLowerCase()
          .includes(q);
      }
      return true;
    });
  }, [
    products,
    activeViewedStore,
    selectedCategory,
    inStockOnly,
    storeSearchQuery,
  ]);

  const handleOpenStorePage = (storeId: string) => {
    const targetStore = stores.find((s) => s.id === storeId);
    if (
      targetStore &&
      hasSelectedCity &&
      !isStoreEligibleForSelectedCity(targetStore, customerLocation)
    ) {
      showToast(
        `This store does not serve ${customerLocation.city}. Please change your location to view it.`
      );
      return;
    }
    setViewedStoreId(storeId);
    setStoreSearchQuery('');
    setSelectedCategory('All Categories');
    setViewMode('STORE_PAGE');
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleAddToCart = (
    product: Product,
    variant: string,
    quantity = 1,
    openCheckoutImmediately = false
  ) => {
    addToCartInContext(product, variant, quantity);
    if (openCheckoutImmediately) {
      setDrawerInitialStep('checkout');
      setIsDrawerOpen(true);
    }
  };

  const handlePlaceOrder = (newOrder: OrderRecord) => {
    placeOrderInContext(newOrder);
    setActiveOrderId(newOrder.id);
  };

  const activeOrder =
    orders.find((o) => o.id === activeOrderId) ||
    orders[0] ||
    INITIAL_DEMO_ORDER;

  const resetCityFilters = () => {
    setOnlyDeliverableToMe(false);
    setSelectedCategory('All Categories');
    setSelectedStoreFilterId('ALL');
    setInStockOnly(false);
    setSortBy('POPULARITY');
    setSearchQuery('');
  };

  const formattedSelectedCityLabel = hasSelectedCity
    ? `${customerLocation.city}${
        customerLocation.stateRegion &&
        customerLocation.stateRegion.toLowerCase() !==
          customerLocation.city.toLowerCase()
          ? `, ${customerLocation.stateRegion}`
          : customerLocation.country
            ? `, ${customerLocation.country}`
            : ''
      }`
    : 'Select location';

  const formattedLocationFull = hasSelectedCity
    ? [
        customerLocation.city,
        customerLocation.stateRegion &&
        customerLocation.stateRegion.toLowerCase() !==
          customerLocation.city.toLowerCase()
          ? customerLocation.stateRegion
          : null,
        customerLocation.country,
      ]
        .filter(Boolean)
        .join(', ')
    : 'Choose your city to find local stores.';

  const isUnfilteredDiscovery =
    selectedCategory === 'All Categories' &&
    selectedStoreFilterId === 'ALL' &&
    searchQuery.trim() === '' &&
    !inStockOnly &&
    !onlyDeliverableToMe;

  const heroSpotlightProducts = useMemo(
    () => filteredProducts.slice(0, 2),
    [filteredProducts]
  );

  const renderProductCard = (product: Product) => {
    const defaultVariant = product.variants[0] || 'Standard';
    const cartEntry = cart.find(
      (c) => c.product.id === product.id && c.variant === defaultVariant
    );
    const inStock = product.isAvailable && product.stock > 0;
    const metrics = popularityByProductId[product.id];
    const orderCount = metrics?.orderCount || 0;
    const isSponsored = sponsoredProductIds.has(product.id);
    const isStoreFeatured = featuredStoreIds.has(product.storeId);

    return (
      <article
        key={product.id}
        className="group ck-card rounded-2xl overflow-hidden flex flex-col justify-between"
      >
        <div>
          <div
            onClick={() => setActivePdpProduct(product)}
            className="relative aspect-[4/3] w-full bg-slate-100 cursor-pointer overflow-hidden border-b border-slate-100/80"
          >
            <ProductStudioArtwork
              preset={product.artworkPreset}
              customImageUrl={product.customImageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            />
            {/* Real order-backed popularity badge only — no fake counts or fabricated badges */}
            {orderCount > 0 && (
              <div className="absolute top-2.5 left-2.5 z-10">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-950 bg-white/95 backdrop-blur-xs border border-emerald-200/80 px-2 py-0.5 rounded-md shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                  Ordered {orderCount} {orderCount === 1 ? 'time' : 'times'}
                </span>
              </div>
            )}
            {/* Transparent, ethical advertising disclosure */}
            {isSponsored && (
              <div className="absolute top-2.5 right-2.5 z-10">
                <span className="text-[10px] font-bold text-amber-950 bg-amber-100/95 border border-amber-300 px-2 py-0.5 rounded-md shadow-2xs">
                  Sponsored
                </span>
              </div>
            )}
          </div>

          <div className="p-3.5 sm:p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-1.5 text-[11px] text-slate-500">
              <button
                type="button"
                onClick={() => handleOpenStorePage(product.storeId)}
                className="hover:text-[#003B8E] hover:underline truncate cursor-pointer font-semibold inline-flex items-center gap-1 text-slate-600 transition-colors"
                title={`Visit ${product.storeName}`}
              >
                <Store className="w-3 h-3 text-[#003B8E] shrink-0" />
                <span className="truncate">{product.storeName}</span>
                {isStoreFeatured && (
                  <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded shrink-0">
                    Featured
                  </span>
                )}
              </button>
              <span className="shrink-0 font-mono tabular-nums text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                {product.deliveryMins}m
              </span>
            </div>

            <h3
              onClick={() => setActivePdpProduct(product)}
              className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#003B8E] cursor-pointer line-clamp-2 leading-snug min-h-[2.5rem] transition-colors"
              title={product.name}
            >
              {product.name}
            </h3>

            <div className="text-[11px] text-slate-500 truncate">
              {product.unit
                ? `${product.unit} · ${product.category}`
                : product.category}
            </div>
          </div>
        </div>

        <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900 tracking-tight">
              {formatCurrency(product.price, product.currency)}
            </div>
            <div
              className={`text-[10px] font-semibold ${
                inStock ? 'text-emerald-700' : 'text-slate-400'
              }`}
            >
              {inStock ? 'In stock' : 'Out of stock'}
            </div>
          </div>

          <div className="flex items-center">
            {cartEntry ? (
              <div className="inline-flex items-center border border-[#003B8E] bg-[#003B8E] text-white rounded-xl shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateCartQuantity(product.id, defaultVariant, -1)
                  }
                  aria-label="Decrease quantity"
                  className="px-2.5 py-1.5 hover:bg-[#002D6E] cursor-pointer transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-2 text-xs font-mono tabular-nums font-bold min-w-[1.25rem] text-center">
                  {cartEntry.quantity}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateCartQuantity(product.id, defaultVariant, 1)
                  }
                  aria-label="Increase quantity"
                  className="px-2.5 py-1.5 hover:bg-[#002D6E] cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!inStock}
                onClick={() =>
                  handleAddToCart(product, defaultVariant, 1, false)
                }
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#F96302] hover:bg-[#E05500] disabled:bg-slate-200 disabled:text-slate-400 rounded-xl transition-all shadow-2xs active:scale-95 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="w-full max-w-none min-h-dvh overflow-x-clip flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* =========================================================
          FULL-WIDTH BUYER-FIRST APPLICATION HEADER
          Official Citykart Logo + Prominent Search + Location + Cart
         ========================================================= */}
      <header className="sticky top-0 z-40 w-full max-w-none bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="w-full max-w-none px-4 sm:px-5 lg:px-6 xl:px-7 py-2.5 flex flex-wrap items-center justify-between gap-3 lg:gap-5">
          {/* LEFT SECTION: Mobile Sidebar Toggle + Official Citykart Logo + Buyer Navigation */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {(viewMode === 'BUYER_HOME' || viewMode === 'STORE_PAGE') && (
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors"
                aria-label="Open categories and filters"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#003B8E]" />
                <span className="hidden sm:inline">Categories</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setViewMode('BUYER_HOME');
                window.scrollTo({top: 0, behavior: 'smooth'});
              }}
              className="whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2.5 group"
            >
              <Image
                src="/citykart-logo.png"
                alt="Citykart.shop official logo"
                width={42}
                height={42}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg object-contain border border-slate-200/80 bg-white shadow-2xs"
                priority
              />
              <div className="flex flex-col text-left">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight leading-none">
                  <span className="text-[#003B8E]">City</span>
                  <span className="text-[#F96302]">kart</span>
                  <span className="text-slate-500 font-semibold text-sm">.shop</span>
                </span>
                <span className="text-[10px] font-medium text-slate-500 tracking-tight hidden sm:inline">
                  Local Stores · Doorstep Delivery
                </span>
              </div>
            </button>

            <nav
              aria-label="Buyer navigation"
              className="hidden xl:flex items-center gap-1.5 text-xs font-semibold text-slate-600 pl-3 border-l border-slate-200"
            >
              <button
                type="button"
                onClick={() => setViewMode('BUYER_HOME')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  viewMode === 'BUYER_HOME' || viewMode === 'STORE_PAGE'
                    ? 'text-[#003B8E] font-bold bg-blue-50/90'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Shop Local
              </button>
              <button
                type="button"
                onClick={() => setViewMode('MY_ORDERS')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  viewMode === 'MY_ORDERS'
                    ? 'text-[#003B8E] font-bold bg-blue-50/90'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                My Orders
              </button>
            </nav>
          </div>

          {/* CENTER SECTION: Prominent Global Search Field */}
          <div className="order-3 md:order-2 w-full md:flex-1 md:max-w-xl lg:max-w-2xl">
            <label htmlFor="header-global-search" className="sr-only">
              Search products or local stores
            </label>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#003B8E] absolute left-3.5 pointer-events-none" />
              <input
                id="header-global-search"
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (viewMode !== 'BUYER_HOME') {
                    setViewMode('BUYER_HOME');
                  }
                }}
                placeholder={`Search products, daily essentials, or stores in ${customerLocation.city || 'your city'}...`}
                className="w-full pl-10 pr-20 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300/90 rounded-xl focus:outline-none focus:border-[#003B8E] focus:ring-2 focus:ring-[#003B8E]/15 focus:bg-white transition-all shadow-2xs placeholder:text-slate-400 text-slate-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 px-2 py-0.5 text-xs font-semibold text-slate-500 hover:text-slate-900 bg-slate-200/70 hover:bg-slate-200 rounded-md cursor-pointer transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* RIGHT SECTION: Selected Location + Single "For Sellers" Access Point + Account + Cart */}
          <div className="order-2 md:order-3 flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Selected Delivery Location Button */}
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-blue-200/80 bg-blue-50/60 hover:bg-blue-50 text-xs text-slate-900 inline-flex items-center gap-1.5 max-w-[165px] sm:max-w-[220px] cursor-pointer transition-colors shadow-2xs"
              title="Change delivery location"
            >
              <MapPin className="w-3.5 h-3.5 text-[#003B8E] shrink-0" />
              <span className="truncate font-semibold">
                {formattedSelectedCityLabel}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
            </button>

            {/* Pricing Link for prospective merchants */}
            <Link
              href="/pricing"
              className="hidden lg:inline-flex px-2.5 py-1.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              Pricing
            </Link>

            {/* ONE CLEAR SELLER ACCESS BUTTON IN HEADER: "For Sellers" -> /seller */}
            <Link
              href="/seller"
              className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-[#003B8E]/40 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all shadow-2xs"
              title="Manage your store or open a new store on Citykart"
            >
              <Store className="w-3.5 h-3.5 text-[#003B8E] shrink-0" />
              <span>For Sellers</span>
            </Link>

            {/* Platform Owner Super Admin Console Link (Shown only to server-verified +918329306616 super_admin) */}
            {isMounted &&
              authenticatedUser?.phoneE164 === '+918329306616' &&
              (authenticatedUser?.role === 'super_admin' ||
                authenticatedUser?.isAdmin === true) && (
                <Link
                  href="/admin"
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-[#003B8E]/30 bg-blue-50/90 hover:bg-[#003B8E] text-[#003B8E] hover:text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all shadow-2xs"
                  title="Open Citykart Platform Owner Super Admin Console"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Super Admin</span>
                </Link>
              )}

            {/* Mobile OTP Account / Sign-in Control */}
            {isMounted && authenticatedUser ? (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs shadow-2xs">
                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <button
                  type="button"
                  onClick={() =>
                    openOtpAuthModal({
                      defaultJourney: 'BUYER',
                      authContextMode: 'BUYER_SIGN_IN',
                    })
                  }
                  className="font-semibold text-slate-900 hover:text-[#003B8E] hover:underline truncate max-w-[110px] cursor-pointer"
                  title={`${authenticatedUser.fullName} (${authenticatedUser.phoneE164})`}
                >
                  {authenticatedUser.fullName}
                </button>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <button
                  type="button"
                  onClick={handleSignOutOtpSession}
                  className="text-slate-500 hover:text-slate-900 underline cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  openOtpAuthModal({
                    defaultJourney: 'BUYER',
                    authContextMode: 'BUYER_SIGN_IN',
                  })
                }
                className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-900 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#003B8E]" />
                <span className="hidden sm:inline">Sign in</span>
              </button>
            )}

            {/* Compact Buyer Orders Link on Medium Screens where XL nav is hidden */}
            <button
              type="button"
              onClick={() => setViewMode('MY_ORDERS')}
              className="hidden sm:inline xl:hidden px-2.5 py-1.5 text-xs font-semibold text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              Orders
            </button>

            {/* High-Intent Cart Button */}
            <button
              type="button"
              onClick={() => {
                setDrawerInitialStep('cart');
                setIsDrawerOpen(true);
              }}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#F96302] hover:bg-[#E05500] rounded-xl transition-all inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-xs active:scale-95 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Cart ({totalCartItems})</span>
              <span aria-hidden="true" className="hidden sm:inline text-orange-200">
                ·
              </span>
              <span className="hidden sm:inline font-mono tabular-nums">
                {formatCurrency(totalCartValue)}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================
          MOBILE / TABLET SLIDE-OVER SIDEBAR DRAWER (< lg)
         ========================================================= */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            aria-hidden="true"
          />
          <div className="relative z-10 w-[300px] max-w-[86vw] h-full bg-[#F8FAFC] p-4 overflow-y-auto shadow-2xl space-y-4">
            <BuyerLeftSidebar
              hasSelectedCity={hasSelectedCity}
              customerLocation={customerLocation}
              formattedLocationFull={formattedLocationFull}
              categories={categories}
              selectedCategory={selectedCategory}
              categoryStoreCounts={categoryStoreCounts}
              categoryProductCounts={categoryProductCounts}
              eligibleStoresInCity={eligibleStoresInCity}
              totalCityProductsCount={totalCityProductsCount}
              selectedStoreFilterId={selectedStoreFilterId}
              onlyDeliverableToMe={onlyDeliverableToMe}
              inStockOnly={inStockOnly}
              sortBy={sortBy}
              onOpenLocationModal={() => setIsLocationModalOpen(true)}
              onQuickSelectCity={handleConfirmBuyerLocation}
              onSelectCategory={(cat) => {
                setSelectedCategory(cat);
                if (viewMode !== 'BUYER_HOME' && viewMode !== 'STORE_PAGE') {
                  setViewMode('BUYER_HOME');
                }
              }}
              onSelectStoreFilter={setSelectedStoreFilterId}
              onToggleOnlyDeliverableToMe={setOnlyDeliverableToMe}
              onToggleInStockOnly={setInStockOnly}
              onChangeSortBy={setSortBy}
              onResetAllFilters={resetCityFilters}
              onCloseMobileDrawer={() => setIsMobileSidebarOpen(false)}
            />

            {/* Seller Links inside Mobile Navigation Drawer */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <Link
                href="/pricing"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="w-full py-2.5 px-3.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center justify-between"
              >
                <span>Merchant Plans &amp; Pricing</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </Link>
              <Link
                href="/seller"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="w-full py-2.5 px-3.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#003B8E]" />
                  <span>For Sellers</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-none">
        {/* =========================================================
            BUYER SUB-VIEW: CUSTOMER "MY ORDERS" PAGE
           ========================================================= */}
        {viewMode === 'MY_ORDERS' && (
          <section className="w-full max-w-none px-4 sm:px-5 lg:px-6 xl:px-7 py-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <button
                  type="button"
                  onClick={() => setViewMode('BUYER_HOME')}
                  className="text-xs font-semibold text-[#003B8E] hover:underline inline-flex items-center gap-1.5 mb-2 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to shopping</span>
                </button>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  My Orders
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Track your live orders from neighborhood stores and review your delivery details.
                </p>
              </div>

              {orders.length > 1 && (
                <select
                  value={activeOrder.id}
                  onChange={(e) => setActiveOrderId(e.target.value)}
                  aria-label="Choose an order"
                  className="px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono focus:outline-none focus:border-[#003B8E]"
                >
                  {orders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      Order #{ord.id} — {ord.storeName} (
                      {formatCurrency(ord.total)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                  <div className="text-xs font-medium text-slate-500">
                    Ordered from <strong className="text-slate-800">{activeOrder.storeName}</strong> at{' '}
                    {activeOrder.createdAt}
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Order #{activeOrder.id} —{' '}
                    <span className="text-[#003B8E]">
                      {activeOrder.orderStatus === 'CANCELLED'
                        ? 'Cancelled'
                        : activeOrder.currentStepIndex === 0
                          ? 'New order received'
                          : activeOrder.currentStepIndex === 1
                            ? 'Preparing your order'
                            : activeOrder.currentStepIndex === 2
                              ? 'Out for delivery'
                              : 'Completed'}
                    </span>
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">
                    Total to pay on delivery
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-[#003B8E]">
                    {formatCurrency(activeOrder.total)}
                  </div>
                </div>
              </div>

              {/* 4 Simple Status Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  {
                    step: 0,
                    title: '1. Order received',
                    desc: 'The store has received your order',
                  },
                  {
                    step: 1,
                    title: '2. Preparing',
                    desc: 'Your items are being packed at the shop',
                  },
                  {
                    step: 2,
                    title: '3. Out for delivery',
                    desc: `On the way to your address (~${activeOrder.estimatedMins} mins)`,
                  },
                  {
                    step: 3,
                    title: '4. Completed',
                    desc: 'Delivered and paid at your door',
                  },
                ].map((milestone) => {
                  const isDone = activeOrder.currentStepIndex >= milestone.step;
                  return (
                    <div
                      key={milestone.step}
                      className={`p-4 rounded-xl border ${
                        isDone
                          ? 'border-[#003B8E] bg-blue-50/40'
                          : 'border-slate-200 bg-white opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                        <span>{milestone.title}</span>
                        {isDone && (
                          <Check className="w-4 h-4 text-emerald-600" />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {milestone.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="pt-5 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#003B8E]" />
                    <span>Delivery address</span>
                  </div>
                  <div className="text-slate-800 font-semibold">
                    {activeOrder.customer.fullName} ·{' '}
                    <span className="font-mono">
                      {activeOrder.customer.phone}
                    </span>
                  </div>
                  <div className="text-slate-600">
                    {activeOrder.customer.address},{' '}
                    {activeOrder.customer.locality}, {activeOrder.customer.city}
                    , {activeOrder.customer.country} —{' '}
                    {activeOrder.customer.postalCode}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-[#003B8E]" />
                    <span>Payment on delivery</span>
                  </div>
                  <div className="text-slate-700">
                    {activeOrder.paymentMethod === 'UPI_ON_DELIVERY'
                      ? `UPI / QR code on delivery (${activeOrder.upiId || 'Scan QR at door'})`
                      : activeOrder.paymentMethod === 'CASH_ON_DELIVERY'
                        ? 'Cash on delivery'
                        : 'Card tap on delivery'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#003B8E]" />
                    <span>Items ordered</span>
                  </div>
                  {activeOrder.items.map((item) => (
                    <div
                      key={`${item.product.id}-${item.variant}`}
                      className="flex justify-between text-slate-700"
                    >
                      <span>
                        {item.quantity}× {item.product.name}
                      </span>
                      <span className="font-mono tabular-nums font-medium">
                        {formatCurrency(
                          item.product.price * item.quantity,
                          item.product.currency
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================
            MAIN DESKTOP TWO-COLUMN SHOPPING INTERFACE
            LEFT: 264–288px Vertically Aligned Sidebar (25 Categories + Store Filters)
            RIGHT: Fluid Full-Width Product & Store Discovery Area
           ========================================================= */}
        {(viewMode === 'BUYER_HOME' || viewMode === 'STORE_PAGE') && (
          <div className="w-full max-w-none px-4 sm:px-5 lg:px-6 xl:px-7 py-5 flex items-start gap-5 xl:gap-6">
            {/* LEFT SIDEBAR (Visible on Desktop/Laptop screens >= 1024px) */}
            <aside
              aria-label="Shopping filters and categories"
              className="hidden lg:block w-[264px] xl:w-[288px] shrink-0 self-start sticky top-[64px] z-20"
            >
              <BuyerLeftSidebar
                hasSelectedCity={hasSelectedCity}
                customerLocation={customerLocation}
                formattedLocationFull={formattedLocationFull}
                categories={categories}
                selectedCategory={selectedCategory}
                categoryStoreCounts={categoryStoreCounts}
                categoryProductCounts={categoryProductCounts}
                eligibleStoresInCity={eligibleStoresInCity}
                totalCityProductsCount={totalCityProductsCount}
                selectedStoreFilterId={selectedStoreFilterId}
                onlyDeliverableToMe={onlyDeliverableToMe}
                inStockOnly={inStockOnly}
                sortBy={sortBy}
                onOpenLocationModal={() => setIsLocationModalOpen(true)}
                onQuickSelectCity={handleConfirmBuyerLocation}
                onSelectCategory={(cat) => {
                  setSelectedCategory(cat);
                }}
                onSelectStoreFilter={(storeId) => {
                  setSelectedStoreFilterId(storeId);
                  if (viewMode === 'STORE_PAGE' && storeId !== 'ALL') {
                    handleOpenStorePage(storeId);
                  }
                }}
                onVisitStorePage={handleOpenStorePage}
                onToggleOnlyDeliverableToMe={setOnlyDeliverableToMe}
                onToggleInStockOnly={setInStockOnly}
                onChangeSortBy={setSortBy}
                onResetAllFilters={resetCityFilters}
              />
            </aside>

            {/* RIGHT CONTENT AREA: Occupies all remaining horizontal space */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Mobile/Tablet Quick Filter Bar (< lg) */}
              <div className="flex lg:hidden flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-900 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#003B8E] shrink-0" />
                  <span>{formattedLocationFull}</span>
                  <span className="underline text-[#003B8E] ml-1">Change</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#003B8E] text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>
                    {selectedCategory === 'All Categories'
                      ? 'Categories & Filters'
                      : selectedCategory}
                  </span>
                </button>
              </div>

              {/* DEDICATED STORE VIEW INSIDE RIGHT CONTENT AREA */}
              {viewMode === 'STORE_PAGE' && activeViewedStore ? (
                <div className="space-y-6">
                  <div>
                    <button
                      type="button"
                      onClick={() => setViewMode('BUYER_HOME')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#003B8E] hover:underline mb-3 cursor-pointer transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to all stores in {customerLocation.city}</span>
                    </button>

                    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
                      {activeViewedStore.coverImageUrl && (
                        <div className="w-full h-36 sm:h-48 bg-slate-100 border-b border-slate-200 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={activeViewedStore.coverImageUrl}
                            alt={`${activeViewedStore.name} cover`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        <div className="space-y-2">
                          <div className="inline-flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200/70 text-[#003B8E] font-semibold">
                              <CategoryIcon
                                categoryIdOrName={activeViewedStore.categoryId}
                                className="w-3.5 h-3.5"
                              />
                              <span>{activeViewedStore.category}</span>
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span>
                              {activeViewedStore.neighborhood},{' '}
                              {activeViewedStore.cityName},{' '}
                              {activeViewedStore.country}
                            </span>
                            {activeViewedStore.isDemo && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600">
                                Demo Store
                              </span>
                            )}
                          </div>

                          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                            {activeViewedStore.name}
                          </h1>

                          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                            {activeViewedStore.specialty} · Address:{' '}
                            <strong className="font-medium text-slate-800">{activeViewedStore.address}</strong>
                          </p>

                          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#003B8E]" />
                              <span>
                                Open: {activeViewedStore.operatingHours}
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>
                                Delivers to:{' '}
                                {activeViewedStore.serviceArea.coveredLocalities.join(
                                  ', '
                                )}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="w-full lg:w-72 space-y-1.5">
                          <label
                            htmlFor="store-product-search"
                            className="block text-xs font-semibold text-slate-700"
                          >
                            Search in {activeViewedStore.name}
                          </label>
                          <div className="relative">
                            <Search className="w-4 h-4 text-[#003B8E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              id="store-product-search"
                              type="search"
                              value={storeSearchQuery}
                              onChange={(e) =>
                                setStoreSearchQuery(e.target.value)
                              }
                              placeholder="Search products in this store..."
                              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#003B8E] focus:bg-white transition-all shadow-2xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        Products from {activeViewedStore.name} (
                        {activeViewedStoreProducts.length})
                      </h2>
                      {selectedCategory !== 'All Categories' && (
                        <button
                          type="button"
                          onClick={() => setSelectedCategory('All Categories')}
                          className="text-xs font-semibold text-[#003B8E] hover:underline cursor-pointer"
                        >
                          Show all categories in this store
                        </button>
                      )}
                    </div>

                    {activeViewedStoreProducts.length === 0 ? (
                      <div className="p-8 sm:p-10 rounded-2xl bg-white border border-slate-200/90 shadow-xs text-center space-y-2 max-w-lg mx-auto">
                        <h3 className="text-base font-bold text-slate-900">
                          No products available in this category in your selected area yet.
                        </h3>
                        <p className="text-xs text-slate-500">
                          Try another category or view all products in{' '}
                          {activeViewedStore.name}.
                        </p>
                        <div className="pt-2 flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setStoreSearchQuery('');
                              setSelectedCategory('All Categories');
                            }}
                            className="px-4 py-2 text-xs font-semibold bg-[#003B8E] hover:bg-[#002D6E] text-white rounded-xl shadow-xs cursor-pointer"
                          >
                            View all store products
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1750px]:grid-cols-6 gap-3.5 sm:gap-4 lg:gap-5">
                        {activeViewedStoreProducts.map((product) =>
                          renderProductCard(product)
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : requiresCitySelection ? (
                /* GATE: DO NOT SHOW CITY-SPECIFIC RESULTS UNTIL BUYER CITY IS IDENTIFIED OR SELECTED */
                <section className="py-8">
                  <div className="p-8 sm:p-10 rounded-2xl bg-white border border-slate-200 text-center space-y-4 max-w-xl mx-auto shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center mx-auto text-[#003B8E]">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Find neighborhood stores near you
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                      Select your city or town to discover verified local stores and daily essentials delivering directly to your doorstep.
                    </p>
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsLocationModalOpen(true)}
                        className="px-5 py-2.5 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white text-xs sm:text-sm font-bold cursor-pointer shadow-xs"
                      >
                        Use my current location
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsLocationModalOpen(true)}
                        className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs sm:text-sm font-semibold cursor-pointer"
                      >
                        Select city manually
                      </button>
                    </div>
                  </div>
                </section>
              ) : eligibleStoresInCity.length === 0 ? (
                /* HELPFUL EMPTY STATE WHEN SELECTED CITY / TOWN / VILLAGE HAS NO STORES YET */
                <section className="py-8">
                  <div className="p-8 sm:p-10 rounded-2xl bg-white border border-slate-200 text-center space-y-4 max-w-xl mx-auto shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center mx-auto text-[#003B8E]">
                      <Store className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                      No stores available in this area yet.
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                      Try another nearby city or check back soon. (Currently viewing{' '}
                      <strong className="text-slate-900">
                        {customerLocation.city}
                        {customerLocation.district
                          ? `, ${customerLocation.district}`
                          : ''}
                        {customerLocation.stateRegion
                          ? `, ${customerLocation.stateRegion}`
                          : ''}
                      </strong>
                      .)
                    </p>
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsLocationModalOpen(true)}
                        className="px-5 py-2.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-semibold cursor-pointer"
                      >
                        Try another nearby city
                      </button>
                      {onlyDeliverableToMe && (
                        <button
                          type="button"
                          onClick={() => setOnlyDeliverableToMe(false)}
                          className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold cursor-pointer"
                        >
                          Show all stores in {customerLocation.city}
                        </button>
                      )}
                      <Link
                        href="/seller"
                        className="px-4 py-2.5 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white text-xs font-bold shadow-xs"
                      >
                        For Sellers — Open a store in {customerLocation.city}
                      </Link>
                    </div>
                  </div>
                </section>
              ) : (
                <>
                  {/* =========================================================
                      EDITORIAL HERO BANNER (SHOWN ON UNFILTERED DISCOVERY)
                      Communicates Citykart's local discovery & direct store delivery value proposition
                     ========================================================= */}
                  {isUnfilteredDiscovery && (
                    <section
                      aria-label="Local marketplace spotlight"
                      className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-hidden"
                    >
                      <div className="grid grid-cols-1 xl:grid-cols-12 items-stretch">
                        {/* Left Editorial Copy & Primary Actions */}
                        <div className="xl:col-span-7 p-6 sm:p-8 flex flex-col justify-between bg-gradient-to-br from-[#003B8E] via-[#00337A] to-[#0B254B] text-white">
                          <div className="space-y-3.5">
                            <div className="inline-flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/15 border border-white/20 text-[11px] font-semibold tracking-wide uppercase text-blue-50">
                                <MapPin className="w-3 h-3 text-[#F96302]" />
                                <span>{customerLocation.city} Neighborhood Marketplace</span>
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-semibold text-emerald-200">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Pay on Delivery</span>
                              </span>
                            </div>

                            <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-extrabold tracking-tight leading-[1.15] text-balance">
                              Shop trusted local stores in {customerLocation.city}, delivered directly to your door.
                            </h1>

                            <p className="text-xs sm:text-sm text-blue-100/90 max-w-xl leading-relaxed">
                              Browse live store inventories across grocery, fresh produce, pharmacy, electronics, and home essentials. Order directly from neighborhood merchants and pay via UPI, Cash, or Card at your doorstep.
                            </p>
                          </div>

                          <div className="pt-5 mt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <a
                                href="#products-grid"
                                className="px-5 py-2.5 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white text-xs sm:text-sm font-bold transition-colors inline-flex items-center gap-2 shadow-sm"
                              >
                                <span>Explore Local Catalog</span>
                                <ArrowRight className="w-4 h-4" />
                              </a>
                              <button
                                type="button"
                                onClick={() => setIsLocationModalOpen(true)}
                                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs sm:text-sm font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <MapPin className="w-3.5 h-3.5 text-orange-300" />
                                <span>Switch City</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-blue-100 font-mono tabular-nums">
                              <div>
                                <strong className="text-white font-bold">{eligibleStoresInCity.length}</strong> active {eligibleStoresInCity.length === 1 ? 'store' : 'stores'}
                              </div>
                              <span aria-hidden="true" className="text-white/30">·</span>
                              <div>
                                <strong className="text-white font-bold">{totalCityProductsCount}</strong> local items
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Live City Product & Store Spotlight */}
                        <div className="xl:col-span-5 p-5 sm:p-6 bg-slate-50/80 flex flex-col justify-between gap-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 inline-flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#F96302]" />
                              <span>Featured in {customerLocation.city}</span>
                            </span>
                            <Link
                              href="/seller"
                              className="text-[11px] font-semibold text-[#003B8E] hover:underline inline-flex items-center gap-1"
                            >
                              <span>Open your store</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {heroSpotlightProducts.map((item) => (
                              <div
                                key={item.id}
                                onClick={() => setActivePdpProduct(item)}
                                className="group bg-white border border-slate-200/90 hover:border-[#003B8E]/50 rounded-xl p-2.5 flex flex-col justify-between cursor-pointer transition-all shadow-2xs"
                              >
                                <div className="relative aspect-[16/10] w-full rounded-lg overflow-hidden bg-slate-100 mb-2">
                                  <ProductStudioArtwork
                                    preset={item.artworkPreset}
                                    customImageUrl={item.customImageUrl}
                                    alt={item.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                </div>
                                <div>
                                  <div className="text-[10px] font-semibold text-[#003B8E] truncate">
                                    {item.storeName}
                                  </div>
                                  <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                                    {item.name}
                                  </div>
                                  <div className="mt-1.5 flex items-center justify-between">
                                    <span className="text-xs font-bold font-mono tabular-nums text-slate-900">
                                      {formatCurrency(item.price, item.currency)}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {item.deliveryMins}m
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Neighborhood Store Quick Chips */}
                          <div className="pt-2 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                            <span className="text-[11px] font-semibold text-slate-500 shrink-0 mr-1">
                              Stores:
                            </span>
                            {eligibleStoresInCity.slice(0, 4).map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => handleOpenStorePage(st.id)}
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-[#003B8E] text-[11px] font-semibold text-slate-700 hover:text-[#003B8E] shrink-0 transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Store className="w-3 h-3 text-[#003B8E]" />
                                <span className="truncate max-w-[130px]">{st.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* =========================================================
                      A. COMPACT PRODUCT-FIRST PAGE HEADING & FILTER BAR
                     ========================================================= */}
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-slate-200/90">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                        {selectedCategory !== 'All Categories'
                          ? `${selectedCategory} in ${customerLocation.city}`
                          : searchQuery.trim()
                            ? `Search results for "${searchQuery.trim()}" in ${customerLocation.city}`
                            : hasValidOrderHistory
                              ? 'Popular products near you'
                              : 'Explore products near you'}
                      </h2>
                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                          Serving{' '}
                          <strong className="font-semibold text-slate-800">
                            {customerLocation.city}
                          </strong>
                          {customerLocation.locality ? ` (${customerLocation.locality})` : ''}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="font-mono tabular-nums font-semibold text-[#003B8E]">
                          {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span>
                          {filteredStores.length} local store{filteredStores.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      {selectedCategory !== 'All Categories' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#003B8E] text-white text-xs font-semibold shadow-2xs">
                          <span>Category: {selectedCategory}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedCategory('All Categories')}
                            aria-label={`Remove filter for ${selectedCategory}`}
                            className="p-0.5 hover:text-blue-200 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {selectedStoreFilterName && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#003B8E] text-white text-xs font-semibold shadow-2xs">
                          <span>Store: {selectedStoreFilterName}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedStoreFilterId('ALL')}
                            aria-label="Remove store filter"
                            className="p-0.5 hover:text-blue-200 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {searchQuery.trim() !== '' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#003B8E] text-white text-xs font-semibold shadow-2xs">
                          <span>Search: &quot;{searchQuery.trim()}&quot;</span>
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            aria-label="Remove search filter"
                            className="p-0.5 hover:text-blue-200 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {inStockOnly && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-[#003B8E] text-xs font-semibold shadow-2xs">
                          <span>In Stock Only</span>
                          <button
                            type="button"
                            onClick={() => setInStockOnly(false)}
                            aria-label="Remove in-stock filter"
                            className="p-0.5 text-[#003B8E] hover:text-slate-900 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {onlyDeliverableToMe && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-[#003B8E] text-xs font-semibold shadow-2xs">
                          <span>Delivers to {customerLocation.locality || 'Locality'}</span>
                          <button
                            type="button"
                            onClick={() => setOnlyDeliverableToMe(false)}
                            aria-label="Remove locality filter"
                            className="p-0.5 text-[#003B8E] hover:text-slate-900 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {(selectedCategory !== 'All Categories' ||
                        selectedStoreFilterId !== 'ALL' ||
                        searchQuery.trim() !== '' ||
                        onlyDeliverableToMe ||
                        inStockOnly ||
                        (sortBy !== 'POPULARITY' && sortBy !== 'RECOMMENDED')) && (
                        <button
                          type="button"
                          onClick={resetCityFilters}
                          className="px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-[#F96302] hover:text-[#E05500] inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Clear all</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Compact matching stores bar when searching */}
                  {searchQuery.trim().length > 0 && filteredStores.length > 0 && (
                    <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5 shrink-0">
                        <Store className="w-3.5 h-3.5 text-[#003B8E]" />
                        <span>Matching local stores ({filteredStores.length}):</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {filteredStores.map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => handleOpenStorePage(st.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:border-[#003B8E] font-semibold text-slate-800 hover:text-[#003B8E] transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>{st.name}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* =========================================================
                      B. UNIFIED PRODUCT DISCOVERY GRID
                     ========================================================= */}
                  {filteredProducts.length === 0 ? (
                    <section className="py-6">
                      <div className="p-8 sm:p-10 rounded-2xl bg-white border border-slate-200/90 shadow-xs text-center space-y-3 max-w-lg mx-auto">
                        <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center mx-auto text-[#003B8E]">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900">
                          {selectedCategory !== 'All Categories'
                            ? 'No products available in this category in your selected area yet.'
                            : 'No products available in this area yet.'}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Try selecting another category from the left sidebar or browse all products in {customerLocation.city}.
                        </p>
                        <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                          <button
                            type="button"
                            onClick={resetCityFilters}
                            className="px-4 py-2 text-xs font-bold bg-[#F96302] hover:bg-[#E05500] text-white rounded-xl cursor-pointer shadow-xs transition-colors"
                          >
                            Show all products in {customerLocation.city}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsLocationModalOpen(true)}
                            className="px-4 py-2 text-xs font-semibold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl cursor-pointer transition-colors"
                          >
                            Change location
                          </button>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <section
                      id="products-grid"
                      aria-label="Products available in your city"
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="font-medium">
                          {hasValidOrderHistory && (sortBy === 'POPULARITY' || sortBy === 'RECOMMENDED')
                            ? 'Ranked by genuine order popularity (most ordered first)'
                            : sortBy === 'PRICE_ASC'
                              ? 'Sorted by price: low to high'
                              : sortBy === 'PRICE_DESC'
                                ? 'Sorted by price: high to low'
                                : sortBy === 'DELIVERY_FASTEST'
                                  ? 'Sorted by fastest local dispatch'
                                  : 'Showing local products serving your city'}
                        </span>
                        <span className="font-mono tabular-nums text-slate-400">
                          {filteredProducts.length} item{filteredProducts.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1750px]:grid-cols-6 gap-3.5 sm:gap-4 lg:gap-5">
                        {filteredProducts.map((product) =>
                          renderProductCard(product)
                        )}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* =========================================================
          CRAWLABLE FULL-WIDTH E-COMMERCE FOOTER (SEO & E-E-A-T)
         ========================================================= */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="w-full max-w-none px-4 sm:px-5 lg:px-6 xl:px-7 py-10 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 text-xs">
            {/* Column 1: Brand & Value Proposition */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/citykart-logo.png"
                  alt="Citykart.shop"
                  width={38}
                  height={38}
                  className="h-9 w-9 rounded-lg object-contain border border-slate-200/80"
                />
                <span className="text-base font-extrabold tracking-tight">
                  <span className="text-[#003B8E]">City</span>
                  <span className="text-[#F96302]">kart</span>
                  <span className="text-slate-500 font-semibold text-xs">.shop</span>
                </span>
              </div>
              <p className="text-slate-500 leading-relaxed max-w-xs">
                Global intra-city commerce connecting verified local merchants with neighborhood buyers. Real-time catalog browsing and fast doorstep delivery.
              </p>
              <div className="text-[11px] text-slate-400">
                Operating in Nanded, Mumbai, Pune, Delhi NCR, Bangalore, and expanding worldwide.
              </div>
            </div>

            {/* Column 2: Popular Categories (Crawlable Deep Links) */}
            <div className="space-y-3">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Popular Categories
              </div>
              <ul className="space-y-2 text-slate-600">
                <li>
                  <Link href="/categories/grocery-daily-essentials" className="hover:text-[#003B8E] hover:underline">
                    Grocery &amp; Daily Essentials
                  </Link>
                </li>
                <li>
                  <Link href="/categories/fruits-vegetables" className="hover:text-[#003B8E] hover:underline">
                    Fruits &amp; Vegetables
                  </Link>
                </li>
                <li>
                  <Link href="/categories/electronics-mobile-accessories" className="hover:text-[#003B8E] hover:underline">
                    Electronics &amp; Accessories
                  </Link>
                </li>
                <li>
                  <Link href="/categories/fashion-clothing" className="hover:text-[#003B8E] hover:underline">
                    Fashion &amp; Clothing
                  </Link>
                </li>
                <li>
                  <Link href="/categories/pharmacy-healthcare-products" className="hover:text-[#003B8E] hover:underline">
                    Pharmacy &amp; Healthcare
                  </Link>
                </li>
                <li>
                  <Link href="/categories/bakery-sweets-desserts" className="hover:text-[#003B8E] hover:underline">
                    Bakery, Sweets &amp; Desserts
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Platform & For Sellers */}
            <div className="space-y-3">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Platform &amp; Merchants
              </div>
              <ul className="space-y-2 text-slate-600">
                <li>
                  <Link href="/about" className="hover:text-[#003B8E] hover:underline">
                    About Citykart
                  </Link>
                </li>
                <li>
                  <Link href="/how-it-works" className="hover:text-[#003B8E] hover:underline">
                    How Shopping Works
                  </Link>
                </li>
                <li>
                  <Link href="/seller-guide" className="hover:text-[#003B8E] hover:underline">
                    How to Open a Store
                  </Link>
                </li>
                <li>
                  <Link href="/seller" className="font-semibold text-[#003B8E] hover:underline">
                    Seller Portal &amp; Registration
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-[#003B8E] hover:underline">
                    Merchant Plans &amp; Pricing
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Help & Legal Policies */}
            <div className="space-y-3">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Help &amp; Trust
              </div>
              <ul className="space-y-2 text-slate-600">
                <li>
                  <Link href="/contact" className="hover:text-[#003B8E] hover:underline">
                    Contact &amp; Customer Support
                  </Link>
                </li>
                <li>
                  <Link href="/delivery-returns" className="hover:text-[#003B8E] hover:underline">
                    Delivery, Tracking &amp; Returns
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-[#003B8E] hover:underline">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-[#003B8E] hover:underline">
                    Terms &amp; Conditions
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              © {new Date().getFullYear()} Citykart Intra-City Platform. All rights reserved.
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span>Cash &amp; UPI on Delivery</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>Direct Neighborhood Dispatch</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>25 Approved Categories</span>
            </div>
          </div>
        </div>
      </footer>

      {/* LOCATION SELECTION DIALOG */}
      <LocationSelectorModal
        key={`${shouldShowLocationModal}-${customerLocation.city}-${customerLocation.country}`}
        isOpen={shouldShowLocationModal}
        canClose={hasSelectedCity}
        currentLocation={customerLocation}
        stores={stores}
        onConfirmLocation={handleConfirmBuyerLocation}
        onClose={() => setIsLocationModalOpen(false)}
      />

      {/* PRODUCT DETAIL MODAL */}
      <ProductDetailModal
        product={activePdpProduct}
        store={
          activePdpProduct
            ? stores.find((s) => s.id === activePdpProduct.storeId)
            : undefined
        }
        customerLocation={customerLocation}
        onClose={() => setActivePdpProduct(null)}
        onViewStore={handleOpenStorePage}
        onAddToCart={handleAddToCart}
      />

      {/* CART & CHECKOUT DRAWER */}
      <CartCheckoutDrawer
        key={`${isDrawerOpen}-${drawerInitialStep}-${customerLocation.city}-${customerLocation.locality}`}
        isOpen={isDrawerOpen}
        initialStep={drawerInitialStep}
        items={cart}
        stores={stores}
        customerLocation={customerLocation}
        onClose={() => setIsDrawerOpen(false)}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onPlaceOrder={handlePlaceOrder}
        onViewOrderTracker={(orderId) => {
          setActiveOrderId(orderId);
          setViewMode('MY_ORDERS');
          window.scrollTo({top: 0, behavior: 'smooth'});
        }}
      />
    </div>
  );
}
