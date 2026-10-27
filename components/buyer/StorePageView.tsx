'use client';

import React from 'react';
import { ArrowLeft, Store, MapPin, Clock, Phone, ShieldCheck, Search } from 'lucide-react';
import { LocalStore as StoreRecord, Product } from '@/lib/catalog-data';

interface StorePageViewProps {
  viewedStoreId: string | null;
  stores: StoreRecord[];
  products: Product[];
  onBackToHome: () => void;
  renderProductCard: (product: Product) => React.ReactNode;
}

export function StorePageView({
  viewedStoreId,
  stores,
  products,
  onBackToHome,
  renderProductCard,
}: StorePageViewProps) {
  const store = stores.find((s) => s.id === viewedStoreId) || stores[0];
  const storeProducts = products.filter((p) => p.storeId === store?.id);

  if (!store) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Store not found</h2>
        <button
          onClick={onBackToHome}
          className="px-4 py-2 bg-[#003B8E] text-white text-xs font-bold rounded-xl cursor-pointer"
        >
          Return to Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      {/* Back button */}
      <button
        onClick={onBackToHome}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#003B8E] cursor-pointer bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-2xs transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to All Stores & Marketplace</span>
      </button>

      {/* Store Header Banner */}
      <div className="bg-gradient-to-r from-[#003B8E] to-[#002D6E] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12">
          <Store className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified City Partner Store
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{store.name}</h1>
          <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">{store.description || store.category}</p>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-300 font-medium">
            <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4 text-[#F96302]" /> {store.address}, {store.cityName}</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-400" /> {store.deliveryMins || 30} mins delivery</span>
            {store.phone && (
              <span className="inline-flex items-center gap-1.5"><Phone className="w-4 h-4 text-emerald-400" /> {store.phone}</span>
            )}
          </div>
        </div>
      </div>

      {/* Store Catalog */}
      <div className="space-y-6">
        <div className="border-b border-slate-200/80 pb-4">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Store Catalog & Inventory</h2>
          <p className="text-xs text-slate-500">{storeProducts.length} items available from {store.name}</p>
        </div>

        {storeProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {storeProducts.map((product) => renderProductCard(product))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
            <h3 className="text-base font-bold text-slate-900">No products listed for this store yet</h3>
            <p className="text-xs text-slate-500">Check back soon or explore other stores in {store.cityName}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
