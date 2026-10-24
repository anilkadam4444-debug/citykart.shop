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

  return (
    <div className="flex flex-col text-stone-900 w-full">
      {/* Mobile Drawer Header (rendered only when inside mobile/tablet slide-over drawer) */}
      {onCloseMobileDrawer && (
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-200">
          <span className="text-xs font-semibold text-stone-900">
            Categories &amp; Local Filters
          </span>
          <button
            type="button"
            onClick={onCloseMobileDrawer}
            className="p-1 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Container Card: Compact, unbordered/clean, zero-pill discipline */}
      <div className="p-2.5 bg-white border border-stone-200/90 rounded-xl shadow-xs">
        {/* Top Segmented Tab Control: Categories vs Filters */}
        <div className="flex items-center justify-between gap-1 p-0.5 bg-stone-100/90 rounded-lg text-xs mb-2">
          <button
            type="button"
            onClick={() => setActiveSidebarTab('CATEGORIES')}
            className={`flex-1 py-1 px-2 rounded-md font-semibold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSidebarTab === 'CATEGORIES'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Categories</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSidebarTab('FILTERS')}
            className={`flex-1 py-1 px-2 rounded-md font-semibold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSidebarTab === 'FILTERS'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block"
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
          <nav aria-label="Product categories" className="w-full">
            {/* Slim Header with Search Toggle */}
            <div className="flex items-center justify-between px-1 pb-1 mb-1 border-b border-stone-100 text-stone-500">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Categories
              </span>
              <button
                type="button"
                onClick={() => setIsCategorySearchOpen((v) => !v)}
                className={`p-0.5 rounded text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer transition-colors ${
                  isCategorySearchOpen || categoryQuery ? 'text-stone-900 bg-stone-100' : ''
                }`}
                title="Filter categories"
                aria-label="Filter categories"
              >
                <Search className="w-3 h-3" />
              </button>
            </div>

            {/* Optional Slim Real-Time Category Search Input */}
            {(isCategorySearchOpen || categoryQuery) && (
              <div className="relative mb-1.5 px-0.5">
                <Search className="w-3 h-3 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={categoryQuery}
                  onChange={(e) => setCategoryQuery(e.target.value)}
                  placeholder="Filter categories..."
                  aria-label="Filter categories"
                  className="w-full pl-6 pr-6 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-md text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-800 focus:bg-white transition-colors"
                  autoFocus
                />
                {categoryQuery && (
                  <button
                    type="button"
                    onClick={() => setCategoryQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-700 cursor-pointer"
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
              className="list-none p-0 m-0 flex flex-col space-y-[1px]"
              style={{ listStyle: 'none', paddingInlineStart: 0, margin: 0 }}
            >
              {/* ENTRY 0: All Products */}
              <li className="list-none p-0 m-0" style={{ listStyle: 'none' }}>
                <Link
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectCategory('All Categories');
                    onCloseMobileDrawer?.();
                  }}
                  className={`w-full px-2 py-[2.5px] rounded-md text-left transition-colors flex items-center gap-1.5 cursor-pointer select-none ${
                    selectedCategory === 'All Categories'
                      ? 'bg-stone-900 text-white font-semibold shadow-2xs'
                      : 'text-stone-700 hover:bg-stone-100/90 hover:text-stone-900'
                  }`}
                  title="All Products"
                >
                  <Store
                    className={`w-3.5 h-3.5 shrink-0 ${
                      selectedCategory === 'All Categories'
                        ? 'text-white'
                        : 'text-stone-500'
                    }`}
                  />
                  <span className="text-[11px] xl:text-[11.5px] leading-tight truncate">
                    All Products
                  </span>
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
                      onClick={(e) => {
                        e.preventDefault();
                        onSelectCategory(
                          isSelected ? 'All Categories' : cat.name
                        );
                        onCloseMobileDrawer?.();
                      }}
                      className={`w-full px-2 py-[2px] 2xl:py-[2.5px] rounded-md text-left transition-colors flex items-center gap-1.5 cursor-pointer select-none ${
                        isSelected
                          ? 'bg-stone-900 text-white font-semibold shadow-2xs'
                          : 'text-stone-700 hover:bg-stone-100/90 hover:text-stone-900'
                      }`}
                      title={cat.name}
                    >
                      <CategoryIcon
                        categoryIdOrName={cat.id}
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-white' : 'text-stone-500'
                        }`}
                      />
                      <span className="text-[11px] xl:text-[11.5px] leading-tight truncate text-left">
                        {cat.name}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {/* =========================================================================
            VIEW 2: SORT & LOCAL STORE FILTERS & LOCATION SETTINGS
            Accessible via tab switch; keeps categories 100% visible on a single screen
           ========================================================================= */}
        {activeSidebarTab === 'FILTERS' && (
          <div className="space-y-3 pt-1 text-xs text-stone-800">
            {/* Header & Reset Action */}
            <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Filter &amp; Sort
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={onResetAllFilters}
                  className="text-[11px] font-medium text-stone-600 hover:text-stone-900 underline inline-flex items-center gap-1 cursor-pointer transition-colors"
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
                className="block text-[11px] font-semibold text-stone-700 mb-1"
              >
                Sort products by
              </label>
              <select
                id="sidebar-sort-select"
                value={sortBy === 'RECOMMENDED' ? 'POPULARITY' : sortBy}
                onChange={(e) =>
                  onChangeSortBy(e.target.value as ProductSortOption)
                }
                className="w-full px-2 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-800 focus:bg-white transition-colors"
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
                className="block text-[11px] font-semibold text-stone-700 mb-1"
              >
                Filter by store in {customerLocation.city || 'your area'}
              </label>
              <select
                id="sidebar-store-filter"
                disabled={!hasSelectedCity || eligibleStoresInCity.length === 0}
                value={selectedStoreFilterId}
                onChange={(e) => onSelectStoreFilter(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 disabled:opacity-60 focus:outline-none focus:border-stone-800 focus:bg-white transition-colors"
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
                  className="mt-1 text-[11px] font-medium text-stone-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Open store catalog</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Checkboxes: In Stock & Locality Delivery */}
            <div className="space-y-1.5 pt-1.5 border-t border-stone-100">
              <label className="flex items-center gap-2 text-xs text-stone-700 hover:text-stone-900 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => onToggleInStockOnly(e.target.checked)}
                  className="rounded border-stone-300 text-stone-900 focus:ring-stone-800"
                />
                <span>In stock products only</span>
              </label>

              {hasSelectedCity && customerLocation.locality && (
                <label className="flex items-center gap-2 text-xs text-stone-700 hover:text-stone-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyDeliverableToMe}
                    onChange={(e) =>
                      onToggleOnlyDeliverableToMe(e.target.checked)
                    }
                    className="rounded border-stone-300 text-stone-900 focus:ring-stone-800"
                  />
                  <span>Delivers to {customerLocation.locality}</span>
                </label>
              )}
            </div>

            {/* Delivery Location Section */}
            <div className="pt-2 border-t border-stone-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-stone-700">
                  Shopping city
                </span>
                {hasSelectedCity && (
                  <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                    Active
                  </span>
                )}
              </div>

              <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-stone-900 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-stone-900 truncate">
                    {formattedLocationFull || 'No city selected'}
                  </div>
                  {customerLocation.locality && (
                    <div className="text-[10px] text-stone-500 truncate">
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
                className="w-full py-1.5 px-2.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-900 text-[11px] font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3 h-3 text-stone-600" />
                <span>
                  {hasSelectedCity ? 'Change shopping city' : 'Select your city'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowQuickCities((v) => !v)}
                className="text-[10px] font-medium text-stone-500 hover:text-stone-900 underline text-left cursor-pointer transition-colors block pt-0.5"
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
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
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
  );
}
