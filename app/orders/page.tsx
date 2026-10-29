'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Package,
  ShoppingBag,
  ArrowLeft,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Truck,
  Store,
  Phone,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CreditCard,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import { useUrbanDirect } from '@/components/urbandirect-provider';
import { formatPaymentMethodLabel, OrderRecord, OrderStatus } from '@/lib/catalog-data';
import { UpiQrCodeCard } from '@/components/upi-qr-code-card';
import { OrderStoreRatingWidget, StoreRatingBadge } from '@/components/store-star-rating';

export default function BuyerOrdersPage() {
  const {
    orders,
    handleCancelOrder,
    stores,
    openOtpAuthModal,
    authenticatedUser,
    getBuyerPinVaultEntry,
    handleRegenerateBuyerDeliveryPin,
  } = useUrbanDirect();

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});
  const [fetchedPins, setFetchedPins] = useState<Record<string, string>>({});
  const [loadingPinOrderId, setLoadingPinOrderId] = useState<string | null>(null);
  const [regeneratingPinOrderId, setRegeneratingPinOrderId] = useState<string | null>(null);
  const [pinErrorByOrder, setPinErrorByOrder] = useState<Record<string, string>>({});
  const [copiedPinOrderId, setCopiedPinOrderId] = useState<string | null>(null);
  const [activeUpiQrOrderId, setActiveUpiQrOrderId] = useState<string | null>(null);

  const handleFetchBuyerPin = async (orderId: string) => {
    setLoadingPinOrderId(orderId);
    setPinErrorByOrder((prev) => ({ ...prev, [orderId]: '' }));
    const vaultEntry = getBuyerPinVaultEntry(orderId);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/pin`, {
        method: 'GET',
        headers: {
          ...(vaultEntry?.buyerAccessToken
            ? { 'x-buyer-order-token': vaultEntry.buyerAccessToken }
            : {}),
        },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPinErrorByOrder((prev) => ({
          ...prev,
          [orderId]:
            data.error || 'Please sign in as the buyer of this order to view its Delivery PIN.',
        }));
        return;
      }
      if (data.deliveryPin) {
        setFetchedPins((prev) => ({ ...prev, [orderId]: data.deliveryPin }));
        setRevealedPins((prev) => ({ ...prev, [orderId]: true }));
      }
    } catch {
      setPinErrorByOrder((prev) => ({
        ...prev,
        [orderId]: 'Network error retrieving Delivery PIN.',
      }));
    } finally {
      setLoadingPinOrderId(null);
    }
  };

  const handleRegeneratePinClick = async (orderId: string) => {
    setRegeneratingPinOrderId(orderId);
    setPinErrorByOrder((prev) => ({ ...prev, [orderId]: '' }));
    const result = await handleRegenerateBuyerDeliveryPin(orderId);
    setRegeneratingPinOrderId(null);
    if (!result.ok) {
      setPinErrorByOrder((prev) => ({
        ...prev,
        [orderId]: result.error || 'Could not regenerate Delivery PIN.',
      }));
      return;
    }
    if (result.pin) {
      setFetchedPins((prev) => ({ ...prev, [orderId]: result.pin! }));
      setRevealedPins((prev) => ({ ...prev, [orderId]: true }));
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const status = order.orderStatus || 'NEW';
    if (filterStatus === 'ACTIVE') {
      return ['NEW', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'].includes(status);
    }
    if (filterStatus === 'COMPLETED') {
      return status === 'DELIVERED';
    }
    if (filterStatus === 'CANCELLED') {
      return status === 'CANCELLED' || status === 'REJECTED';
    }
    return true;
  });

  const getStatusBadge = (status: OrderStatus = 'NEW') => {
    switch (status) {
      case 'NEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/90 shadow-2xs transition-all duration-500 ease-out hover:scale-[1.03]">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse transition-transform duration-300" />
            <span>Order Placed</span>
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#003B8E] border border-blue-200/90 shadow-2xs transition-all duration-500 ease-out hover:scale-[1.03]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#003B8E] transition-transform duration-300" />
            <span>Store Confirmed</span>
          </span>
        );
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/90 shadow-2xs transition-all duration-500 ease-out hover:scale-[1.03]">
            <Package className="w-3.5 h-3.5 text-indigo-600 animate-[bounce_2s_infinite] transition-transform duration-300" />
            <span>Being Prepared</span>
          </span>
        );
      case 'OUT_FOR_DELIVERY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-[#F96302] border border-orange-200/90 shadow-2xs transition-all duration-500 ease-out hover:scale-[1.03] ring-2 ring-orange-100/60 animate-pulse">
            <Truck className="w-3.5 h-3.5 text-[#F96302] transition-transform duration-300" />
            <span>Out for Delivery</span>
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-2xs transition-all duration-500 ease-out hover:scale-[1.03]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 transition-transform duration-300" />
            <span>Delivered</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-800 border border-red-200/90 shadow-2xs transition-all duration-500 ease-out hover:scale-[1.03]">
            <XCircle className="w-3.5 h-3.5 text-red-600 transition-transform duration-300" />
            <span>Cancelled</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200/90 shadow-2xs transition-all duration-500 ease-out hover:scale-[1.03]">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 transition-transform duration-300" />
            <span>Rejected by Store</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 transition-all duration-500 ease-out">
            {status}
          </span>
        );
    }
  };

  const renderTimeline = (order: OrderRecord) => {
    const status = order.orderStatus || 'NEW';
    if (status === 'CANCELLED' || status === 'REJECTED') {
      return (
        <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5 transition-all duration-500 ease-out animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">
              {status === 'CANCELLED' ? 'Order Cancelled' : 'Order Rejected by Store'}
            </p>
            {order.cancellationReason && (
              <p className="text-[11px] text-red-600/90">Reason: {order.cancellationReason}</p>
            )}
            {order.rejectionReason && (
              <p className="text-[11px] text-red-600/90">Reason: {order.rejectionReason}</p>
            )}
          </div>
        </div>
      );
    }

    const steps = [
      { id: 'NEW', label: 'Order Placed', shortLabel: 'Placed' },
      { id: 'CONFIRMED', label: 'Confirmed', shortLabel: 'Confirmed' },
      { id: 'PREPARING', label: 'Preparing', shortLabel: 'Preparing' },
      { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', shortLabel: 'On the way' },
      { id: 'DELIVERED', label: 'Delivered', shortLabel: 'Delivered' },
    ];

    const currentIdx = steps.findIndex((s) => s.id === status);

    return (
      <div className="py-2.5">
        <div className="flex items-center justify-between relative px-2 sm:px-3">
          {/* Background Track Line */}
          <div className="absolute top-1/2 left-3 right-3 h-1.5 bg-slate-200/80 rounded-full -translate-y-1/2 z-0" />

          {/* Animated Filled Progress Line */}
          <div
            className="absolute top-1/2 left-3 h-1.5 bg-linear-to-r from-[#003B8E] via-blue-600 to-[#F96302] rounded-full -translate-y-1/2 z-0 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-2xs"
            style={{
              width: currentIdx < 0
                ? '0%'
                : `calc(${Math.min(100, Math.max(0, (currentIdx / (steps.length - 1)) * 100))}% - 6px)`,
            }}
          />

          {steps.map((step, idx) => {
            const isDone = idx <= currentIdx;
            const isCurrent = idx === currentIdx;

            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center group">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform ${
                    isCurrent
                      ? 'bg-[#003B8E] text-white scale-120 ring-4 ring-blue-200/90 shadow-md shadow-blue-500/25 ring-offset-1 ring-offset-white'
                      : isDone
                      ? 'bg-[#003B8E] text-white shadow-xs scale-100 ring-2 ring-blue-50'
                      : 'bg-white text-slate-400 border border-slate-300 scale-95 hover:border-slate-400'
                  }`}
                  title={`${step.label} (${isCurrent ? 'Current stage' : isDone ? 'Completed' : 'Upcoming'})`}
                >
                  <span className="transition-transform duration-300">
                    {isDone ? '✓' : idx + 1}
                  </span>
                </div>
                <span
                  className={`text-[10px] sm:text-[11px] mt-1.5 font-medium transition-all duration-500 ease-out tracking-tight text-center ${
                    isCurrent
                      ? 'text-[#003B8E] font-extrabold scale-105'
                      : isDone
                      ? 'text-slate-800 font-semibold'
                      : 'text-slate-400'
                  }`}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleConfirmCancel = async () => {
    if (!cancellingOrderId) return;
    setIsSubmittingCancel(true);
    const success = await handleCancelOrder(cancellingOrderId, cancelReason);
    setIsSubmittingCancel(false);
    if (success) {
      setCancellingOrderId(null);
      setCancelReason('');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      {/* Top Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-slate-100 text-slate-600 inline-flex items-center justify-center transition-colors shrink-0"
              title="Back to Catalog"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 truncate">
                My Orders
              </h1>
              <p className="text-xs text-slate-500 truncate">
                Track live status, view store contacts, or manage orders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!authenticatedUser ? (
              <button
                onClick={() => openOtpAuthModal({ defaultJourney: 'BUYER' })}
                className="min-h-[40px] text-xs font-bold px-3.5 py-2 rounded-xl bg-[#003B8E] text-white hover:bg-[#002D6E] transition-colors cursor-pointer"
              >
                Sign In
              </button>
            ) : (
              <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 truncate max-w-[130px] sm:max-w-none">
                {authenticatedUser.fullName || authenticatedUser.maskedPhone}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-3.5 sm:px-4 py-6 space-y-6">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'ALL', label: `All Orders (${orders.length})` },
            {
              id: 'ACTIVE',
              label: `Active (${
                orders.filter((o) =>
                  ['NEW', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'].includes(
                    o.orderStatus || 'NEW'
                  )
                ).length
              })`,
            },
            {
              id: 'COMPLETED',
              label: `Delivered (${
                orders.filter((o) => o.orderStatus === 'DELIVERED').length
              })`,
            },
            {
              id: 'CANCELLED',
              label: `Cancelled / Rejected (${
                orders.filter((o) =>
                  ['CANCELLED', 'REJECTED'].includes(o.orderStatus || '')
                ).length
              })`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id as typeof filterStatus)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer tabular-nums ${
                filterStatus === tab.id
                  ? 'bg-[#003B8E] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Empty State */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-4 max-w-md mx-auto my-8">
            <div className="w-16 h-16 bg-blue-50 text-[#003B8E] rounded-2xl flex items-center justify-center mx-auto border border-blue-200/60">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                No orders found
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {filterStatus === 'ALL'
                  ? "You haven't placed any local orders yet."
                  : `No orders matching filter "${filterStatus}".`}
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F96302] text-white text-xs font-bold hover:bg-[#E05500] transition-colors shadow-xs"
            >
              Explore Local Stores
            </Link>
          </div>
        ) : (
          /* Order Cards List */
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const matchedStore = stores.find((s) => s.id === order.storeId);
              const canCancel =
                ['NEW', 'CONFIRMED'].includes(order.orderStatus || 'NEW');
              const isExpanded = expandedOrderId === order.id;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300"
                >
                  {/* Card Header */}
                  <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono tabular-nums text-xs font-bold bg-slate-200/80 text-slate-800 px-2 py-0.5 rounded">
                          #{order.id}
                        </span>
                        {getStatusBadge(order.orderStatus)}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            order.paymentStatus === 'PAID'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : order.paymentStatus === 'DISPUTED'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>
                            Payment: {order.paymentStatus || 'PENDING'} (
                            {order.paymentMethod === 'UPI_ON_DELIVERY'
                              ? 'UPI on Delivery'
                              : order.paymentMethod === 'CASH_ON_DELIVERY'
                              ? 'Cash on Delivery'
                              : 'Card Tap'}
                            )
                          </span>
                        </span>
                        {order.isDemo && (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                            Demo Order
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900 pt-0.5">
                        <Store className="w-3.5 h-3.5 text-[#003B8E]" />
                        <span>{order.storeName}</span>
                        <StoreRatingBadge
                          storeId={order.storeId}
                          fallbackRating={matchedStore?.rating}
                          fallbackReviewsCount={matchedStore?.reviewsCount}
                          size="xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                      <div className="text-left sm:text-right">
                        <div className="text-xs text-slate-500">Order Total</div>
                        <div className="text-sm font-extrabold font-mono tabular-nums text-slate-900">
                          ₹{order.total.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setExpandedOrderId(isExpanded ? null : order.id)
                        }
                        className="px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <span>Collapse</span>
                            <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            <span>Details</span>
                            <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Status Timeline */}
                  <div className="p-4 sm:p-5 border-b border-slate-100 bg-white">
                    {renderTimeline(order)}
                  </div>

                  {/* Buyer Delivery PIN Panel */}
                  {(() => {
                    const status = order.orderStatus || 'NEW';
                    const isActiveOrder = [
                      'NEW',
                      'CONFIRMED',
                      'PREPARING',
                      'OUT_FOR_DELIVERY',
                    ].includes(status);
                    const vaultEntry = getBuyerPinVaultEntry(order.id);
                    const activePin =
                      fetchedPins[order.id] || vaultEntry?.pin || null;
                    const isPinRevealed = revealedPins[order.id] ?? Boolean(activePin);
                    const pinErr = pinErrorByOrder[order.id];

                    if (status === 'DELIVERED') {
                      return (
                        <div className="px-4 sm:px-5 py-3 bg-emerald-50/80 border-b border-emerald-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-950">
                          <div className="flex items-center gap-2 font-bold">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              Delivery Confirmed via 6-Digit Delivery PIN
                            </span>
                          </div>
                          <span className="text-[11px] text-emerald-800">
                            Single-use Delivery PIN verified and consumed · Payment Status:{' '}
                            <strong>{order.paymentStatus || 'PENDING'}</strong>
                          </span>
                        </div>
                      );
                    }

                    if (!isActiveOrder) return null;

                    return (
                      <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 border-b border-blue-200/80 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-[#003B8E] text-white flex items-center justify-center shrink-0 mt-0.5">
                              <KeyRound className="w-4 h-4 text-amber-300" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-extrabold text-slate-900">
                                  Buyer 6-Digit Delivery PIN
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#003B8E] border border-blue-200">
                                  {order.deliveryPinInfo?.status === 'LOCKED'
                                    ? 'Locked — Regenerate Required'
                                    : `Active (v${order.deliveryPinInfo?.pinVersion || 1})`}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                Give this 6-digit PIN to the delivery person only when your order is in your hands.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {activePin ? (
                              <div className="px-3.5 py-1.5 rounded-xl bg-white border border-blue-300 font-mono text-base font-extrabold tracking-[0.22em] text-[#003B8E] shadow-2xs tabular-nums">
                                {isPinRevealed ? activePin : '••••••'}
                              </div>
                            ) : null}

                            {activePin ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRevealedPins((prev) => ({
                                      ...prev,
                                      [order.id]: !isPinRevealed,
                                    }))
                                  }
                                  className="px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  {isPinRevealed ? (
                                    <>
                                      <EyeOff className="w-3.5 h-3.5" />
                                      <span>Hide</span>
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Show</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(activePin);
                                    setCopiedPinOrderId(order.id);
                                    setTimeout(
                                      () =>
                                        setCopiedPinOrderId((curr) =>
                                          curr === order.id ? null : curr
                                        ),
                                      2000
                                    );
                                  }}
                                  className="px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  {copiedPinOrderId === order.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={loadingPinOrderId === order.id}
                                onClick={() => void handleFetchBuyerPin(order.id)}
                                className="px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>
                                  {loadingPinOrderId === order.id
                                    ? 'Loading PIN...'
                                    : 'View My Delivery PIN'}
                                </span>
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={regeneratingPinOrderId === order.id}
                              onClick={() => void handleRegeneratePinClick(order.id)}
                              className="px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-white hover:bg-blue-50 text-[#003B8E] border border-blue-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  regeneratingPinOrderId === order.id
                                    ? 'animate-spin'
                                    : ''
                                }`}
                              />
                              <span>
                                {regeneratingPinOrderId === order.id
                                  ? 'Generating...'
                                  : 'Resend / Regenerate PIN'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {pinErr && (
                          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
                            {pinErr}
                          </div>
                        )}

                        <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-[11px] sm:text-xs text-amber-950 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <span className="font-semibold">
                            Share your delivery PIN only after you have received your order. Never share it in advance. Your delivery PIN confirms delivery; it does not confirm payment.
                          </span>
                        </div>

                        {activePin && (
                          <div className="p-2.5 rounded-xl bg-white/90 border border-blue-200/80 text-[11px] text-slate-700 space-y-1.5 overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-[#003B8E]">
                              <span>Unified Order &amp; Delivery PIN Notification (Push + SMS)</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-[#003B8E] border border-blue-200">
                                Single Combined Alert
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[#003B8E] font-semibold">
                                Est. Delivery: ~{vaultEntry?.unifiedNotification?.estimatedDeliveryMins || order.estimatedMins || matchedStore?.avgDispatchMins || 25} mins
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[#003B8E] font-mono font-semibold">
                                Seller Mobile: {vaultEntry?.unifiedNotification?.sellerPhone || order.sellerPhone || matchedStore?.phone || '+919820000000'}
                              </span>
                            </div>
                            <p className="font-mono text-[11px] text-slate-600 leading-relaxed break-words">
                              {isPinRevealed
                                ? vaultEntry?.unifiedNotification?.smsText ||
                                  `Citykart: Order #${order.id} placed successfully with ${order.storeName} for Rs.${order.total}. Est. Delivery: ~${order.estimatedMins || matchedStore?.avgDispatchMins || 25} mins. Seller Mobile: ${order.sellerPhone || matchedStore?.phone || '+919820000000'}. Your Delivery PIN is ${activePin}. SAFETY: Share this PIN with the delivery partner ONLY after receiving your order. Never share in advance. PIN confirms delivery only, not payment.`
                                : `Citykart: Order #${order.id} placed successfully with ${order.storeName} for Rs.${order.total}. Est. Delivery: ~${vaultEntry?.unifiedNotification?.estimatedDeliveryMins || order.estimatedMins || matchedStore?.avgDispatchMins || 25} mins. Seller Mobile: ${vaultEntry?.unifiedNotification?.sellerPhone || order.sellerPhone || matchedStore?.phone || '+919820000000'}. Your Delivery PIN is ••••••. SAFETY: Share this PIN with the delivery partner ONLY after receiving your order. Never share in advance. PIN confirms delivery only, not payment.`}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Items Preview */}
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>Items ({order.items.reduce((s, i) => s + i.quantity, 0)})</span>
                      <span className="text-slate-400 font-normal">
                        Placed: {order.createdAt || 'Today'}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {order.items.map((item, idx) => (
                        <div
                          key={`${item.product.id}-${idx}`}
                          className="py-2.5 flex items-center gap-3 text-xs"
                        >
                          {item.product.customImageUrl ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 relative shrink-0 border border-slate-200">
                              <Image
                                src={item.product.customImageUrl}
                                alt={item.product.name}
                                fill
                                className="object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 truncate">
                              {item.product.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Variant: {item.variant} • Qty: {item.quantity}
                            </p>
                          </div>
                          <div className="font-bold font-mono tabular-nums text-slate-900 text-right">
                            ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Store Star Rating Widget (Active when order is DELIVERED, or quick-deliver trigger) */}
                  <div className="px-4 sm:px-5 pb-4">
                    <OrderStoreRatingWidget order={order} compact />
                  </div>

                  {/* Expanded Order Details */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-slate-50/70 border-t border-slate-200 space-y-5 text-xs">
                      {/* Address & Payment Info Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Delivery Address */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#003B8E]" />
                            Delivery Address
                          </div>
                          <p className="font-bold text-slate-900">
                            {order.customer.fullName} ({order.customer.phone})
                          </p>
                          <p className="text-slate-600">
                            {order.customer.address}, {order.customer.locality},{' '}
                            {order.customer.city}, {order.customer.stateRegion} -{' '}
                            {order.customer.postalCode}
                          </p>
                          {order.customer.notes && (
                            <p className="text-amber-700 font-medium pt-1">
                              Note: &quot;{order.customer.notes}&quot;
                            </p>
                          )}
                        </div>

                        {/* Payment & Store Contact */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-[#003B8E]" />
                            Payment &amp; Fulfillment Status
                          </div>
                          <div className="flex items-center justify-between text-slate-700">
                            <span>Payment Option:</span>
                            <span className="font-bold text-slate-900">
                              {formatPaymentMethodLabel(
                                order.paymentMethod,
                                order.paymentCollectionMethod
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-700">
                            <span>Payment Status:</span>
                            <span
                              className={`font-bold ${
                                order.paymentStatus === 'PAID'
                                  ? 'text-emerald-700'
                                  : order.paymentStatus === 'DISPUTED'
                                  ? 'text-rose-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {order.paymentStatus === 'PAID'
                                ? order.paymentCollectionMethod === 'UPI_ON_DELIVERY'
                                  ? 'Paid via UPI on Delivery'
                                  : order.paymentCollectionMethod === 'CASH_ON_DELIVERY'
                                  ? 'Paid via Cash on Delivery'
                                  : 'Paid on Delivery'
                                : order.paymentStatus === 'DISPUTED'
                                ? 'Disputed'
                                : 'Pay by Cash or UPI on Delivery'}
                            </span>
                          </div>
                          {order.paymentVerifiedAt && order.paymentStatus === 'PAID' && (
                            <div className="flex items-center justify-between text-slate-600 text-[11px]">
                              <span>Verified At:</span>
                              <span className="font-mono font-semibold text-emerald-800">
                                {new Date(order.paymentVerifiedAt).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {order.paymentReferenceNote && (
                            <div className="flex items-center justify-between text-slate-600 text-[11px]">
                              <span>Payment Ref:</span>
                              <span className="font-mono font-semibold text-slate-800">
                                {order.paymentReferenceNote}
                              </span>
                            </div>
                          )}

                          {/* Delivery-Stage Dynamic UPI QR Toggle for Unpaid Active Orders */}
                          {(() => {
                            const isCancelled = order.orderStatus === 'CANCELLED' || order.orderStatus === 'REJECTED';
                            return !isCancelled && order.paymentStatus !== 'PAID' ? (
                              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[11px] text-slate-600">
                                  Pay in cash or scan the exact-amount UPI QR when your order arrives.
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveUpiQrOrderId((prev) =>
                                      prev === order.id ? null : order.id
                                    )
                                  }
                                  className="px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-[#003B8E] hover:bg-[#002d6e] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  {activeUpiQrOrderId === order.id
                                    ? 'Hide UPI QR Code'
                                    : 'Pay by UPI (Show QR)'}
                                </button>
                              </div>

                              {activeUpiQrOrderId === order.id && (
                                <UpiQrCodeCard
                                  order={order}
                                  store={matchedStore}
                                  compact
                                />
                              )}
                            </div>
                          ) : null;
                          })()}

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-slate-600">Store Contact:</span>
                            {matchedStore?.phone ? (
                              <a
                                href={`tel:${matchedStore.phone}`}
                                className="inline-flex items-center gap-1 font-bold text-[#003B8E] hover:underline"
                              >
                                <Phone className="w-3 h-3" />
                                {matchedStore.phone}
                              </a>
                            ) : (
                              <span className="text-slate-400">Available on order receipt</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Financial Summary */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5 max-w-md ml-auto">
                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal</span>
                          <span className="font-mono tabular-nums">₹{order.subtotal.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Delivery Fee</span>
                          <span className="font-mono tabular-nums">
                            {order.deliveryFee === 0
                              ? 'FREE'
                              : `₹${order.deliveryFee}`}
                          </span>
                        </div>
                        {(order.discount || 0) > 0 && (
                          <div className="flex justify-between text-emerald-600 font-medium">
                            <span>Discount</span>
                            <span className="font-mono tabular-nums">-₹{order.discount || 0}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-1.5 border-t border-slate-200">
                          <span>Total Amount</span>
                          <span className="font-mono tabular-nums">₹{order.total.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      {/* Status History Events Log */}
                      {order.statusHistory && order.statusHistory.length > 0 && (
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                          <div className="font-bold text-slate-800 text-xs">
                            Status Audit History
                          </div>
                          <div className="space-y-1.5 divide-y divide-slate-100">
                            {order.statusHistory.map((hist, hIdx) => {
                              const dotColor =
                                hist.status === 'DELIVERED'
                                  ? 'bg-emerald-500'
                                  : hist.status === 'OUT_FOR_DELIVERY'
                                  ? 'bg-[#F96302]'
                                  : hist.status === 'PREPARING'
                                  ? 'bg-indigo-500'
                                  : hist.status === 'CONFIRMED'
                                  ? 'bg-[#003B8E]'
                                  : hist.status === 'NEW'
                                  ? 'bg-amber-500'
                                  : 'bg-red-500';

                              return (
                                <div
                                  key={hIdx}
                                  className="pt-1.5 flex items-start justify-between text-[11px] transition-all duration-300 ease-out hover:bg-slate-50/80 px-2 py-1 rounded-md"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor} transition-transform duration-300 hover:scale-125`} />
                                    <div>
                                      <span className="font-bold text-slate-800">
                                        {hist.status}
                                      </span>
                                      {hist.note && (
                                        <span className="text-slate-500 ml-1.5">
                                          — {hist.note}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-slate-400 font-mono tabular-nums text-[10px] shrink-0 ml-2">
                                    {new Date(hist.timestamp).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-[11px] font-medium text-slate-500">
                      Store: <strong className="text-slate-700">{order.storeName}</strong>
                    </div>

                    <div className="flex items-center gap-2">
                      {canCancel && (
                        <button
                          onClick={() => setCancellingOrderId(order.id)}
                          className="px-4 py-2.5 min-h-[44px] rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Cancel Order</span>
                        </button>
                      )}

                      <Link
                        href={`/stores/${order.storeId}`}
                        className="px-4 py-2.5 min-h-[44px] rounded-xl bg-white text-[#003B8E] hover:bg-slate-100 border border-slate-200 text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                      >
                        <Store className="w-4 h-4" />
                        <span>Visit Store</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Cancel Order Reason Modal */}
      {cancellingOrderId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-extrabold text-slate-900">
                Cancel Order #{cancellingOrderId}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel this order? Once cancelled, the store
              will be notified and items will be returned to store stock.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Reason for Cancellation
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Changed my mind, ordered wrong item, delivery time too long"
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setCancellingOrderId(null);
                  setCancelReason('');
                }}
                disabled={isSubmittingCancel}
                className="px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              >
                Keep Order
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel}
                className="px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSubmittingCancel ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Confirm Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
