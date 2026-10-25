'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Search,
  Store,
  RotateCcw,
  SlidersHorizontal,
  ArrowRight,
  ChevronRight,
  LayoutGrid,
  X,
} from 'lucide-react';
import {
  CategoryDefinition,
  CustomerShoppingLocation,
  GLOBAL_CITY_DIRECTORY,
  LocalStore,
  ProductCategory,
  StoreCategoryId,
} from '@/lib/catalog-data';
import { CategoryIcon } from './category-icon';

export type ProductSortOption =
  | 'POPULARITY'
  | 'RECOMMENDED'
  | 'PRICE_ASC'
  | 'PRICE_DESC'
  | 'DELIVERY_FASTEST';

interface BuyerLeftSidebarProps {
  hasSelectedCity: boolean;
  customerLocation: CustomerShoppingLocation;
  formattedLocationFull: string;
  categories: CategoryDefinition[];
  selectedCategory: ProductCategory;
  categoryStoreCounts: Record<StoreCategoryId, number>;
  categoryProductCounts: Record<StoreCategoryId, number>;
  eligibleStoresInCity: LocalStore[];
  totalCityProductsCount: number;
  selectedStoreFilterId: string;
  onlyDeliverableToMe: boolean;
  inStockOnly: boolean;
  sortBy: ProductSortOption;
  onOpenLocationModal: () => void;
  onQuickSelectCity: (loc: CustomerShoppingLocation) => void;
  onSelectCategory: (cat: ProductCategory) => void;
  onSelectStoreFilter: (storeId: string) => void;
  onVisitStorePage?: (storeId: string) => void;
  onToggleOnlyDeliverableToMe: (val: boolean) => void;
  onToggleInStockOnly: (val: boolean) => void;
  onChangeSortBy: (sort: ProductSortOption) => void;
  onResetAllFilters: () => void;
  onCloseMobileDrawer?: () => void;
}

export function BuyerLeftSidebar({
  hasSelectedCity,
  customerLocation,
  formattedLocationFull,
  categories,
  selectedCategory,
  eligibleStoresInCity,
  selectedStoreFilterId,
  onlyDeliverableToMe,
  inStockOnly,
  sortBy,
  onOpenLocationModal,
  onQuickSelectCity,
  onSelectCategory,
  onSelectStoreFilter,
  onVisitStorePage,
  onToggleOnlyDeliverableToMe,
  onToggleInStockOnly,
  onChangeSortBy,
  onResetAllFilters,
  onCloseMobileDrawer,
}: BuyerLeftSidebarProps) {
  const [activeSidebarTab, setActiveSidebarTab] = useState<'CATEGORIES' | 'FILTERS'>('CATEGORIES');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [isCategorySearchOpen, setIsCategorySearchOpen] = useState(false);
  const [showQuickCities, setShowQuickCities] = useState(false);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive),
    [categories]
  );

  const filteredCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    if (!q) return activeCategories;
    return activeCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [activeCategories, categoryQuery]);

  const isDefaultSort =
    sortBy === 'POPULARITY' || sortBy === 'RECOMMENDED';

  const hasActiveFilters =
    selectedCategory !== 'All Categories' ||
    selectedStoreFilterId !== 'ALL' ||
    onlyDeliverableToMe ||
    inStockOnly ||
    !isDefaultSort;

  const isAllSelected = selectedCategory === 'All Categories';

  return (
    <div className="flex flex-col text-slate-900 w-full">
      {/* Mobile Drawer Header (rendered only when inside mobile/tablet slide-over drawer) */}
      {onCloseMobileDrawer && (
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#003B8E] text-white flex items-center justify-center shadow-2xs">
              <LayoutGrid className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-bold text-slate-900 tracking-tight">
              Marketplace Categories
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobileDrawer}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F96302] cursor-pointer transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Sidebar Container: Crisp white surface, subtle brand top rule, refined elevation */}
      <div className="bg-white border border-slate-200/95 rounded-xl shadow-xs overflow-hidden">
        {/* Top Brand Accent Rule */}
        <div className="h-[3px] w-full bg-gradient-to-r from-[#003B8E] via-[#003B8E] to-[#F96302]" />

        <div className="p-2">
          {/* Segmented Mode Switcher: Categories vs Filters */}
          <div className="flex items-center justify-between gap-1 p-0.5 bg-slate-100/90 border border-slate-200/70 rounded-lg text-xs mb-1.5">
            <button
              type="button"
              onClick={() => setActiveSidebarTab('CATEGORIES')}
              className={`flex-1 py-1 px-2 rounded-md font-semibold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F96302] ${
                activeSidebarTab === 'CATEGORIES'
                  ? 'bg-[#003B8E] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#003B8E] hover:bg-white/60'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Categories</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSidebarTab('FILTERS')}
              className={`flex-1 py-1 px-2 rounded-md font-semibold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F96302] ${
                activeSidebarTab === 'FILTERS'
                  ? 'bg-[#003B8E] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#003B8E] hover:bg-white/60'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Local Filters</span>
              {hasActiveFilters && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#F96302] inline-block"
                  title="Active filters enabled"
                />
              )}
            </button>
          </div>

          {/* =========================================================================
              VIEW 1: SINGLE-SCREEN UNNUMBERED CATEGORIES LIST
              All 25 top-level categories visible simultaneously in viewport without scroll
             ========================================================================= */}
          {activeSidebarTab === 'CATEGORIES' && (
            <nav aria-label="Shop by Category" className="w-full">
              {/* Prominent, Refined Category Heading Bar */}
              <div className="flex items-center justify-between px-1.5 py-1 mb-1 rounded-lg bg-[#003B8E]/[0.04] border border-[#003B8E]/10">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-3.5 rounded-full bg-[#F96302] shrink-0" />
                  <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-[#003B8E] truncate">
                    Shop by Category
                  </h2>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!isAllSelected && (
                    <button
                      type="button"
                      onClick={() => onSelectCategory('All Categories')}
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-[#F96302] hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F96302] cursor-pointer transition-colors"
                      title="Reset to All Products"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsCategorySearchOpen((v) => !v)}
                    className={`p-1 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F96302] ${
                      isCategorySearchOpen || categoryQuery
                        ? 'text-white bg-[#003B8E]'
                        : 'text-[#003B8E]/75 hover:text-[#003B8E] hover:bg-[#003B8E]/10'
                    }`}
                    title="Quick find category"
                    aria-label="Quick find category"
                    aria-expanded={isCategorySearchOpen || Boolean(categoryQuery)}
                  >
                    <Search className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Optional Slim Real-Time Category Search Input */}
              {(isCategorySearchOpen || categoryQuery) && (
                <div className="relative mb-1.5 px-0.5">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={categoryQuery}
                    onChange={(e) => setCategoryQuery(e.target.value)}
                    placeholder="Find a department..."
                    aria-label="Filter categories"
                    className="w-full pl-6 pr-6 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#003B8E] focus:ring-1 focus:ring-[#003B8E] focus:bg-white transition-colors"
                    autoFocus
                  />
                  {categoryQuery && (
                    <button
                      type="button"
                      onClick={() => setCategoryQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="Clear category filter"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Explicit Unnumbered List Structure (list-style: none, padding-inline-start: 0, margin: 0) */}
              <ul
                role="list"
                className="list-none p-0 m-0 flex flex-col space-y-[1.5px]"
                style={{ listStyle: 'none', paddingInlineStart: 0, margin: 0 }}
              >
                {/* ENTRY 0: All Marketplace Products */}
                <li className="list-none p-0 m-0" style={{ listStyle: 'none' }}>
                  <Link
                    href="/"
                    aria-current={isAllSelected ? 'page' : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectCategory('All Categories');
                      onCloseMobileDrawer?.();
                    }}
                    className={`group relative w-full px-1.5 py-[2.5px] rounded-lg text-left transition-all duration-150 flex items-center gap-2 cursor-pointer select-none border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F96302] focus-visible:ring-offset-1 ${
                      isAllSelected
                        ? 'bg-[#003B8E] text-white font-semibold border-[#002C6B] shadow-2xs'
                        : 'bg-transparent border-transparent text-slate-700 font-medium hover:bg-[#003B8E]/[0.06] hover:border-[#003B8E]/15 hover:text-[#003B8E]'
                    }`}
                    title="All Marketplace Products"
                  >
                    {/* Left Selection Accent Cue */}
                    <span
                      aria-hidden="true"
                      className={`w-[3px] h-3.5 rounded-full shrink-0 transition-all duration-150 ${
                        isAllSelected
                          ? 'bg-[#F96302]'
                          : 'bg-transparent group-hover:bg-[#F96302]/60'
                      }`}
                    />

                    {/* Icon Container */}
                    <span
                      className={`w-[19px] h-[19px] rounded-[5px] flex items-center justify-center shrink-0 transition-all duration-150 ${
                        isAllSelected
                          ? 'bg-white/15 text-white ring-1 ring-white/25'
                          : 'bg-[#003B8E]/[0.07] text-[#003B8E] group-hover:bg-[#003B8E] group-hover:text-white'
                      }`}
                    >
                      <Store className="w-3 h-3 shrink-0" strokeWidth={2} />
                    </span>

                    <span className="text-[11.5px] xl:text-[12px] leading-tight truncate flex-1">
                      All Products
                    </span>

                    <ChevronRight
                      aria-hidden="true"
                      className={`w-3 h-3 shrink-0 transition-all duration-150 ${
                        isAllSelected
                          ? 'text-[#F96302] opacity-100 translate-x-0'
                          : 'text-[#003B8E]/40 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0'
                      }`}
                    />
                  </Link>
                </li>

                {/* ENTRIES 1–25: Authoritative Categories (Explicitly Unnumbered) */}
                {filteredCategories.map((cat) => {
                  const isSelected = selectedCategory === cat.name;
                  return (
                    <li
                      key={cat.id}
                      className="list-none p-0 m-0"
                      style={{ listStyle: 'none' }}
                    >
                      <Link
                        href={`/categories/${cat.slug}`}
                        aria-current={isSelected ? 'page' : undefined}
                        onClick={(e) => {
                          e.preventDefault();
                          onSelectCategory(
                            isSelected ? 'All Categories' : cat.name
                          );
                          onCloseMobileDrawer?.();
                        }}
                        className={`group relative w-full px-1.5 py-[2.5px] rounded-lg text-left transition-all duration-150 flex items-center gap-2 cursor-pointer select-none border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F96302] focus-visible:ring-offset-1 ${
                          isSelected
                            ? 'bg-[#003B8E] text-white font-semibold border-[#002C6B] shadow-2xs'
                            : 'bg-transparent border-transparent text-slate-700 font-medium hover:bg-[#003B8E]/[0.06] hover:border-[#003B8E]/15 hover:text-[#003B8E]'
                        }`}
                        title={cat.name}
                      >
                        {/* Left Selection Accent Cue */}
                        <span
                          aria-hidden="true"
                          className={`w-[3px] h-3.5 rounded-full shrink-0 transition-all duration-150 ${
                            isSelected
                              ? 'bg-[#F96302]'
                              : 'bg-transparent group-hover:bg-[#F96302]/60'
                          }`}
                        />

                        {/* Structured Category Icon Frame */}
                        <span
                          className={`w-[19px] h-[19px] rounded-[5px] flex items-center justify-center shrink-0 transition-all duration-150 ${
                            isSelected
                              ? 'bg-white/15 text-white ring-1 ring-white/25'
                              : 'bg-slate-100/90 text-[#003B8E] border border-slate-200/70 group-hover:bg-[#003B8E] group-hover:border-[#003B8E] group-hover:text-white'
                          }`}
                        >
                          <CategoryIcon
                            categoryIdOrName={cat.id}
                            className="w-3 h-3 shrink-0 transition-colors"
                            strokeWidth={isSelected ? 2.1 : 1.9}
                          />
                        </span>

                        {/* Readable Category Name */}
                        <span className="text-[11.5px] xl:text-[12px] leading-tight truncate text-left flex-1">
                          {cat.name}
                        </span>

                        {/* Subtle Right Selection / Hover Indicator */}
                        <ChevronRight
                          aria-hidden="true"
                          className={`w-3 h-3 shrink-0 transition-all duration-150 ${
                            isSelected
                              ? 'text-[#F96302] opacity-100 translate-x-0'
                              : 'text-[#003B8E]/40 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0'
                          }`}
                        />
                      </Link>
                    </li>
                  );
                })}

                {filteredCategories.length === 0 && (
                  <li className="py-4 px-2 text-center text-[11px] text-slate-500">
                    No matching categories found.
                  </li>
                )}
              </ul>
            </nav>
          )}

        {/* =========================================================================
            VIEW 2: SORT & LOCAL STORE FILTERS & LOCATION SETTINGS
            Accessible via tab switch; keeps categories 100% visible on a single screen
           ========================================================================= */}
        {activeSidebarTab === 'FILTERS' && (
          <div className="space-y-3 pt-1 text-xs text-slate-800">
            {/* Header & Reset Action */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Filter &amp; Sort
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={onResetAllFilters}
                  className="text-[11px] font-semibold text-[#F96302] hover:text-[#E05500] inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset all</span>
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div>
              <label
                htmlFor="sidebar-sort-select"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Sort products by
              </label>
              <select
                id="sidebar-sort-select"
                value={sortBy === 'RECOMMENDED' ? 'POPULARITY' : sortBy}
                onChange={(e) =>
                  onChangeSortBy(e.target.value as ProductSortOption)
                }
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#003B8E] focus:bg-white transition-colors"
              >
                <option value="POPULARITY">Popularity (Most ordered)</option>
                <option value="PRICE_ASC">Price: Low to High</option>
                <option value="PRICE_DESC">Price: High to Low</option>
                <option value="DELIVERY_FASTEST">Fastest local delivery</option>
              </select>
            </div>

            {/* Filter by Local Store */}
            <div>
              <label
                htmlFor="sidebar-store-filter"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Filter by store in {customerLocation.city || 'your area'}
              </label>
              <select
                id="sidebar-store-filter"
                disabled={!hasSelectedCity || eligibleStoresInCity.length === 0}
                value={selectedStoreFilterId}
                onChange={(e) => onSelectStoreFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 disabled:opacity-60 focus:outline-none focus:border-[#003B8E] focus:bg-white transition-colors"
              >
                <option value="ALL">
                  All local stores ({eligibleStoresInCity.length})
                </option>
                {eligibleStoresInCity.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.neighborhood})
                  </option>
                ))}
              </select>

              {selectedStoreFilterId !== 'ALL' && onVisitStorePage && (
                <button
                  type="button"
                  onClick={() => {
                    onVisitStorePage(selectedStoreFilterId);
                    onCloseMobileDrawer?.();
                  }}
                  className="mt-1.5 text-[11px] font-semibold text-[#003B8E] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Open store catalog</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Checkboxes: In Stock & Locality Delivery */}
            <div className="space-y-2 pt-1.5 border-t border-slate-100">
              <label className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => onToggleInStockOnly(e.target.checked)}
                  className="rounded border-slate-300 text-[#003B8E] focus:ring-[#003B8E]"
                />
                <span>In stock products only</span>
              </label>

              {hasSelectedCity && customerLocation.locality && (
                <label className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyDeliverableToMe}
                    onChange={(e) =>
                      onToggleOnlyDeliverableToMe(e.target.checked)
                    }
                    className="rounded border-slate-300 text-[#003B8E] focus:ring-[#003B8E]"
                  />
                  <span>Delivers to {customerLocation.locality}</span>
                </label>
              )}
            </div>

            {/* Delivery Location Section */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700">
                  Shopping city
                </span>
                {hasSelectedCity && (
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/70 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                    Active
                  </span>
                )}
              </div>

              <div className="p-2 rounded-lg bg-blue-50/60 border border-blue-200/70 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#003B8E] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-slate-900 truncate">
                    {formattedLocationFull || 'No city selected'}
                  </div>
                  {customerLocation.locality && (
                    <div className="text-[10px] text-slate-600 truncate">
                      {customerLocation.locality}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onOpenLocationModal();
                  onCloseMobileDrawer?.();
                }}
                className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-[#003B8E]/40 text-slate-900 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MapPin className="w-3 h-3 text-[#003B8E]" />
                <span>
                  {hasSelectedCity ? 'Change shopping city' : 'Select your city'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowQuickCities((v) => !v)}
                className="text-[10px] font-semibold text-[#003B8E] hover:underline text-left cursor-pointer transition-colors block pt-0.5"
              >
                {showQuickCities
                  ? 'Hide popular cities'
                  : 'Quick switch to major cities'}
              </button>

              {showQuickCities && (
                <div className="pt-1 flex flex-wrap gap-1">
                  {GLOBAL_CITY_DIRECTORY.slice(0, 8).map((cityRec) => {
                    const isCurrent =
                      hasSelectedCity &&
                      customerLocation.city.toLowerCase() ===
                        cityRec.cityName.toLowerCase();
                    return (
                      <button
                        key={cityRec.cityId}
                        type="button"
                        onClick={() => {
                          onQuickSelectCity({
                            mode: 'SELECTED_LOCATION',
                            country: cityRec.country,
                            countryCode: cityRec.countryCode,
                            stateRegion: cityRec.stateRegion,
                            district: cityRec.district,
                            postalCode: cityRec.postalCode,
                            localityType: cityRec.localityType || 'CITY',
                            city: cityRec.cityName,
                            cityId: cityRec.cityId,
                            locality: cityRec.defaultLocality,
                          });
                          onCloseMobileDrawer?.();
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[#003B8E] text-white border-[#003B8E]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cityRec.cityName}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

