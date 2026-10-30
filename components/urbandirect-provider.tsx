'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  CartItem,
  CustomerShoppingLocation,
  CategoryDefinition,
  INITIAL_PRODUCTS,
  INITIAL_STORES,
  INITIAL_SELLERS,
  AUTHORITATIVE_STORE_CATEGORIES,
  LocalStore,
  OrderRecord,
  Product,
  SellerProfile,
  StoreCategoryId,
  UserAccount,
  PaymentMethod,
  isStoreEligibleForSelectedCity,
  normalizeCityId,
} from '@/lib/catalog-data';
import { buildAuthenticatedHeaders } from '@/lib/firebase';
import { MobileOtpAuthModal, OtpAuthContextMode } from './mobile-otp-auth-modal';

export const AUTH_USER_STORAGE_KEY = 'urbandirect_user';

const DEMO_PRODUCT = INITIAL_PRODUCTS[0] || {
  id: 'p1',
  sellerId: 'seller-1',
  storeId: 'store-1',
  storeName: 'Nanded Spice & Kirana Bazaar',
  sku: 'NSB-001',
  name: 'Organic Turmeric Powder (Haldi)',
  categoryId: 'cat-01-grocery-daily-essentials' as StoreCategoryId,
  category: 'Grocery & Daily Essentials' as const,
  price: 180,
  deliveryCharge: 0,
  currency: 'INR',
  unit: '500g Pack',
  city: 'Nanded · Vazirabad',
  neighborhood: 'Vazirabad',
  distanceKm: 1.2,
  deliveryMins: 25,
  stock: 40,
  isAvailable: true,
  rating: 4.9,
  reviewsCount: 42,
  description: 'Pure single-origin organic turmeric powder from Nanded.',
  dimensions: '500g Pouch',
  materials: '100% Organic Curcuma Longa',
  variants: ['500g Pack', '1kg Pack'],
  statusNote: 'Fresh Batch',
  artworkPreset: 'matcha_ceremonial' as const,
};

export const INITIAL_DEMO_ORDER: OrderRecord = {
  id: 'demo-order-101',
  createdAt: 'Today, 11:30 AM',
  createdAtIso: new Date().toISOString(),
  storeId: DEMO_PRODUCT.storeId || 'store-1',
  storeName: DEMO_PRODUCT.storeName || 'Nanded Spice & Kirana Bazaar',
  sellerId: DEMO_PRODUCT.sellerId || 'seller-1',
  items: [
    {
      productId: DEMO_PRODUCT.id,
      storeId: DEMO_PRODUCT.storeId,
      productName: DEMO_PRODUCT.name,
      price: DEMO_PRODUCT.price,
      quantity: 2,
      unit: DEMO_PRODUCT.unit,
      product: DEMO_PRODUCT,
      variant: DEMO_PRODUCT.variants?.[0] || 'Standard',
      platformFee: 5,
    },
  ],
  subtotal: DEMO_PRODUCT.price * 2,
  deliveryFee: 0,
  discount: 0,
  totalPlatformFee: 5,
  total: DEMO_PRODUCT.price * 2 + 5,
  paymentMethod: 'PAY_ON_DELIVERY',
  paymentStatus: 'PENDING',
  customer: {
    fullName: 'Rahul Sharma',
    phone: '+91 98765 43210',
    country: 'India',
    stateRegion: 'Maharashtra',
    address: 'Plot 14, Vazirabad Main Road',
    city: 'Nanded',
    locality: 'Vazirabad',
    postalCode: '431601',
    notes: 'Call at gate upon arrival',
  },
  currentStepIndex: 1,
  orderStatus: 'PREPARING',
  isDemo: true,
  estimatedMins: 25,
};

export const INITIAL_DELIVERED_DEMO_ORDER: OrderRecord = {
  id: 'demo-order-102',
  createdAt: 'Yesterday, 6:15 PM',
  createdAtIso: new Date(Date.now() - 86400000).toISOString(),
  storeId: DEMO_PRODUCT.storeId || 'store-1',
  storeName: DEMO_PRODUCT.storeName || 'Nanded Spice & Kirana Bazaar',
  sellerId: DEMO_PRODUCT.sellerId || 'seller-1',
  items: [
    {
      productId: DEMO_PRODUCT.id,
      storeId: DEMO_PRODUCT.storeId,
      productName: DEMO_PRODUCT.name,
      price: DEMO_PRODUCT.price,
      quantity: 1,
      unit: DEMO_PRODUCT.unit,
      product: DEMO_PRODUCT,
      variant: DEMO_PRODUCT.variants?.[0] || 'Standard',
      platformFee: 5,
    },
  ],
  subtotal: DEMO_PRODUCT.price,
  deliveryFee: 0,
  discount: 0,
  totalPlatformFee: 5,
  total: DEMO_PRODUCT.price + 5,
  paymentMethod: 'PAY_ON_DELIVERY',
  paymentStatus: 'PAID',
  paymentCollectionMethod: 'UPI_ON_DELIVERY',
  customer: {
    fullName: 'Rahul Sharma',
    phone: '+91 98765 43210',
    country: 'India',
    stateRegion: 'Maharashtra',
    address: 'Plot 14, Vazirabad Main Road',
    city: 'Nanded',
    locality: 'Vazirabad',
    postalCode: '431601',
    notes: 'Delivered at main gate',
  },
  currentStepIndex: 3,
  orderStatus: 'DELIVERED',
  deliveredAt: new Date(Date.now() - 82800000).toISOString(),
  deliveryPinVerified: true,
  isDemo: true,
  estimatedMins: 25,
};

export interface SellerNotificationItem {
  id: string;
  orderId: string;
  storeId: string;
  title: string;
  body: string;
  message?: string;
  buyerPhone?: string;
  buyerFullAddress?: string;
  deliveryNotes?: string;
  smsText?: string;
  createdAt: string;
  isRead: boolean;
}

export interface BuyerPinVaultEntry {
  orderId: string;
  pin: string;
  updatedAt: string;
  accessToken?: string;
  buyerAccessToken?: string;
  unifiedNotification?: import('@/lib/catalog-data').BuyerUnifiedOrderNotification;
}

interface UrbanDirectContextType {
  isMounted: boolean;
  authenticatedUser: UserAccount | null;
  setAuthenticatedUser: (user: UserAccount | null) => void;
  categories: CategoryDefinition[];
  customerLocation: CustomerShoppingLocation;
  hasSelectedCity: boolean;
  isBuyerCityLocked: boolean;
  setCustomerLocation: (loc: CustomerShoppingLocation) => void;
  handleConfirmBuyerLocation: (loc: CustomerShoppingLocation) => void;
  isLocationModalOpen: boolean;
  setIsLocationModalOpen: (val: boolean) => void;
  sellers: SellerProfile[];
  stores: LocalStore[];
  setStores: React.Dispatch<React.SetStateAction<LocalStore[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  userOwnedStores: LocalStore[];
  hasSellerRole: boolean;
  hasCompletedStore: boolean;
  cart: CartItem[];
  totalCartItems: number;
  totalCartValue: number;
  cartTotal: number;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  handleAddToCart: (product: Product, variant?: string, quantity?: number) => void;
  handleUpdateCartQuantity: (productId: string, variant: string, delta: number) => void;
  handleRemoveCartItem: (productId: string, variant: string) => void;
  orders: OrderRecord[];
  activeOrdersCount: number;
  placeOrder: (customerDetails: {
    fullName: string;
    phoneE164: string;
    deliveryAddress: string;
    locality?: string;
  }) => Promise<{ ok: boolean; order?: OrderRecord; error?: string }>;
  handlePlaceOrder: (newOrder: OrderRecord) => void;
  handleCancelOrder: (orderId: string, reason?: string) => boolean;
  getBuyerPinVaultEntry: (orderId: string) => BuyerPinVaultEntry | undefined;
  regenerateBuyerDeliveryPin: (orderId: string) => Promise<{ ok: boolean; deliveryPin?: string; error?: string }>;
  handleRegenerateBuyerDeliveryPin: (orderId: string) => Promise<{ ok: boolean; pin?: string; message?: string; error?: string }>;
  handleSignOutOtpSession: () => void;
  openOtpAuthModal: (options?: {
    defaultJourney?: 'BUYER' | 'SELLER';
    authContextMode?: OtpAuthContextMode;
    legacySellerId?: string;
    onSuccessCallback?: (user: UserAccount) => void;
  }) => void;
  showToast: (message: string) => void;
  handleAddSellerAndStore: (newSeller: SellerProfile, newStore: LocalStore) => void;
  handleUpdateStoreSettings: (updatedStore: LocalStore) => void;
  handleDeleteStore: (
    storeId: string,
    storeNameConfirm?: string
  ) => Promise<{ ok: boolean; success: boolean; message: string }>;
  permanentlyDeleteStore: (
    storeId: string,
    reason?: string
  ) => Promise<{ ok: boolean; success: boolean; message: string }>;
  handleAddProduct: (newProduct: Product, options?: { skipServerSync?: boolean }) => void;
  handleUpdateProduct: (updatedProduct: Product) => void;
  handleDeleteProduct: (productId: string) => void;
  handleUpdateStock: (
    productId: string,
    nextStock: number,
    isAvailableOrActor?: boolean | string,
    isAdmin?: boolean
  ) => void;
  handleSetOrderStep: (
    orderId: string,
    stepIndex: number,
    explicitStatus?: OrderRecord['orderStatus'],
    reason?: string
  ) => void;
  handleSubmitStoreRating: (orderId: string, rating: number, comment?: string) => void;
  handleToggleCategoryStatus: (categoryId: StoreCategoryId) => void;
  handleVerifyOrderDeliveryPin: (
    orderId: string,
    pinInput: string,
    actorRole?: 'SELLER' | 'DELIVERY_AGENT' | string
  ) => Promise<{ ok: boolean; success: boolean; message: string }>;
  handleUpdateOrderPaymentStatus: (
    orderId: string,
    status: 'PENDING' | 'PAID' | 'DISPUTED',
    collectionMethodOrOptions?:
      | PaymentMethod
      | {
          actorSellerId?: string;
          collectionMethod?: PaymentMethod | string;
          referenceNote?: string;
        },
    referenceNote?: string
  ) => Promise<{ ok: boolean; success: boolean; message: string }>;
  sellerNotifications: SellerNotificationItem[];
  unreadNotificationCount: number;
  handleMarkNotificationRead: (notificationId: string) => void;
  handleClearNotifications: () => void;
}

const UrbanDirectContext = createContext<UrbanDirectContextType | null>(null);

const DEFAULT_LOCATION: CustomerShoppingLocation = {
  mode: 'SELECTED_LOCATION',
  country: 'India',
  countryCode: 'IN',
  stateRegion: 'Maharashtra',
  district: 'Nanded',
  cityId: 'india-maharashtra-nanded',
  city: 'Nanded',
  locality: 'Vazirabad',
  postalCode: '431601',
};

export function UrbanDirectProvider({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [customerLocation, setCustomerLocation] = useState<CustomerShoppingLocation>(DEFAULT_LOCATION);
  const [categories, setCategories] = useState<CategoryDefinition[]>(AUTHORITATIVE_STORE_CATEGORIES);
  const [sellers, setSellers] = useState<SellerProfile[]>(INITIAL_SELLERS);
  const [stores, setStores] = useState<LocalStore[]>(INITIAL_STORES);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([
    INITIAL_DEMO_ORDER,
    INITIAL_DELIVERED_DEMO_ORDER,
  ]);
  const [authenticatedUser, setAuthenticatedUser] = useState<UserAccount | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sellerNotifications, setSellerNotifications] = useState<SellerNotificationItem[]>([]);
  const [pinVault, setPinVault] = useState<Record<string, BuyerPinVaultEntry>>({
    [INITIAL_DEMO_ORDER.id]: {
      orderId: INITIAL_DEMO_ORDER.id,
      pin: '482915',
      updatedAt: new Date().toISOString(),
    },
  });

  // OTP Auth Modal State
  const [otpModalState, setOtpModalState] = useState<{
    isOpen: boolean;
    defaultJourney: 'BUYER' | 'SELLER';
    authContextMode: OtpAuthContextMode;
    legacySellerId?: string;
    onSuccessCallback?: (user: UserAccount) => void;
  }>({
    isOpen: false,
    defaultJourney: 'BUYER',
    authContextMode: 'BUYER_SIGN_IN',
  });

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('urbandirect_session_token');
      const storedUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as UserAccount;
          setAuthenticatedUser(parsedUser);
          if (parsedUser.lockedCity) {
            setCustomerLocation((prev) => ({
              ...prev,
              mode: 'SELECTED_LOCATION',
              city: parsedUser.lockedCity!,
              cityId:
                parsedUser.lockedCityId ||
                normalizeCityId(
                  parsedUser.lockedCountry || prev.country || 'India',
                  parsedUser.lockedStateRegion || prev.stateRegion || 'Maharashtra',
                  parsedUser.lockedCity!
                ),
              stateRegion: parsedUser.lockedStateRegion || prev.stateRegion,
              country: parsedUser.lockedCountry || prev.country,
              countryCode: parsedUser.lockedCountryCode || prev.countryCode,
              locality: parsedUser.lockedLocality || prev.locality,
              postalCode: parsedUser.lockedPostalCode || prev.postalCode,
            }));
          }
        } catch {
          // Ignore parse error
        }
      }
      if (storedToken) {
        fetch('/api/auth/otp', {
          headers: { 'x-urbandirect-session': storedToken },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.ok && data.user) {
              const serverUser = data.user as UserAccount;
              setAuthenticatedUser((prevUser) => {
                const mergedUser: UserAccount = {
                  ...serverUser,
                  lockedCity: serverUser.lockedCity || prevUser?.lockedCity,
                  lockedCityId: serverUser.lockedCityId || prevUser?.lockedCityId,
                  lockedStateRegion:
                    serverUser.lockedStateRegion || prevUser?.lockedStateRegion,
                  lockedCountry:
                    serverUser.lockedCountry || prevUser?.lockedCountry,
                  lockedCountryCode:
                    serverUser.lockedCountryCode || prevUser?.lockedCountryCode,
                  lockedLocality:
                    serverUser.lockedLocality || prevUser?.lockedLocality,
                  lockedPostalCode:
                    serverUser.lockedPostalCode || prevUser?.lockedPostalCode,
                  cityLockedAt:
                    serverUser.cityLockedAt || prevUser?.cityLockedAt,
                };
                localStorage.setItem(
                  AUTH_USER_STORAGE_KEY,
                  JSON.stringify(mergedUser)
                );
                return mergedUser;
              });
            }
          })
          .catch(() => {});
      }
      try {
        // Hydrate custom sellers, stores, and products from localStorage
        const customSellersRaw = localStorage.getItem('urbandirect_custom_sellers_v1');
        if (customSellersRaw) {
          const parsedSellers = JSON.parse(customSellersRaw) as SellerProfile[];
          if (Array.isArray(parsedSellers) && parsedSellers.length > 0) {
            setSellers((prev) => {
              const map = new Map<string, SellerProfile>();
              for (const s of prev) map.set(s.id, s);
              for (const s of parsedSellers) map.set(s.id, s);
              return Array.from(map.values());
            });
          }
        }

        const customStoresRaw = localStorage.getItem('urbandirect_custom_stores_v1');
        if (customStoresRaw) {
          const parsedStores = JSON.parse(customStoresRaw) as LocalStore[];
          if (Array.isArray(parsedStores) && parsedStores.length > 0) {
            setStores((prev) => {
              const map = new Map<string, LocalStore>();
              for (const s of prev) map.set(s.id, s);
              for (const s of parsedStores) map.set(s.id, s);
              return Array.from(map.values());
            });
          }
        }

        const customProductsRaw = localStorage.getItem('urbandirect_custom_products_v1');
        if (customProductsRaw) {
          const parsedProducts = JSON.parse(customProductsRaw) as Product[];
          if (Array.isArray(parsedProducts) && parsedProducts.length > 0) {
            setProducts((prev) => {
              const map = new Map<string, Product>();
              for (const p of prev) map.set(p.id, p);
              for (const p of parsedProducts) map.set(p.id, p);
              return Array.from(map.values());
            });
          }
        }

        // Hydrate custom orders and PIN vault from localStorage
        const savedPinVaultRaw = localStorage.getItem('urbandirect_pin_vault_v1');
        if (savedPinVaultRaw) {
          const parsedPinVault = JSON.parse(savedPinVaultRaw) as Record<
            string,
            BuyerPinVaultEntry
          >;
          if (parsedPinVault && typeof parsedPinVault === 'object') {
            setPinVault((prev) => ({ ...prev, ...parsedPinVault }));
          }
        }

        const customOrdersRaw = localStorage.getItem('urbandirect_custom_orders_v1');
        if (customOrdersRaw) {
          const parsedOrders = JSON.parse(customOrdersRaw) as OrderRecord[];
          if (Array.isArray(parsedOrders) && parsedOrders.length > 0) {
            setOrders((prev) => {
              const map = new Map<string, OrderRecord>();
              for (const o of parsedOrders) map.set(o.id, o);
              for (const o of prev) {
                if (!map.has(o.id)) map.set(o.id, o);
              }
              return Array.from(map.values());
            });
          }
        }

        const savedStoreRatingsRaw = localStorage.getItem('urbandirect_store_ratings_v1');
        if (savedStoreRatingsRaw) {
          const parsedRatings = JSON.parse(savedStoreRatingsRaw) as Record<
            string,
            { rating: number; reviewsCount: number }
          >;
          setStores((prev) =>
            prev.map((st) =>
              parsedRatings[st.id]
                ? {
                    ...st,
                    rating: parsedRatings[st.id].rating,
                    reviewsCount: parsedRatings[st.id].reviewsCount,
                  }
                : st
            )
          );
        }
        const savedOrderRatingsRaw = localStorage.getItem('urbandirect_order_ratings_v1');
        if (savedOrderRatingsRaw) {
          const parsedOrderRatings = JSON.parse(savedOrderRatingsRaw) as Record<
            string,
            {
              storeRating: number;
              storeReviewComment?: string;
              storeRatedAt: string;
              orderStatus?: OrderRecord['orderStatus'];
              currentStepIndex?: number;
            }
          >;
          setOrders((prev) =>
            prev.map((ord) =>
              parsedOrderRatings[ord.id]
                ? {
                    ...ord,
                    storeRating: parsedOrderRatings[ord.id].storeRating,
                    storeReviewComment: parsedOrderRatings[ord.id].storeReviewComment,
                    storeRatedAt: parsedOrderRatings[ord.id].storeRatedAt,
                    orderStatus: parsedOrderRatings[ord.id].orderStatus || ord.orderStatus,
                    currentStepIndex:
                      typeof parsedOrderRatings[ord.id].currentStepIndex === 'number'
                        ? parsedOrderRatings[ord.id].currentStepIndex!
                        : ord.currentStepIndex,
                  }
                : ord
            )
          );
        }
      } catch {
        // Ignore storage read error
      }

      // Sync stores, products, and orders from server APIs on mount
      fetch('/api/stores')
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && Array.isArray(data.stores)) {
            setStores((prev) => {
              const map = new Map<string, LocalStore>();
              for (const s of prev) map.set(s.id, s);
              for (const s of data.stores as LocalStore[]) map.set(s.id, s);
              return Array.from(map.values());
            });
          }
          if (data.ok && Array.isArray(data.sellers)) {
            setSellers((prev) => {
              const map = new Map<string, SellerProfile>();
              for (const s of prev) map.set(s.id, s);
              for (const s of data.sellers as SellerProfile[]) map.set(s.id, s);
              return Array.from(map.values());
            });
          }
        })
        .catch(() => {});

      fetch('/api/products')
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && Array.isArray(data.products)) {
            setProducts((prev) => {
              const map = new Map<string, Product>();
              for (const p of prev) map.set(p.id, p);
              for (const p of data.products as Product[]) map.set(p.id, p);
              return Array.from(map.values());
            });
          }
        })
        .catch(() => {});

      fetch('/api/orders')
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && Array.isArray(data.orders)) {
            setOrders((prev) => {
              const map = new Map<string, OrderRecord>();
              for (const o of data.orders as OrderRecord[]) map.set(o.id, o);
              for (const o of prev) {
                if (!map.has(o.id)) map.set(o.id, o);
              }
              return Array.from(map.values());
            });
            setPinVault((prev) => {
              const next = { ...prev };
              for (const o of data.orders as OrderRecord[]) {
                const pin = o.buyerDeliveryPin || o.deliveryPin;
                if (pin && !next[o.id]) {
                  next[o.id] = {
                    orderId: o.id,
                    pin,
                    updatedAt: new Date().toISOString(),
                    accessToken: o.buyerOrderAccessToken,
                  };
                }
              }
              return next;
            });
          }
        })
        .catch(() => {});
    }
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 4000);
  }, []);

  const hasSelectedCity = Boolean(
    customerLocation.mode === 'SELECTED_LOCATION' && customerLocation.city?.trim()
  );

  const isBuyerCityLocked = Boolean(authenticatedUser);

  // Ensure authenticatedUser always has a lockedCity and keep customerLocation locked to it
  useEffect(() => {
    if (!authenticatedUser) return;
    const lockedCityName = authenticatedUser.lockedCity?.trim();
    if (lockedCityName) {
      if (
        customerLocation.city.trim().toLowerCase() !==
        lockedCityName.toLowerCase()
      ) {
        setCustomerLocation((prev) => ({
          ...prev,
          mode: 'SELECTED_LOCATION',
          city: lockedCityName,
          cityId:
            authenticatedUser.lockedCityId ||
            normalizeCityId(
              authenticatedUser.lockedCountry || prev.country || 'India',
              authenticatedUser.lockedStateRegion || prev.stateRegion || 'Maharashtra',
              lockedCityName
            ),
          stateRegion: authenticatedUser.lockedStateRegion || prev.stateRegion,
          country: authenticatedUser.lockedCountry || prev.country,
          countryCode: authenticatedUser.lockedCountryCode || prev.countryCode,
          locality: authenticatedUser.lockedLocality || prev.locality,
          postalCode: authenticatedUser.lockedPostalCode || prev.postalCode,
        }));
      }
    } else if (customerLocation.city?.trim()) {
      // Backfill lockedCity onto legacy user sessions immediately
      const updatedUser: UserAccount = {
        ...authenticatedUser,
        lockedCity: customerLocation.city,
        lockedCityId:
          customerLocation.cityId ||
          normalizeCityId(
            customerLocation.country || 'India',
            customerLocation.stateRegion || 'Maharashtra',
            customerLocation.city
          ),
        lockedStateRegion: customerLocation.stateRegion,
        lockedCountry: customerLocation.country,
        lockedCountryCode: customerLocation.countryCode,
        lockedLocality: customerLocation.locality,
        lockedPostalCode: customerLocation.postalCode,
        cityLockedAt: new Date().toISOString(),
      };
      setAuthenticatedUser(updatedUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(updatedUser));
      }
    }
  }, [authenticatedUser, customerLocation]);

  // Remove any cross-city items from cart if city is locked
  useEffect(() => {
    if (!hasSelectedCity || cart.length === 0) return;
    setCart((prev) => {
      const validItems = prev.filter((item) => {
        const storeId = item.product?.storeId || item.storeId;
        const store = stores.find((s) => s.id === storeId);
        if (!store) return true;
        return isStoreEligibleForSelectedCity(store, customerLocation);
      });
      return validItems.length === prev.length ? prev : validItems;
    });
  }, [customerLocation, hasSelectedCity, stores, cart.length]);

  const handleSetCustomerLocationGuarded = useCallback(
    (newLoc: CustomerShoppingLocation) => {
      if (authenticatedUser) {
        const lockedCity =
          authenticatedUser.lockedCity || customerLocation.city;
        if (
          lockedCity &&
          newLoc.city &&
          newLoc.city.trim().toLowerCase() !== lockedCity.trim().toLowerCase()
        ) {
          showToast(
            `Your shopping city is locked to ${lockedCity}. Citykart is a hyperlocal marketplace and delivers within ${lockedCity} only.`
          );
          return;
        }
      }
      setCustomerLocation(newLoc);
    },
    [authenticatedUser, customerLocation.city, showToast]
  );

  const handleConfirmBuyerLocation = useCallback(
    (newLoc: CustomerShoppingLocation) => {
      if (authenticatedUser) {
        const lockedCity =
          authenticatedUser.lockedCity || customerLocation.city;
        if (
          lockedCity &&
          newLoc.city &&
          newLoc.city.trim().toLowerCase() !== lockedCity.trim().toLowerCase()
        ) {
          showToast(
            `Your shopping city is locked to ${lockedCity}. Citykart is a hyperlocal marketplace and delivers within ${lockedCity} only.`
          );
          setIsLocationModalOpen(false);
          return;
        }
      }
      setCustomerLocation({
        ...newLoc,
        mode: 'SELECTED_LOCATION',
      });
      setIsLocationModalOpen(false);
    },
    [authenticatedUser, customerLocation.city, showToast]
  );

  const handleSetIsLocationModalOpenGuarded = useCallback(
    (val: boolean) => {
      if (val && authenticatedUser) {
        const lockedCity =
          authenticatedUser.lockedCity || customerLocation.city;
        showToast(
          `Your city is locked to ${lockedCity} during your logged-in session. Delivery of products is within ${lockedCity} only.`
        );
        return;
      }
      setIsLocationModalOpen(val);
    },
    [authenticatedUser, customerLocation.city, showToast]
  );

  const handleAddToCart = useCallback(
    (product: Product, variant = 'Standard', quantity = 1) => {
      const productStore = stores.find((s) => s.id === product.storeId);
      if (
        productStore &&
        hasSelectedCity &&
        !isStoreEligibleForSelectedCity(productStore, customerLocation)
      ) {
        showToast(
          `Cannot add item: ${productStore.name} is in ${productStore.cityName}. Delivery of products is strictly within ${customerLocation.city} only.`
        );
        return;
      }

      const targetVariant = variant || product.variants?.[0] || 'Standard';
      setCart((prev) => {
        const existingIndex = prev.findIndex(
          (item) =>
            (item.product?.id || item.productId) === product.id &&
            (item.variant || 'Standard') === targetVariant
        );
        if (existingIndex > -1) {
          return prev.map((item, idx) =>
            idx === existingIndex
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            storeId: product.storeId,
            productName: product.name,
            price: product.price,
            unit: product.unit,
            imageUrl: product.customImageUrl,
            product,
            variant: targetVariant,
            quantity,
            platformFee: 5,
          },
        ];
      });
    },
    [stores, hasSelectedCity, customerLocation, showToast]
  );

  const addToCart = useCallback(
    (product: Product, quantity = 1) => {
      handleAddToCart(product, product.variants?.[0] || 'Standard', quantity);
    },
    [handleAddToCart]
  );

  const handleRemoveCartItem = useCallback((productId: string, variant = 'Standard') => {
    setCart((prev) =>
      prev.filter(
        (item) =>
          !(
            (item.product?.id || item.productId) === productId &&
            (item.variant || 'Standard') === variant
          )
      )
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) =>
      prev.filter((item) => (item.product?.id || item.productId) !== productId)
    );
  }, []);

  const handleUpdateCartQuantity = useCallback(
    (productId: string, variant: string, delta: number) => {
      setCart((prev) =>
        prev
          .map((item) => {
            if (
              (item.product?.id || item.productId) === productId &&
              (item.variant || 'Standard') === variant
            ) {
              const nextQty = item.quantity + delta;
              return nextQty > 0 ? { ...item, quantity: nextQty } : null;
            }
            return item;
          })
          .filter(Boolean) as CartItem[]
      );
    },
    []
  );

  const updateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(productId);
        return;
      }
      setCart((prev) =>
        prev.map((item) =>
          (item.product?.id || item.productId) === productId
            ? { ...item, quantity }
            : item
        )
      );
    },
    [removeFromCart]
  );

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const totalCartItems = useMemo(
    () => cart.reduce((sum, item) => sum + (item.quantity || 0), 0),
    [cart]
  );

  const totalCartValue = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + (item.product?.price ?? item.price ?? 0) * (item.quantity || 0),
        0
      ),
    [cart]
  );

  const handlePlaceOrder = useCallback(
    (newOrder: OrderRecord) => {
      setOrders((prev) => {
        const next = [newOrder, ...prev.filter((o) => o.id !== newOrder.id)];
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('urbandirect_custom_orders_v1', JSON.stringify(next));
          } catch {
            // Ignore storage errors
          }
        }
        return next;
      });

      const pinVal = newOrder.buyerDeliveryPin || newOrder.deliveryPin;
      if (pinVal) {
        setPinVault((prev) => {
          const next = {
            ...prev,
            [newOrder.id]: {
              orderId: newOrder.id,
              pin: pinVal,
              updatedAt: new Date().toISOString(),
              accessToken: newOrder.buyerOrderAccessToken,
              buyerAccessToken: newOrder.buyerOrderAccessToken,
            },
          };
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('urbandirect_pin_vault_v1', JSON.stringify(next));
            } catch {
              // Ignore storage errors
            }
          }
          return next;
        });
      }

      const customerName = newOrder.customer?.fullName || 'Customer';
      const customerAddress = [
        newOrder.customer?.address,
        newOrder.customer?.locality,
        newOrder.customer?.city,
        newOrder.customer?.postalCode,
      ]
        .filter(Boolean)
        .join(', ');

      setSellerNotifications((prev) => [
        {
          id: `notif-${newOrder.id}-${Date.now()}`,
          orderId: newOrder.id,
          storeId: newOrder.storeId,
          title: `New Order #${newOrder.id} (${newOrder.storeName})`,
          body: `${customerName} ordered ${(newOrder.items || []).length} item(s) worth ₹${newOrder.total}.`,
          message: `${customerName} ordered ${(newOrder.items || []).length} item(s) worth ₹${newOrder.total}.`,
          buyerPhone: newOrder.customer?.phone,
          buyerFullAddress: customerAddress,
          deliveryNotes: newOrder.customer?.notes,
          createdAt: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          isRead: false,
        },
        ...prev,
      ]);

      clearCart();
    },
    [clearCart]
  );

  const placeOrder = useCallback(
    async (customerDetails: {
      fullName: string;
      phoneE164: string;
      deliveryAddress: string;
      locality?: string;
    }) => {
      if (cart.length === 0) {
        return { ok: false, error: 'Your cart is empty.' };
      }

      const firstItem = cart[0];
      const storeId = firstItem.product?.storeId || firstItem.storeId || 'store-1';
      const store = stores.find((s) => s.id === storeId);
      const subtotal = totalCartValue;
      const deliveryFee = 25;
      const platformFee = 5;
      const total = subtotal + deliveryFee + platformFee;

      try {
        const headers = await buildAuthenticatedHeaders();
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            customer: {
              fullName: customerDetails.fullName,
              phone: customerDetails.phoneE164,
              phoneE164: customerDetails.phoneE164,
              address: customerDetails.deliveryAddress,
              deliveryAddress: customerDetails.deliveryAddress,
              locality:
                customerDetails.locality ||
                customerLocation.locality ||
                store?.neighborhood ||
                store?.serviceArea?.coveredLocalities?.[0] ||
                'Vazirabad',
              city: customerLocation.city,
              stateRegion: customerLocation.stateRegion,
              country: customerLocation.country,
              postalCode:
                customerLocation.postalCode || store?.postalCode || '431601',
              notes: '',
            },
            storeId,
            sellerId: store?.sellerId || 'seller-01',
            storeName: store?.name || 'Local Store',
            items: cart,
            subtotal,
            deliveryFee,
            platformFee,
            total,
            currency: 'INR',
            paymentMethod: 'PAY_ON_DELIVERY',
          }),
        });

        const data = await res.json();
        if (data.ok && data.order) {
          const enrichedOrder: OrderRecord = {
            ...data.order,
            deliveryPin: data.deliveryPin || data.order.deliveryPin,
            buyerDeliveryPin: data.deliveryPin || data.order.buyerDeliveryPin,
          };
          handlePlaceOrder(enrichedOrder);
          return { ok: true, order: enrichedOrder };
        }
        return { ok: false, error: data.error || 'Failed to place order.' };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Network failure during order placement.',
        };
      }
    },
    [cart, stores, totalCartValue, customerLocation, handlePlaceOrder]
  );

  const handleCancelOrder = useCallback((orderId: string, reason = 'Cancelled by customer') => {
    setOrders((prev) => {
      const next = prev.map((o) =>
        o.id === orderId
          ? { ...o, orderStatus: 'CANCELLED' as const, cancellationReason: reason }
          : o
      );
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('urbandirect_custom_orders_v1', JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
      }
      return next;
    });

    if (typeof window !== 'undefined') {
      buildAuthenticatedHeaders({ 'Content-Type': 'application/json' })
        .then((headers) =>
          fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              orderStatus: 'CANCELLED',
              cancellationReason: reason,
            }),
          })
        )
        .catch(() => {});
    }
    return true;
  }, []);

  const getBuyerPinVaultEntry = useCallback(
    (orderId: string) => pinVault[orderId],
    [pinVault]
  );

  const regenerateBuyerDeliveryPin = useCallback(
    async (orderId: string) => {
      try {
        const existingEntry = pinVault[orderId];
        const headers = await buildAuthenticatedHeaders({
          'Content-Type': 'application/json',
          ...(existingEntry?.accessToken
            ? { 'x-buyer-order-token': existingEntry.accessToken }
            : {}),
        });
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/pin`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            buyerAccessToken: existingEntry?.accessToken,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          const pin = data.deliveryPin || data.pin || '583920';
          setPinVault((prev) => {
            const next = {
              ...prev,
              [orderId]: {
                ...(prev[orderId] || {}),
                orderId,
                pin,
                updatedAt: new Date().toISOString(),
              },
            };
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('urbandirect_pin_vault_v1', JSON.stringify(next));
              } catch {
                // Ignore storage errors
              }
            }
            return next;
          });
          setOrders((prev) => {
            const next = prev.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    deliveryPin: pin,
                    buyerDeliveryPin: pin,
                  }
                : o
            );
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('urbandirect_custom_orders_v1', JSON.stringify(next));
              } catch {
                // Ignore storage errors
              }
            }
            return next;
          });
          return { ok: true, deliveryPin: pin };
        }
        return { ok: false, error: data.error };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Failed to regenerate delivery PIN.',
        };
      }
    },
    [pinVault]
  );

  const handleRegenerateBuyerDeliveryPin = useCallback(
    async (orderId: string) => {
      const res = await regenerateBuyerDeliveryPin(orderId);
      return {
        ok: res.ok,
        pin: res.deliveryPin,
        message: res.ok ? 'New delivery PIN generated.' : res.error,
        error: res.error,
      };
    },
    [regenerateBuyerDeliveryPin]
  );

  const openOtpAuthModal = useCallback(
    (options?: {
      defaultJourney?: 'BUYER' | 'SELLER';
      authContextMode?: OtpAuthContextMode;
      legacySellerId?: string;
      onSuccessCallback?: (user: UserAccount) => void;
    }) => {
      setOtpModalState({
        isOpen: true,
        defaultJourney: options?.defaultJourney || 'BUYER',
        authContextMode: options?.authContextMode || 'BUYER_SIGN_IN',
        legacySellerId: options?.legacySellerId,
        onSuccessCallback: options?.onSuccessCallback,
      });
    },
    []
  );

  const handleSignOutOtpSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('urbandirect_session_token');
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      document.cookie = 'urbandirect_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }
    setAuthenticatedUser(null);
  }, []);

  const userOwnedStores = useMemo(() => {
    if (!authenticatedUser) return [];
    return stores.filter(
      (s) =>
        s.sellerId === authenticatedUser.sellerId ||
        s.ownerUid === authenticatedUser.id ||
        (authenticatedUser.storeIds && authenticatedUser.storeIds.includes(s.id)) ||
        (s.phone && s.phone === authenticatedUser.phoneE164)
    );
  }, [authenticatedUser, stores]);

  const hasSellerRole = Boolean(
    authenticatedUser &&
      (authenticatedUser.role === 'seller' ||
        authenticatedUser.roles?.includes('SELLER') ||
        userOwnedStores.length > 0)
  );

  const hasCompletedStore = userOwnedStores.length > 0;

  const handleAddSellerAndStore = useCallback(
    (newSeller: SellerProfile, newStore: LocalStore) => {
      const enrichedStore: LocalStore = {
        ...newStore,
        sellerId: newSeller.id,
        ownerUid:
          newStore.ownerUid ||
          authenticatedUser?.id ||
          authenticatedUser?.uid ||
          `user-${newSeller.id}`,
        phone:
          newStore.phone ||
          newSeller.phoneE164 ||
          authenticatedUser?.phoneE164,
        isActive: newStore.isActive !== false,
      };

      const enrichedSeller: SellerProfile = {
        ...newSeller,
        storeIds: Array.from(
          new Set([...(newSeller.storeIds || []), enrichedStore.id])
        ),
      };

      setSellers((prev) => {
        const next = [
          enrichedSeller,
          ...prev.filter((s) => s.id !== enrichedSeller.id),
        ];
        if (typeof window !== 'undefined') {
          try {
            const customRaw = localStorage.getItem('urbandirect_custom_sellers_v1');
            const customList = customRaw ? (JSON.parse(customRaw) as SellerProfile[]) : [];
            const nextCustom = [
              enrichedSeller,
              ...customList.filter((s) => s.id !== enrichedSeller.id),
            ];
            localStorage.setItem(
              'urbandirect_custom_sellers_v1',
              JSON.stringify(nextCustom)
            );
          } catch {
            // Ignore storage errors
          }
        }
        return next;
      });

      setStores((prev) => {
        const next = [
          enrichedStore,
          ...prev.filter((s) => s.id !== enrichedStore.id),
        ];
        if (typeof window !== 'undefined') {
          try {
            const customRaw = localStorage.getItem('urbandirect_custom_stores_v1');
            const customList = customRaw ? (JSON.parse(customRaw) as LocalStore[]) : [];
            const nextCustom = [
              enrichedStore,
              ...customList.filter((s) => s.id !== enrichedStore.id),
            ];
            localStorage.setItem(
              'urbandirect_custom_stores_v1',
              JSON.stringify(nextCustom)
            );
          } catch {
            // Ignore storage errors
          }
        }
        return next;
      });

      setAuthenticatedUser((prevUser) => {
        const baseUser: UserAccount = prevUser || {
          id: enrichedStore.ownerUid || `user-${Date.now()}`,
          uid: enrichedStore.ownerUid || `user-${Date.now()}`,
          fullName: enrichedSeller.businessOwnerName,
          phoneE164: enrichedSeller.phoneE164,
          phoneCountryCode: enrichedSeller.phoneCountryCode || 'IN',
          phoneVerified: true,
          roles: ['BUYER', 'SELLER'],
          role: 'seller',
          activeRole: 'SELLER',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          lockedCity: enrichedStore.cityName,
          lockedCityId: enrichedStore.cityId,
          lockedStateRegion: enrichedStore.stateRegion,
          lockedCountry: enrichedStore.country,
          lockedCountryCode: enrichedStore.countryCode,
          lockedLocality: enrichedStore.neighborhood,
          lockedPostalCode: enrichedStore.postalCode,
        };
        const nextRoles = Array.from(
          new Set([...(baseUser.roles || ['BUYER']), 'SELLER'])
        ) as UserAccount['roles'];
        const nextStoreIds = Array.from(
          new Set([...(baseUser.storeIds || []), enrichedStore.id])
        );
        const updatedUser: UserAccount = {
          ...baseUser,
          fullName: baseUser.fullName || enrichedSeller.businessOwnerName,
          role: 'seller',
          activeRole: 'SELLER',
          roles: nextRoles,
          sellerId: enrichedSeller.id,
          storeIds: nextStoreIds,
        };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(
              AUTH_USER_STORAGE_KEY,
              JSON.stringify(updatedUser)
            );
            // Clear stale session token so buildAuthenticatedHeaders re-encodes with updated sellerId and storeIds
            localStorage.removeItem('urbandirect_session_token');
          } catch {
            // Ignore storage errors
          }
        }
        return updatedUser;
      });

      if (typeof window !== 'undefined') {
        buildAuthenticatedHeaders({ 'Content-Type': 'application/json' })
          .then((headers) =>
            fetch('/api/stores', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                store: enrichedStore,
                seller: enrichedSeller,
              }),
            })
          )
          .catch(() => {});
      }
    },
    [authenticatedUser]
  );

  const handleUpdateStoreSettings = useCallback((updatedStore: LocalStore) => {
    setStores((prev) => {
      const next = prev.map((s) => (s.id === updatedStore.id ? updatedStore : s));
      if (typeof window !== 'undefined') {
        try {
          const customRaw = localStorage.getItem('urbandirect_custom_stores_v1');
          const customList = customRaw ? (JSON.parse(customRaw) as LocalStore[]) : [];
          const nextCustom = [
            updatedStore,
            ...customList.filter((s) => s.id !== updatedStore.id),
          ];
          localStorage.setItem(
            'urbandirect_custom_stores_v1',
            JSON.stringify(nextCustom)
          );
        } catch {
          // Ignore storage errors
        }
      }
      return next;
    });
    if (typeof window !== 'undefined') {
      buildAuthenticatedHeaders({ 'Content-Type': 'application/json' })
        .then((headers) =>
          fetch('/api/stores', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ store: updatedStore }),
          })
        )
        .catch(() => {});
    }
  }, []);

  const handleDeleteStore = useCallback(
    async (storeId: string, _storeNameConfirm?: string) => {
      setStores((prev) => prev.filter((s) => s.id !== storeId));
      setProducts((prev) => prev.filter((p) => p.storeId !== storeId));
      if (typeof window !== 'undefined') {
        try {
          const customStoresRaw = localStorage.getItem('urbandirect_custom_stores_v1');
          if (customStoresRaw) {
            const parsedStores = JSON.parse(customStoresRaw) as LocalStore[];
            localStorage.setItem(
              'urbandirect_custom_stores_v1',
              JSON.stringify(parsedStores.filter((s) => s.id !== storeId))
            );
          }
          const customProdsRaw = localStorage.getItem('urbandirect_custom_products_v1');
          if (customProdsRaw) {
            const parsedProds = JSON.parse(customProdsRaw) as Product[];
            localStorage.setItem(
              'urbandirect_custom_products_v1',
              JSON.stringify(parsedProds.filter((p) => p.storeId !== storeId))
            );
          }
        } catch {
          // Ignore storage errors
        }
        fetch(`/api/stores?storeId=${encodeURIComponent(storeId)}`, {
          method: 'DELETE',
        }).catch(() => {});
      }
      return { ok: true, success: true, message: 'Store deleted.' };
    },
    []
  );

  const permanentlyDeleteStore = useCallback(
    async (storeId: string, _reason?: string) => {
      return handleDeleteStore(storeId);
    },
    [handleDeleteStore]
  );

  const handleAddProduct = useCallback(
    (newProduct: Product, options?: { skipServerSync?: boolean }) => {
      setProducts((prev) => {
        const next = [newProduct, ...prev.filter((p) => p.id !== newProduct.id)];
        if (typeof window !== 'undefined') {
          try {
            const customRaw = localStorage.getItem('urbandirect_custom_products_v1');
            const customList = customRaw ? (JSON.parse(customRaw) as Product[]) : [];
            const nextCustom = [
              newProduct,
              ...customList.filter((p) => p.id !== newProduct.id),
            ];
            localStorage.setItem(
              'urbandirect_custom_products_v1',
              JSON.stringify(nextCustom)
            );
          } catch {
            // Ignore storage errors
          }
        }
        return next;
      });
      setStores((prev) =>
        prev.map((s) =>
          s.id === newProduct.storeId
            ? { ...s, activeSkus: (s.activeSkus || 0) + 1 }
            : s
        )
      );
      if (typeof window !== 'undefined' && !options?.skipServerSync) {
        buildAuthenticatedHeaders({ 'Content-Type': 'application/json' })
          .then((headers) =>
            fetch('/api/products', {
              method: 'POST',
              headers,
              body: JSON.stringify({ product: newProduct }),
            })
          )
          .catch(() => {});
      }
    },
    []
  );

  const handleUpdateProduct = useCallback((updatedProduct: Product) => {
    setProducts((prev) => {
      const next = prev.map((p) =>
        p.id === updatedProduct.id ? updatedProduct : p
      );
      if (typeof window !== 'undefined') {
        try {
          const customRaw = localStorage.getItem('urbandirect_custom_products_v1');
          const customList = customRaw ? (JSON.parse(customRaw) as Product[]) : [];
          const nextCustom = [
            updatedProduct,
            ...customList.filter((p) => p.id !== updatedProduct.id),
          ];
          localStorage.setItem(
            'urbandirect_custom_products_v1',
            JSON.stringify(nextCustom)
          );
        } catch {
          // Ignore storage errors
        }
      }
      return next;
    });
    if (typeof window !== 'undefined') {
      buildAuthenticatedHeaders({ 'Content-Type': 'application/json' })
        .then((headers) =>
          fetch('/api/products', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ product: updatedProduct }),
          })
        )
        .catch(() => {});
    }
  }, []);

  const handleDeleteProduct = useCallback((productId: string) => {
    setProducts((prev) => {
      const target = prev.find((p) => p.id === productId);
      if (target) {
        setStores((stPrev) =>
          stPrev.map((s) =>
            s.id === target.storeId
              ? { ...s, activeSkus: Math.max(0, (s.activeSkus || 1) - 1) }
              : s
          )
        );
      }
      const next = prev.filter((p) => p.id !== productId);
      if (typeof window !== 'undefined') {
        try {
          const customRaw = localStorage.getItem('urbandirect_custom_products_v1');
          if (customRaw) {
            const customList = JSON.parse(customRaw) as Product[];
            localStorage.setItem(
              'urbandirect_custom_products_v1',
              JSON.stringify(customList.filter((p) => p.id !== productId))
            );
          }
        } catch {
          // Ignore storage errors
        }
      }
      return next;
    });
    if (typeof window !== 'undefined') {
      fetch(`/api/products?productId=${encodeURIComponent(productId)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  }, []);

  const handleUpdateStock = useCallback(
    (
      productId: string,
      nextStock: number,
      isAvailableOrActor?: boolean | string,
      _isAdmin?: boolean
    ) => {
      const nextAvailable =
        typeof isAvailableOrActor === 'boolean'
          ? isAvailableOrActor
          : nextStock > 0;
      setProducts((prev) => {
        let updatedTarget: Product | null = null;
        const next = prev.map((p) => {
          if (p.id === productId) {
            updatedTarget = {
              ...p,
              stock: nextStock,
              isAvailable: nextAvailable,
              statusNote: nextAvailable && nextStock > 0 ? 'In stock' : 'Out of stock',
            };
            return updatedTarget;
          }
          return p;
        });
        if (updatedTarget && typeof window !== 'undefined') {
          const targetProd = updatedTarget as Product;
          try {
            const customRaw = localStorage.getItem('urbandirect_custom_products_v1');
            const customList = customRaw ? (JSON.parse(customRaw) as Product[]) : [];
            const nextCustom = [
              targetProd,
              ...customList.filter((p) => p.id !== targetProd.id),
            ];
            localStorage.setItem(
              'urbandirect_custom_products_v1',
              JSON.stringify(nextCustom)
            );
          } catch {
            // Ignore storage errors
          }
          buildAuthenticatedHeaders({ 'Content-Type': 'application/json' })
            .then((headers) =>
              fetch('/api/products', {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ product: targetProd }),
              })
            )
            .catch(() => {});
        }
        return next;
      });
    },
    []
  );

  const handleSetOrderStep = useCallback(
    (
      orderId: string,
      stepIndex: number,
      explicitStatus?: OrderRecord['orderStatus'],
      reason?: string
    ) => {
      const statusMap: Record<number, OrderRecord['orderStatus']> = {
        0: 'NEW',
        1: 'PREPARING',
        2: 'OUT_FOR_DELIVERY',
        3: 'DELIVERED',
      };
      const resolvedStatus: OrderRecord['orderStatus'] =
        explicitStatus || statusMap[stepIndex] || 'NEW';
      const resolvedStep =
        resolvedStatus === 'NEW'
          ? 0
          : resolvedStatus === 'CONFIRMED' || resolvedStatus === 'PREPARING'
            ? 1
            : resolvedStatus === 'OUT_FOR_DELIVERY'
              ? 2
              : resolvedStatus === 'DELIVERED'
                ? 3
                : stepIndex >= 0
                  ? stepIndex
                  : 0;

      setOrders((prev) => {
        const next = prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                currentStepIndex: resolvedStep,
                orderStatus: resolvedStatus,
                cancellationReason:
                  resolvedStatus === 'CANCELLED' || resolvedStatus === 'REJECTED'
                    ? reason || o.cancellationReason || `Order ${resolvedStatus.toLowerCase()} by seller`
                    : o.cancellationReason,
                deliveredAt:
                  resolvedStatus === 'DELIVERED'
                    ? o.deliveredAt || new Date().toISOString()
                    : o.deliveredAt,
              }
            : o
        );
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('urbandirect_custom_orders_v1', JSON.stringify(next));
          } catch {
            // Ignore storage errors
          }
        }
        return next;
      });

      if (typeof window !== 'undefined') {
        buildAuthenticatedHeaders({ 'Content-Type': 'application/json' })
          .then((headers) =>
            fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                orderStatus: resolvedStatus,
                currentStepIndex: resolvedStep,
                cancellationReason: reason,
              }),
            })
          )
          .catch(() => {});
      }
    },
    []
  );

  const handleSubmitStoreRating = useCallback(
    (orderId: string, rating: number, comment?: string) => {
      const clampedRating = Math.min(5, Math.max(1, Math.round(rating)));
      const ratedAtIso = new Date().toISOString();

      let targetStoreId: string | null = null;

      setOrders((prevOrders) => {
        const updatedOrders = prevOrders.map((ord) => {
          if (ord.id !== orderId) return ord;
          const isDelivered =
            ord.orderStatus === 'DELIVERED' || ord.currentStepIndex >= 3;
          if (!isDelivered) return ord;
          targetStoreId = ord.storeId;
          return {
            ...ord,
            storeRating: clampedRating,
            storeReviewComment: comment,
            storeRatedAt: ratedAtIso,
          };
        });

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('urbandirect_custom_orders_v1', JSON.stringify(updatedOrders));
            const existingRaw = localStorage.getItem('urbandirect_order_ratings_v1');
            const existingMap = existingRaw ? JSON.parse(existingRaw) : {};
            const ratedOrder = updatedOrders.find((o) => o.id === orderId);
            if (ratedOrder && ratedOrder.storeRating) {
              existingMap[orderId] = {
                storeRating: ratedOrder.storeRating,
                storeReviewComment: ratedOrder.storeReviewComment,
                storeRatedAt: ratedOrder.storeRatedAt,
                orderStatus: ratedOrder.orderStatus,
                currentStepIndex: ratedOrder.currentStepIndex,
              };
              localStorage.setItem(
                'urbandirect_order_ratings_v1',
                JSON.stringify(existingMap)
              );
            }
          } catch {
            // Ignore localStorage write errors
          }
        }

        return updatedOrders;
      });

      setStores((prevStores) => {
        const resolvedStoreId =
          targetStoreId || orders.find((o) => o.id === orderId)?.storeId;
        if (!resolvedStoreId) return prevStores;

        const nextStores = prevStores.map((st) => {
          if (st.id !== resolvedStoreId) return st;
          const baseCount = typeof st.reviewsCount === 'number' && st.reviewsCount > 0 ? st.reviewsCount : 12;
          const baseRating = typeof st.rating === 'number' && st.rating > 0 ? st.rating : 4.8;
          const nextCount = baseCount + 1;
          const nextRating = Number(
            ((baseRating * baseCount + clampedRating) / nextCount).toFixed(1)
          );
          return {
            ...st,
            rating: nextRating,
            reviewsCount: nextCount,
          };
        });

        if (typeof window !== 'undefined') {
          try {
            const existingRaw = localStorage.getItem('urbandirect_store_ratings_v1');
            const existingMap = existingRaw ? JSON.parse(existingRaw) : {};
            const updatedStore = nextStores.find((s) => s.id === resolvedStoreId);
            if (updatedStore) {
              existingMap[resolvedStoreId] = {
                rating: updatedStore.rating,
                reviewsCount: updatedStore.reviewsCount ?? 13,
              };
              localStorage.setItem(
                'urbandirect_store_ratings_v1',
                JSON.stringify(existingMap)
              );
            }
          } catch {
            // Ignore localStorage write errors
          }
        }

        return nextStores;
      });

      showToast('Thank you! Your store star rating has been submitted.');
    },
    [orders, showToast]
  );

  const handleToggleCategoryStatus = useCallback((categoryId: StoreCategoryId) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, isActive: !c.isActive } : c))
    );
  }, []);

  const handleVerifyOrderDeliveryPin = useCallback(
    async (orderId: string, pinInput: string, actorRole?: string) => {
      const cleanPin = pinInput.trim();
      if (!/^\d{6}$/.test(cleanPin)) {
        return {
          ok: false,
          success: false,
          message: 'Please enter a valid 6-digit numeric Delivery PIN.',
        };
      }

      try {
        const headers = await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' });
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/verify-pin`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            pin: cleanPin,
            deliveryPin: cleanPin,
            actorRole: actorRole || 'SELLER',
          }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          const verifiedAtIso = new Date().toISOString();
          setOrders((prev) => {
            const next = prev.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    ...(data.order || {}),
                    currentStepIndex: 3,
                    orderStatus: 'DELIVERED' as const,
                    deliveredAt: data.order?.deliveredAt || o.deliveredAt || verifiedAtIso,
                    deliveryPinVerified: true,
                    deliveryPinInfo: {
                      ...(o.deliveryPinInfo || {
                        pinHash: `verified-${orderId}`,
                        maskedPin: '••••••',
                        generatedAt: o.createdAt,
                        attempts: 0,
                        maxAttempts: 5,
                      }),
                      ...(data.order?.deliveryPinInfo || {}),
                      status: 'VERIFIED' as const,
                      verifiedAt: verifiedAtIso,
                    },
                  }
                : o
            );
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('urbandirect_custom_orders_v1', JSON.stringify(next));
              } catch {
                // Ignore storage errors
              }
            }
            return next;
          });
          return {
            ok: true,
            success: true,
            message: data.message || 'Delivery PIN verified! Order marked as delivered.',
          };
        }
        if (res.status !== 404 && data.error) {
          return { ok: false, success: false, message: data.error };
        }
      } catch {
        // Fallback to local vault if server request fails
      }

      const vaultEntry = pinVault[orderId];
      if (vaultEntry && vaultEntry.pin === cleanPin) {
        const verifiedAtIso = new Date().toISOString();
        setOrders((prev) => {
          const next = prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  currentStepIndex: 3,
                  orderStatus: 'DELIVERED' as const,
                  deliveredAt: o.deliveredAt || verifiedAtIso,
                  deliveryPinVerified: true,
                  deliveryPinInfo: {
                    ...(o.deliveryPinInfo || {
                      pinHash: `verified-${orderId}`,
                      maskedPin: '••••••',
                      generatedAt: o.createdAt,
                      attempts: 0,
                      maxAttempts: 5,
                    }),
                    status: 'VERIFIED' as const,
                    verifiedAt: verifiedAtIso,
                  },
                }
              : o
          );
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('urbandirect_custom_orders_v1', JSON.stringify(next));
            } catch {
              // Ignore storage errors
            }
          }
          return next;
        });
        return {
          ok: true,
          success: true,
          message: 'Delivery PIN verified! Order marked as delivered.',
        };
      }

      return {
        ok: false,
        success: false,
        message: 'Invalid delivery PIN. Please confirm the 6-digit PIN with the buyer.',
      };
    },
    [pinVault]
  );

  const handleUpdateOrderPaymentStatus = useCallback(
    async (
      orderId: string,
      status: 'PENDING' | 'PAID' | 'DISPUTED',
      collectionMethodOrOptions?:
        | PaymentMethod
        | {
            actorSellerId?: string;
            collectionMethod?: PaymentMethod | string;
            referenceNote?: string;
          },
      referenceNote?: string
    ) => {
      const resolvedMethod: PaymentMethod | undefined =
        typeof collectionMethodOrOptions === 'string'
          ? collectionMethodOrOptions
          : (collectionMethodOrOptions?.collectionMethod as PaymentMethod | undefined);
      const resolvedNote: string | undefined =
        typeof collectionMethodOrOptions === 'object' && collectionMethodOrOptions !== null
          ? collectionMethodOrOptions.referenceNote ?? referenceNote
          : referenceNote;
      const resolvedActorSellerId: string | undefined =
        typeof collectionMethodOrOptions === 'object' && collectionMethodOrOptions !== null
          ? collectionMethodOrOptions.actorSellerId
          : undefined;

      const nowIso = new Date().toISOString();

      setOrders((prev) => {
        const next = prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                paymentStatus: status,
                paymentCollectionMethod: resolvedMethod || o.paymentCollectionMethod,
                paymentReferenceNote: resolvedNote ?? o.paymentReferenceNote,
                paymentCollectedAt: status === 'PAID' ? nowIso : o.paymentCollectedAt,
                paymentVerifiedAt: status === 'PAID' ? nowIso : o.paymentVerifiedAt,
                paymentVerifiedBySellerId:
                  status === 'PAID'
                    ? resolvedActorSellerId || o.paymentVerifiedBySellerId
                    : o.paymentVerifiedBySellerId,
              }
            : o
        );
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('urbandirect_custom_orders_v1', JSON.stringify(next));
          } catch {
            // Ignore storage errors
          }
        }
        return next;
      });

      try {
        const headers = await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' });
        await fetch(`/api/orders/${encodeURIComponent(orderId)}/payment`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            paymentStatus: status,
            collectionMethod: resolvedMethod,
            referenceNote: resolvedNote,
            actorSellerId: resolvedActorSellerId,
          }),
        });
      } catch {
        // Ignore network error after optimistic update
      }

      return {
        ok: true,
        success: true,
        message:
          status === 'PAID'
            ? `Payment recorded (${resolvedMethod === 'UPI_ON_DELIVERY' ? 'UPI on Delivery' : 'Cash on Delivery'}) and order marked as PAID.`
            : `Payment status updated to ${status}.`,
      };
    },
    []
  );

  const handleMarkNotificationRead = useCallback((notificationId: string) => {
    setSellerNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
  }, []);

  const handleClearNotifications = useCallback(() => {
    setSellerNotifications([]);
  }, []);

  return (
    <UrbanDirectContext.Provider
      value={{
        isMounted,
        authenticatedUser,
        setAuthenticatedUser,
        categories,
        customerLocation,
        hasSelectedCity,
        isBuyerCityLocked,
        setCustomerLocation: handleSetCustomerLocationGuarded,
        handleConfirmBuyerLocation,
        isLocationModalOpen,
        setIsLocationModalOpen: handleSetIsLocationModalOpenGuarded,
        sellers,
        stores,
        setStores,
        products,
        setProducts,
        userOwnedStores,
        hasSellerRole,
        hasCompletedStore,
        cart,
        totalCartItems,
        totalCartValue,
        cartTotal: totalCartValue,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        handleAddToCart,
        handleUpdateCartQuantity,
        handleRemoveCartItem,
        orders,
        activeOrdersCount: orders.filter(
          (o) => o.orderStatus !== 'DELIVERED' && o.orderStatus !== 'CANCELLED'
        ).length,
        placeOrder,
        handlePlaceOrder,
        handleCancelOrder,
        getBuyerPinVaultEntry,
        regenerateBuyerDeliveryPin,
        handleRegenerateBuyerDeliveryPin,
        handleSignOutOtpSession,
        openOtpAuthModal,
        showToast,
        handleAddSellerAndStore,
        handleUpdateStoreSettings,
        handleDeleteStore,
        permanentlyDeleteStore,
        handleAddProduct,
        handleUpdateProduct,
        handleDeleteProduct,
        handleUpdateStock,
        handleSetOrderStep,
        handleSubmitStoreRating,
        handleToggleCategoryStatus,
        handleVerifyOrderDeliveryPin,
        handleUpdateOrderPaymentStatus,
        sellerNotifications,
        unreadNotificationCount: sellerNotifications.filter((n) => !n.isRead).length,
        handleMarkNotificationRead,
        handleClearNotifications,
      }}
    >
      {children}

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 text-xs font-semibold flex items-center justify-between gap-3">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <MobileOtpAuthModal
        isOpen={otpModalState.isOpen}
        defaultJourney={otpModalState.defaultJourney}
        authContextMode={otpModalState.authContextMode}
        currentLocation={customerLocation}
        unmigratedSellers={sellers}
        onAuthenticated={(user) => {
          const lockedCity = user.lockedCity || customerLocation.city;
          const lockedCityId =
            user.lockedCityId ||
            customerLocation.cityId ||
            normalizeCityId(
              user.lockedCountry || customerLocation.country || 'India',
              user.lockedStateRegion || customerLocation.stateRegion || 'Maharashtra',
              lockedCity
            );
          const enrichedUser: UserAccount = {
            ...user,
            lockedCity,
            lockedCityId,
            lockedStateRegion:
              user.lockedStateRegion || customerLocation.stateRegion,
            lockedCountry: user.lockedCountry || customerLocation.country,
            lockedCountryCode:
              user.lockedCountryCode || customerLocation.countryCode,
            lockedLocality: user.lockedLocality || customerLocation.locality,
            lockedPostalCode:
              user.lockedPostalCode || customerLocation.postalCode,
            cityLockedAt: user.cityLockedAt || new Date().toISOString(),
          };
          setCustomerLocation({
            mode: 'SELECTED_LOCATION',
            city: lockedCity,
            cityId: lockedCityId,
            stateRegion:
              enrichedUser.lockedStateRegion || customerLocation.stateRegion,
            country: enrichedUser.lockedCountry || customerLocation.country,
            countryCode:
              enrichedUser.lockedCountryCode || customerLocation.countryCode,
            locality:
              enrichedUser.lockedLocality || customerLocation.locality || '',
            postalCode:
              enrichedUser.lockedPostalCode || customerLocation.postalCode,
          });
          setAuthenticatedUser(enrichedUser);
          if (typeof window !== 'undefined') {
            localStorage.setItem(
              AUTH_USER_STORAGE_KEY,
              JSON.stringify(enrichedUser)
            );
          }
          const callback = otpModalState.onSuccessCallback;
          setOtpModalState((prev) => ({
            ...prev,
            isOpen: false,
            onSuccessCallback: undefined,
          }));
          if (callback) {
            callback(enrichedUser);
          }
          showToast(
            `Welcome, ${enrichedUser.fullName || 'Verified User'}! Your shopping city is locked to ${lockedCity} (intra-city delivery only).`
          );
        }}
        onClose={() =>
          setOtpModalState((prev) => ({
            ...prev,
            isOpen: false,
            onSuccessCallback: undefined,
          }))
        }
      />
    </UrbanDirectContext.Provider>
  );
}

export function useUrbanDirect() {
  const context = useContext(UrbanDirectContext);
  if (!context) {
    throw new Error('useUrbanDirect must be used within an UrbanDirectProvider');
  }
  return context;
}
