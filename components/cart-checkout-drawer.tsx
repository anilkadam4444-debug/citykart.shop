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
  MapPin,
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
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping cart and checkout"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#F8FAFC] h-full flex flex-col justify-between border-l border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Drawer Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step === 'checkout' && (
              <button
                type="button"
                onClick={() => setStep('cart')}
                className="p-1.5 -ml-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back to cart"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {step === 'cart' && 'Your Shopping Cart'}
                {step === 'checkout' && `Checkout · ${activeStore?.name || 'Local Store'}`}
                {step === 'confirmed' && `Order #${confirmedOrder?.id} Confirmed`}
              </h2>
              <p className="text-xs text-slate-500">
                {step === 'cart' &&
                  (uniqueStoreIds.length > 1
                    ? `Items from ${uniqueStoreIds.length} local stores (separate store orders)`
                    : 'Review your neighborhood store items before checkout')}
                {step === 'checkout' &&
                  'Pay at door upon delivery · Direct local merchant fulfillment'}
                {step === 'confirmed' &&
                  'The neighborhood store has received and confirmed your order'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Free Delivery Progress Bar (per active store) */}
        {step !== 'confirmed' && checkoutItems.length > 0 && activeStore && (
          <div className="px-6 py-3 bg-blue-50/70 border-b border-blue-200/60">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-800 font-semibold">
                {remainingForFreeDelivery === 0
                  ? `Free local delivery unlocked from ${activeStore.name}!`
                  : `Add ${formatCurrency(remainingForFreeDelivery)} more for free delivery from ${activeStore.name}`}
              </span>
              <span className="font-mono tabular-nums font-semibold text-[#003B8E]">
                {formatCurrency(Math.min(subtotal, freeThreshold))} /{' '}
                {formatCurrency(freeThreshold)}
              </span>
            </div>
            <div className="w-full h-1.5 bg-blue-200/70 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#003B8E] transition-transform duration-200 origin-left"
                style={{
                  transform: `scaleX(${Math.min(1, subtotal / freeThreshold)})`,
                }}
              />
            </div>
          </div>
        )}

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
          {step === 'confirmed' && confirmedOrder ? (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2.5 text-slate-900">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <span className="text-sm font-bold block">
                      Order placed successfully (#{confirmedOrder.id})
                    </span>
                    <span className="text-[11px] text-emerald-700 font-semibold">
                      Direct Store Dispatch Active
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-900">{confirmedOrder.storeName}</strong> has received your
                  order. Your items are being prepared for delivery to{' '}
                  <strong className="text-slate-900">
                    {confirmedOrder.customer.locality},{' '}
                    {confirmedOrder.customer.city}
                  </strong>
                  .
                </p>
                <div className="pt-2.5 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Ordered at {confirmedOrder.createdAt}</span>
                  <span>·</span>
                  <span className="font-medium text-slate-700">
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
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2 text-xs shadow-2xs">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#003B8E]" />
                  <span>Delivery Address</span>
                </div>
                <div className="text-slate-800 font-semibold">
                  {confirmedOrder.customer.fullName} ·{' '}
                  <span className="font-mono tabular-nums text-slate-600">
                    {confirmedOrder.customer.phone}
                  </span>
                </div>
                <div className="text-slate-600 leading-relaxed">
                  {confirmedOrder.customer.address},{' '}
                  {confirmedOrder.customer.locality},{' '}
                  {confirmedOrder.customer.city},{' '}
                  {confirmedOrder.customer.stateRegion},{' '}
                  {confirmedOrder.customer.country} —{' '}
                  <span className="font-mono tabular-nums font-medium text-slate-800">
                    {confirmedOrder.customer.postalCode}
                  </span>
                </div>
                {confirmedOrder.customer.notes && (
                  <div className="text-slate-500 pt-1 italic">
                    Note: {confirmedOrder.customer.notes}
                  </div>
                )}
              </div>

              {/* Itemized Receipt Summary */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-2xs">
                <div className="text-sm font-bold text-slate-900">
                  Order Summary
                </div>
                <div className="divide-y divide-slate-100">
                  {confirmedOrder.items.map((item) => (
                    <div
                      key={`${item.product.id}-${item.variant}`}
                      className="py-2.5 flex items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {item.quantity}× {item.product.name}
                        </div>
                        <div className="text-slate-500">
                          {item.variant} · {item.product.storeName}
                        </div>
                      </div>
                      <div className="font-mono tabular-nums font-semibold text-slate-900">
                        {formatCurrency(
                          item.product.price * item.quantity,
                          item.product.currency
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Items total</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(confirmedOrder.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery charge</span>
                    <span className="font-mono tabular-nums">
                      {confirmedOrder.deliveryFee === 0
                        ? 'Free'
                        : formatCurrency(confirmedOrder.deliveryFee)}
                    </span>
                  </div>
                  {confirmedOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Discount (URBAN10)</span>
                      <span className="font-mono tabular-nums">
                        -{formatCurrency(confirmedOrder.discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total to pay on delivery</span>
                    <span className="font-mono tabular-nums text-[#003B8E]">
                      {formatCurrency(confirmedOrder.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#003B8E] mb-4">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Your shopping cart is empty
              </h3>
              <p className="mt-1.5 text-xs text-slate-500 max-w-xs leading-relaxed">
                Explore verified local stores in your city and add daily essentials or neighborhood specialties to start an order.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 px-5 py-2.5 text-xs font-bold text-white bg-[#F96302] hover:bg-[#E05500] rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Explore Local Products
              </button>
            </div>
          ) : step === 'cart' ? (
            /* Multi-Merchant Grouped Cart View */
            <div className="space-y-5">
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
                    className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4"
                  >
                    {/* Store Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#003B8E] shrink-0">
                          <StoreIcon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            {storeInfo?.name || storeItems[0].product.storeName}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {storeInfo?.neighborhood ? `${storeInfo.neighborhood}, ` : ''}
                            {storeInfo?.cityName || storeItems[0].product.city}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono tabular-nums text-slate-900">
                        {formatCurrency(storeSubtotal)}
                      </span>
                    </div>

                    {!storeEligibility.isDeliverable && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                        <span>
                          Does not deliver to {customerLocation.city}. Check coverage below.
                        </span>
                      </div>
                    )}

                    {/* Store Items List */}
                    <div className="space-y-3.5">
                      {storeItems.map((item) => {
                        const inStock =
                          item.product.isAvailable && item.product.stock > 0;
                        const isAtMaxStock = item.quantity >= item.product.stock;

                        return (
                          <div
                            key={`${item.product.id}-${item.variant}`}
                            className="flex gap-3 text-xs"
                          >
                            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-slate-100">
                              <ProductStudioArtwork
                                preset={item.product.artworkPreset}
                                customImageUrl={item.product.customImageUrl}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="font-semibold text-slate-900 truncate">
                                  {item.product.name}
                                </h4>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onRemoveItem(item.product.id, item.variant)
                                  }
                                  aria-label={`Remove ${item.product.name}`}
                                  className="text-slate-400 hover:text-red-600 p-0.5 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="text-slate-500 text-[11px] mt-0.5">
                                {item.variant}
                              </div>

                              {!inStock ? (
                                <div className="text-[11px] font-semibold text-red-600 mt-1">
                                  Out of stock at store
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Stock: {item.product.stock} available
                                </div>
                              )}

                              <div className="mt-2 flex items-center justify-between">
                                <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
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
                                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-l-lg cursor-pointer transition-colors"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="px-2.5 text-xs font-mono tabular-nums font-bold text-slate-900">
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
                                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-r-lg disabled:opacity-30 cursor-pointer transition-colors"
                                    title={
                                      isAtMaxStock
                                        ? `Max available stock: ${item.product.stock}`
                                        : undefined
                                    }
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="font-bold font-mono tabular-nums text-slate-900">
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
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div className="text-[11px] font-medium text-slate-600">
                        Delivery:{' '}
                        <span className={storeDelivFee === 0 ? 'text-emerald-700 font-semibold' : 'font-mono tabular-nums'}>
                          {storeDelivFee === 0 ? 'Free' : formatCurrency(storeDelivFee)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartCheckoutForStore(storeId)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#003B8E] hover:bg-[#002D6E] rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <span>Checkout this store</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Promo Code Input */}
              <form onSubmit={handleApplyPromo} className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Discount code (Optional — try{' '}
                  <span className="font-mono font-bold text-[#003B8E]">URBAN10</span>)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="Enter discount code"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E] font-mono uppercase"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-200/80 hover:bg-slate-300 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
                {promoMessage && (
                  <p className="mt-1.5 text-xs font-medium text-[#003B8E]">
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
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#003B8E] shrink-0">
                      <StoreIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">
                        Ordering from {activeStore.name}
                      </span>
                      <p className="text-slate-500 text-[11px]">
                        {checkoutItems.length} item(s) · {activeStore.neighborhood}, {activeStore.cityName}
                      </p>
                    </div>
                  </div>
                  {uniqueStoreIds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setStep('cart')}
                      className="text-[#003B8E] font-semibold underline text-xs cursor-pointer"
                    >
                      Switch store
                    </button>
                  )}
                </div>
              )}

              {/* Service Area Warning */}
              {activeStore && !isStoreDeliverable && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2.5">
                  <div className="flex items-start gap-2 font-bold">
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
                    className="px-3.5 py-1.5 bg-amber-900 text-white rounded-lg text-xs font-semibold hover:bg-amber-800 transition-colors cursor-pointer"
                  >
                    Use store&apos;s delivery area
                  </button>
                </div>
              )}

              {/* Payment Method Selection */}
              <div>
                <div className="text-xs font-bold text-slate-900 mb-2.5">
                  1. Payment Method (Pay on Delivery)
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI_ON_DELIVERY')}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer ${
                      paymentMethod === 'UPI_ON_DELIVERY'
                        ? 'border-[#003B8E] bg-blue-50/40 ring-1 ring-[#003B8E] shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <QrCode className="w-4 h-4 text-[#003B8E] mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          UPI or QR Code on Delivery
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Scan the store delivery person&apos;s QR code when your order arrives
                        </div>
                      </div>
                    </div>
                  </button>

                  {paymentMethod === 'UPI_ON_DELIVERY' && (
                    <div className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Your UPI ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="example: yourname@okicici"
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-[#003B8E] focus:bg-white"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH_ON_DELIVERY')}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer ${
                      paymentMethod === 'CASH_ON_DELIVERY'
                        ? 'border-[#003B8E] bg-blue-50/40 ring-1 ring-[#003B8E] shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Banknote className="w-4 h-4 text-[#003B8E] mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Cash on Delivery
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Pay with cash when you receive your order at your doorstep
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('TAP_ON_DELIVERY')}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer ${
                      paymentMethod === 'TAP_ON_DELIVERY'
                        ? 'border-[#003B8E] bg-blue-50/40 ring-1 ring-[#003B8E] shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Smartphone className="w-4 h-4 text-[#003B8E] mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Card Tap on Delivery
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Tap your debit/credit card or smartphone POS machine
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Customer Delivery Address Form */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    2. Delivery Address
                  </span>
                  <button
                    type="button"
                    onClick={handleAlignAddressWithStore}
                    className="text-xs font-semibold text-[#003B8E] underline hover:text-[#002D6E] cursor-pointer"
                  >
                    Use store&apos;s delivery area
                  </button>
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mobile number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98204 51290"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono focus:outline-none focus:border-[#003B8E]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Country *
                    </label>
                    <input
                      type="text"
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      State / Region *
                    </label>
                    <input
                      type="text"
                      required
                      value={stateRegion}
                      onChange={(e) => setStateRegion(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      City / Town *
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Locality / Area *
                    </label>
                    <input
                      type="text"
                      required
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Postal code *
                    </label>
                    <input
                      type="text"
                      required
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono focus:outline-none focus:border-[#003B8E]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Street address, flat / building number *
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Delivery notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Example: Call on mobile at gate or ring bell #402"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#003B8E]"
                  />
                </div>

                {/* Mandatory Seller Responsibility & Terms Acknowledgement */}
                <div className="pt-3 border-t border-slate-200">
                  <div className="p-3.5 rounded-xl bg-slate-100/90 border border-slate-200/90 space-y-2 text-xs">
                    <label htmlFor="checkout-terms-checkbox" className="flex items-start gap-2.5 cursor-pointer text-slate-800 leading-relaxed">
                      <input
                        type="checkbox"
                        id="checkout-terms-checkbox"
                        required
                        checked={termsAcknowledged}
                        onChange={(e) => {
                          setTermsAcknowledged(e.target.checked);
                          if (e.target.checked) setFormError(null);
                        }}
                        className="mt-1 w-4 h-4 rounded border-slate-300 text-[#003B8E] focus:ring-[#003B8E] shrink-0 cursor-pointer"
                      />
                      <span className="text-[11px] sm:text-xs text-slate-600">
                        I understand that Citykart connects buyers with independent sellers. The seller is responsible for accepting and processing my order, product accuracy and quality, packaging, fulfillment and delivery, and handling applicable order-related cancellations, returns and refunds. I understand that Citykart is a marketplace platform and is not ordinarily responsible for the seller&apos;s fulfillment or delivery obligations, subject to applicable law and Citykart&apos;s published policies.{' '}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-[#003B8E] font-bold hover:text-[#002D6E]"
                        >
                          Terms of Service
                        </a>{' '}
                        ·{' '}
                        <a
                          href="/delivery-returns"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-[#003B8E] font-bold hover:text-[#002D6E]"
                        >
                          Cancellation &amp; Refund Policy
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
          <div className="p-6 bg-white border-t border-slate-200 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onViewOrderTracker(confirmedOrder.id);
                onClose();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <span>Track Live Order (#{confirmedOrder.id})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('cart');
                onClose();
              }}
              className="py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        ) : items.length > 0 ? (
          <div className="p-6 bg-white border-t border-slate-200 space-y-4">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>
                  Items total ({step === 'checkout' ? activeStore?.name : `${items.length} items`})
                </span>
                <span className="font-mono tabular-nums font-medium text-slate-900">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivery charge</span>
                <span className="font-mono tabular-nums font-medium">
                  {deliveryFee === 0 ? (
                    <span className="text-emerald-700 font-semibold">Free ({formatCurrency(0)})</span>
                  ) : (
                    formatCurrency(deliveryFee)
                  )}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount (URBAN10)</span>
                  <span className="font-mono tabular-nums">
                    -{formatCurrency(discount)}
                  </span>
                </div>
              )}
              <div className="pt-2.5 border-t border-slate-200 flex justify-between items-baseline text-sm font-bold text-slate-900">
                <span>Total to pay on delivery</span>
                <span className="text-lg font-mono tabular-nums text-[#003B8E]">
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
                className="w-full py-3.5 px-5 rounded-xl bg-[#F96302] hover:bg-[#E05500] text-white text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                form="order-checkout-form"
                disabled={isSubmitting || hasOutOfStockItems || hasExceededStockItems}
                className="w-full py-3.5 px-5 rounded-xl bg-[#F96302] hover:bg-[#E05500] disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
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
                      Place Order · Pay {formatCurrency(total)} on Delivery
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
