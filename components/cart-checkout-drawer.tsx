'use client';

import React, {useState, useMemo} from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  Banknote,
  Smartphone,
  ShoppingBag,
  AlertTriangle,
  Store as StoreIcon,
  Loader2,
} from 'lucide-react';
import {
  CartItem,
  CustomerShoppingLocation,
  evaluateStoreDeliveryEligibility,
  formatCurrency,
  LocalStore,
  OrderRecord,
  PaymentMethod,
} from '@/lib/catalog-data';
import {ProductStudioArtwork} from './product-studio-artwork';

interface CartCheckoutDrawerProps {
  isOpen: boolean;
  initialStep?: 'cart' | 'checkout';
  items: CartItem[];
  stores: LocalStore[];
  customerLocation: CustomerShoppingLocation;
  buyerUid?: string;
  onClose: () => void;
  onUpdateQuantity: (productId: string, variant: string, delta: number) => void;
  onRemoveItem: (productId: string, variant: string) => void;
  onPlaceOrder: (order: OrderRecord) => void;
  onViewOrderTracker: (orderId: string) => void;
}

const FREE_DELIVERY_THRESHOLD = 199;

export function CartCheckoutDrawer({
  isOpen,
  initialStep = 'cart',
  items,
  stores,
  customerLocation,
  buyerUid,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onPlaceOrder,
  onViewOrderTracker,
}: CartCheckoutDrawerProps) {
  const [step, setStep] = useState<'cart' | 'checkout' | 'confirmed'>(
    initialStep
  );
  const [selectedCheckoutStoreId, setSelectedCheckoutStoreId] = useState<
    string | null
  >(null);

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  // Customer Delivery Fields
  const [fullName, setFullName] = useState('Anil Kadam');
  const [phone, setPhone] = useState('+91 98204 51290');
  const [country, setCountry] = useState(customerLocation.country || 'India');
  const [stateRegion, setStateRegion] = useState(
    customerLocation.stateRegion || 'Maharashtra'
  );
  const [city, setCity] = useState(customerLocation.city || 'Mumbai');
  const [locality, setLocality] = useState(
    customerLocation.locality || 'Bandra West'
  );
  const [address, setAddress] = useState(
    '402 Sea Breeze Apartments, 16th Road'
  );
  const [postalCode, setPostalCode] = useState(
    customerLocation.postalCode || '400050'
  );
  const [notes, setNotes] = useState('Call on intercom #402 upon arrival');
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('UPI_ON_DELIVERY');
  const [upiId, setUpiId] = useState('anilkadam@okicici');
  const [termsAcknowledged, setTermsAcknowledged] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(
    null
  );

  // Group items by store for strict multi-merchant separation
  const itemsByStore = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    for (const item of items) {
      const storeId = item.product.storeId;
      const list = map.get(storeId) || [];
      list.push(item);
      map.set(storeId, list);
    }
    return map;
  }, [items]);

  const uniqueStoreIds = useMemo(
    () => Array.from(itemsByStore.keys()),
    [itemsByStore]
  );

  // Active store being checked out: if not explicitly selected, pick first store
  const activeStoreId =
    selectedCheckoutStoreId || uniqueStoreIds[0] || null;

  const activeStore = useMemo(() => {
    if (!activeStoreId) return null;
    return stores.find((s) => s.id === activeStoreId) || null;
  }, [stores, activeStoreId]);

  // Filter items for the active checkout store
  const checkoutItems = useMemo(() => {
    if (!activeStoreId) return items;
    return itemsByStore.get(activeStoreId) || [];
  }, [itemsByStore, activeStoreId, items]);

  if (!isOpen) return null;

  const subtotal = checkoutItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const freeThreshold =
    activeStore?.serviceArea?.freeDeliveryAbove &&
    activeStore.serviceArea.freeDeliveryAbove > 0
      ? activeStore.serviceArea.freeDeliveryAbove
      : FREE_DELIVERY_THRESHOLD;

  const standardDeliveryFee =
    activeStore?.serviceArea?.sellerDeliveryFee &&
    activeStore.serviceArea.sellerDeliveryFee > 0
      ? activeStore.serviceArea.sellerDeliveryFee
      : 25;

  const deliveryFee =
    subtotal === 0 ? 0 : subtotal >= freeThreshold ? 0 : standardDeliveryFee;

  const discount =
    appliedPromo === 'URBAN10' ? Math.round(subtotal * 0.1) : 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const remainingForFreeDelivery = Math.max(0, freeThreshold - subtotal);

  const enteredLocationCheck: CustomerShoppingLocation = {
    mode: 'SELECTED_LOCATION',
    country,
    stateRegion,
    city,
    locality,
    postalCode,
  };

  const isStoreDeliverable = activeStore
    ? evaluateStoreDeliveryEligibility(activeStore, enteredLocationCheck)
        .isDeliverable
    : true;

  // Check if any items in the active checkout store are out of stock or exceed stock
  const hasOutOfStockItems = checkoutItems.some(
    (i) => !i.product.isAvailable || i.product.stock <= 0
  );

  const hasExceededStockItems = checkoutItems.some(
    (i) => i.quantity > i.product.stock
  );

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = promoInput.trim().toUpperCase();
    if (cleaned === 'URBAN10') {
      setAppliedPromo('URBAN10');
      setPromoMessage('Discount code URBAN10 applied (10% off).');
    } else {
      setPromoMessage('Check this code and try again. Try URBAN10 for 10% off.');
    }
  };

  const handleAlignAddressWithStore = () => {
    if (!activeStore) return;
    setCountry(activeStore.country);
    setStateRegion(activeStore.stateRegion);
    setCity(activeStore.cityName);
    setLocality(
      activeStore.serviceArea.coveredLocalities[0] || activeStore.neighborhood
    );
    setAddress(`12 Main Street, ${activeStore.neighborhood}`);
    setPostalCode(activeStore.postalCode || postalCode);
    setFormError(null);
  };

  const handleStartCheckoutForStore = (storeId: string) => {
    setSelectedCheckoutStoreId(storeId);
    setStep('checkout');
    setFormError(null);
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !fullName.trim() ||
      !phone.trim() ||
      !country.trim() ||
      !city.trim() ||
      !locality.trim() ||
      !address.trim() ||
      !postalCode.trim()
    ) {
      setFormError(
        'Please fill in your name, mobile number, and complete delivery address.'
      );
      return;
    }

    if (!activeStore) {
      setFormError('Please select a valid store for checkout.');
      return;
    }

    if (!isStoreDeliverable) {
      setFormError(
        `${activeStore.name} does not deliver to ${locality}, ${city}. Please enter an address inside the store's delivery coverage or click "Use store's delivery area".`
      );
      return;
    }

    if (hasOutOfStockItems) {
      setFormError(
        'One or more items in your cart are currently out of stock. Please remove them to proceed.'
      );
      return;
    }

    if (hasExceededStockItems) {
      setFormError(
        'One or more items have quantities exceeding current stock. Please adjust quantities to proceed.'
      );
      return;
    }

    if (!termsAcknowledged) {
      setFormError(
        'Please acknowledge the seller responsibility terms before placing your order.'
      );
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    // Client-side idempotency key based on timestamp and randomness
    const idempotencyKey = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    try {
      const payload = {
        storeId: activeStore.id,
        storeData: activeStore,
        items: checkoutItems.map((item) => ({
          productId: item.product.id,
          productData: item.product,
          variant: item.variant,
          quantity: item.quantity,
        })),
        customer: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          country: country.trim(),
          stateRegion: stateRegion.trim(),
          city: city.trim(),
          locality: locality.trim(),
          address: address.trim(),
          postalCode: postalCode.trim(),
          notes: notes.trim(),
        },
        paymentMethod,
        upiId: paymentMethod === 'UPI_ON_DELIVERY' ? upiId.trim() : undefined,
        promoCode: appliedPromo || undefined,
        idempotencyKey,
        buyerUid: buyerUid || undefined,
        termsAcknowledged: true,
        termsVersion: '2026-v1.2',
        termsDocumentId: 'terms-of-service-v1.2',
        checkoutAcknowledgementVersion: 'seller-responsibility-v1.2',
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setFormError(data.error || 'Failed to place order. Please check your details and try again.');
        setIsSubmitting(false);
        return;
      }

      const verifiedOrder = data.order as OrderRecord;
      setConfirmedOrder(verifiedOrder);
      onPlaceOrder(verifiedOrder);

      // Remove the ordered items from the multi-merchant cart
      for (const item of checkoutItems) {
        onRemoveItem(item.product.id, item.variant);
      }

      setStep('confirmed');
    } catch {
      setFormError('Network error while placing order. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-[2px] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping cart and checkout"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#FAF9F6] h-full flex flex-col justify-between border-l border-stone-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Drawer Header */}
        <div className="px-6 py-4 bg-white border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step === 'checkout' && (
              <button
                type="button"
                onClick={() => setStep('cart')}
                className="p-1.5 -ml-1.5 text-stone-600 hover:text-stone-900 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
                aria-label="Back to cart"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-base font-semibold text-stone-900">
                {step === 'cart' && 'Your shopping cart'}
                {step === 'checkout' && `Checkout · ${activeStore?.name || 'Local Store'}`}
                {step === 'confirmed' && `Order #${confirmedOrder?.id} confirmed`}
              </h2>
              <p className="text-xs text-stone-500">
                {step === 'cart' &&
                  (uniqueStoreIds.length > 1
                    ? `Items from ${uniqueStoreIds.length} local stores (separate suborders)`
                    : 'Review your items before proceeding')}
                {step === 'checkout' &&
                  'Pay at door upon delivery · Verified merchant order'}
                {step === 'confirmed' &&
                  'The store has received and confirmed your order'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="p-2 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Free Delivery Progress Bar (per active store) */}
        {step !== 'confirmed' && checkoutItems.length > 0 && activeStore && (
          <div className="px-6 py-3 bg-[#F3F1EC] border-b border-stone-200">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-stone-700 font-medium">
                {remainingForFreeDelivery === 0
                  ? `Free local delivery from ${activeStore.name}!`
                  : `Add ${formatCurrency(remainingForFreeDelivery)} more for free delivery from ${activeStore.name}`}
              </span>
              <span className="font-mono tabular-nums text-stone-500">
                {formatCurrency(Math.min(subtotal, freeThreshold))} /{' '}
                {formatCurrency(freeThreshold)}
              </span>
            </div>
            <div className="w-full h-1.5 bg-stone-300/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-stone-900 transition-transform duration-200 origin-left"
                style={{
                  transform: `scaleX(${Math.min(1, subtotal / freeThreshold)})`,
                }}
              />
            </div>
          </div>
        )}

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'confirmed' && confirmedOrder ? (
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-white border border-stone-200 space-y-3">
                <div className="flex items-center gap-2.5 text-stone-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span className="text-sm font-semibold">
                    Order placed successfully (#{confirmedOrder.id})
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  <strong>{confirmedOrder.storeName}</strong> has received your
                  order. Your items are being prepared for delivery to{' '}
                  <strong>
                    {confirmedOrder.customer.locality},{' '}
                    {confirmedOrder.customer.city}
                  </strong>
                  .
                </p>
                <div className="pt-2 border-t border-stone-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                  <span>Ordered at {confirmedOrder.createdAt}</span>
                  <span>·</span>
                  <span>
                    Payment:{' '}
                    {confirmedOrder.paymentMethod === 'UPI_ON_DELIVERY'
                      ? `UPI on delivery (${confirmedOrder.upiId || 'Scan QR at door'})`
                      : confirmedOrder.paymentMethod === 'CASH_ON_DELIVERY'
                        ? 'Cash on delivery'
                        : 'Card tap on delivery'}
                  </span>
                </div>
              </div>

              {/* Delivery Recipient Details */}
              <div className="p-5 rounded-xl bg-white border border-stone-200 space-y-2 text-xs">
                <div className="font-semibold text-stone-900 text-sm">
                  Delivery address
                </div>
                <div className="text-stone-700">
                  {confirmedOrder.customer.fullName} ·{' '}
                  <span className="font-mono tabular-nums">
                    {confirmedOrder.customer.phone}
                  </span>
                </div>
                <div className="text-stone-600">
                  {confirmedOrder.customer.address},{' '}
                  {confirmedOrder.customer.locality},{' '}
                  {confirmedOrder.customer.city},{' '}
                  {confirmedOrder.customer.stateRegion},{' '}
                  {confirmedOrder.customer.country} —{' '}
                  <span className="font-mono tabular-nums">
                    {confirmedOrder.customer.postalCode}
                  </span>
                </div>
                {confirmedOrder.customer.notes && (
                  <div className="text-stone-500 pt-1">
                    Delivery note: {confirmedOrder.customer.notes}
                  </div>
                )}
              </div>

              {/* Itemized Receipt Summary */}
              <div className="p-5 rounded-xl bg-white border border-stone-200 space-y-3">
                <div className="text-sm font-semibold text-stone-900">
                  Order summary
                </div>
                <div className="divide-y divide-stone-100">
                  {confirmedOrder.items.map((item) => (
                    <div
                      key={`${item.product.id}-${item.variant}`}
                      className="py-2.5 flex items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <div className="font-medium text-stone-900">
                          {item.quantity}× {item.product.name}
                        </div>
                        <div className="text-stone-500">
                          {item.variant} · {item.product.storeName}
                        </div>
                      </div>
                      <div className="font-mono tabular-nums font-medium text-stone-900">
                        {formatCurrency(
                          item.product.price * item.quantity,
                          item.product.currency
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-stone-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>Items total</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(confirmedOrder.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Delivery charge</span>
                    <span className="font-mono tabular-nums">
                      {confirmedOrder.deliveryFee === 0
                        ? 'Free'
                        : formatCurrency(confirmedOrder.deliveryFee)}
                    </span>
                  </div>
                  {confirmedOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount (URBAN10)</span>
                      <span className="font-mono tabular-nums">
                        -{formatCurrency(confirmedOrder.discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold text-stone-900 pt-2 border-t border-stone-200">
                    <span>Total to pay on delivery</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(confirmedOrder.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-12 h-12 rounded-full bg-stone-200/70 flex items-center justify-center text-stone-600 mb-4">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-stone-900">
                Your cart is empty.
              </h3>
              <p className="mt-1 text-xs text-stone-500 max-w-xs">
                Browse nearby stores in your city and add products to start an
                order.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              >
                Start shopping
              </button>
            </div>
          ) : step === 'cart' ? (
            /* Multi-Merchant Grouped Cart View */
            <div className="space-y-6">
              {uniqueStoreIds.map((storeId) => {
                const storeItems = itemsByStore.get(storeId) || [];
                const storeInfo = stores.find((s) => s.id === storeId);
                const storeSubtotal = storeItems.reduce(
                  (sum, i) => sum + i.product.price * i.quantity,
                  0
                );
                const storeFreeThresh =
                  storeInfo?.serviceArea?.freeDeliveryAbove || FREE_DELIVERY_THRESHOLD;
                const storeDelivFee =
                  storeSubtotal >= storeFreeThresh
                    ? 0
                    : storeInfo?.serviceArea?.sellerDeliveryFee || 25;
                const storeEligibility = storeInfo
                  ? evaluateStoreDeliveryEligibility(storeInfo, customerLocation)
                  : {isDeliverable: true, statusLabel: ''};

                return (
                  <div
                    key={storeId}
                    className="p-4 rounded-xl bg-white border border-stone-200 space-y-4"
                  >
                    {/* Store Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                      <div className="flex items-center gap-2">
                        <StoreIcon className="w-4 h-4 text-stone-700" />
                        <div>
                          <span className="text-xs font-bold text-stone-900">
                            {storeInfo?.name || storeItems[0].product.storeName}
                          </span>
                          <span className="text-[11px] text-stone-500 ml-1.5">
                            · {storeInfo?.cityName || storeItems[0].product.city}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-semibold font-mono tabular-nums text-stone-900">
                        {formatCurrency(storeSubtotal)}
                      </span>
                    </div>

                    {!storeEligibility.isDeliverable && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                        <span>
                          Does not deliver to {customerLocation.city}. Check coverage below.
                        </span>
                      </div>
                    )}

                    {/* Store Items List */}
                    <div className="space-y-3">
                      {storeItems.map((item) => {
                        const inStock =
                          item.product.isAvailable && item.product.stock > 0;
                        const isAtMaxStock = item.quantity >= item.product.stock;

                        return (
                          <div
                            key={`${item.product.id}-${item.variant}`}
                            className="flex gap-3 text-xs"
                          >
                            <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-stone-200/60 bg-[#F3EFEA]">
                              <ProductStudioArtwork
                                preset={item.product.artworkPreset}
                                customImageUrl={item.product.customImageUrl}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="font-semibold text-stone-900 truncate">
                                  {item.product.name}
                                </h4>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onRemoveItem(item.product.id, item.variant)
                                  }
                                  aria-label={`Remove ${item.product.name}`}
                                  className="text-stone-400 hover:text-stone-700 p-0.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="text-stone-500 text-[11px] mt-0.5">
                                {item.variant}
                              </div>

                              {!inStock ? (
                                <div className="text-[11px] font-medium text-red-600 mt-1">
                                  Out of stock at store
                                </div>
                              ) : (
                                <div className="text-[10px] text-stone-400 mt-0.5">
                                  Stock: {item.product.stock} available
                                </div>
                              )}

                              <div className="mt-2 flex items-center justify-between">
                                <div className="inline-flex items-center border border-stone-300 rounded-md bg-[#FAF9F6]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateQuantity(
                                        item.product.id,
                                        item.variant,
                                        -1
                                      )
                                    }
                                    aria-label="Decrease quantity"
                                    className="p-1 text-stone-600 hover:text-stone-900 cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="px-2 text-xs font-mono tabular-nums font-medium text-stone-900">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={!inStock || isAtMaxStock}
                                    onClick={() =>
                                      onUpdateQuantity(
                                        item.product.id,
                                        item.variant,
                                        1
                                      )
                                    }
                                    aria-label="Increase quantity"
                                    className="p-1 text-stone-600 hover:text-stone-900 disabled:opacity-30 cursor-pointer"
                                    title={
                                      isAtMaxStock
                                        ? `Max available stock: ${item.product.stock}`
                                        : undefined
                                    }
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="font-semibold font-mono tabular-nums text-stone-900">
                                  {formatCurrency(
                                    item.product.price * item.quantity,
                                    item.product.currency
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Store Suborder Action */}
                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
                      <div className="text-[11px] text-stone-500">
                        Delivery:{' '}
                        {storeDelivFee === 0 ? 'Free' : formatCurrency(storeDelivFee)}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartCheckoutForStore(storeId)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>Checkout this order</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Promo Code Input */}
              <form onSubmit={handleApplyPromo} className="pt-2">
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Discount code (Optional — try{' '}
                  <span className="font-mono">URBAN10</span>)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="Enter discount code"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 font-mono uppercase"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium text-stone-900 bg-stone-200/80 hover:bg-stone-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
                {promoMessage && (
                  <p className="mt-1.5 text-xs text-stone-600">
                    {promoMessage}
                  </p>
                )}
              </form>
            </div>
          ) : (
            /* Step 2: Checkout Form for Active Store */
            <form
              id="order-checkout-form"
              onSubmit={handleConfirmOrder}
              className="space-y-5"
            >
              {/* Selected Store Indicator */}
              {activeStore && (
                <div className="p-3.5 rounded-xl bg-white border border-stone-200 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-stone-900">
                      Ordering from {activeStore.name}
                    </span>
                    <p className="text-stone-500 text-[11px] mt-0.5">
                      {checkoutItems.length} item(s) · {activeStore.cityName}
                    </p>
                  </div>
                  {uniqueStoreIds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setStep('cart')}
                      className="text-stone-700 underline text-xs"
                    >
                      Change store
                    </button>
                  )}
                </div>
              )}

              {/* Service Area Warning */}
              {activeStore && !isStoreDeliverable && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
                  <div className="flex items-start gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      {activeStore.name} does not deliver to {locality}, {city}
                    </span>
                  </div>
                  <p className="text-amber-800 leading-relaxed text-[11px]">
                    This merchant delivers within {activeStore.cityName} (
                    {activeStore.serviceArea.coveredLocalities.join(', ')}).
                  </p>
                  <button
                    type="button"
                    onClick={handleAlignAddressWithStore}
                    className="px-3 py-1.5 bg-amber-900 text-white rounded-md text-xs font-medium hover:bg-amber-800 transition-colors cursor-pointer"
                  >
                    Use store&apos;s delivery area
                  </button>
                </div>
              )}

              {/* Payment Method Selection */}
              <div>
                <div className="text-xs font-semibold text-stone-900 mb-2.5">
                  1. Payment method (Pay on delivery)
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI_ON_DELIVERY')}
                    className={`p-3.5 rounded-xl border text-left transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                      paymentMethod === 'UPI_ON_DELIVERY'
                        ? 'border-stone-900 bg-white shadow-xs'
                        : 'border-stone-200 bg-white/60 hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <QrCode className="w-4 h-4 text-stone-900 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-stone-900">
                          UPI or QR code on delivery
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          Scan the delivery person&apos;s QR code when your
                          order arrives
                        </div>
                      </div>
                    </div>
                  </button>

                  {paymentMethod === 'UPI_ON_DELIVERY' && (
                    <div className="px-3.5 py-2.5 rounded-lg bg-[#F3F1EC] border border-stone-200">
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Your UPI ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="example: yourname@okicici"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-md font-mono focus:outline-none focus:border-stone-900"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH_ON_DELIVERY')}
                    className={`p-3.5 rounded-xl border text-left transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                      paymentMethod === 'CASH_ON_DELIVERY'
                        ? 'border-stone-900 bg-white shadow-xs'
                        : 'border-stone-200 bg-white/60 hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Banknote className="w-4 h-4 text-stone-900 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-stone-900">
                          Cash on delivery
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          Pay with cash when you receive your order at your door
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('TAP_ON_DELIVERY')}
                    className={`p-3.5 rounded-xl border text-left transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                      paymentMethod === 'TAP_ON_DELIVERY'
                        ? 'border-stone-900 bg-white shadow-xs'
                        : 'border-stone-200 bg-white/60 hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Smartphone className="w-4 h-4 text-stone-900 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-stone-900">
                          Card tap on delivery
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          Tap your debit/credit card or smartphone POS machine
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Customer Delivery Address Form */}
              <div className="pt-2 border-t border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-900">
                    2. Delivery address
                  </span>
                  <button
                    type="button"
                    onClick={handleAlignAddressWithStore}
                    className="text-xs text-stone-600 underline hover:text-stone-900 cursor-pointer"
                  >
                    Use store&apos;s delivery area
                  </button>
                </div>

                {formError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Full name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Mobile number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98204 51290"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg font-mono focus:outline-none focus:border-stone-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Country *
                    </label>
                    <input
                      type="text"
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      State / Region *
                    </label>
                    <input
                      type="text"
                      required
                      value={stateRegion}
                      onChange={(e) => setStateRegion(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      City / Town *
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Locality / Area *
                    </label>
                    <input
                      type="text"
                      required
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Postal code *
                    </label>
                    <input
                      type="text"
                      required
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg font-mono focus:outline-none focus:border-stone-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Street address, flat / building number *
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Delivery notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Example: Call on mobile at gate or ring bell #402"
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                  />
                </div>

                {/* Mandatory Seller Responsibility & Terms Acknowledgement */}
                <div className="pt-3 border-t border-stone-200">
                  <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2 text-xs">
                    <label htmlFor="checkout-terms-checkbox" className="flex items-start gap-2.5 cursor-pointer text-stone-800 leading-relaxed">
                      <input
                        type="checkbox"
                        id="checkout-terms-checkbox"
                        required
                        checked={termsAcknowledged}
                        onChange={(e) => {
                          setTermsAcknowledged(e.target.checked);
                          if (e.target.checked) setFormError(null);
                        }}
                        className="mt-1 w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 shrink-0 cursor-pointer"
                      />
                      <span className="text-[11px] sm:text-xs text-stone-700">
                        I understand that Citykart connects buyers with independent sellers. The seller is responsible for accepting and processing my order, product accuracy and quality, packaging, fulfillment and delivery, and handling applicable order-related cancellations, returns and refunds. I understand that Citykart is a marketplace platform and is not ordinarily responsible for the seller&apos;s fulfillment or delivery obligations, subject to applicable law and Citykart&apos;s published policies.{' '}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-stone-900 font-bold hover:text-emerald-800"
                        >
                          Terms of Service
                        </a>{' '}
                        ·{' '}
                        <a
                          href="/delivery-returns"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-stone-900 font-bold hover:text-emerald-800"
                        >
                          Cancellation & Refund Policy
                        </a>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Sticky Drawer Footer */}
        {step === 'confirmed' && confirmedOrder ? (
          <div className="p-6 bg-white border-t border-stone-200 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onViewOrderTracker(confirmedOrder.id);
                onClose();
              }}
              className="flex-1 py-3 px-4 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>View order status (#{confirmedOrder.id})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('cart');
                onClose();
              }}
              className="py-3 px-4 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-800 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Continue shopping
            </button>
          </div>
        ) : items.length > 0 ? (
          <div className="p-6 bg-white border-t border-stone-200 space-y-4">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>
                  Items total ({step === 'checkout' ? activeStore?.name : `${items.length} items`})
                </span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Delivery charge</span>
                <span className="font-mono tabular-nums">
                  {deliveryFee === 0
                    ? `Free (${formatCurrency(0)})`
                    : formatCurrency(deliveryFee)}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Discount (URBAN10)</span>
                  <span className="font-mono tabular-nums">
                    -{formatCurrency(discount)}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline text-sm font-semibold text-stone-900">
                <span>Total to pay on delivery</span>
                <span className="text-base font-mono tabular-nums">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {step === 'cart' ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedCheckoutStoreId(uniqueStoreIds[0] || null);
                  setStep('checkout');
                }}
                className="w-full py-3 px-5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Continue to checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                form="order-checkout-form"
                disabled={isSubmitting || hasOutOfStockItems || hasExceededStockItems}
                className="w-full py-3 px-5 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying and placing order...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      Place order · Pay {formatCurrency(total)} on delivery
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
