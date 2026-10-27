'use client';

import React from 'react';
import Image from 'next/image';
import {
  Search,
  MapPin,
  Store,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Truck,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Product, ProductCategory, CategoryDefinition, LocalStore as StoreRecord } from '@/lib/catalog-data';
import { CategoryIcon } from '@/components/category-icon';
import { TiltCard } from '@/components/tilt-card';
import { ProductSortOption } from '@/components/buyer-left-sidebar';

interface BuyerHomeViewProps {
  hasSelectedCity: boolean;
  formattedSelectedCityLabel: string;
  setIsLocationModalOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  categories: (CategoryDefinition | ProductCategory | string)[];
  filteredProducts: Product[];
  heroSpotlightProducts: Product[];
  isUnfilteredDiscovery: boolean;
  resetCityFilters: () => void;
  renderProductCard: (product: Product) => React.ReactNode;
  handleOpenStorePage: (storeId: string) => void;
  stores: StoreRecord[];
  onlyDeliverableToMe: boolean;
  setOnlyDeliverableToMe: (val: boolean) => void;
  selectedStoreFilterId: string;
  setSelectedStoreFilterId: (id: string) => void;
  inStockOnly: boolean;
  setInStockOnly: (val: boolean) => void;
  sortBy: ProductSortOption;
  setSortBy: (sort: ProductSortOption) => void;
  onInspectProduct: (product: Product) => void;
}

export function BuyerHomeView({
  hasSelectedCity,
  formattedSelectedCityLabel,
  setIsLocationModalOpen,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  categories,
  filteredProducts,
  heroSpotlightProducts,
  isUnfilteredDiscovery,
  resetCityFilters,
  renderProductCard,
  handleOpenStorePage,
  stores,
  onlyDeliverableToMe,
  setOnlyDeliverableToMe,
  selectedStoreFilterId,
  setSelectedStoreFilterId,
  inStockOnly,
  setInStockOnly,
  sortBy,
  setSortBy,
  onInspectProduct,
}: BuyerHomeViewProps) {
  return (
    <div className="w-full flex flex-col space-y-8 pb-16">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#003B8E] via-[#002D6E] to-[#0A192F] text-white py-12 md:py-16 px-4 sm:px-6 lg:px-8 shadow-lg">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-1 rounded-full text-xs font-semibold text-emerald-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Citykart City Commerce & Local Growth Platform</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-balance">
              Everything in Your City, <span className="text-[#F96302]">Delivered in Minutes</span>
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Discover trusted local merchants, artisans, supermarkets, and restaurants right in {formattedSelectedCityLabel}. Real-time inventory, direct store prices, and lightning-fast local doorstep delivery.
            </p>

            {/* City Selector & Search Bar Trigger */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 max-w-xl mx-auto lg:mx-0">
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(true)}
                className="w-full sm:w-auto px-4 py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
              >
                <MapPin className="w-4 h-4 text-[#F96302]" />
                <span>{formattedSelectedCityLabel}</span>
                <span className="text-[10px] bg-[#F96302] text-white px-2 py-0.5 rounded-full font-bold">Change</span>
              </button>

              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stores, groceries, electronics, fashion..."
                  className="w-full bg-white text-slate-900 placeholder:text-slate-400 pl-10 pr-4 py-3 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F96302] shadow-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 pt-3 text-xs text-slate-300 font-medium">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> 100% Verified Local Stores</span>
              <span className="inline-flex items-center gap-1.5"><Truck className="w-4 h-4 text-[#F96302]" /> Direct Doorstep Delivery</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-400" /> Average 30-Min Fulfillment</span>
            </div>
          </div>

          {/* Hero Right: Spotlight Cards / Dynamic Illustration */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {heroSpotlightProducts.slice(0, 2).map((product) => (
              <TiltCard
                key={product.id}
                onClick={() => onInspectProduct(product)}
                className="group bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 cursor-pointer hover:bg-white/15 transition-all flex items-center gap-4 shadow-xl"
              >
                <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-white/25">
                  <CategoryIcon categoryIdOrName={product.categoryId} variant="illustration" className="w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-0.5">Spotlight Deal</div>
                  <h4 className="text-sm font-bold text-white truncate group-hover:text-[#F96302] transition-colors">{product.name}</h4>
                  <div className="text-xs text-slate-300 truncate">{product.storeName}</div>
                  <div className="text-sm font-bold font-mono text-emerald-400 mt-1">₹{product.price}</div>
                </div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORY GRID WITH DYNAMIC ILLUSTRATIONS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Explore Categories</h2>
            <p className="text-xs text-slate-500">25+ curated local merchant categories across {formattedSelectedCityLabel}</p>
          </div>
          {selectedCategory !== 'All Categories' && (
            <button
              onClick={() => setSelectedCategory('All Categories')}
              className="text-xs font-semibold text-[#003B8E] hover:underline cursor-pointer"
            >
              Clear Category Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
          {categories.map((cat, idx) => {
            const catName = typeof cat === 'string' ? cat : cat.name;
            const catId = typeof cat === 'string' ? cat : cat.id;
            const catDesc = typeof cat === 'string' ? 'Local stores & items' : (cat.description || 'Local stores & items');
            const isSelected = selectedCategory === catName;
            return (
              <div
                key={catId || idx}
                onClick={() => setSelectedCategory(isSelected ? 'All Categories' : catName)}
                className={`group cursor-pointer rounded-2xl p-3.5 border transition-all duration-200 flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#003B8E] text-white border-[#003B8E] shadow-md scale-[1.02]'
                    : 'bg-white text-slate-900 border-slate-200/80 hover:border-[#003B8E]/40 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-50 text-[#003B8E]'}`}>
                    <CategoryIcon categoryIdOrName={catId} variant="icon" className="w-5 h-5" />
                  </div>
                  <span className="text-sm">✨</span>
                </div>
                <div>
                  <h3 className={`text-xs sm:text-sm font-bold line-clamp-1 ${isSelected ? 'text-white' : 'text-slate-900 group-hover:text-[#003B8E]'}`}>
                    {catName}
                  </h3>
                  <p className={`text-[10px] mt-0.5 line-clamp-1 ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                    {catDesc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* PRODUCTS FEED & FILTERS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              {selectedCategory === 'All Categories' ? 'All Available Products & Stores' : selectedCategory}
            </h2>
            <p className="text-xs text-slate-500">{filteredProducts.length} items available in {formattedSelectedCityLabel}</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ProductSortOption)}
              className="bg-white border border-slate-200 rounded-xl text-xs font-medium px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003B8E]"
            >
              <option value="POPULARITY">Most Popular</option>
              <option value="PRICE_LOW_HIGH">Price: Low to High</option>
              <option value="PRICE_HIGH_LOW">Price: High to Low</option>
              <option value="FASTEST_DELIVERY">Fastest Delivery</option>
            </select>

            <button
              onClick={() => setInStockOnly(!inStockOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                inStockOnly ? 'bg-[#003B8E] text-white border-[#003B8E]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              In Stock Only
            </button>
          </div>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product) => renderProductCard(product))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-2xs space-y-4 max-w-lg mx-auto p-8">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 text-[#F96302] flex items-center justify-center mx-auto text-2xl font-bold">
              🏪
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">No products found matching your filters</h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              We couldn&apos;t find any items matching your current search or category filter in {formattedSelectedCityLabel}. Try resetting filters or choosing another category.
            </p>
            <button
              onClick={resetCityFilters}
              className="px-5 py-2.5 bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
