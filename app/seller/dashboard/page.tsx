'use client';

export const dynamic = 'force-dynamic';

import React, {Suspense} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {useRouter, useSearchParams} from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Phone,
  ShieldAlert,
  Store,
} from 'lucide-react';
import {useUrbanDirect} from '@/components/urbandirect-provider';
import {MerchantStudio} from '@/components/merchant-studio';

function SellerDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSection = searchParams?.get('section');

  const {
    isMounted,
    sellers,
    stores,
    products,
    orders,
    categories,
    authenticatedUser,
    hasSellerRole,
    hasCompletedStore,
    openOtpAuthModal,
    handleSignOutOtpSession,
    handleAddSellerAndStore,
    handleUpdateStoreSettings,
    handleDeleteStore,
    handleAddProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleUpdateStock,
    handleSetOrderStep,
    handleToggleCategoryStatus,
  } = useUrbanDirect();

  const initialSection =
    requestedSection === 'orders' ||
    requestedSection === 'products' ||
    requestedSection === 'add-product' ||
    requestedSection === 'my-store' ||
    requestedSection === 'store-hours' ||
    requestedSection === 'billing' ||
    requestedSection === 'admin-revenue' ||
    requestedSection === 'settings'
      ? requestedSection
      : 'home';

  return (
    <div className="w-full min-h-dvh flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Seller Dashboard Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
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
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#003B8E] text-white">
              Seller Dashboard
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
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
                  onClick={async () => {
                    await handleSignOutOtpSession();
                    router.push('/seller');
                  }}
                  className="text-slate-600 hover:text-slate-900 underline cursor-pointer font-semibold"
                >
                  Sign out
                </button>
              </div>
            )}

            <Link
              href="/pricing"
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 transition-colors"
            >
              Plans &amp; Pricing
            </Link>

            <Link
              href="/seller"
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 transition-colors"
            >
              Seller Gateway
            </Link>

            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Public Shopping Homepage</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-none px-4 sm:px-6 lg:px-8 py-6">
        {!isMounted ? (
          <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
            Verifying seller session and store authorization...
          </div>
        ) : !authenticatedUser ? (
          /* GUARD 1: Unauthenticated visitor attempting to access /seller/dashboard directly */
          <div className="max-w-lg mx-auto my-12 p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200/70 flex items-center justify-center mx-auto text-[#003B8E]">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">
              Seller sign-in required
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              The Seller Dashboard is restricted to verified store owners.
              Please sign in with your registered mobile number via OTP or open
              a new store on the Seller Access page.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  openOtpAuthModal({
                    defaultJourney: 'SELLER',
                    authContextMode: 'SELLER_SIGN_IN',
                  })
                }
                className="px-5 py-2.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Phone className="w-4 h-4" />
                <span>Sign in to your store</span>
              </button>
              <Link
                href="/seller"
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5"
              >
                <span>Go to For Sellers (/seller)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : !hasCompletedStore ? (
          /* GUARD 2: Authenticated buyer-only account OR seller with incomplete store setup */
          <div className="max-w-lg mx-auto my-12 p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-800">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {hasSellerRole
                ? 'Complete your store setup first'
                : 'No store registered on this account'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {hasSellerRole
                ? `Your mobile account (${authenticatedUser.phoneE164}) is verified, but you haven't finished setting up your store yet. Complete your store registration on the Seller page to unlock your dashboard.`
                : `You are signed in with buyer account ${authenticatedUser.phoneE164}, which does not have a registered store. Ordinary buyer accounts cannot access the Seller Dashboard unless they open a store.`}
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/seller"
                className="px-5 py-2.5 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-xs"
              >
                <Store className="w-4 h-4" />
                <span>
                  {hasSellerRole ? 'Complete store setup' : 'Open a store'}
                </span>
              </Link>
              <Link
                href="/"
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-bold"
              >
                Back to shopping
              </Link>
            </div>
          </div>
        ) : (
          /* AUTHORIZED SELLER DASHBOARD */
          <MerchantStudio
            key={`${authenticatedUser.id}-${initialSection}`}
            mode="DASHBOARD"
            initialSection={initialSection}
            sellers={sellers}
            stores={stores}
            products={products}
            orders={orders}
            categories={categories}
            authenticatedUser={authenticatedUser}
            onOpenAuthModal={(opts) =>
              openOtpAuthModal({
                defaultJourney: 'SELLER',
                authContextMode: 'SELLER_SIGN_IN',
                legacySellerId: opts?.legacySellerId,
              })
            }
            onAddSellerAndStore={(newSeller, newStore) => {
              void handleAddSellerAndStore(newSeller, newStore);
            }}
            onUpdateStoreSettings={handleUpdateStoreSettings}
            onDeleteStore={handleDeleteStore}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onUpdateStock={handleUpdateStock}
            onUpdateOrderStep={handleSetOrderStep}
            onToggleCategoryStatus={handleToggleCategoryStatus}
            onBackToShopping={() => router?.push('/')}
          />
        )}
      </main>
    </div>
  );
}

export default function SellerDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-dvh flex items-center justify-center bg-[#F8FAFC] text-xs font-semibold text-slate-600">
          Loading Seller Dashboard...
        </div>
      }
    >
      <SellerDashboardContent />
    </Suspense>
  );
}
