'use client';

import React from 'react';
import {
  Search,
  MapPin,
  Store,
  Sparkles,
  SlidersHorizontal,
  ShieldCheck,
  Truck,
  Clock,
  ArrowRight,
  TrendingUp,
  Tag,
  Star,
  CheckCircle2,
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
      {/* HIGH-IMPACT PROFESSIONAL HERO BANNER */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#003B8E] via-[#002D6E] to-[#091526] text-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-md border border-slate-800">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-xs font-semibold text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Hyperlocal Storefronts · Direct Merchant Pricing</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-balance">
              Local City Commerce, <span className="text-[#F96302]">Delivered to Your Door</span>
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm lg:text-base max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Browse authentic local shops, supermarkets, fashion boutiques, and specialty stores in{' '}
              <strong className="text-white font-semibold">{formattedSelectedCityLabel}</strong>. Enjoy direct retail pricing, live local stock visibility, and fast fulfillment.
            </p>

            {/* Quick Location & Search CTA Bar inside Hero */}
            <div className="flex flex-col sm:flex-row items-stretch gap-2.5 pt-1 max-w-xl mx-auto lg:mx-0">
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(true)}
                className="px-3.5 py-2.5 bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <MapPin className="w-4 h-4 text-[#F96302]" />
                <span className="truncate max-w-[150px]">{formattedSelectedCityLabel}</span>
                <span className="text-[10px] bg-[#F96302] text-white px-2 py-0.5 rounded-md font-bold">Change</span>
              </button>

              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search local stores, groceries, apparel..."
                  className="w-full bg-white text-slate-900 placeholder:text-slate-400 pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F96302] shadow-sm"
                />
              </div>
            </div>

            {/* Qualitative Trust Markers with Clean Typography Separators */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-1 pt-2 text-xs text-slate-300 font-medium">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Verified Neighborhood Stores</span>
              <span aria-hidden="true" className="text-slate-500 hidden sm:inline">·</span>
              <span className="inline-flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-[#F96302]" /> Direct Doorstep Delivery</span>
              <span aria-hidden="true" className="text-slate-500 hidden sm:inline">·</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-400" /> ~30 Min Local Fulfillment</span>
            </div>
          </div>

          {/* Hero Spotlight Products */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
            {heroSpotlightProducts.slice(0, 2).map((product) => (
              <TiltCard
                key={product.id}
                onClick={() => onInspectProduct(product)}
                className="group bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3.5 cursor-pointer hover:bg-white/15 transition-all flex items-center gap-3.5 shadow-md"
              >
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-white/20 flex items-center justify-center">
                  <CategoryIcon categoryIdOrName={product.categoryId} variant="illustration" className="w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-0.5">Featured Store Item</div>
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#F96302] transition-colors">{product.name}</h4>
                  <div className="text-xs text-slate-300 truncate">{product.storeName}</div>
                  <div className="text-xs font-bold font-mono text-emerald-400 mt-1">₹{product.price}</div>
                </div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* CURATED CATEGORY GRID */}
      <section className="w-full space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Browse Departments</h2>
            <p className="text-xs text-slate-500">Curated merchant categories in {formattedSelectedCityLabel}</p>
          </div>
          {selectedCategory !== 'All Categories' && (
            <button
              onClick={() => setSelectedCategory('All Categories')}
              className="text-xs font-semibold text-[#003B8E] hover:underline cursor-pointer"
            >
              Show all departments
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {categories.slice(0, 12).map((cat, idx) => {
            const catName = typeof cat === 'string' ? cat : cat.name;
            const catId = typeof cat === 'string' ? cat : cat.id;
            const isSelected = selectedCategory === catName;
            return (
              <button
                key={catId || idx}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'All Categories' : catName)}
                className={`group cursor-pointer rounded-2xl p-3 border transition-all duration-150 flex items-center gap-2.5 text-left ${
                  isSelected
                    ? 'bg-[#003B8E] text-white border-[#003B8E] shadow-xs'
                    : 'bg-white text-slate-900 border-slate-200/90 hover:border-[#003B8E]/40 hover:shadow-2xs'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-50/80 text-[#003B8E]'}`}>
                  <CategoryIcon categoryIdOrName={catId} variant="icon" className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900 group-hover:text-[#003B8E]'}`}>
                    {catName}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* PRODUCT FEED SECTION */}
      <section className="w-full space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {selectedCategory === 'All Categories' ? 'Products & Local Offerings' : selectedCategory}
            </h2>
            <p className="text-xs text-slate-500 font-mono tabular-nums">{filteredProducts.length} items available in {formattedSelectedCityLabel}</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ProductSortOption)}
              className="bg-white border border-slate-200 rounded-xl text-xs font-semibold px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003B8E] cursor-pointer shadow-2xs"
            >
              <option value="POPULARITY">Most Popular</option>
              <option value="PRICE_ASC">Price: Low to High</option>
              <option value="PRICE_DESC">Price: High to Low</option>
              <option value="DELIVERY_FASTEST">Fastest Local Delivery</option>
            </select>

            <button
              type="button"
              onClick={() => setInStockOnly(!inStockOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer shadow-2xs ${
                inStockOnly ? 'bg-[#003B8E] text-white border-[#003B8E]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              In Stock
            </button>
          </div>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => renderProductCard(product))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 max-w-md mx-auto p-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto text-xl font-bold">
              🔍
            </div>
            <h3 className="text-sm font-bold text-slate-900">No products match your selected filters</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Try adjusting your category, store selection, or search query for {formattedSelectedCityLabel}.
            </p>
            <button
              type="button"
              onClick={resetCityFilters}
              className="px-4 py-2 bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              Reset Filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
