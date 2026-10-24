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
        reasonDetail: `Delivered by the store in about ${product.deliveryMins} minutes`,
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
      className="fixed inset-0 z-50 bg-stone-950/55 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-[#FAF9F6] border border-stone-200 rounded-xl shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Simple Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-white">
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <CategoryIcon
              categoryIdOrName={product.categoryId || product.category}
              className="w-4 h-4 text-stone-700"
            />
            <span>{product.category}</span>
            <span aria-hidden="true">·</span>
            <span>{product.city}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Close</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left Column: Product Photo */}
          <div className="lg:col-span-6 bg-[#EFECE6] p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-stone-200">
            <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden">
              <ProductStudioArtwork
                preset={product.artworkPreset}
                customImageUrl={product.customImageUrl}
                alt={product.name}
                viewAngle={viewAngle}
                className="w-full h-full"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-300/60">
              <div className="flex items-center gap-1 p-1 bg-stone-200/75 rounded-lg">
                {(
                  [
                    {id: 'front', label: 'Main view'},
                    {id: 'scale', label: 'Size view'},
                    {id: 'detail', label: 'Close-up'},
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setViewAngle(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      viewAngle === tab.id
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Clear Purchase Details */}
          <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between bg-[#FAF9F6]">
            <div>
              {/* Store Name & Link */}
              <div className="flex items-center justify-between gap-2 text-xs text-stone-600 mb-2">
                <span className="inline-flex items-center gap-1.5 font-medium text-stone-800">
                  <Store className="w-3.5 h-3.5" />
                  <span>Sold by {product.storeName}</span>
                </span>
                {onViewStore && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewStore(product.storeId);
                    }}
                    className="text-stone-700 underline hover:text-stone-900 cursor-pointer"
                  >
                    View store
                  </button>
                )}
              </div>

              {/* Product Title & Price */}
              <h2
                id="pdp-title"
                className="text-2xl font-semibold tracking-tight text-stone-900 text-balance"
              >
                {product.name}
              </h2>

              <div className="mt-3 flex flex-wrap items-baseline gap-3">
                <span className="text-2xl font-semibold font-mono tabular-nums text-stone-900">
                  {formatCurrency(product.price, product.currency)}
                </span>
                {product.unit && (
                  <span className="text-xs font-medium text-stone-500">
                    ({product.unit})
                  </span>
                )}
                <span
                  className={`text-xs font-medium ${
                    isInStock ? 'text-emerald-800' : 'text-red-700'
                  }`}
                >
                  {isInStock
                    ? `In stock (${product.stock} available)`
                    : 'Out of stock'}
                </span>
              </div>

              {/* Delivery Availability Box */}
              <div
                className={`mt-4 p-3.5 rounded-lg border text-xs ${
                  eligibility.isDeliverable
                    ? 'bg-white border-stone-200 text-stone-700'
                    : 'bg-amber-50/90 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  {eligibility.isDeliverable ? (
                    <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  )}
                  <span>{eligibility.statusLabel}</span>
                </div>
                <p className="mt-1 text-stone-600">{eligibility.reasonDetail}</p>
              </div>

              <p className="mt-4 text-sm text-stone-600 leading-relaxed">
                {product.description}
              </p>

              {/* Option Selector (if more than 1 option) */}
              {product.variants.length > 1 && (
                <div className="mt-5 pt-4 border-t border-stone-200">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium text-stone-700">
                      Choose option
                    </span>
                    <span className="text-stone-500">{activeVariant}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((variant) => (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => setSelectedVariant(variant)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          activeVariant === variant
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
                        }`}
                      >
                        {variant}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity & Total */}
              <div className="mt-5 flex items-center justify-between gap-4">
                <div>
                  <span className="block text-xs font-medium text-stone-700 mb-1">
                    Quantity
                  </span>
                  <div className="inline-flex items-center border border-stone-300 rounded-lg bg-white">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      aria-label="Decrease quantity"
                      className="p-2.5 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-4 text-sm font-mono tabular-nums font-medium text-stone-900">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      disabled={!isInStock || quantity >= product.stock}
                      onClick={() =>
                        setQuantity((q) => Math.min(Math.max(1, product.stock), q + 1))
                      }
                      aria-label="Increase quantity"
                      className="p-2.5 text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-stone-500">Total price</div>
                  <div className="text-lg font-semibold font-mono tabular-nums text-stone-900">
                    {formatCurrency(product.price * quantity, product.currency)}
                  </div>
                </div>
              </div>

              {/* Primary Actions */}
              <div className="mt-6 space-y-2.5">
                <button
                  type="button"
                  disabled={!isInStock}
                  onClick={() => handleAdd(false)}
                  className="w-full py-3 px-5 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {justAdded ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Added to cart</span>
                    </>
                  ) : (
                    <>
                      <span>Add to cart</span>
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
                  className="w-full py-2.5 px-5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-900 text-xs font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Buy now (Pay on delivery)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Store Info Footer */}
            <div className="mt-6 pt-4 border-t border-stone-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-stone-700" />
                <span>Store location: {product.neighborhood}, {product.city}</span>
              </span>
              {store && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-stone-700" />
                  <span>Open: {store.operatingHours}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
