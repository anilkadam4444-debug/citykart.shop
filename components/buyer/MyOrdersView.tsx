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
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{order.orderStatus || 'CONFIRMED'}</span>
                </div>
              </div>

              <div className="space-y-2">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-slate-800 font-medium">{item.productName} × {item.quantity}</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">₹{item.price * item.quantity}</span>
                  </div>
                ))}
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
