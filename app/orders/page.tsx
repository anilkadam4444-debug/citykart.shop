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
} from 'lucide-react';
import { useUrbanDirect } from '@/components/urbandirect-provider';
import { OrderRecord, OrderStatus } from '@/lib/catalog-data';

export default function BuyerOrdersPage() {
  const { orders, handleCancelOrder, stores, openOtpAuthModal, authenticatedUser, showToast } =
    useUrbanDirect();

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);

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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            Order Placed
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            Store Confirmed
          </span>
        );
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Package className="w-3.5 h-3.5 text-indigo-600 animate-bounce" />
            Being Prepared
          </span>
        );
      case 'OUT_FOR_DELIVERY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <Truck className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
            Out for Delivery
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Delivered
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            Cancelled
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Rejected by Store
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
            {status}
          </span>
        );
    }
  };

  const renderTimeline = (order: OrderRecord) => {
    const status = order.orderStatus || 'NEW';
    if (status === 'CANCELLED' || status === 'REJECTED') {
      return (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {status === 'CANCELLED' ? 'Order Cancelled' : 'Order Rejected by Store'}
            </p>
            {order.cancellationReason && (
              <p className="mt-0.5">Reason: {order.cancellationReason}</p>
            )}
            {order.rejectionReason && (
              <p className="mt-0.5">Reason: {order.rejectionReason}</p>
            )}
          </div>
        </div>
      );
    }

    const steps = [
      { id: 'NEW', label: 'Order Placed' },
      { id: 'CONFIRMED', label: 'Confirmed' },
      { id: 'PREPARING', label: 'Preparing' },
      { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
      { id: 'DELIVERED', label: 'Delivered' },
    ];

    const currentIdx = steps.findIndex((s) => s.id === status);

    return (
      <div className="py-2">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-stone-200 -translate-y-1/2 z-0" />
          <div
            className="absolute top-1/2 left-0 h-1 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-300"
            style={{
              width: `${Math.max(0, (currentIdx / (steps.length - 1)) * 100)}%`,
            }}
          />

          {steps.map((step, idx) => {
            const isDone = idx <= currentIdx;
            const isCurrent = idx === currentIdx;

            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    isDone
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-stone-200 text-stone-500'
                  } ${isCurrent ? 'ring-4 ring-emerald-100 scale-110' : ''}`}
                >
                  {isDone ? '✓' : idx + 1}
                </div>
                <span
                  className={`text-[10px] mt-1 font-medium hidden sm:block ${
                    isCurrent ? 'text-emerald-700 font-bold' : isDone ? 'text-stone-700' : 'text-stone-400'
                  }`}
                >
                  {step.label}
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
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-full hover:bg-stone-100 text-stone-600 transition-colors"
              title="Back to Catalog"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-stone-900">
                My Orders
              </h1>
              <p className="text-xs text-stone-500">
                Track status, view store contacts, or request cancellations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!authenticatedUser ? (
              <button
                onClick={() => openOtpAuthModal({ defaultJourney: 'BUYER' })}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                Sign In
              </button>
            ) : (
              <span className="text-xs font-medium text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200">
                {authenticatedUser.fullName || authenticatedUser.maskedPhone}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
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
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                filterStatus === tab.id
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Empty State */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-stone-200 shadow-xs space-y-4 max-w-md mx-auto my-8">
            <div className="w-16 h-16 bg-stone-100 text-stone-400 rounded-full flex items-center justify-center mx-auto">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-800">
                No orders found
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                {filterStatus === 'ALL'
                  ? "You haven't placed any orders yet."
                  : `No orders matching filter "${filterStatus}".`}
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
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
                  className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden transition-all hover:border-stone-300"
                >
                  {/* Card Header */}
                  <div className="p-4 sm:p-5 border-b border-stone-100 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold bg-stone-200/80 text-stone-800 px-2 py-0.5 rounded">
                          #{order.id}
                        </span>
                        {getStatusBadge(order.orderStatus)}
                        {order.isDemo && (
                          <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                            Demo Order
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800 pt-0.5">
                        <Store className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{order.storeName}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-200">
                      <div className="text-left sm:text-right">
                        <div className="text-xs text-stone-500">Order Total</div>
                        <div className="text-sm font-extrabold text-stone-900">
                          ₹{order.total.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setExpandedOrderId(isExpanded ? null : order.id)
                        }
                        className="p-2 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-600 text-xs font-semibold flex items-center gap-1"
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
                  <div className="p-4 sm:p-5 border-b border-stone-100 bg-white">
                    {renderTimeline(order)}
                  </div>

                  {/* Items Preview */}
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="text-xs font-bold text-stone-700 flex items-center justify-between">
                      <span>Items ({order.items.reduce((s, i) => s + i.quantity, 0)})</span>
                      <span className="text-stone-400 font-normal">
                        Placed: {order.createdAt || 'Today'}
                      </span>
                    </div>

                    <div className="divide-y divide-stone-100">
                      {order.items.map((item, idx) => (
                        <div
                          key={`${item.product.id}-${idx}`}
                          className="py-2 flex items-center gap-3 text-xs"
                        >
                          {item.product.customImageUrl ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-100 relative shrink-0 border border-stone-200">
                              <Image
                                src={item.product.customImageUrl}
                                alt={item.product.name}
                                fill
                                className="object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-stone-800 truncate">
                              {item.product.name}
                            </p>
                            <p className="text-[11px] text-stone-500">
                              Variant: {item.variant} • Qty: {item.quantity}
                            </p>
                          </div>
                          <div className="font-semibold text-stone-900 text-right">
                            ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expanded Order Details */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-stone-50/70 border-t border-stone-200 space-y-5 text-xs">
                      {/* Address & Payment Info Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Delivery Address */}
                        <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-1.5">
                          <div className="font-bold text-stone-800 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            Delivery Address
                          </div>
                          <p className="font-semibold text-stone-900">
                            {order.customer.fullName} ({order.customer.phone})
                          </p>
                          <p className="text-stone-600">
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
                        <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-2">
                          <div className="font-bold text-stone-800 flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                            Payment Method
                          </div>
                          <div className="flex items-center justify-between text-stone-700">
                            <span>Method:</span>
                            <span className="font-bold text-stone-900">
                              {order.paymentMethod === 'UPI_ON_DELIVERY'
                                ? 'UPI on Delivery'
                                : order.paymentMethod === 'CASH_ON_DELIVERY'
                                ? 'Cash on Delivery (COD)'
                                : order.paymentMethod === 'TAP_ON_DELIVERY'
                                ? 'Card Tap on Delivery'
                                : order.paymentMethod}
                            </span>
                          </div>
                          {order.upiId && (
                            <div className="flex items-center justify-between text-stone-700">
                              <span>Store UPI ID:</span>
                              <span className="font-mono text-emerald-700 font-semibold">
                                {order.upiId}
                              </span>
                            </div>
                          )}

                          <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                            <span className="text-stone-600">Store Contact:</span>
                            {matchedStore?.phone ? (
                              <a
                                href={`tel:${matchedStore.phone}`}
                                className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                              >
                                <Phone className="w-3 h-3" />
                                {matchedStore.phone}
                              </a>
                            ) : (
                              <span className="text-stone-400">Available on order receipt</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Financial Summary */}
                      <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-1.5 max-w-md ml-auto">
                        <div className="flex justify-between text-stone-600">
                          <span>Subtotal</span>
                          <span>₹{order.subtotal.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-stone-600">
                          <span>Delivery Fee</span>
                          <span>
                            {order.deliveryFee === 0
                              ? 'FREE'
                              : `₹${order.deliveryFee}`}
                          </span>
                        </div>
                        {order.discount > 0 && (
                          <div className="flex justify-between text-emerald-600 font-medium">
                            <span>Discount</span>
                            <span>-₹{order.discount}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-extrabold text-sm text-stone-900 pt-1.5 border-t border-stone-200">
                          <span>Total Amount</span>
                          <span>₹{order.total.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      {/* Status History Events Log */}
                      {order.statusHistory && order.statusHistory.length > 0 && (
                        <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-2">
                          <div className="font-bold text-stone-800 text-xs">
                            Status Audit History
                          </div>
                          <div className="space-y-1.5 divide-y divide-stone-100">
                            {order.statusHistory.map((hist, hIdx) => (
                              <div
                                key={hIdx}
                                className="pt-1.5 flex items-start justify-between text-[11px]"
                              >
                                <div>
                                  <span className="font-semibold text-stone-800">
                                    {hist.status}
                                  </span>
                                  {hist.note && (
                                    <span className="text-stone-500 ml-1.5">
                                      — {hist.note}
                                    </span>
                                  )}
                                </div>
                                <div className="text-stone-400 font-mono text-[10px] shrink-0">
                                  {new Date(hist.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
                    <div className="text-[11px] text-stone-500">
                      Store: {order.storeName}
                    </div>

                    <div className="flex items-center gap-2">
                      {canCancel && (
                        <button
                          onClick={() => setCancellingOrderId(order.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel Order
                        </button>
                      )}

                      <Link
                        href={`/stores/${order.storeId}`}
                        className="px-3 py-1.5 rounded-lg bg-white text-stone-700 hover:bg-stone-100 border border-stone-200 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Store className="w-3.5 h-3.5" />
                        Visit Store
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
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold text-stone-900">
                Cancel Order #{cancellingOrderId}
              </h3>
            </div>
            <p className="text-xs text-stone-600">
              Are you sure you want to cancel this order? Once cancelled, the store
              will be notified and items will be returned to store stock.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700">
                Reason for Cancellation
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Changed my mind, ordered wrong item, delivery time too long"
                rows={3}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setCancellingOrderId(null);
                  setCancelReason('');
                }}
                disabled={isSubmittingCancel}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 border border-stone-200"
              >
                Keep Order
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5"
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
