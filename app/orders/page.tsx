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
  const { orders, handleCancelOrder, stores, openOtpAuthModal, authenticatedUser } =
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            Order Placed
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#003B8E] border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#003B8E]" />
            Store Confirmed
          </span>
        );
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <Package className="w-3.5 h-3.5 text-indigo-600 animate-bounce" />
            Being Prepared
          </span>
        );
      case 'OUT_FOR_DELIVERY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-[#F96302] border border-orange-200">
            <Truck className="w-3.5 h-3.5 text-[#F96302] animate-pulse" />
            Out for Delivery
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Delivered
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-800 border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            Cancelled
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Rejected by Store
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const renderTimeline = (order: OrderRecord) => {
    const status = order.orderStatus || 'NEW';
    if (status === 'CANCELLED' || status === 'REJECTED') {
      return (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
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
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 -translate-y-1/2 z-0" />
          <div
            className="absolute top-1/2 left-0 h-1 bg-[#003B8E] -translate-y-1/2 z-0 transition-all duration-300"
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
                      ? 'bg-[#003B8E] text-white shadow-sm'
                      : 'bg-slate-200 text-slate-500'
                  } ${isCurrent ? 'ring-4 ring-blue-100 scale-110' : ''}`}
                >
                  {isDone ? '✓' : idx + 1}
                </div>
                <span
                  className={`text-[10px] mt-1 font-medium hidden sm:block ${
                    isCurrent ? 'text-[#003B8E] font-bold' : isDone ? 'text-slate-700' : 'text-slate-400'
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      {/* Top Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              title="Back to Catalog"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                My Orders
              </h1>
              <p className="text-xs text-slate-500">
                Track live status, view store contacts, or manage orders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!authenticatedUser ? (
              <button
                onClick={() => openOtpAuthModal({ defaultJourney: 'BUYER' })}
                className="text-xs font-bold px-3.5 py-2 rounded-xl bg-[#003B8E] text-white hover:bg-[#002D6E] transition-colors cursor-pointer"
              >
                Sign In
              </button>
            ) : (
              <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
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
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer tabular-nums ${
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
                        {order.isDemo && (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                            Demo Order
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 pt-0.5">
                        <Store className="w-3.5 h-3.5 text-[#003B8E]" />
                        <span>{order.storeName}</span>
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
                        className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
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
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-[#003B8E]" />
                            Payment Method
                          </div>
                          <div className="flex items-center justify-between text-slate-700">
                            <span>Method:</span>
                            <span className="font-bold text-slate-900">
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
                            <div className="flex items-center justify-between text-slate-700">
                              <span>Store UPI ID:</span>
                              <span className="font-mono text-[#003B8E] font-bold">
                                {order.upiId}
                              </span>
                            </div>
                          )}

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
                        {order.discount > 0 && (
                          <div className="flex justify-between text-emerald-600 font-medium">
                            <span>Discount</span>
                            <span className="font-mono tabular-nums">-₹{order.discount}</span>
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
                            {order.statusHistory.map((hist, hIdx) => (
                              <div
                                key={hIdx}
                                className="pt-1.5 flex items-start justify-between text-[11px]"
                              >
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
                                <div className="text-slate-400 font-mono tabular-nums text-[10px] shrink-0">
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
                  <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-[11px] font-medium text-slate-500">
                      Store: <strong className="text-slate-700">{order.storeName}</strong>
                    </div>

                    <div className="flex items-center gap-2">
                      {canCancel && (
                        <button
                          onClick={() => setCancellingOrderId(order.id)}
                          className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel Order
                        </button>
                      )}

                      <Link
                        href={`/stores/${order.storeId}`}
                        className="px-3 py-1.5 rounded-xl bg-white text-[#003B8E] hover:bg-slate-100 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1"
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
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              >
                Keep Order
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5 cursor-pointer"
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
