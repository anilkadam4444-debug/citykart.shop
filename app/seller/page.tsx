'use client';

export const dynamic = 'force-dynamic';

import React, {useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {useRouter} from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Phone,
  ShieldCheck,
  Store,
  AlertCircle,
  Plus,
  ShoppingBag,
  MapPin,
  Package,
} from 'lucide-react';
import {useUrbanDirect} from '@/components/urbandirect-provider';
import {MerchantStudio} from '@/components/merchant-studio';
import {CategoryIcon} from '@/components/category-icon';
import {isStoreLocationComplete} from '@/lib/catalog-data';

export default function SellerEntryPage() {
  const router = useRouter();
  const {
    isMounted,
    sellers,
    stores,
    products,
    orders,
    categories,
    authenticatedUser,
    userOwnedStores,
    hasSellerRole,
    hasCompletedStore,
    openOtpAuthModal,
    handleSignOutOtpSession,
    handleAddSellerAndStore,
    handleUpdateStoreSettings,
    handleAddProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleUpdateStock,
    handleSetOrderStep,
    handleToggleCategoryStatus,
    showToast,
  } = useUrbanDirect();

  const [isOpeningNewStore, setIsOpeningNewStore] = useState<boolean>(false);
  const [accountStateNotice, setAccountStateNotice] = useState<{
    type: 'BUYER_NO_STORE' | 'DUPLICATE_STORE_PREVENTED' | 'INCOMPLETE_STORE';
    message: string;
  } | null>(null);

  const primaryOwnedStore = userOwnedStores[0] || null;
  const isIncompleteSellerAccount =
    Boolean(authenticatedUser) &&
    hasSellerRole &&
    !hasCompletedStore &&
    !authenticatedUser?.roles.includes('ADMIN');

  // Show the 6-step store registration wizard when:
  // 1. User clicked "Open a store" (and does not already have a completed store), OR
  // 2. Case 4: User signed in as a seller whose store setup is incomplete
  const showOnboardingWizard =
    (isOpeningNewStore && !hasCompletedStore) || isIncompleteSellerAccount;

  // Option 1: "Sign in to your store"
  const handleSignInToStore = () => {
    setAccountStateNotice(null);

    // If already signed in via Mobile OTP, inspect their account state
    if (authenticatedUser) {
      if (hasCompletedStore) {
        router?.push('/seller/dashboard');
        return;
      }
      if (hasSellerRole && !hasCompletedStore) {
        setIsOpeningNewStore(true);
        setAccountStateNotice({
          type: 'INCOMPLETE_STORE',
          message:
            'Your mobile number is verified as a seller account, but your store setup is not complete yet. Complete the steps below to open your Seller Dashboard.',
        });
        return;
      }
      // Case 2: Existing buyer account with no registered store
      setAccountStateNotice({
        type: 'BUYER_NO_STORE',
        message: `Your verified mobile number (${authenticatedUser.phoneE164}) is currently a buyer account and does not have a registered store yet. Click "Open a store" below to register your store using this mobile number.`,
      });
      return;
    }

    // Unauthenticated visitor: launch Mobile OTP verification in SELLER_SIGN_IN mode
    openOtpAuthModal({
      defaultJourney: 'SELLER',
      authContextMode: 'SELLER_SIGN_IN',
      onSuccessCallback: (verifiedUser) => {
        const matchedSeller = sellers.find(
          (s) =>
            s.id === verifiedUser.sellerId ||
            (Boolean(s.phoneE164) && s.phoneE164 === verifiedUser.phoneE164)
        );
        const matchedStores = stores.filter(
          (st) =>
            (verifiedUser.sellerId && st.sellerId === verifiedUser.sellerId) ||
            (matchedSeller && st.sellerId === matchedSeller.id) ||
            Boolean(verifiedUser.storeIds?.includes(st.id))
        );
        const completed =
          Boolean(verifiedUser.roles?.includes('ADMIN')) ||
          matchedStores.some((s) => isStoreLocationComplete(s));

        if (completed) {
          router?.push('/seller/dashboard');
        } else if (
          Boolean(verifiedUser.roles?.includes('SELLER')) ||
          Boolean(verifiedUser.sellerId)
        ) {
          setIsOpeningNewStore(true);
          setAccountStateNotice({
            type: 'INCOMPLETE_STORE',
            message:
              'Your mobile number is verified, please complete your store registration below to access your Seller Dashboard.',
          });
        } else {
          // Case 2: Authenticated an existing buyer-only mobile number
          setAccountStateNotice({
            type: 'BUYER_NO_STORE',
            message: `Mobile number ${verifiedUser.phoneE164} is registered as a buyer account and does not have a store yet. You can open a store right now using your verified account.`,
          });
        }
      },
    });
  };

  // Option 2: "Open a store"
  const handleOpenStoreOption = () => {
    setAccountStateNotice(null);

    if (authenticatedUser) {
      // Prevent duplicate store creation if this seller account already owns a completed store
      if (hasCompletedStore && primaryOwnedStore) {
        setAccountStateNotice({
          type: 'DUPLICATE_STORE_PREVENTED',
          message: `Your verified mobile account (${authenticatedUser.phoneE164}) already manages "${primaryOwnedStore.name}" in ${primaryOwnedStore.cityName}. Duplicate store creation is prevented for the same seller account.`,
        });
        return;
      }
      setIsOpeningNewStore(true);
      return;
    }

    // Unauthenticated visitor: verify mobile number with OTP first, then open registration wizard
    openOtpAuthModal({
      defaultJourney: 'SELLER',
      authContextMode: 'SELLER_OPEN_STORE',
      onSuccessCallback: (verifiedUser) => {
        const matchedSeller = sellers.find(
          (s) =>
            s.id === verifiedUser.sellerId ||
            (Boolean(s.phoneE164) && s.phoneE164 === verifiedUser.phoneE164)
        );
        const matchedStores = stores.filter(
          (st) =>
            (verifiedUser.sellerId && st.sellerId === verifiedUser.sellerId) ||
            (matchedSeller && st.sellerId === matchedSeller.id) ||
            Boolean(verifiedUser.storeIds?.includes(st.id))
        );
        const existingCompletedStore = matchedStores.find((s) =>
          isStoreLocationComplete(s)
        );

        if (existingCompletedStore) {
          setAccountStateNotice({
            type: 'DUPLICATE_STORE_PREVENTED',
            message: `Your verified mobile number (${verifiedUser.phoneE164}) already owns "${existingCompletedStore.name}". You can go directly to your Seller Dashboard.`,
          });
          return;
        }
        setIsOpeningNewStore(true);
      },
    });
  };

  return (
    <div className="w-full min-h-dvh flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Dedicated Seller Entry Header */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <Link
              href="/"
              className="flex items-center gap-2 group"
            >
              <Image
                src="/citykart-icon.png"
                alt="Citykart"
                width={32}
                height={32}
                className="w-8 h-8 object-contain"
                priority
              />
              <span className="text-lg font-extrabold tracking-tight leading-none">
                <span className="text-[#003B8E]">City</span>
                <span className="text-[#F96302]">kart</span>
                <span className="text-[10px] font-bold text-slate-400">.shop</span>
              </span>
            </Link>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200/80 text-[#003B8E]">
              For Sellers
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {isMounted && authenticatedUser && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50">
                <Phone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="font-bold text-slate-900">
                  {authenticatedUser.fullName}
                </span>
                <span className="font-mono text-slate-500 hidden sm:inline">
                  ({authenticatedUser.phoneE164})
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpeningNewStore(false);
                    setAccountStateNotice(null);
                    void handleSignOutOtpSession();
                  }}
                  className="text-slate-600 hover:text-slate-900 underline cursor-pointer font-semibold"
                >
                  Sign out
                </button>
              </div>
            )}

            <Link
              href="/pricing"
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 transition-colors"
            >
              Plans &amp; Pricing
            </Link>

            <Link
              href="/"
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to shopping</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        {/* Hero Heading & Supporting Text */}
        <section className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200/80 text-xs font-bold text-[#003B8E]">
            <Store className="w-3.5 h-3.5 text-[#003B8E]" />
            <span>Local Retail Partner Gateway</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
            Manage your store with Citykart
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Reach customers in your city, list your products, and manage your
            orders in one place with zero commission on sales.
          </p>
        </section>

        {/* Active Account Status Banner when signed in */}
        {isMounted && authenticatedUser && (
          <section className="max-w-3xl mx-auto">
            {hasCompletedStore && primaryOwnedStore ? (
              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <Check className="w-4 h-4 text-emerald-700" />
                    <span>
                      Verified Seller Account ({authenticatedUser.phoneE164})
                    </span>
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <CategoryIcon
                      categoryIdOrName={primaryOwnedStore.categoryId}
                      className="w-4 h-4 text-[#003B8E]"
                    />
                    <span>{primaryOwnedStore.name}</span>
                  </h2>
                  <p className="text-xs text-slate-600">
                    {primaryOwnedStore.category} ·{' '}
                    {primaryOwnedStore.neighborhood},{' '}
                    {primaryOwnedStore.cityName}, {primaryOwnedStore.country}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <Link
                    href="/seller/dashboard"
                    className="px-5 py-2.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors shadow-xs"
                  >
                    <span>Go to Seller Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs shadow-2xs">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-700" />
                    <span>
                      Signed in as {authenticatedUser.fullName} (
                      <span className="font-mono">
                        {authenticatedUser.phoneE164}
                      </span>
                      )
                    </span>
                  </div>
                  <p className="text-slate-600">
                    {isIncompleteSellerAccount
                      ? 'Your seller profile is verified, but your store setup is incomplete. Finish registering your store below to unlock your Seller Dashboard.'
                      : 'This mobile number is currently a buyer account with no registered store. You can open a store below using this same verified mobile number.'}
                  </p>
                </div>
                {!showOnboardingWizard && (
                  <button
                    type="button"
                    onClick={() => setIsOpeningNewStore(true)}
                    className="px-4 py-2.5 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Open a store</span>
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* Contextual Notice for Buyer-Only Accounts or Duplicate Store Prevention */}
        {accountStateNotice && (
          <section className="max-w-3xl mx-auto">
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-amber-950">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">
                    {accountStateNotice.type === 'BUYER_NO_STORE'
                      ? 'No store registered on this mobile number yet'
                      : accountStateNotice.type === 'DUPLICATE_STORE_PREVENTED'
                        ? 'Store already registered for this seller account'
                        : 'Complete your store setup'}
                  </div>
                  <p className="text-amber-900 leading-relaxed">
                    {accountStateNotice.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {accountStateNotice.type === 'BUYER_NO_STORE' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAccountStateNotice(null);
                      setIsOpeningNewStore(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white font-bold cursor-pointer"
                  >
                    Open a store now
                  </button>
                )}
                {accountStateNotice.type === 'DUPLICATE_STORE_PREVENTED' && (
                  <Link
                    href="/seller/dashboard"
                    className="px-4 py-2 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white font-bold inline-flex items-center gap-1.5"
                  >
                    <span>Open Seller Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Two Primary Seller Gateway Cards OR Store Registration Wizard */}
        {showOnboardingWizard ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">
                Complete your store registration
              </h2>
              {!isIncompleteSellerAccount && (
                <button
                  type="button"
                  onClick={() => setIsOpeningNewStore(false)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                >
                  Cancel and return to seller options
                </button>
              )}
            </div>

            <MerchantStudio
              mode="ONBOARDING_ONLY"
              initialSection="onboarding"
              sellers={sellers}
              stores={stores}
              products={products}
              orders={orders}
              categories={categories}
              authenticatedUser={authenticatedUser}
              onOpenAuthModal={(opts) =>
                openOtpAuthModal({
                  defaultJourney: 'SELLER',
                  authContextMode: 'SELLER_OPEN_STORE',
                  legacySellerId: opts?.legacySellerId,
                })
              }
              onAddSellerAndStore={(newSeller, newStore) => {
                void handleAddSellerAndStore(newSeller, newStore);
              }}
              onOnboardingComplete={(newStore, goToAddProduct) => {
                showToast(
                  `Store "${newStore.name}" registered! Opening your Seller Dashboard...`
                );
                router?.push(
                  goToAddProduct
                    ? '/seller/dashboard?section=add-product'
                    : '/seller/dashboard'
                );
              }}
              onUpdateStoreSettings={handleUpdateStoreSettings}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onUpdateStock={handleUpdateStock}
              onUpdateOrderStep={handleSetOrderStep}
              onToggleCategoryStatus={handleToggleCategoryStatus}
              onBackToShopping={() => router?.push('/')}
            />
          </section>
        ) : (
          <section
            aria-label="Seller entry options"
            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
          >
            {/* OPTION 1 — EXISTING SELLER: "Sign in to your store" */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 hover:border-[#003B8E]/40 hover:shadow-md transition-all">
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200/70 flex items-center justify-center text-[#003B8E]">
                  <ShieldCheck className="w-5 h-5" />
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#003B8E]">
                    Existing seller
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Sign in to your store
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Already registered your shop on Citykart? Verify your
                    mobile number with a one-time password (OTP) to access your
                    Seller Dashboard, manage products, and fulfill customer
                    orders.
                  </p>
                </div>

                <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Mobile number &amp; 6-digit OTP verification</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Manage live stock, prices, and incoming orders</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Update delivery areas and opening hours</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleSignInToStore}
                  className="w-full py-3.5 px-5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs sm:text-sm font-bold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Phone className="w-4 h-4" />
                  <span>
                    {isMounted && authenticatedUser && hasCompletedStore
                      ? 'Go to your Seller Dashboard'
                      : 'Sign in to your store'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                {isMounted && authenticatedUser && (
                  <button
                    type="button"
                    onClick={() =>
                      openOtpAuthModal({
                        defaultJourney: 'SELLER',
                        authContextMode: 'SELLER_SIGN_IN',
                        onSuccessCallback: () => {
                          router?.push('/seller/dashboard');
                        },
                      })
                    }
                    className="w-full py-2 text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer font-semibold"
                  >
                    Sign in with a different seller mobile number
                  </button>
                )}
              </div>
            </div>

            {/* OPTION 2 — NEW SELLER: "Open a store" */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 hover:border-[#F96302]/40 hover:shadow-md transition-all">
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200/70 flex items-center justify-center text-[#F96302]">
                  <Store className="w-5 h-5" />
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#F96302]">
                    New to Citykart?
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Open a store
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Create your online storefront in minutes. Verify your mobile
                    number, choose from 25 retail categories, set your city or
                    town delivery area, and start receiving local orders.
                  </p>
                </div>

                <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>All 25 local retail &amp; essential categories</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>
                      Register in Mumbai and approved medium &amp; large cities
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>
                      Direct store delivery with Cash or UPI on delivery
                    </span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleOpenStoreOption}
                  className="w-full py-3.5 px-5 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white text-xs sm:text-sm font-bold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Open a store</span>
                </button>
                <p className="text-[11px] text-slate-500 text-center">
                  Uses mobile OTP verification only — no email or password
                  needed.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Overview of What Sellers Can Manage Inside /seller/dashboard */}
        <section className="max-w-4xl mx-auto pt-4 border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-2xs">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-[#003B8E]" />
                <span>Products &amp; Stock</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                List items with INR pricing, upload photos, and mark products in
                or out of stock anytime.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-2xs">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-[#003B8E]" />
                <span>Local Order Fulfillment</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Receive direct orders from nearby buyers and update status from
                Confirmed to Delivered.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-2xs">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#003B8E]" />
                <span>City &amp; Neighborhood Control</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Define the exact neighborhoods, towns, or radius your shop
                delivers to.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
