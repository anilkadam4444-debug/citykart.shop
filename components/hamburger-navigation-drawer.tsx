'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  FileText,
  Handshake,
  HelpCircle,
  Info,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  PhoneCall,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  Truck,
  X,
} from 'lucide-react';
import { formatCurrency, LocalStore, UserAccount } from '@/lib/catalog-data';

export type BuyerDrawerViewMode = 'BUYER_HOME' | 'STORE_PAGE' | 'MY_ORDERS';

export interface HamburgerNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  isMounted: boolean;
  authenticatedUser: UserAccount | null;
  hasSellerRole: boolean;
  userOwnedStores: LocalStore[];
  viewMode: BuyerDrawerViewMode;
  onSelectViewMode: (mode: BuyerDrawerViewMode) => void;
  ordersCount: number;
  totalCartItems: number;
  totalCartValue: number;
  formattedSelectedCityLabel: string;
  onOpenLocationModal: () => void;
  onOpenCartDrawer: () => void;
  onOpenSignInModal: () => void;
  onSignOut: () => void;
}

const DESIGNATED_SUPER_ADMIN_PHONE = '+918329306616';

export function HamburgerNavigationDrawer({
  isOpen,
  onClose,
  triggerRef,
  isMounted,
  authenticatedUser,
  hasSellerRole,
  userOwnedStores,
  viewMode,
  onSelectViewMode,
  ordersCount,
  totalCartItems,
  totalCartValue,
  formattedSelectedCityLabel,
  onOpenLocationModal,
  onOpenCartDrawer,
  onOpenSignInModal,
  onSignOut,
}: HamburgerNavigationDrawerProps) {
  const pathname = usePathname() || '/';
  const prefersReducedMotion = useReducedMotion();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isSupportExpanded, setIsSupportExpanded] = useState<boolean>(false);

  // Determine role flags strictly from authenticatedUser state
  const isAuthenticated = Boolean(isMounted && authenticatedUser);
  const isSuperAdmin = Boolean(
    isAuthenticated &&
      authenticatedUser?.phoneE164 === DESIGNATED_SUPER_ADMIN_PHONE &&
      (authenticatedUser?.role === 'super_admin' ||
        authenticatedUser?.isAdmin === true ||
        authenticatedUser?.roles?.includes('ADMIN'))
  );
  const isOperationalAdmin = Boolean(
    isAuthenticated &&
      !isSuperAdmin &&
      (authenticatedUser?.role === 'admin' ||
        authenticatedUser?.isAdmin === true ||
        authenticatedUser?.roles?.includes('ADMIN'))
  );
  const isAdminOrSuperAdmin = isSuperAdmin || isOperationalAdmin;
  const isPartner = Boolean(
    isAuthenticated &&
      (authenticatedUser?.isPartner === true ||
        authenticatedUser?.role === 'partner' ||
        authenticatedUser?.roles?.includes('PARTNER'))
  );
  const isSeller = Boolean(
    isAuthenticated &&
      (hasSellerRole ||
        userOwnedStores.length > 0 ||
        authenticatedUser?.role === 'seller' ||
        authenticatedUser?.roles?.includes('SELLER'))
  );

  const roleBadgeLabel = isSuperAdmin
    ? 'Super Admin'
    : isOperationalAdmin
      ? 'Admin'
      : isPartner
        ? 'City Partner'
        : isSeller
          ? 'Verified Merchant'
          : isAuthenticated
            ? 'Verified Customer'
            : 'Guest Session';

  // Lock background page scroll while modal drawer is open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Focus management and keyboard Escape + Tab focus trap
  useEffect(() => {
    if (!isOpen) return;

    const focusTimer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 20);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        triggerRef?.current?.focus();
        return;
      }

      if (event.key === 'Tab' && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  const handleCloseWithFocusRestore = () => {
    onClose();
    setTimeout(() => {
      triggerRef?.current?.focus();
    }, 0);
  };

  const isStorefrontActive =
    pathname === '/' && (viewMode === 'BUYER_HOME' || viewMode === 'STORE_PAGE');
  const isInlineOrdersActive = pathname === '/' && viewMode === 'MY_ORDERS';

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-start"
          data-testid="hamburger-menu-overlay-container"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
            onClick={handleCloseWithFocusRestore}
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            aria-hidden="true"
            data-testid="hamburger-menu-backdrop"
          />

          {/* Modal Navigation Drawer */}
          <motion.div
            ref={drawerRef}
            id="citykart-hamburger-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="citykart-drawer-title"
            data-testid="hamburger-menu-drawer"
            initial={prefersReducedMotion ? { opacity: 0 } : { x: '-100%' }}
            animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { x: '-100%' }}
            transition={
              prefersReducedMotion
                ? { duration: 0.1 }
                : { type: 'spring', damping: 30, stiffness: 320 }
            }
            className="relative z-10 w-[360px] max-w-[92vw] h-dvh bg-white flex flex-col shadow-2xl border-r border-slate-200 overflow-hidden"
          >
            {/* =========================================================
                1. STICKY DRAWER HEADER (Brand Identity + 44x44 Close Button)
               ========================================================= */}
            <div className="px-3.5 sm:px-4 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Image
                  src="/citykart-logo.png"
                  alt="Citykart Logo"
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-xl object-contain border border-slate-200 bg-white shrink-0"
                />
                <div className="min-w-0">
                  <h2
                    id="citykart-drawer-title"
                    className="text-base font-extrabold text-slate-900 tracking-tight leading-none"
                  >
                    <span className="text-[#003B8E]">City</span>
                    <span className="text-[#F96302]">kart</span>
                    <span className="text-slate-400 font-semibold text-xs">.shop</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                    Platform Navigation &amp; Portals
                  </p>
                </div>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={handleCloseWithFocusRestore}
                data-testid="hamburger-menu-close"
                aria-label="Close navigation menu"
                className="min-w-[44px] min-h-[44px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003B8E]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* =========================================================
                SCROLLABLE DRAWER BODY
               ========================================================= */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-3.5 sm:px-4 py-4 space-y-5 bg-[#F8FAFC]">
              {/* =======================================================
                  2. ACCOUNT & IDENTITY CARD
                 ======================================================= */}
              <section
                aria-label="Account and authentication"
                data-testid="menu-section-account"
                className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#003B8E]/10 border border-[#003B8E]/20 text-[#003B8E] flex items-center justify-center font-extrabold text-sm shrink-0">
                      {isAuthenticated
                        ? (authenticatedUser?.fullName || 'U')
                            .charAt(0)
                            .toUpperCase()
                        : 'CK'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          data-testid="menu-account-name"
                          className="text-xs font-extrabold text-slate-900 truncate max-w-[140px] sm:max-w-[180px]"
                        >
                          {isAuthenticated
                            ? authenticatedUser?.fullName || 'Verified User'
                            : 'Guest Visitor'}
                        </span>
                        <span
                          data-testid="menu-account-role-badge"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            isAdminOrSuperAdmin
                              ? 'bg-blue-100 text-[#003B8E]'
                              : isPartner
                                ? 'bg-emerald-100 text-emerald-800'
                                : isSeller
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {roleBadgeLabel}
                        </span>
                      </div>
                      <div
                        data-testid="menu-account-phone"
                        className="text-[11px] font-mono text-slate-500 truncate mt-0.5"
                      >
                        {isAuthenticated
                          ? authenticatedUser?.phoneE164
                          : 'Sign in with mobile OTP to sync orders'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  {isAuthenticated ? (
                    <button
                      type="button"
                      data-testid="menu-action-signout"
                      onClick={() => {
                        onSignOut();
                        onClose();
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out of Session</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid="menu-action-signin"
                      onClick={() => {
                        onClose();
                        onOpenSignInModal();
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003B8E] focus-visible:ring-offset-2"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign In / Register via OTP</span>
                    </button>
                  )}
                </div>
              </section>

              {/* =======================================================
                  3. PRIMARY SHOPPING & ORDERS NAVIGATION
                 ======================================================= */}
              <nav
                aria-label="Primary shopping and orders"
                data-testid="menu-section-shopping"
                className="space-y-1.5"
              >
                <div className="px-1 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Shopping &amp; Orders
                </div>

                {/* Option 1: Shop Local Storefront */}
                <button
                  type="button"
                  data-testid="menu-item-shop-home"
                  aria-current={isStorefrontActive ? 'page' : undefined}
                  onClick={() => {
                    onSelectViewMode('BUYER_HOME');
                    onClose();
                  }}
                  className={`w-full min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003B8E] ${
                    isStorefrontActive
                      ? 'bg-[#003B8E] text-white shadow-2xs'
                      : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/90'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <ShoppingBag
                      className={`w-4 h-4 shrink-0 ${
                        isStorefrontActive ? 'text-[#F96302]' : 'text-[#003B8E]'
                      }`}
                    />
                    <span>Shop Local Storefront</span>
                  </span>
                  <ArrowRight
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isStorefrontActive ? 'text-blue-200' : 'text-slate-400'
                    }`}
                  />
                </button>

                {/* Option 2: My Orders & Live Tracking (Inline View) */}
                <button
                  type="button"
                  data-testid="menu-item-my-orders-inline"
                  aria-current={isInlineOrdersActive ? 'page' : undefined}
                  onClick={() => {
                    onSelectViewMode('MY_ORDERS');
                    onClose();
                  }}
                  className={`w-full min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003B8E] ${
                    isInlineOrdersActive
                      ? 'bg-[#003B8E] text-white shadow-2xs'
                      : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/90'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Truck
                      className={`w-4 h-4 shrink-0 ${
                        isInlineOrdersActive ? 'text-[#F96302]' : 'text-[#003B8E]'
                      }`}
                    />
                    <span>My Orders &amp; Live Tracking</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {ordersCount > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          isInlineOrdersActive
                            ? 'bg-white/20 text-white'
                            : 'bg-[#003B8E] text-white'
                        }`}
                      >
                        {ordersCount}
                      </span>
                    )}
                    <ArrowRight
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isInlineOrdersActive ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    />
                  </span>
                </button>

                {/* Option 3: Dedicated Order History & Delivery PIN Vault (/orders) */}
                <Link
                  href="/orders"
                  data-testid="menu-item-orders-page"
                  aria-current={pathname === '/orders' ? 'page' : undefined}
                  onClick={onClose}
                  className={`w-full min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003B8E] ${
                    pathname === '/orders'
                      ? 'bg-[#003B8E] text-white shadow-2xs'
                      : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/90'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <KeyRound
                      className={`w-4 h-4 shrink-0 ${
                        pathname === '/orders' ? 'text-[#F96302]' : 'text-[#003B8E]'
                      }`}
                    />
                    <span>Order History &amp; Delivery PINs</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Link>

                {/* Option 4: Delivery Location Modal Trigger (Locked once authenticated) */}
                <button
                  type="button"
                  data-testid="menu-item-location"
                  onClick={() => {
                    onClose();
                    onOpenLocationModal();
                  }}
                  className="w-full min-h-[44px] py-2.5 px-3.5 rounded-xl bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/90 text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003B8E]"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <MapPin className="w-4 h-4 text-[#F96302] shrink-0" />
                    <span className="truncate">
                      City: {formattedSelectedCityLabel}
                    </span>
                  </span>
                  {isAuthenticated ? (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold shrink-0 inline-flex items-center gap-1">
                      <Lock className="w-3 h-3 text-[#003B8E]" />
                      <span>Locked</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#003B8E] text-[10px] font-bold shrink-0">
                      Change
                    </span>
                  )}
                </button>

                {/* Option 5: Shopping Cart & Checkout Drawer Trigger */}
                <button
                  type="button"
                  data-testid="menu-item-cart"
                  onClick={() => {
                    onClose();
                    onOpenCartDrawer();
                  }}
                  className="w-full min-h-[44px] py-2.5 px-3.5 rounded-xl bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/90 text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003B8E]"
                >
                  <span className="flex items-center gap-2.5">
                    <ShoppingBag className="w-4 h-4 text-[#F96302] shrink-0" />
                    <span>Shopping Cart ({totalCartItems})</span>
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[#003B8E]">
                    {formatCurrency(totalCartValue)}
                  </span>
                </button>
              </nav>

              {/* =======================================================
                  4. BUSINESS GROWTH & PARTNER PORTALS
                 ======================================================= */}
              <nav
                aria-label="Business growth and partner portals"
                data-testid="menu-section-business"
                className="space-y-1.5 pt-2 border-t border-slate-200"
              >
                <div className="px-1 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Merchants &amp; City Partners
                </div>

                {/* Option 6: For Sellers & Store Studio (/seller) */}
                <Link
                  href="/seller"
                  data-testid="menu-item-seller-portal"
                  aria-current={pathname === '/seller' ? 'page' : undefined}
                  onClick={onClose}
                  className={`w-full min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003B8E] ${
                    pathname === '/seller'
                      ? 'bg-[#003B8E] text-white shadow-2xs'
                      : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/90'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Store className="w-4 h-4 text-[#003B8E] shrink-0" />
                    <span>For Sellers &amp; Store Studio</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#003B8E] text-[10px] font-bold">
                      {isSeller ? 'My Store' : '0% Comm.'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </span>
                </Link>

                {/* Option 7: Role-Conditional Direct Seller Dashboard (/seller/dashboard) */}
                {(isSeller || isAdminOrSuperAdmin) && (
                  <Link
                    href="/seller/dashboard"
                    data-testid="menu-item-seller-dashboard"
                    aria-current={
                      pathname === '/seller/dashboard' ? 'page' : undefined
                    }
                    onClick={onClose}
                    className={`w-full min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003B8E] ${
                      pathname === '/seller/dashboard'
                        ? 'bg-[#003B8E] text-white shadow-2xs'
                        : 'bg-amber-50/80 text-amber-950 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <LayoutDashboard className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Merchant Studio Dashboard</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  </Link>
                )}

                {/* Option 8: Merchant Plans & Pricing (/pricing) */}
                <Link
                  href="/pricing"
                  data-testid="menu-item-pricing"
                  aria-current={pathname === '/pricing' ? 'page' : undefined}
                  onClick={onClose}
                  className={`w-full min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003B8E] ${
                    pathname === '/pricing'
                      ? 'bg-[#003B8E] text-white shadow-2xs'
                      : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/90'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Tag className="w-4 h-4 text-[#F96302] shrink-0" />
                    <span>Merchant Plans &amp; Pricing</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Link>

                {/* Option 9: Become a Partner / City Partner Console (/partner) */}
                <Link
                  href="/partner"
                  data-testid="menu-item-partner-portal"
                  aria-current={pathname === '/partner' ? 'page' : undefined}
                  onClick={onClose}
                  className="w-full min-h-[44px] py-2.5 px-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-950 hover:bg-emerald-100 flex items-center justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Handshake className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      {isPartner
                        ? 'City Partner Console'
                        : 'Become a Partner (50/50 Share)'}
                    </span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                </Link>
              </nav>

              {/* =======================================================
                  5. PLATFORM ADMINISTRATION (Strictly Role-Gated)
                 ======================================================= */}
              {isAdminOrSuperAdmin && (
                <nav
                  aria-label="Platform administration"
                  data-testid="menu-section-admin"
                  className="space-y-1.5 pt-2 border-t border-slate-200"
                >
                  <div className="px-1 text-[11px] font-extrabold text-[#003B8E] uppercase tracking-wider">
                    Platform Governance
                  </div>
                  <Link
                    href="/admin"
                    data-testid="menu-item-super-admin"
                    aria-current={pathname === '/admin' ? 'page' : undefined}
                    onClick={onClose}
                    className="w-full min-h-[44px] py-2.5 px-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-[#003B8E] hover:bg-blue-100 flex items-center justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003B8E]"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-[#003B8E] shrink-0" />
                      <span>
                        {isSuperAdmin ? 'Super Admin Console' : 'Admin Console'}
                      </span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#003B8E] shrink-0" />
                  </Link>
                </nav>
              )}

              {/* =======================================================
                  6. COLLAPSIBLE HELP, GUIDES & LEGAL POLICIES
                 ======================================================= */}
              <nav
                aria-label="Help, guides, and legal policies"
                data-testid="menu-section-support"
                className="pt-2 border-t border-slate-200"
              >
                <button
                  type="button"
                  data-testid="menu-collapse-support-toggle"
                  aria-expanded={isSupportExpanded}
                  aria-controls="hamburger-support-links"
                  onClick={() => setIsSupportExpanded((prev) => !prev)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/90 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-between transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003B8E]"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <HelpCircle className="w-4 h-4 text-[#003B8E] shrink-0" />
                    <span>Help, Guides &amp; Legal Policies</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      isSupportExpanded ? 'rotate-180 text-[#003B8E]' : ''
                    }`}
                  />
                </button>

                {isSupportExpanded && (
                  <div
                    id="hamburger-support-links"
                    data-testid="menu-support-links-group"
                    className="mt-2 space-y-1 pl-1"
                  >
                    <Link
                      href="/how-it-works"
                      data-testid="menu-item-how-it-works"
                      onClick={onClose}
                      className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/70 text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-[#003B8E]" />
                        <span>How Local Shopping Works</span>
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </Link>

                    <Link
                      href="/seller-guide"
                      data-testid="menu-item-seller-guide"
                      onClick={onClose}
                      className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/70 text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 text-[#003B8E]" />
                        <span>How to Open a Store (Seller Guide)</span>
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </Link>

                    <Link
                      href="/about"
                      data-testid="menu-item-about"
                      onClick={onClose}
                      className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/70 text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-[#003B8E]" />
                        <span>About CityKart</span>
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </Link>

                    <Link
                      href="/contact"
                      data-testid="menu-item-contact"
                      onClick={onClose}
                      className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/70 text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <PhoneCall className="w-3.5 h-3.5 text-[#003B8E]" />
                        <span>Contact &amp; Customer Support</span>
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </Link>

                    <Link
                      href="/delivery-returns"
                      data-testid="menu-item-delivery-returns"
                      onClick={onClose}
                      className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/70 text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <RotateCcw className="w-3.5 h-3.5 text-[#003B8E]" />
                        <span>Delivery, Tracking &amp; Returns</span>
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </Link>

                    <Link
                      href="/privacy"
                      data-testid="menu-item-privacy"
                      onClick={onClose}
                      className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/70 text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-[#003B8E]" />
                        <span>Privacy Policy</span>
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </Link>

                    <Link
                      href="/terms"
                      data-testid="menu-item-terms"
                      onClick={onClose}
                      className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/70 text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-[#003B8E]" />
                        <span>Terms &amp; Conditions</span>
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </Link>
                  </div>
                )}
              </nav>
            </div>

            {/* =========================================================
                7. DRAWER FOOTER TRUST BAR
               ========================================================= */}
            <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
              <span className="font-semibold text-slate-700">
                Citykart Intra-City Platform
              </span>
              <span className="font-mono text-[10px] text-emerald-700 font-bold">
                UPI &amp; Cash on Delivery
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
