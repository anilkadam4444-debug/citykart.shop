'use client';

import React from 'react';
import { ArrowLeft, Clock, ShoppingBag, CheckCircle, Truck, Package } from 'lucide-react';
import { OrderRecord } from '@/lib/catalog-data';

interface MyOrdersViewProps {
  orders: OrderRecord[];
  onBackToHome: () => void;
}

export function MyOrdersView({ orders, onBackToHome }: MyOrdersViewProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
      <button
        onClick={onBackToHome}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#003B8E] cursor-pointer bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-2xs transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Marketplace</span>
      </button>

      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">My Order History & Tracking</h1>
        <p className="text-xs text-slate-500">Real-time status updates and delivery tracking for your city purchases.</p>
      </div>

      {orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-mono font-bold text-slate-900">Order #{order.id}</span>
                  <div className="text-[11px] text-slate-500">{order.createdAt || 'Recent order'}</div>
                </div>
                {(() => {
                  const status = order.orderStatus || 'NEW';
                  const badgeConfig = {
                    NEW: {
                      bg: 'bg-amber-50 text-amber-800 border-amber-200/90',
                      icon: <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse transition-transform duration-300" />,
                      label: 'Order Placed',
                    },
                    CONFIRMED: {
                      bg: 'bg-blue-50 text-[#003B8E] border-blue-200/90',
                      icon: <CheckCircle className="w-3.5 h-3.5 text-[#003B8E] transition-transform duration-300" />,
                      label: 'Store Confirmed',
                    },
                    PREPARING: {
                      bg: 'bg-indigo-50 text-indigo-800 border-indigo-200/90',
                      icon: <Package className="w-3.5 h-3.5 text-indigo-600 animate-[bounce_2s_infinite] transition-transform duration-300" />,
                      label: 'Being Prepared',
                    },
                    OUT_FOR_DELIVERY: {
                      bg: 'bg-orange-50 text-[#F96302] border-orange-200/90 ring-2 ring-orange-100/60 animate-pulse',
                      icon: <Truck className="w-3.5 h-3.5 text-[#F96302] transition-transform duration-300" />,
                      label: 'Out for Delivery',
                    },
                    DELIVERED: {
                      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
                      icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-600 transition-transform duration-300" />,
                      label: 'Delivered',
                    },
                    CANCELLED: {
                      bg: 'bg-red-50 text-red-800 border-red-200/90',
                      icon: <Clock className="w-3.5 h-3.5 text-red-600 transition-transform duration-300" />,
                      label: 'Cancelled',
                    },
                    REJECTED: {
                      bg: 'bg-rose-50 text-rose-800 border-rose-200/90',
                      icon: <Clock className="w-3.5 h-3.5 text-rose-600 transition-transform duration-300" />,
                      label: 'Rejected',
                    },
                  }[status] || {
                    bg: 'bg-slate-100 text-slate-700 border-slate-200',
                    icon: <Clock className="w-3.5 h-3.5 text-slate-500" />,
                    label: status,
                  };

                  return (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs transition-all duration-500 ease-out hover:scale-[1.03] ${badgeConfig.bg}`}>
                      {badgeConfig.icon}
                      <span>{badgeConfig.label}</span>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2">
                {order.items?.map((item, idx) => {
                  const productName = item.product?.name || (item as unknown as { productName?: string }).productName || 'Item';
                  const itemPrice = item.product?.price ?? (item as unknown as { price?: number }).price ?? 0;
                  return (
                    <div key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-slate-800 font-medium">{productName} × {item.quantity}</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">₹{itemPrice * item.quantity}</span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Total Amount Paid</span>
                <span className="font-mono tabular-nums font-extrabold text-base text-slate-900">₹{order.total}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#003B8E] flex items-center justify-center mx-auto text-2xl">
            📦
          </div>
          <h3 className="text-base font-bold text-slate-900">No orders placed yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Explore local stores in your city and place your first order to track fulfillment and delivery here.
          </p>
          <button
            onClick={onBackToHome}
            className="px-5 py-2.5 bg-[#003B8E] text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-[#002D6E]"
          >
            Start Shopping
          </button>
        </div>
      )}
    </div>
  );
}
