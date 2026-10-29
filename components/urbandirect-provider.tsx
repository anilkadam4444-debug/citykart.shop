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
  handleAddProduct: (newProduct: Product) => void;
  handleUpdateProduct: (updatedProduct: Product) => void;
  handleDeleteProduct: (productId: string) => void;
  handleUpdateStock: (
    productId: string,
    nextStock: number,
    isAvailableOrActor?: boolean | string,
    isAdmin?: boolean
  ) => void;
  handleSetOrderStep: (orderId: string, stepIndex: number) => void;
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
      setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
      const pinVal = newOrder.buyerDeliveryPin || newOrder.deliveryPin;
      if (pinVal) {
        setPinVault((prev) => ({
          ...prev,
          [newOrder.id]: {
            orderId: newOrder.id,
            pin: pinVal,
            updatedAt: new Date().toISOString(),
            accessToken: newOrder.buyerOrderAccessToken,
          },
        }));
      }
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
              locality: customerDetails.locality || customerLocation.locality,
              city: customerLocation.city,
              stateRegion: customerLocation.stateRegion,
              country: customerLocation.country,
              postalCode: customerLocation.postalCode || '',
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
          handlePlaceOrder(data.order);
          return { ok: true, order: data.order };
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
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, orderStatus: 'CANCELLED', cancellationReason: reason }
          : o
      )
    );
    return true;
  }, []);

  const getBuyerPinVaultEntry = useCallback(
    (orderId: string) => pinVault[orderId],
    [pinVault]
  );

  const regenerateBuyerDeliveryPin = useCallback(async (orderId: string) => {
    try {
      const headers = await buildAuthenticatedHeaders();
      const res = await fetch(`/api/orders/${orderId}/pin`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (data.ok) {
        const pin = data.deliveryPin || data.pin || '583920';
        setPinVault((prev) => ({
          ...prev,
          [orderId]: {
            orderId,
            pin,
            updatedAt: new Date().toISOString(),
          },
        }));
        return { ok: true, deliveryPin: pin };
      }
      return { ok: false, error: data.error };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to regenerate delivery PIN.',
      };
    }
  }, []);

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

  const handleAddSellerAndStore = useCallback((newSeller: SellerProfile, newStore: LocalStore) => {
    setSellers((prev) => [newSeller, ...prev.filter((s) => s.id !== newSeller.id)]);
    setStores((prev) => [newStore, ...prev.filter((s) => s.id !== newStore.id)]);
  }, []);

  const handleUpdateStoreSettings = useCallback((updatedStore: LocalStore) => {
    setStores((prev) => prev.map((s) => (s.id === updatedStore.id ? updatedStore : s)));
  }, []);

  const handleDeleteStore = useCallback(
    async (storeId: string, _storeNameConfirm?: string) => {
      setStores((prev) => prev.filter((s) => s.id !== storeId));
      setProducts((prev) => prev.filter((p) => p.storeId !== storeId));
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

  const handleAddProduct = useCallback((newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
  }, []);

  const handleUpdateProduct = useCallback((updatedProduct: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)));
  }, []);

  const handleDeleteProduct = useCallback((productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
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
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, stock: nextStock, isAvailable: nextAvailable }
            : p
        )
      );
    },
    []
  );

  const handleSetOrderStep = useCallback((orderId: string, stepIndex: number) => {
    const statusMap: OrderRecord['orderStatus'][] = [
      'NEW',
      'PREPARING',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ];
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              currentStepIndex: stepIndex,
              orderStatus: statusMap[stepIndex] || o.orderStatus,
              deliveredAt:
                stepIndex >= 3 ? o.deliveredAt || new Date().toISOString() : o.deliveredAt,
            }
          : o
      )
    );
  }, []);

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
    async (orderId: string, pinInput: string, _actorRole?: string) => {
      const vaultEntry = pinVault[orderId];
      if (vaultEntry && vaultEntry.pin === pinInput.trim()) {
        handleSetOrderStep(orderId, 3);
        const msg = 'Delivery PIN verified! Order marked as delivered.';
        return { ok: true, success: true, message: msg };
      }
      const errMsg = 'Invalid delivery PIN.';
      return { ok: false, success: false, message: errMsg };
    },
    [pinVault, handleSetOrderStep]
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

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                paymentStatus: status,
                paymentCollectionMethod: resolvedMethod || o.paymentCollectionMethod,
                paymentReferenceNote: resolvedNote || o.paymentReferenceNote,
                paymentCollectedAt:
                  status === 'PAID' ? new Date().toISOString() : o.paymentCollectedAt,
              }
            : o
        )
      );
      return { ok: true, success: true, message: `Payment status updated to ${status}.` };
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
