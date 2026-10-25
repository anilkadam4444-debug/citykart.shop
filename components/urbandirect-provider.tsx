'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {Check} from 'lucide-react';
import {usePathname, useRouter} from 'next/navigation';
import {
  AUTHORITATIVE_STORE_CATEGORIES,
  CartItem,
  CategoryDefinition,
  CustomerShoppingLocation,
  isStoreLocationComplete,
  LocalStore,
  normalizeCityId,
  OrderRecord,
  Product,
  SellerProfile,
  StoreCategoryId,
  UserAccount,
} from '@/lib/catalog-data';
import {
  INITIAL_PRODUCTS,
  INITIAL_SELLERS,
  INITIAL_STORES,
} from '@/lib/initial-data';

import {
  MobileOtpAuthModal,
  OtpAuthContextMode,
} from '@/components/mobile-otp-auth-modal';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  deleteProductFromFirestore,
  deleteStoreAndProductsFromFirestore,
  fetchStoresAndProductsFromFirestore,
  firebaseSignOut,
  syncOrderToFirestore,
  syncProductToFirestore,
  syncSellerProfileToFirestore,
  syncStoreToFirestore,
  syncUserAccountToFirestore,
} from '@/lib/firebase';
import { requestAndRegisterFcmToken, subscribeToForegroundMessages } from '@/lib/fcm-client';

export const BUYER_CITY_STORAGE_KEY = 'urbandirect_buyer_city_v1';
export const AUTH_USER_STORAGE_KEY = 'urbandirect_otp_user_v2';
export const DELETED_STORES_STORAGE_KEY = 'urbandirect_deleted_stores_v1';
const CUSTOM_STORES_STORAGE_KEY = 'urbandirect_custom_stores_v1';
const CUSTOM_SELLERS_STORAGE_KEY = 'urbandirect_custom_sellers_v1';
const CUSTOM_PRODUCTS_STORAGE_KEY = 'urbandirect_custom_products_v1';
const CUSTOM_ORDERS_STORAGE_KEY = 'urbandirect_custom_orders_v1';

export function readStoredDeletedStoreIds(): Set<string> {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const raw = window.localStorage.getItem(DELETED_STORES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set<string>(parsed);
      }
    }
  } catch {
    // Ignore storage read error
  }
  return new Set<string>();
}


const UNSET_CUSTOMER_LOCATION: CustomerShoppingLocation = {
  mode: 'UNSET',
  country: '',
  stateRegion: '',
  city: '',
  locality: '',
};

export const DEFAULT_NANDED_BUYER_LOCATION: CustomerShoppingLocation = {
  mode: 'SELECTED_LOCATION',
  country: 'India',
  countryCode: 'IN',
  stateRegion: 'Maharashtra',
  district: 'Nanded',
  localityType: 'CITY',
  city: 'Nanded',
  cityId: 'india-maharashtra-nanded',
  locality: 'Vazirabad',
  postalCode: '431601',
};

function subscribeNoop() {
  return () => {};
}

function getClientMountedSnapshot() {
  return true;
}

function getServerMountedSnapshot() {
  return false;
}

export function readStoredBuyerLocation(): CustomerShoppingLocation | null {
  if (typeof window === 'undefined') return DEFAULT_NANDED_BUYER_LOCATION;
  try {
    const raw = window.localStorage.getItem(BUYER_CITY_STORAGE_KEY);
    if (!raw) return DEFAULT_NANDED_BUYER_LOCATION;
    const parsed = JSON.parse(raw) as Partial<CustomerShoppingLocation>;
    if (
      parsed &&
      parsed.mode === 'SELECTED_LOCATION' &&
      typeof parsed.city === 'string' &&
      parsed.city.trim().length > 0 &&
      typeof parsed.country === 'string' &&
      parsed.country.trim().length > 0
    ) {
      const city = parsed.city.trim();
      const country = parsed.country.trim();
      const stateRegion = (parsed.stateRegion || country).trim();
      return {
        mode: 'SELECTED_LOCATION',
        country,
        countryCode: parsed.countryCode,
        stateRegion,
        district: parsed.district,
        postalCode: parsed.postalCode,
        localityType: parsed.localityType,
        city,
        cityId: parsed.cityId || normalizeCityId(country, stateRegion, city),
        locality:
          typeof parsed.locality === 'string' ? parsed.locality.trim() : '',
      };
    }
  } catch {
    // Ignore malformed storage
  }
  return DEFAULT_NANDED_BUYER_LOCATION;
}

export const INITIAL_DEMO_ORDER: OrderRecord = {
  id: 'UD-4918',
  createdAt: '14:10',
  storeId: 'demo-nanded-store-01a',
  storeName: 'Nanded Super Bazar & Kirana',
  sellerId: 'demo-nanded-seller-01a',
  items: [
    {
      product: INITIAL_PRODUCTS[0],
      variant: INITIAL_PRODUCTS[0].variants[0] || 'Standard',
      quantity: 1,
    },
  ],
  subtotal: INITIAL_PRODUCTS[0].price,
  deliveryFee: 0,
  discount: 0,
  total: INITIAL_PRODUCTS[0].price,
  paymentMethod: 'UPI_ON_DELIVERY',
  upiId: 'anilkadam@okicici',
  customer: {
    fullName: 'Anil Kadam',
    phone: '+91 98204 51290',
    country: 'India',
    stateRegion: 'Maharashtra',
    address: 'Plot 14, Bhagya Nagar Main Road',
    city: 'Nanded',
    locality: 'Vazirabad',
    postalCode: '431601',
    notes: 'Call on mobile upon arrival at gate',
  },
  currentStepIndex: 1,
  orderStatus: 'PREPARING',
  isDemo: true,
  estimatedMins: 24,
};

export interface OtpModalLaunchOptions {
  defaultJourney?: 'BUYER' | 'SELLER';
  authContextMode?: OtpAuthContextMode;
  legacySellerId?: string;
  onSuccessCallback?: (
    user: UserAccount,
    selectedJourney: 'BUYER' | 'SELLER'
  ) => void;
}

import { SellerNotification } from '@/lib/orders-registry';

export interface UrbanDirectContextValue {
  isMounted: boolean;
  isAuthReady: boolean;
  sellers: SellerProfile[];
  stores: LocalStore[];
  setStores: React.Dispatch<React.SetStateAction<LocalStore[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: OrderRecord[];
  sellerNotifications: SellerNotification[];
  unreadNotificationCount: number;
  handleMarkNotificationRead: (id: string) => void;
  handleClearNotifications: () => void;
  categories: CategoryDefinition[];
  savedLocation: CustomerShoppingLocation | null;
  customerLocation: CustomerShoppingLocation;
  hasSelectedCity: boolean;
  isLocationModalOpen: boolean;
  setIsLocationModalOpen: (open: boolean) => void;
  handleConfirmBuyerLocation: (newLoc: CustomerShoppingLocation) => void;
  authenticatedUser: UserAccount | null;
  setAuthenticatedUser: React.Dispatch<React.SetStateAction<UserAccount | null>>;
  userOwnedStores: LocalStore[];
  hasSellerRole: boolean;
  hasCompletedStore: boolean;
  openOtpAuthModal: (options?: OtpModalLaunchOptions) => void;
  handleSignOutOtpSession: () => Promise<void>;
  handleAddSellerAndStore: (
    newSeller: SellerProfile,
    newStore: LocalStore
  ) => Promise<void>;
  handleUpdateStoreSettings: (updatedStore: LocalStore) => void;
  handleDeleteStore: (
    storeId: string,
    storeNameConfirm: string
  ) => Promise<{ success: boolean; message?: string }>;
  permanentlyDeleteStore: (storeId: string) => Promise<void>;
  handleAddProduct: (newProduct: Product) => void;
  handleUpdateProduct: (updatedProduct: Product) => void;
  handleDeleteProduct: (productId: string) => void;
  handleUpdateStock: (
    productId: string,
    newStock: number,
    actorSellerId: string,
    isAdmin: boolean
  ) => void;
  handleToggleCategoryStatus: (categoryId: StoreCategoryId) => void;
  cart: CartItem[];
  totalCartItems: number;
  totalCartValue: number;
  handleAddToCart: (
    product: Product,
    variant: string,
    quantity?: number
  ) => void;
  handleUpdateCartQuantity: (
    productId: string,
    variant: string,
    delta: number
  ) => void;
  handleRemoveCartItem: (productId: string, variant: string) => void;
  handlePlaceOrder: (newOrder: OrderRecord) => void;
  handleSetOrderStep: (
    orderId: string,
    nextStep: number,
    nextStatus?: OrderRecord['orderStatus']
  ) => void;
  handleCancelOrder: (orderId: string, reason?: string) => Promise<boolean>;
  toastNotice: string | null;
  showToast: (msg: string) => void;
}

const UrbanDirectContext = createContext<UrbanDirectContextValue | null>(null);

export function UrbanDirectProvider({children}: {children: React.ReactNode}) {
  const router = useRouter();
  const pathname = usePathname();
  const isMounted = useSyncExternalStore(
    subscribeNoop,
    getClientMountedSnapshot,
    getServerMountedSnapshot
  );
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);

  const [sellers, setSellers] = useState<SellerProfile[]>(() => {
    if (typeof window === 'undefined') return INITIAL_SELLERS;
    try {
      const raw = window.localStorage.getItem(CUSTOM_SELLERS_STORAGE_KEY);
      if (raw) {
        const custom = JSON.parse(raw) as SellerProfile[];
        const map = new Map<string, SellerProfile>();
        for (const s of INITIAL_SELLERS) map.set(s.id, s);
        for (const s of custom) map.set(s.id, s);
        return Array.from(map.values());
      }
    } catch {
      // Ignore
    }
    return INITIAL_SELLERS;
  });

  const [deletedStoreIds, setDeletedStoreIds] = useState<Set<string>>(() =>
    readStoredDeletedStoreIds()
  );

  const [stores, setStores] = useState<LocalStore[]>(() => {
    const deleted = readStoredDeletedStoreIds();
    const baseStores = INITIAL_STORES.filter((s) => !deleted.has(s.id));
    if (typeof window === 'undefined') return baseStores;
    try {
      const raw = window.localStorage.getItem(CUSTOM_STORES_STORAGE_KEY);
      if (raw) {
        const custom = JSON.parse(raw) as LocalStore[];
        const map = new Map<string, LocalStore>();
        for (const s of baseStores) map.set(s.id, s);
        for (const s of custom) {
          if (!deleted.has(s.id)) map.set(s.id, s);
        }
        return Array.from(map.values());
      }
    } catch {
      // Ignore
    }
    return baseStores;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const deleted = readStoredDeletedStoreIds();
    const baseProducts = INITIAL_PRODUCTS.filter((p) => !deleted.has(p.storeId));
    if (typeof window === 'undefined') return baseProducts;
    try {
      const raw = window.localStorage.getItem(CUSTOM_PRODUCTS_STORAGE_KEY);
      if (raw) {
        const custom = JSON.parse(raw) as Product[];
        const map = new Map<string, Product>();
        for (const p of baseProducts) map.set(p.id, p);
        for (const p of custom) {
          if (!deleted.has(p.storeId)) map.set(p.id, p);
        }
        return Array.from(map.values());
      }
    } catch {
      // Ignore
    }
    return baseProducts;
  });

  const [categories, setCategories] = useState<CategoryDefinition[]>(
    AUTHORITATIVE_STORE_CATEGORIES
  );

  // Sync live stores and products from Firestore (`urbandirectintracity`) on mount
  useEffect(() => {
    let active = true;
    fetchStoresAndProductsFromFirestore().then((live) => {
      if (!active) return;
      const currentDeleted = readStoredDeletedStoreIds();
      if (live.stores.length > 0) {
        setStores((prev) => {
          const map = new Map<string, LocalStore>();
          for (const s of prev) {
            if (!currentDeleted.has(s.id)) map.set(s.id, s);
          }
          for (const s of live.stores) {
            if (!currentDeleted.has(s.id)) map.set(s.id, s);
          }
          return Array.from(map.values());
        });
      }
      if (live.products.length > 0) {
        setProducts((prev) => {
          const map = new Map<string, Product>();
          for (const p of prev) {
            if (!currentDeleted.has(p.storeId)) map.set(p.id, p);
          }
          for (const p of live.products) {
            if (!currentDeleted.has(p.storeId)) map.set(p.id, p);
          }
          return Array.from(map.values());
        });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Persistent Buyer City State
  const [savedLocation, setSavedLocation] =
    useState<CustomerShoppingLocation | null>(() => readStoredBuyerLocation());
  const [isLocationModalOpen, setIsLocationModalOpen] =
    useState<boolean>(false);

  // Mobile OTP-Only Authentication State
  // Defaults to null for unauthenticated visitors so `/` opens as a public buyer experience immediately
  const [authenticatedUser, setAuthenticatedUser] =
    useState<UserAccount | null>(() => {
      if (typeof window === 'undefined') return null;
      try {
        const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
        if (raw) {
          return JSON.parse(raw) as UserAccount;
        }
      } catch {
        // Ignore storage read errors
      }
      return null;
    });

  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    defaultJourney: 'BUYER' | 'SELLER';
    authContextMode: OtpAuthContextMode;
    legacySellerId?: string;
  }>({
    isOpen: false,
    defaultJourney: 'BUYER',
    authContextMode: 'BUYER_SIGN_IN',
  });

  const authSuccessCallbackRef = useRef<
    | ((user: UserAccount, selectedJourney: 'BUYER' | 'SELLER') => void)
    | undefined
  >(undefined);

  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice((current) => (current === msg ? null : current));
    }, 3200);
  };

  // Restore and verify server session on mount & Firebase Auth state change
  useEffect(() => {
    if (!isMounted) return;
    let active = true;

    const verifyAndRestoreSession = async () => {
      try {
        const res = await fetch('/api/auth/otp', {
          method: 'GET',
          cache: 'no-store',
        });
        const data = await res.json();

        if (!active) return;

        if (res.status === 403 && data?.suspended) {
          setAuthenticatedUser(null);
          try {
            window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
          } catch {}
          setIsAuthReady(true);
          return;
        }

        if (data?.ok && data?.authenticated && data?.user) {
          const serverVerifiedUser = data.user as UserAccount;
          setAuthenticatedUser(serverVerifiedUser);
          try {
            window.localStorage.setItem(
              AUTH_USER_STORAGE_KEY,
              JSON.stringify(serverVerifiedUser)
            );
          } catch {}
        } else if (authenticatedUser?.phoneE164) {
          // If localStorage has a session from before server restart, re-verify with server
          const reVerifyRes = await fetch('/api/auth/otp', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              action: 'RESOLVE_FIREBASE_USER',
              phoneE164: authenticatedUser.phoneE164,
              countryCode: authenticatedUser.countryCode || 'IN',
              maskedPhone: authenticatedUser.maskedPhone,
              firebaseUid:
                auth.currentUser?.uid ||
                authenticatedUser.uid ||
                authenticatedUser.id ||
                `firebase-phone-${authenticatedUser.phoneE164.replace(/[^0-9]/g, '')}`,
            }),
          });
          const reVerifyData = await reVerifyRes.json();
          if (active && reVerifyRes.ok && reVerifyData?.user) {
            const restoredUser = reVerifyData.user as UserAccount;
            setAuthenticatedUser(restoredUser);
            try {
              window.localStorage.setItem(
                AUTH_USER_STORAGE_KEY,
                JSON.stringify(restoredUser)
              );
            } catch {}
          }
        }
      } catch {
        // Ignore network errors during initial check
      } finally {
        if (active) {
          setIsAuthReady(true);
        }
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, () => {
      void verifyAndRestoreSession();
    });

    void verifyAndRestoreSession();

    return () => {
      active = false;
      unsubscribeAuth();
    };
  }, [isMounted, authenticatedUser?.phoneE164, authenticatedUser?.countryCode, authenticatedUser?.maskedPhone, authenticatedUser?.uid, authenticatedUser?.id]);

  // Automated FCM Device Registration & Real-Time Foreground Push Listener
  useEffect(() => {
    if (!isMounted) return;

    void requestAndRegisterFcmToken({
      uid: authenticatedUser?.uid || authenticatedUser?.id,
      sellerId: authenticatedUser?.sellerId,
      buyerPhone: authenticatedUser?.phoneE164,
      role: authenticatedUser?.sellerId ? 'BOTH' : 'BUYER',
    });

    const unsubscribe = subscribeToForegroundMessages(({ title, body }) => {
      showToast(`🔔 ${title}: ${body}`);
    });

    return () => {
      unsubscribe();
    };
  }, [isMounted, authenticatedUser]);

  const openOtpAuthModal = (options?: OtpModalLaunchOptions) => {
    authSuccessCallbackRef.current = options?.onSuccessCallback;
    setAuthModalState({
      isOpen: true,
      defaultJourney: options?.defaultJourney || 'BUYER',
      authContextMode: options?.authContextMode || 'BUYER_SIGN_IN',
      legacySellerId: options?.legacySellerId,
    });
  };

  const handleAuthenticatedViaOtp = (
    user: UserAccount,
    selectedJourney: 'BUYER' | 'SELLER',
    migratedSellerId?: string
  ) => {
    // Check if this user's phone matches any existing seller or custom store in local state
    const matchedSeller = sellers.find(
      (s) => s.phoneE164 === user.phoneE164 || s.id === user.sellerId
    );
    const matchedStores = stores.filter(
      (st) =>
        (matchedSeller && st.sellerId === matchedSeller.id) ||
        (user.sellerId && st.sellerId === user.sellerId) ||
        user.storeIds.includes(st.id)
    );

    // Strictly preserve server-verified `isAdmin` and `role: 'super_admin'`
    const isVerifiedSuperAdmin =
      user.phoneE164 === '+918329306616' &&
      user.role === 'super_admin' &&
      user.isAdmin === true;

    const enrichedUser: UserAccount =
      matchedSeller || matchedStores.length > 0
        ? {
            ...user,
            roles: Array.from(
              new Set([
                ...user.roles,
                'BUYER',
                'SELLER',
                ...(isVerifiedSuperAdmin ? (['ADMIN'] as const) : []),
              ])
            ),
            isAdmin: isVerifiedSuperAdmin,
            role: isVerifiedSuperAdmin ? 'super_admin' : undefined,
            sellerId: user.sellerId || matchedSeller?.id,
            storeIds: Array.from(
              new Set([
                ...user.storeIds,
                ...(matchedSeller?.storeIds || []),
                ...matchedStores.map((m) => m.id),
              ])
            ),
          }
        : {
            ...user,
            isAdmin: isVerifiedSuperAdmin,
            role: isVerifiedSuperAdmin ? 'super_admin' : undefined,
          };

    setAuthenticatedUser(enrichedUser);
    try {
      window.localStorage.setItem(
        AUTH_USER_STORAGE_KEY,
        JSON.stringify(enrichedUser)
      );
    } catch {
      // Ignore quota errors
    }

    setAuthModalState((prev) => ({...prev, isOpen: false}));

    // AUTOMATIC REDIRECT FOR DESIGNATED PLATFORM OWNER (+918329306616)
    // When both phone identity (+918329306616) and trusted server role (super_admin) pass,
    // automatically redirect to the Super Admin Dashboard (/admin) from any login entry point.
    if (isVerifiedSuperAdmin || enrichedUser.phoneE164 === '+918329306616') {
      authSuccessCallbackRef.current = undefined;
      showToast(
        isVerifiedSuperAdmin
          ? 'Verified Platform Owner (+918329306616) · Redirecting to Super Admin Dashboard...'
          : 'Verified Platform Owner (+918329306616) · Opening Super Admin Role Activation...'
      );
      if (pathname !== '/admin') {
        router.push('/admin');
      }
      return;
    }

    if (migratedSellerId) {
      setSellers((prev) =>
        prev.map((s) =>
          s.id === migratedSellerId
            ? {
                ...s,
                phoneE164: enrichedUser.phoneE164,
                phoneCountryCode: enrichedUser.countryCode,
                phoneVerified: true,
                migrationRequired: false,
              }
            : s
        )
      );
      showToast(
        `Mobile number ${enrichedUser.phoneE164} verified and linked to your seller account.`
      );
    } else {
      showToast(`Signed in via mobile OTP (${enrichedUser.phoneE164})`);
    }

    if (authSuccessCallbackRef.current) {
      const cb = authSuccessCallbackRef.current;
      authSuccessCallbackRef.current = undefined;
      cb(enrichedUser, selectedJourney);
    }
  };

  const handleSignOutOtpSession = async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignore Firebase sign-out errors
    }
    try {
      await fetch('/api/auth/otp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'SIGN_OUT'}),
      });
    } catch {
      // Ignore network errors on sign-out
    }
    setAuthenticatedUser(null);
    try {
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    } catch {
      // Ignore
    }
    showToast('Signed out of your mobile session.');
  };

  const customerLocation: CustomerShoppingLocation = useMemo(() => {
    if (!isMounted) return UNSET_CUSTOMER_LOCATION;
    return savedLocation || UNSET_CUSTOMER_LOCATION;
  }, [isMounted, savedLocation]);

  const hasSelectedCity =
    customerLocation.mode === 'SELECTED_LOCATION' &&
    customerLocation.city.trim().length > 0;

  const handleConfirmBuyerLocation = (newLoc: CustomerShoppingLocation) => {
    setSavedLocation(newLoc);
    setIsLocationModalOpen(false);
    try {
      window.localStorage.setItem(
        BUYER_CITY_STORAGE_KEY,
        JSON.stringify(newLoc)
      );
    } catch {
      // Ignore storage quota errors
    }
    showToast(
      `Delivering in: ${newLoc.city}${
        newLoc.stateRegion ? `, ${newLoc.stateRegion}` : ''
      }`
    );
  };

  // Compute stores owned by the currently authenticated user
  const userOwnedStores = useMemo(() => {
    if (!authenticatedUser) return [];
    const matchedSeller = sellers.find(
      (s) =>
        s.id === authenticatedUser.sellerId ||
        (Boolean(s.phoneE164) && s.phoneE164 === authenticatedUser.phoneE164)
    );
    return stores.filter(
      (st) =>
        (authenticatedUser.sellerId &&
          st.sellerId === authenticatedUser.sellerId) ||
        (matchedSeller && st.sellerId === matchedSeller.id) ||
        authenticatedUser.storeIds.includes(st.id)
    );
  }, [authenticatedUser, sellers, stores]);

  const hasSellerRole = Boolean(
    authenticatedUser &&
      (authenticatedUser.roles.includes('SELLER') ||
        authenticatedUser.roles.includes('ADMIN') ||
        Boolean(authenticatedUser.sellerId) ||
        userOwnedStores.length > 0)
  );

  const hasCompletedStore = Boolean(
    authenticatedUser &&
      (authenticatedUser.roles.includes('ADMIN') ||
        userOwnedStores.some((s) => isStoreLocationComplete(s)))
  );

  const handleAddSellerAndStore = async (
    newSeller: SellerProfile,
    newStore: LocalStore
  ) => {
    setSellers((prev) => {
      const next = [...prev.filter((s) => s.id !== newSeller.id), newSeller];
      try {
        const customOnly = next.filter(
          (s) => !INITIAL_SELLERS.some((init) => init.id === s.id)
        );
        window.localStorage.setItem(
          CUSTOM_SELLERS_STORAGE_KEY,
          JSON.stringify(customOnly)
        );
      } catch {
        // Ignore
      }
      return next;
    });

    setStores((prev) => {
      const next = [...prev.filter((s) => s.id !== newStore.id), newStore];
      try {
        const customOnly = next.filter(
          (s) => !INITIAL_STORES.some((init) => init.id === s.id)
        );
        window.localStorage.setItem(
          CUSTOM_STORES_STORAGE_KEY,
          JSON.stringify(customOnly)
        );
      } catch {
        // Ignore
      }
      return next;
    });

    // Upgrade or sync authenticatedUser so the same mobile account now has both BUYER and SELLER access
    const phoneE164 =
      authenticatedUser?.phoneE164 || newSeller.phoneE164 || '+919820000000';
    const upgradedUser: UserAccount = authenticatedUser
      ? {
          ...authenticatedUser,
          fullName: newSeller.businessOwnerName || authenticatedUser.fullName,
          roles: Array.from(
            new Set([...authenticatedUser.roles, 'BUYER', 'SELLER'])
          ),
          sellerId: newSeller.id,
          storeIds: Array.from(
            new Set([...authenticatedUser.storeIds, newStore.id])
          ),
        }
      : {
          id: `user-${newSeller.id}`,
          phoneE164,
          maskedPhone: `${phoneE164.slice(0, 3)} •••••• ${phoneE164.slice(-4)}`,
          countryCode: newSeller.phoneCountryCode || 'IN',
          fullName: newSeller.businessOwnerName,
          roles: ['BUYER', 'SELLER'],
          sellerId: newSeller.id,
          storeIds: [newStore.id],
          createdAt: new Date().toISOString().slice(0, 10),
        };

    setAuthenticatedUser(upgradedUser);
    try {
      window.localStorage.setItem(
        AUTH_USER_STORAGE_KEY,
        JSON.stringify(upgradedUser)
      );
    } catch {
      // Ignore
    }

    try {
      await fetch('/api/auth/otp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'UPGRADE_TO_SELLER',
          phoneE164: upgradedUser.phoneE164,
          countryCode: upgradedUser.countryCode,
          fullName: upgradedUser.fullName,
          sellerId: newSeller.id,
          storeId: newStore.id,
        }),
      });
    } catch {
      // Ignore network error
    }

    void syncSellerProfileToFirestore(newSeller);
    void syncStoreToFirestore(newStore);
    void syncUserAccountToFirestore(upgradedUser);

    showToast(
      `Your store "${newStore.name}" is now open in ${newStore.cityName}!`
    );
  };

  const handleUpdateStoreSettings = (updatedStore: LocalStore) => {
    setStores((prev) => {
      const next = prev.map((s) =>
        s.id === updatedStore.id ? updatedStore : s
      );
      try {
        const customOnly = next.filter(
          (s) => !INITIAL_STORES.some((init) => init.id === s.id)
        );
        window.localStorage.setItem(
          CUSTOM_STORES_STORAGE_KEY,
          JSON.stringify(customOnly)
        );
      } catch {
        // Ignore
      }
      return next;
    });
    void syncStoreToFirestore(updatedStore);
    showToast('Store details saved.');
  };

  const handleDeleteStore = async (
    storeId: string,
    storeNameConfirm: string
  ): Promise<{ success: boolean; message?: string }> => {
    const storeToDelete = stores.find((s) => s.id === storeId);
    if (!storeToDelete) {
      return { success: false, message: 'Store could not be found or has already been deleted.' };
    }

    // 1. Call secure server-side deletion API endpoint
    try {
      const res = await fetch(`/api/stores/${encodeURIComponent(storeId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterUid: authenticatedUser?.uid || auth.currentUser?.uid,
          requesterPhone: authenticatedUser?.phoneE164,
          sellerId: authenticatedUser?.sellerId,
          storeNameConfirmation: storeNameConfirm,
          isAdmin: authenticatedUser?.isAdmin === true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        return {
          success: false,
          message: data.error || 'Server rejected store deletion request.',
        };
      }
    } catch (err) {
      console.error('Error invoking server store deletion endpoint:', err);
      return {
        success: false,
        message: 'Network error connecting to store deletion service. Please try again.',
      };
    }

    // 2. Direct Firestore cleanup fallback
    void deleteStoreAndProductsFromFirestore(storeId);

    // 3. Update deleted stores tombstone registry in local state and localStorage
    const updatedDeleted = new Set(deletedStoreIds);
    updatedDeleted.add(storeId);
    setDeletedStoreIds(updatedDeleted);
    try {
      window.localStorage.setItem(
        DELETED_STORES_STORAGE_KEY,
        JSON.stringify(Array.from(updatedDeleted))
      );
    } catch {
      // Ignore
    }

    // 4. Update stores state and storage
    setStores((prev) => {
      const next = prev.filter((s) => s.id !== storeId);
      try {
        const customOnly = next.filter(
          (s) => !INITIAL_STORES.some((init) => init.id === s.id)
        );
        window.localStorage.setItem(
          CUSTOM_STORES_STORAGE_KEY,
          JSON.stringify(customOnly)
        );
      } catch {
        // Ignore
      }
      return next;
    });

    // 5. Update products state: remove all products belonging to the deleted store
    setProducts((prev) => {
      const next = prev.filter((p) => p.storeId !== storeId);
      try {
        const customOnly = next.filter(
          (p) => !INITIAL_PRODUCTS.some((init) => init.id === p.id)
        );
        window.localStorage.setItem(
          CUSTOM_PRODUCTS_STORAGE_KEY,
          JSON.stringify(customOnly)
        );
      } catch {
        // Ignore
      }
      return next;
    });

    // 6. Clean up cart: remove any items from this store
    setCart((prev) => prev.filter((item) => item.product.storeId !== storeId));

    // 7. Update authenticatedUser storeIds
    if (authenticatedUser && authenticatedUser.storeIds) {
      const updatedStoreIds = authenticatedUser.storeIds.filter(
        (id) => id !== storeId
      );
      const updatedUser: UserAccount = {
        ...authenticatedUser,
        storeIds: updatedStoreIds,
      };
      setAuthenticatedUser(updatedUser);
      try {
        window.localStorage.setItem(
          AUTH_USER_STORAGE_KEY,
          JSON.stringify(updatedUser)
        );
      } catch {
        // Ignore
      }
      void syncUserAccountToFirestore(updatedUser);
    }

    showToast(`Store "${storeToDelete.name}" and all listed products have been permanently deleted.`);
    return {
      success: true,
      message: `Store "${storeToDelete.name}" deleted successfully.`,
    };
  };

  const permanentlyDeleteStore = async (storeId: string) => {
    // 1. Direct Firestore cleanup (products + store document)
    void deleteStoreAndProductsFromFirestore(storeId);

    // 2. Add to local deleted stores registry (tombstone)
    const updatedDeleted = new Set(deletedStoreIds);
    updatedDeleted.add(storeId);
    setDeletedStoreIds(updatedDeleted);
    try {
      window.localStorage.setItem(
        DELETED_STORES_STORAGE_KEY,
        JSON.stringify(Array.from(updatedDeleted))
      );
    } catch {
      // Ignore storage error
    }

    // 3. Filter stores state
    setStores((prev) => prev.filter((s) => s.id !== storeId));

    // 4. Filter products state
    setProducts((prev) => prev.filter((p) => p.storeId !== storeId));

    // 5. Cleanup cart
    setCart((prev) => prev.filter((item) => item.product.storeId !== storeId));

    // 6. Update authenticatedUser storeIds if they owned it
    if (authenticatedUser && authenticatedUser.storeIds.includes(storeId)) {
      const updatedUser: UserAccount = {
        ...authenticatedUser,
        storeIds: authenticatedUser.storeIds.filter((id) => id !== storeId),
      };
      setAuthenticatedUser(updatedUser);
      try {
        window.localStorage.setItem(
          AUTH_USER_STORAGE_KEY,
          JSON.stringify(updatedUser)
        );
      } catch {}
      void syncUserAccountToFirestore(updatedUser);
    }

    showToast(`Store ${storeId} permanently removed.`);
  };

  const handleAddProduct = (newProduct: Product) => {
    setProducts((prev) => {
      const next = [newProduct, ...prev];
      try {
        const customOnly = next.filter(
          (p) => !INITIAL_PRODUCTS.some((init) => init.id === p.id)
        );
        window.localStorage.setItem(
          CUSTOM_PRODUCTS_STORAGE_KEY,
          JSON.stringify(customOnly)
        );
      } catch {
        // Ignore
      }
      return next;
    });
    void syncProductToFirestore(newProduct);
    showToast('Product added successfully.');
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    void syncProductToFirestore(updatedProduct);
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== productId);
      try {
        const customOnly = next.filter(
          (p) => !INITIAL_PRODUCTS.some((init) => init.id === p.id)
        );
        window.localStorage.setItem(
          CUSTOM_PRODUCTS_STORAGE_KEY,
          JSON.stringify(customOnly)
        );
      } catch {
        // Ignore
      }
      return next;
    });
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    void deleteProductFromFirestore(productId);
    showToast('Product removed from your store.');
  };

  const handleUpdateStock = (
    productId: string,
    newStock: number,
    actorSellerId: string,
    isAdmin: boolean
  ) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        if (!isAdmin && p.sellerId !== actorSellerId) return p;
        return {
          ...p,
          stock: newStock,
          isAvailable: newStock > 0,
          statusNote: newStock > 0 ? 'In stock' : 'Out of stock',
        };
      })
    );
  };

  const handleToggleCategoryStatus = (categoryId: StoreCategoryId) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId ? {...c, isActive: !c.isActive} : c
      )
    );
  };

  // Shopping Cart State
  const [cart, setCart] = useState<CartItem[]>([
    {
      product: INITIAL_PRODUCTS[0],
      variant: INITIAL_PRODUCTS[0].variants[0],
      quantity: 1,
    },
  ]);

  const totalCartItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );
  const totalCartValue = useMemo(
    () =>
      cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart]
  );

  const handleAddToCart = (
    product: Product,
    variant: string,
    quantity = 1
  ) => {
    if (product.stock <= 0) {
      showToast(`"${product.name}" is currently out of stock`);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.variant === variant
      );
      if (existingIndex > -1) {
        const currentQty = prev[existingIndex].quantity;
        const totalQty = currentQty + quantity;
        if (totalQty > product.stock) {
          showToast(`Cannot add more. Stock limit reached (${product.stock})`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: totalQty,
        };
        return updated;
      }
      const initialQty = Math.min(quantity, product.stock);
      return [...prev, { product, variant, quantity: initialQty }];
    });
    showToast(`Added "${product.name}" to your cart`);
  };

  const handleUpdateCartQuantity = (
    productId: string,
    variant: string,
    delta: number
  ) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId && item.variant === variant) {
            const nextQty = item.quantity + delta;
            if (delta > 0 && nextQty > item.product.stock) {
              showToast(`Stock limit reached (${item.product.stock} max)`);
              return item;
            }
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const handleRemoveCartItem = (productId: string, variant: string) => {
    setCart((prev) =>
      prev.filter(
        (item) => !(item.product.id === productId && item.variant === variant)
      )
    );
  };

  // Customer Orders State (persists real buyer orders across reloads; keeps INITIAL_DEMO_ORDER tagged isDemo: true)
  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    if (typeof window === 'undefined') return [INITIAL_DEMO_ORDER];
    try {
      const raw = window.localStorage.getItem(CUSTOM_ORDERS_STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as OrderRecord[];
        const map = new Map<string, OrderRecord>();
        for (const o of stored) {
          if (o && typeof o.id === 'string') {
            map.set(o.id, o);
          }
        }
        if (!map.has(INITIAL_DEMO_ORDER.id)) {
          map.set(INITIAL_DEMO_ORDER.id, INITIAL_DEMO_ORDER);
        } else {
          // Ensure the built-in sample order always retains isDemo: true
          const existingDemo = map.get(INITIAL_DEMO_ORDER.id)!;
          map.set(INITIAL_DEMO_ORDER.id, {...existingDemo, isDemo: true});
        }
        return Array.from(map.values());
      }
    } catch {
      // Ignore storage read error
    }
    return [INITIAL_DEMO_ORDER];
  });

  const [sellerNotifications, setSellerNotifications] = useState<SellerNotification[]>([]);

  const unreadNotificationCount = useMemo(
    () => sellerNotifications.filter((n) => !n.isRead).length,
    [sellerNotifications]
  );

  const handleMarkNotificationRead = (id: string) => {
    setSellerNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleClearNotifications = () => {
    setSellerNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const persistOrdersToStorage = (nextOrders: OrderRecord[]) => {
    try {
      window.localStorage.setItem(
        CUSTOM_ORDERS_STORAGE_KEY,
        JSON.stringify(nextOrders)
      );
    } catch {
      // Ignore storage quota error
    }
  };

  // Automated Real-Time Seller Orders and Notifications Sync
  useEffect(() => {
    if (!isMounted) return;
    let active = true;

    const syncSellerData = async () => {
      if (!authenticatedUser?.sellerId) return;
      try {
        const [ordersRes, notifsRes] = await Promise.all([
          fetch(`/api/orders?sellerId=${authenticatedUser.sellerId}`),
          fetch(`/api/orders?type=notifications&sellerId=${authenticatedUser.sellerId}`),
        ]);

        if (ordersRes.ok && active) {
          const ordersData = await ordersRes.json();
          if (ordersData.ok && Array.isArray(ordersData.orders)) {
            const fetchedOrders: OrderRecord[] = ordersData.orders;
            setOrders((prev) => {
              const map = new Map<string, OrderRecord>();
              for (const o of prev) map.set(o.id, o);
              for (const o of fetchedOrders) {
                if (!map.has(o.id) && o.orderStatus === 'NEW') {
                  showToast(`🔔 New order #${o.id} received from ${o.customer.fullName}!`);
                }
                map.set(o.id, o);
              }
              const next = Array.from(map.values());
              persistOrdersToStorage(next);
              return next;
            });
          }
        }

        if (notifsRes.ok && active) {
          const notifsData = await notifsRes.json();
          if (notifsData.ok && Array.isArray(notifsData.notifications)) {
            setSellerNotifications((prev) => {
              const map = new Map<string, SellerNotification>();
              for (const n of prev) map.set(n.id, n);
              for (const n of notifsData.notifications) {
                if (!map.has(n.id)) map.set(n.id, n);
              }
              return Array.from(map.values()).sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
            });
          }
        }
      } catch {
        // Ignore network errors on background poll
      }
    };

    void syncSellerData();
    const interval = setInterval(syncSellerData, 7000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isMounted, authenticatedUser?.sellerId]);

  const handlePlaceOrder = (newOrder: OrderRecord) => {
    const orderWithStatus: OrderRecord = {
      ...newOrder,
      createdAtIso: newOrder.createdAtIso || new Date().toISOString(),
      orderStatus: newOrder.orderStatus || 'NEW',
      isDemo: Boolean(newOrder.isDemo),
      isTest: Boolean(newOrder.isTest),
    };
    setOrders((prev) => {
      const deduped = prev.filter((o) => o.id !== orderWithStatus.id);
      const next = [orderWithStatus, ...deduped];
      persistOrdersToStorage(next);
      return next;
    });

    // Decrement stock for ordered items
    setProducts((prev) =>
      prev.map((p) => {
        const itemInOrder = newOrder.items.find((i) => i.product.id === p.id);
        if (itemInOrder) {
          const nextStock = Math.max(0, p.stock - itemInOrder.quantity);
          return {
            ...p,
            stock: nextStock,
            isAvailable: nextStock > 0,
            statusNote: nextStock > 0 ? 'In stock' : 'Out of stock',
          };
        }
        return p;
      })
    );

    setCart([]);
    void syncOrderToFirestore(orderWithStatus);
    showToast(`Order #${newOrder.id} placed with ${newOrder.storeName}`);
  };

  const handleSetOrderStep = async (
    orderId: string,
    nextStep: number,
    nextStatus?: OrderRecord['orderStatus']
  ) => {
    const resolvedStatus: OrderRecord['orderStatus'] =
      nextStatus ||
      (nextStep === 0
        ? 'NEW'
        : nextStep === 1
          ? 'CONFIRMED'
          : nextStep === 2
            ? 'PREPARING'
            : nextStep === 3
              ? 'OUT_FOR_DELIVERY'
              : 'DELIVERED');

    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nextStatus: resolvedStatus,
          actorSellerId: authenticatedUser?.sellerId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.order) {
        const updatedOrder: OrderRecord = data.order;
        setOrders((prev) => {
          const next = prev.map((o) => (o.id === orderId ? updatedOrder : o));
          persistOrdersToStorage(next);
          return next;
        });
        void syncOrderToFirestore(updatedOrder);
        showToast(`Order #${orderId} updated to ${resolvedStatus}`);
        return;
      }
    } catch {
      // Fallback local update
    }

    setOrders((prev) => {
      const next = prev.map((o) => {
        if (o.id !== orderId) return o;
        const updatedOrder: OrderRecord = {
          ...o,
          currentStepIndex: nextStep,
          orderStatus: resolvedStatus,
          statusHistory: [
            ...(o.statusHistory || []),
            {
              status: resolvedStatus,
              timestamp: new Date().toISOString(),
              note: `Status updated to ${resolvedStatus}`,
              actor: authenticatedUser?.sellerId ? 'SELLER' : 'SYSTEM',
            },
          ],
        };
        void syncOrderToFirestore(updatedOrder);
        return updatedOrder;
      });
      persistOrdersToStorage(next);
      return next;
    });
    showToast(`Order #${orderId} status updated`);
  };

  const handleCancelOrder = async (orderId: string, reason?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nextStatus: 'CANCELLED',
          cancellationReason: reason || 'Cancelled by buyer',
          actorBuyerUid: authenticatedUser?.id,
          actorSellerId: authenticatedUser?.sellerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to cancel order');
        return false;
      }

      const updatedOrder: OrderRecord = data.order;
      setOrders((prev) => {
        const next = prev.map((o) => (o.id === orderId ? updatedOrder : o));
        persistOrdersToStorage(next);
        return next;
      });
      void syncOrderToFirestore(updatedOrder);
      showToast(`Order #${orderId} cancelled successfully`);
      return true;
    } catch {
      // Fallback local cancellation
      setOrders((prev) => {
        const next = prev.map((o) => {
          if (o.id !== orderId) return o;
          const updated: OrderRecord = {
            ...o,
            orderStatus: 'CANCELLED',
            cancellationReason: reason || 'Cancelled by buyer',
            statusHistory: [
              ...(o.statusHistory || []),
              {
                status: 'CANCELLED',
                timestamp: new Date().toISOString(),
                note: reason || 'Cancelled by buyer',
                actor: 'BUYER',
              },
            ],
          };
          void syncOrderToFirestore(updated);
          return updated;
        });
        persistOrdersToStorage(next);
        return next;
      });
      showToast(`Order #${orderId} cancelled`);
      return true;
    }
  };

  const value: UrbanDirectContextValue = {
    isMounted,
    isAuthReady,
    sellers,
    stores,
    setStores,
    products,
    setProducts,
    orders,
    sellerNotifications,
    unreadNotificationCount,
    handleMarkNotificationRead,
    handleClearNotifications,
    categories,
    savedLocation,
    customerLocation,
    hasSelectedCity,
    isLocationModalOpen,
    setIsLocationModalOpen,
    handleConfirmBuyerLocation,
    authenticatedUser,
    setAuthenticatedUser,
    userOwnedStores,
    hasSellerRole,
    hasCompletedStore,
    openOtpAuthModal,
    handleSignOutOtpSession,
    handleAddSellerAndStore,
    handleUpdateStoreSettings,
    handleDeleteStore,
    permanentlyDeleteStore,
    handleAddProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleUpdateStock,
    handleToggleCategoryStatus,
    cart,
    totalCartItems,
    totalCartValue,
    handleAddToCart,
    handleUpdateCartQuantity,
    handleRemoveCartItem,
    handlePlaceOrder,
    handleSetOrderStep,
    handleCancelOrder,
    toastNotice,
    showToast,
  };

  return (
    <UrbanDirectContext.Provider value={value}>
      {children}

      {/* Global Toast Notice */}
      {toastNotice && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#0F172A] text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700/80 text-xs font-semibold flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          </span>
          <span>{toastNotice}</span>
        </div>
      )}

      {/* Global Mobile OTP Authentication Modal */}
      <MobileOtpAuthModal
        key={`${authModalState.isOpen}-${authModalState.authContextMode}-${authModalState.defaultJourney}`}
        isOpen={authModalState.isOpen}
        defaultJourney={authModalState.defaultJourney}
        authContextMode={authModalState.authContextMode}
        unmigratedSellers={sellers.filter(
          (s) => s.migrationRequired && !s.phoneVerified
        )}
        onAuthenticated={handleAuthenticatedViaOtp}
        onClose={() => setAuthModalState((prev) => ({...prev, isOpen: false}))}
      />
    </UrbanDirectContext.Provider>
  );
}

const DEFAULT_FALLBACK_CONTEXT: UrbanDirectContextValue = {
  isMounted: false,
  isAuthReady: false,
  sellers: INITIAL_SELLERS,
  stores: INITIAL_STORES,
  setStores: () => {},
  products: INITIAL_PRODUCTS,
  setProducts: () => {},
  orders: [INITIAL_DEMO_ORDER],
  sellerNotifications: [],
  unreadNotificationCount: 0,
  handleMarkNotificationRead: () => {},
  handleClearNotifications: () => {},
  categories: AUTHORITATIVE_STORE_CATEGORIES,
  savedLocation: DEFAULT_NANDED_BUYER_LOCATION,
  customerLocation: DEFAULT_NANDED_BUYER_LOCATION,
  hasSelectedCity: true,
  isLocationModalOpen: false,
  setIsLocationModalOpen: () => {},
  handleConfirmBuyerLocation: () => {},
  authenticatedUser: null,
  setAuthenticatedUser: () => {},
  userOwnedStores: [],
  hasSellerRole: false,
  hasCompletedStore: false,
  openOtpAuthModal: () => {},
  handleSignOutOtpSession: async () => {},
  handleAddSellerAndStore: async () => {},
  handleUpdateStoreSettings: () => {},
  handleDeleteStore: async () => ({ success: false }),
  permanentlyDeleteStore: async () => {},
  handleAddProduct: () => {},
  handleUpdateProduct: () => {},
  handleDeleteProduct: () => {},
  handleUpdateStock: () => {},
  handleToggleCategoryStatus: () => {},
  cart: [],
  totalCartItems: 0,
  totalCartValue: 0,
  handleAddToCart: () => {},
  handleUpdateCartQuantity: () => {},
  handleRemoveCartItem: () => {},
  handlePlaceOrder: () => {},
  handleSetOrderStep: () => {},
  handleCancelOrder: async () => false,
  toastNotice: null,
  showToast: () => {},
};

export function useUrbanDirect(): UrbanDirectContextValue {
  const ctx = useContext(UrbanDirectContext);
  if (!ctx) {
    return DEFAULT_FALLBACK_CONTEXT;
  }
  return ctx;
}
