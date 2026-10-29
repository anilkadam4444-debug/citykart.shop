'use client';

import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  LayoutGrid,
  Store,
  Search,
  MapPin,
  Check,
  Sparkles,
  X,
  Lock,
} from 'lucide-react';
import {
  CategoryDefinition,
  CustomerShoppingLocation,
  LocalStore,
  ProductCategory,
  StoreCategoryId,
} from '@/lib/catalog-data';
import { CategoryIcon } from './category-icon';
import { ProductStudioArtwork } from './product-studio-artwork';

export type ProductSortOption =
  | 'POPULARITY'
  | 'RECOMMENDED'
  | 'PRICE_ASC'
  | 'PRICE_DESC'
  | 'DELIVERY_FASTEST';

interface BuyerLeftSidebarProps {
  hasSelectedCity: boolean;
  isCityLocked?: boolean;
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

export function BuyerLeftSidebar(props: BuyerLeftSidebarProps) {
  // Master panel open state (places Categories and Local Filters under the same button)
  const [isUnifiedPanelOpen, setIsUnifiedPanelOpen] = useState(true);
  // Categories minimized under a dropdown menu inside the unified panel
  const [isCategoriesDropdownOpen, setIsCategoriesDropdownOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');

  const activeCategories = useMemo(
    () => (props.categories || []).filter((c) => c?.isActive),
    [props.categories]
  );

  const filteredCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    return q
      ? activeCategories.filter((c) => c?.name?.toLowerCase().includes(q))
      : activeCategories;
  }, [activeCategories, categoryQuery]);

  const selectedCategoryObj = useMemo(
    () =>
      activeCategories.find((c) => c.name === props.selectedCategory) || null,
    [activeCategories, props.selectedCategory]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (props.selectedCategory !== 'All Categories') count += 1;
    if (props.selectedStoreFilterId !== 'ALL') count += 1;
    if (props.onlyDeliverableToMe) count += 1;
    if (props.inStockOnly) count += 1;
    if (props.sortBy !== 'POPULARITY' && props.sortBy !== 'RECOMMENDED') count += 1;
    return count;
  }, [
    props.selectedCategory,
    props.selectedStoreFilterId,
    props.onlyDeliverableToMe,
    props.inStockOnly,
    props.sortBy,
  ]);

  return (
    <div className="flex flex-col text-slate-900 w-full">
      {/* =========================================================
          SINGLE UNIFIED BUTTON & PANEL FOR CATEGORIES + LOCAL FILTERS
          Categories are minimized under an interactive dropdown menu
          inside the same unified control as Local Filters.
         ========================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {/* Master Unified Button Header */}
        <button
          type="button"
          onClick={() => setIsUnifiedPanelOpen((prev) => !prev)}
          className="w-full flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-[#003B8E] to-[#002D6E] text-white hover:from-[#00337A] hover:to-[#00255C] transition-all cursor-pointer"
          aria-expanded={isUnifiedPanelOpen}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4 h-4 text-[#F96302]" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-xs font-extrabold tracking-wide uppercase flex items-center gap-1.5">
                <span>Categories &amp; Local Filters</span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#F96302] text-white text-[10px] font-mono font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-blue-100 truncate">
                {props.selectedCategory === 'All Categories'
                  ? `All ${activeCategories.length} Categories · ${props.customerLocation.city || 'Local'}`
                  : props.selectedCategory}
              </div>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-blue-100 shrink-0 transition-transform duration-200 ${
              isUnifiedPanelOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isUnifiedPanelOpen && (
          <div className="p-3.5 space-y-4 divide-y divide-slate-100">
            {/* =========================================================
                PART 1: CATEGORIES DROPDOWN MENU (MINIMIZED BY DEFAULT)
                Restores category images & renames Department -> Categories
               ========================================================= */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5 text-[#003B8E]" />
                  <span>Categories ({activeCategories.length})</span>
                </span>
                {props.selectedCategory !== 'All Categories' && (
                  <button
                    type="button"
                    onClick={() => props.onSelectCategory('All Categories')}
                    className="text-[11px] font-bold text-[#F96302] hover:underline cursor-pointer"
                  >
                    Show All
                  </button>
                )}
              </div>

              {/* Minimized Categories Dropdown Trigger Button */}
              <button
                type="button"
                onClick={() => setIsCategoriesDropdownOpen((prev) => !prev)}
                className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-[#003B8E] bg-slate-50/80 hover:bg-white transition-all flex items-center justify-between gap-2.5 cursor-pointer shadow-2xs"
                aria-expanded={isCategoriesDropdownOpen}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {selectedCategoryObj ? (
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                      <ProductStudioArtwork
                        preset={selectedCategoryObj.defaultArtworkPreset}
                        alt={selectedCategoryObj.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200/80 text-[#003B8E] flex items-center justify-center shrink-0">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                  )}
                  <div className="text-left min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {props.selectedCategory}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {isCategoriesDropdownOpen
                        ? 'Click to minimize categories'
                        : 'Click to browse categories with images'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#003B8E] font-mono text-[10px] font-bold">
                    {props.selectedCategory === 'All Categories'
                      ? props.totalCityProductsCount
                      : selectedCategoryObj
                        ? props.categoryProductCounts[selectedCategoryObj.id] || 0
                        : 0}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                      isCategoriesDropdownOpen ? 'rotate-180 text-[#003B8E]' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Expanded Categories Dropdown List with Category Images */}
              {isCategoriesDropdownOpen && (
                <div className="pt-1.5 space-y-2 animate-in fade-in duration-150">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      placeholder="Filter categories..."
                      value={categoryQuery}
                      onChange={(e) => setCategoryQuery(e.target.value)}
                      className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#003B8E] focus:bg-white font-medium"
                    />
                    {categoryQuery && (
                      <button
                        type="button"
                        onClick={() => setCategoryQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-[320px] overflow-y-auto pr-1 space-y-1">
                    {/* All Categories Option */}
                    <button
                      type="button"
                      onClick={() => {
                        props.onSelectCategory('All Categories');
                        setIsCategoriesDropdownOpen(false);
                        props.onCloseMobileDrawer?.();
                      }}
                      className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        props.selectedCategory === 'All Categories'
                          ? 'bg-[#003B8E] text-white shadow-2xs'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            props.selectedCategory === 'All Categories'
                              ? 'bg-white/15 text-white'
                              : 'bg-blue-50 text-[#003B8E]'
                          }`}
                        >
                          <Store className="w-4 h-4" />
                        </div>
                        <span className="truncate">All Categories</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold shrink-0 ${
                          props.selectedCategory === 'All Categories'
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {props.totalCityProductsCount}
                      </span>
                    </button>

                    {/* Individual Categories with Restored Studio Images & Icons */}
                    {filteredCategories.map((cat) => {
                      const isSelected = props.selectedCategory === cat.name;
                      const prodCount = props.categoryProductCounts?.[cat.id] ?? 0;
                      const storeCount = props.categoryStoreCounts?.[cat.id] ?? 0;

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            props.onSelectCategory(cat.name);
                            setIsCategoriesDropdownOpen(false);
                            props.onCloseMobileDrawer?.();
                          }}
                          className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-xl text-xs transition-all cursor-pointer group ${
                            isSelected
                              ? 'bg-[#003B8E] text-white font-bold shadow-2xs'
                              : 'hover:bg-slate-100 text-slate-700 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Category Image Thumbnail + Icon Badge */}
                            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200/80 shrink-0 bg-slate-100">
                              <ProductStudioArtwork
                                preset={cat.defaultArtworkPreset}
                                alt={cat.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute bottom-0 right-0 w-4 h-4 rounded-tl-md bg-white/95 text-[#003B8E] flex items-center justify-center shadow-2xs">
                                <CategoryIcon
                                  categoryIdOrName={cat.id}
                                  className="w-2.5 h-2.5"
                                />
                              </div>
                            </div>
                            <div className="text-left min-w-0">
                              <div className="truncate leading-tight">
                                {cat.name}
                              </div>
                              {storeCount > 0 && (
                                <div
                                  className={`text-[10px] truncate ${
                                    isSelected ? 'text-blue-100' : 'text-slate-400'
                                  }`}
                                >
                                  {storeCount} {storeCount === 1 ? 'store' : 'stores'}
                                </div>
                              )}
                            </div>
                          </div>

                          <span
                            className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold shrink-0 ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : prodCount > 0
                                  ? 'bg-blue-50 text-[#003B8E]'
                                  : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {prodCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* =========================================================
                PART 2: LOCAL FILTERS (UNDER THE SAME UNIFIED BUTTON)
               ========================================================= */}
            <div className="pt-3.5 space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#003B8E]" />
                  <span>Local Filters</span>
                </span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={props.onResetAllFilters}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Active Delivery City Selector */}
              <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-[#003B8E] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <span>Shopping Location</span>
                      {props.isCityLocked && (
                        <span className="text-[9px] font-bold text-[#003B8E] bg-blue-100 px-1 py-0.2 rounded">
                          Intra-City Only
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {props.formattedLocationFull}
                    </div>
                  </div>
                </div>
                {props.isCityLocked ? (
                  <span
                    title="Your city is locked after login for hyperlocal intra-city delivery"
                    className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold shrink-0 inline-flex items-center gap-1"
                  >
                    <Lock className="w-3 h-3 text-[#003B8E]" />
                    <span>Locked</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={props.onOpenLocationModal}
                    className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-[#003B8E] hover:bg-blue-50 text-[11px] font-bold shrink-0 cursor-pointer shadow-2xs"
                  >
                    Change
                  </button>
                )}
              </div>

              {/* Sort Order Selector */}
              <div>
                <label
                  htmlFor="sidebar-sort-select"
                  className="block text-[11px] font-bold text-slate-700 mb-1.5"
                >
                  Sort Products By
                </label>
                <select
                  id="sidebar-sort-select"
                  value={props.sortBy}
                  onChange={(e) =>
                    props.onChangeSortBy(e.target.value as ProductSortOption)
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#003B8E] focus:bg-white cursor-pointer"
                >
                  <option value="POPULARITY">Most Popular in City</option>
                  <option value="PRICE_ASC">Price: Low to High</option>
                  <option value="PRICE_DESC">Price: High to Low</option>
                  <option value="DELIVERY_FASTEST">Fastest Local Delivery</option>
                </select>
              </div>

              {/* Local Store Filter */}
              {props.eligibleStoresInCity.length > 0 && (
                <div>
                  <label
                    htmlFor="sidebar-store-select"
                    className="block text-[11px] font-bold text-slate-700 mb-1.5"
                  >
                    Filter by Neighborhood Store ({props.eligibleStoresInCity.length})
                  </label>
                  <select
                    id="sidebar-store-select"
                    value={props.selectedStoreFilterId}
                    onChange={(e) => props.onSelectStoreFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#003B8E] focus:bg-white cursor-pointer"
                  >
                    <option value="ALL">
                      All Stores in {props.customerLocation.city || 'City'}
                    </option>
                    {props.eligibleStoresInCity.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.neighborhood})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Toggle Checkboxes */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition-colors">
                  <span className="font-semibold text-slate-700">
                    Deliverable to {props.customerLocation.locality || 'my locality'}
                  </span>
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[#003B8E] rounded cursor-pointer"
                    checked={props.onlyDeliverableToMe}
                    onChange={(e) =>
                      props.onToggleOnlyDeliverableToMe(e.target.checked)
                    }
                  />
                </label>

                <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition-colors">
                  <span className="font-semibold text-slate-700">
                    In-stock items only
                  </span>
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[#003B8E] rounded cursor-pointer"
                    checked={props.inStockOnly}
                    onChange={(e) => props.onToggleInStockOnly(e.target.checked)}
                  />
                </label>
              </div>

              {/* Reset All Filters Button */}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={props.onResetAllFilters}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#003B8E]" />
                  <span>Reset All Categories &amp; Filters</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
