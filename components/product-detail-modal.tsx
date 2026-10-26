'use client';

import React, {useState} from 'react';
import {
  X,
  Plus,
  Minus,
  Check,
  ArrowRight,
  Clock,
  MapPin,
  AlertCircle,
  Store,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import {
  CustomerShoppingLocation,
  evaluateStoreDeliveryEligibility,
  formatCurrency,
  LocalStore,
  Product,
} from '@/lib/catalog-data';
import {ProductStudioArtwork} from './product-studio-artwork';
import {CategoryIcon} from './category-icon';

interface ProductDetailModalProps {
  product: Product | null;
  store?: LocalStore;
  customerLocation: CustomerShoppingLocation;
  onClose: () => void;
  onViewStore?: (storeId: string) => void;
  onAddToCart: (
    product: Product,
    variant: string,
    quantity: number,
    openCheckoutImmediately?: boolean
  ) => void;
}

export function ProductDetailModal({
  product,
  store,
  customerLocation,
  onClose,
  onViewStore,
  onAddToCart,
}: ProductDetailModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<string>(
    product?.variants[0] || 'Standard'
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [viewAngle, setViewAngle] = useState<'front' | 'scale' | 'detail'>(
    'front'
  );
  const [justAdded, setJustAdded] = useState(false);

  if (!product) return null;

  const activeVariant = product.variants.includes(selectedVariant)
    ? selectedVariant
    : product.variants[0] || 'Standard';

  const isInStock = product.isAvailable && product.stock > 0;

  const eligibility = store
    ? evaluateStoreDeliveryEligibility(store, customerLocation)
    : {
        isDeliverable: true,
        statusLabel: `Delivers in ${product.city}`,
        reasonDetail: `Delivered directly by the store in about ${product.deliveryMins} minutes`,
      };

  const handleAdd = (instantCheckout = false) => {
    onAddToCart(product, activeVariant, quantity, instantCheckout);
    if (!instantCheckout) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1400);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Breadcrumb Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#003B8E]">
              <CategoryIcon
                categoryIdOrName={product.categoryId || product.category}
                className="w-3.5 h-3.5"
              />
            </span>
            <span className="font-semibold text-slate-800">{product.category}</span>
            <span aria-hidden="true" className="text-slate-300">/</span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <MapPin className="w-3 h-3 text-[#003B8E]" />
              {product.city}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Close</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left Column: Studio Product Gallery */}
          <div className="lg:col-span-6 bg-slate-100/70 p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200">
            <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-white border border-slate-200/80 shadow-xs">
              <ProductStudioArtwork
                preset={product.artworkPreset}
                customImageUrl={product.customImageUrl}
                alt={product.name}
                viewAngle={viewAngle}
                className="w-full h-full"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200/80">
              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
                {(
                  [
                    {id: 'front', label: 'Studio View'},
                    {id: 'scale', label: 'Pack Scale'},
                    {id: 'detail', label: 'Close-Up'},
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setViewAngle(tab.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      viewAngle === tab.id
                        ? 'bg-white text-[#003B8E] shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] font-medium text-slate-500 inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Direct store stock
              </span>
            </div>
          </div>

          {/* Right Column: Conversion & Store Details */}
          <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between bg-white">
            <div>
              {/* Store Identity Header */}
              <div className="flex items-center justify-between gap-2 text-xs mb-3">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#003B8E] bg-blue-50/90 border border-blue-200/70 px-2.5 py-1 rounded-md">
                  <Store className="w-3.5 h-3.5 shrink-0" />
                  <span>Sold by {product.storeName}</span>
                </span>
                {onViewStore && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewStore(product.storeId);
                    }}
                    className="text-xs font-semibold text-[#003B8E] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Visit store</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Product Title */}
              <h2
                id="pdp-title"
                className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 text-balance leading-snug"
              >
                {product.name}
              </h2>

              {/* Price & Stock Row */}
              <div className="mt-3.5 flex flex-wrap items-center gap-3 pb-4 border-b border-slate-100">
                <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900">
                  {formatCurrency(product.price, product.currency)}
                </span>
                {product.unit && (
                  <span className="text-xs font-semibold text-slate-500">
                    per {product.unit}
                  </span>
                )}
                {(!product.deliveryCharge || product.deliveryCharge === 0) ? (
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    Free Delivery
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                    Delivery Charge: {formatCurrency(product.deliveryCharge, product.currency)} per unit
                  </span>
                )}
                <span
                  className={`ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-md border ${
                    isInStock
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {isInStock
                    ? `In stock (${product.stock} available)`
                    : 'Out of stock'}
                </span>
              </div>

              {/* Delivery Availability Box */}
              <div
                className={`mt-4 p-3.5 rounded-xl border text-xs ${
                  eligibility.isDeliverable
                    ? 'bg-slate-50 border-slate-200/90 text-slate-700'
                    : 'bg-amber-50/90 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  {eligibility.isDeliverable ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>{eligibility.statusLabel}</span>
                </div>
                <p className="mt-1 text-slate-600 leading-relaxed">
                  {eligibility.reasonDetail}
                </p>
              </div>

              {/* Description */}
              <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                {product.description}
              </p>

              {/* Option Selector (if more than 1 option) */}
              {product.variants.length > 1 && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-700">
                      Select pack / option
                    </span>
                    <span className="font-medium text-[#003B8E]">{activeVariant}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((variant) => (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => setSelectedVariant(variant)}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          activeVariant === variant
                            ? 'border-[#003B8E] bg-[#003B8E] text-white shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {variant}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity & Total */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Quantity
                  </span>
                  <div className="inline-flex items-center border border-slate-300 rounded-xl bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      aria-label="Decrease quantity"
                      className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-l-xl transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-4 text-sm font-mono tabular-nums font-bold text-slate-900">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      disabled={!isInStock || quantity >= product.stock}
                      onClick={() =>
                        setQuantity((q) => Math.min(Math.max(1, product.stock), q + 1))
                      }
                      aria-label="Increase quantity"
                      className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-r-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-medium text-slate-500">Order subtotal</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    {formatCurrency(product.price * quantity, product.currency)}
                  </div>
                </div>
              </div>

              {/* Primary Commerce Actions */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={!isInStock}
                  onClick={() => handleAdd(false)}
                  className={`w-full py-3 px-4 rounded-xl text-white text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-xs ${
                    justAdded
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-[#F96302] hover:bg-[#E05500] disabled:bg-slate-300'
                  }`}
                >
                  {justAdded ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Added to Cart</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add to Cart</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(
                          product.price * quantity,
                          product.currency
                        )}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={!isInStock}
                  onClick={() => handleAdd(true)}
                  className="w-full py-3 px-4 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
                >
                  <span>Buy Now (Pay at Door)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Store Info Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#003B8E]" />
                <span>Store neighborhood: <strong className="font-medium text-slate-700">{product.neighborhood}, {product.city}</strong></span>
              </span>
              {store && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#003B8E]" />
                  <span>Hours: <strong className="font-medium text-slate-700">{store.operatingHours}</strong></span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
