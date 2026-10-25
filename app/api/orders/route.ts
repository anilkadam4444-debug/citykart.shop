import {NextRequest, NextResponse} from 'next/server';
import {collection, doc, getDoc, getDocs, query, where} from 'firebase/firestore';
import {db, syncOrderToFirestore} from '@/lib/firebase';
import {
  CartItem,
  evaluateStoreDeliveryEligibility,
  LocalStore,
  OrderRecord,
  OrderStatusHistoryEvent,
  PaymentMethod,
  Product,
} from '@/lib/catalog-data';
import {
  INITIAL_PRODUCTS,
  INITIAL_STORES,
} from '@/lib/initial-data';


interface CreateOrderRequestBody {
  storeId: string;
  storeData?: LocalStore;
  items: Array<{
    productId: string;
    productData?: Product;
    variant: string;
    quantity: number;
  }>;
  customer: {
    fullName: string;
    phone: string;
    country: string;
    stateRegion: string;
    city: string;
    locality: string;
    address: string;
    postalCode: string;
    notes?: string;
  };
  paymentMethod: PaymentMethod;
  upiId?: string;
  promoCode?: string;
  idempotencyKey?: string;
  buyerUid?: string;
  termsAcknowledged?: boolean;
  termsVersion?: string;
  termsDocumentId?: string;
  checkoutAcknowledgementVersion?: string;
}

// In-memory server-side registry of all current stores and products (merging catalog and demo data)
const ALL_STORES_MAP = new Map<string, LocalStore>();
for (const s of INITIAL_STORES) {
  ALL_STORES_MAP.set(s.id, s);
}

const ALL_PRODUCTS_MAP = new Map<string, Product>();
for (const p of INITIAL_PRODUCTS) {
  ALL_PRODUCTS_MAP.set(p.id, p);
}

import { serverOrdersRegistry, serverNotificationsRegistry, SellerNotification } from '@/lib/orders-registry';
import { isStoreDeletedServer, serverDeletedStoresRegistry } from '@/lib/stores-registry';
import { sendNewOrderPushNotifications } from '@/lib/server-fcm';


// In-memory idempotency cache (cleared after 15 mins)
const idempotencyCache = new Map<
  string,
  {order: OrderRecord; timestampMs: number}
>();

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateOrderRequestBody;
    const {
      storeId,
      storeData,
      items,
      customer,
      paymentMethod,
      upiId,
      promoCode,
      idempotencyKey,
      buyerUid,
      termsAcknowledged,
      termsVersion,
      termsDocumentId,
      checkoutAcknowledgementVersion,
    } = body;

    // 0. Mandatory Seller Responsibility Acknowledgement Check
    if (termsAcknowledged !== true) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Mandatory buyer acknowledgement of seller responsibility terms is required to place an order.',
        },
        {status: 400}
      );
    }

    // 1. Idempotency Check: prevent duplicate orders from rapid retries or double-clicks
    if (idempotencyKey) {
      const existing = idempotencyCache.get(idempotencyKey);
      if (existing && Date.now() - existing.timestampMs < 15 * 60 * 1000) {
        return NextResponse.json({
          ok: true,
          duplicatePrevented: true,
          order: existing.order,
          message: 'Order already received and verified (duplicate prevented).',
        });
      }
    }

    // 2. Validate Store (lookup in static catalog, request payload metadata, or Firestore)
    if (!storeId || typeof storeId !== 'string') {
      return NextResponse.json(
        {ok: false, error: 'A valid store ID is required to place an order.'},
        {status: 400}
      );
    }

    if (await isStoreDeletedServer(storeId)) {
      ALL_STORES_MAP.delete(storeId);
      return NextResponse.json(
        {
          ok: false,
          error:
            'This store has been permanently deleted and is no longer accepting orders.',
        },
        {status: 404}
      );
    }


    let store = ALL_STORES_MAP.get(storeId);

    if (!store && storeData && typeof storeData === 'object' && storeData.id === storeId) {
      store = storeData;
      ALL_STORES_MAP.set(store.id, store);
    }

    if (!store) {
      try {
        const storeSnap = await getDoc(doc(db, 'stores', storeId));
        if (storeSnap.exists()) {
          store = storeSnap.data() as LocalStore;
          ALL_STORES_MAP.set(store.id, store);
        }
      } catch {
        // Ignore Firestore lookup error
      }
    }

    if (!store) {
      return NextResponse.json(
        {ok: false, error: `Store with ID "${storeId}" could not be found.`},
        {status: 404}
      );
    }

    if (!store.isActive) {
      return NextResponse.json(
        {
          ok: false,
          error: `Store "${store.name}" is currently closed and not accepting new orders.`,
        },
        {status: 400}
      );
    }

    // 3. Validate Items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {ok: false, error: 'Order must contain at least one product.'},
        {status: 400}
      );
    }

    const verifiedItems: CartItem[] = [];
    let serverSubtotal = 0;
    let maxDeliveryMins = store.avgDispatchMins || 25;

    for (const rawItem of items) {
      let product = ALL_PRODUCTS_MAP.get(rawItem.productId);

      if (!product && rawItem.productData && typeof rawItem.productData === 'object' && rawItem.productData.id === rawItem.productId) {
        product = rawItem.productData;
        ALL_PRODUCTS_MAP.set(product.id, product);
      }

      if (!product) {
        try {
          const productSnap = await getDoc(doc(db, 'products', rawItem.productId));
          if (productSnap.exists()) {
            product = productSnap.data() as Product;
            ALL_PRODUCTS_MAP.set(product.id, product);
          }
        } catch {
          // Ignore
        }
      }
      if (!product) {
        return NextResponse.json(
          {
            ok: false,
            error: `Product with ID "${rawItem.productId}" was not found in the catalog.`,
          },
          {status: 404}
        );
      }

      // Check single-merchant rule: every item must belong to the selected store
      if (product.storeId !== store.id) {
        return NextResponse.json(
          {
            ok: false,
            error: `Product "${product.name}" belongs to store "${product.storeName}", not "${store.name}". Mixed-merchant orders are not permitted. Please submit separate orders per store.`,
          },
          {status: 400}
        );
      }

      const qty = Math.floor(Number(rawItem.quantity) || 0);
      if (qty <= 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `Invalid quantity (${qty}) specified for "${product.name}".`,
          },
          {status: 400}
        );
      }

      // Stock availability check
      if (!product.isAvailable || product.stock <= 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `"${product.name}" is currently out of stock at ${store.name}.`,
          },
          {status: 400}
        );
      }

      if (qty > product.stock) {
        return NextResponse.json(
          {
            ok: false,
            error: `Requested quantity for "${product.name}" (${qty}) exceeds available stock (${product.stock}).`,
          },
          {status: 400}
        );
      }

      if (product.deliveryMins && product.deliveryMins > maxDeliveryMins) {
        maxDeliveryMins = product.deliveryMins;
      }

      serverSubtotal += product.price * qty;
      verifiedItems.push({
        product,
        variant: rawItem.variant || product.variants[0] || 'Standard',
        quantity: qty,
      });
    }

    // 4. Validate Customer Details
    if (
      !customer ||
      !customer.fullName?.trim() ||
      !customer.phone?.trim() ||
      !customer.country?.trim() ||
      !customer.city?.trim() ||
      !customer.locality?.trim() ||
      !customer.address?.trim() ||
      !customer.postalCode?.trim()
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Customer contact information and delivery address (full name, phone, city, area/locality, street address, and postal code) are required.',
        },
        {status: 400}
      );
    }

    // 5. Validate Delivery Coverage against Store's Configured Service Area
    const customerLocation = {
      mode: 'SELECTED_LOCATION' as const,
      country: customer.country.trim(),
      stateRegion: customer.stateRegion?.trim() || '',
      city: customer.city.trim(),
      locality: customer.locality.trim(),
      postalCode: customer.postalCode.trim(),
    };

    const eligibility = evaluateStoreDeliveryEligibility(store, customerLocation);
    if (!eligibility.isDeliverable) {
      return NextResponse.json(
        {
          ok: false,
          error: `Delivery address is outside ${store.name}'s service area. ${eligibility.statusLabel} — ${eligibility.reasonDetail}`,
        },
        {status: 400}
      );
    }

    // 6. Trusted Server-Side Financials Calculation
    // Free delivery threshold: check store's configured freeDeliveryAbove, else fallback to ₹199 threshold
    const freeThreshold =
      store.serviceArea.freeDeliveryAbove > 0
        ? store.serviceArea.freeDeliveryAbove
        : 199;
    const standardFee =
      store.serviceArea.sellerDeliveryFee > 0
        ? store.serviceArea.sellerDeliveryFee
        : 25;

    const serverDeliveryFee = serverSubtotal >= freeThreshold ? 0 : standardFee;

    // Validate discount code
    let serverDiscount = 0;
    if (promoCode && promoCode.trim().toUpperCase() === 'URBAN10') {
      serverDiscount = Math.round(serverSubtotal * 0.1);
    }

    const serverTotal = Math.max(
      0,
      serverSubtotal + serverDeliveryFee - serverDiscount
    );

    // 7. Validate Payment Method (Merchant-managed payment only: UPI on delivery, COD, or Tap on delivery)
    const validMethods: PaymentMethod[] = [
      'UPI_ON_DELIVERY',
      'CASH_ON_DELIVERY',
      'TAP_ON_DELIVERY',
    ];
    if (!validMethods.includes(paymentMethod)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid payment method. Citykart supports merchant-managed UPI on Delivery, Cash on Delivery, or Card Tap on Delivery.',
        },
        {status: 400}
      );
    }

    // 8. Generate Order Record
    const orderId = `UD-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();
    const nowTimeStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const initialStatusHistory: OrderStatusHistoryEvent[] = [
      {
        status: 'NEW',
        timestamp: nowIso,
        note: `Order placed with ${store.name}. Awaiting merchant acceptance and packing.`,
        actor: 'BUYER',
      },
    ];

    const newOrder: OrderRecord = {
      id: orderId,
      createdAt: nowTimeStr,
      createdAtIso: nowIso,
      storeId: store.id,
      storeName: store.name,
      sellerId: store.sellerId,
      sellerUid: store.ownerUid || `seller-${store.sellerId}`,
      buyerUid: buyerUid || undefined,
      idempotencyKey: idempotencyKey || undefined,
      items: verifiedItems,
      subtotal: serverSubtotal,
      deliveryFee: serverDeliveryFee,
      discount: serverDiscount,
      total: serverTotal,
      paymentMethod,
      upiId: paymentMethod === 'UPI_ON_DELIVERY' ? upiId?.trim() : undefined,
      customer: {
        fullName: customer.fullName.trim(),
        phone: customer.phone.trim(),
        country: customer.country.trim(),
        stateRegion: customer.stateRegion?.trim() || store.stateRegion,
        city: customer.city.trim(),
        locality: customer.locality.trim(),
        address: customer.address.trim(),
        postalCode: customer.postalCode.trim(),
        notes: customer.notes?.trim() || '',
      },
      currentStepIndex: 0,
      orderStatus: 'NEW',
      statusHistory: initialStatusHistory,
      estimatedMins: maxDeliveryMins,
      isDemo: Boolean(store.isDemo),
      termsAcknowledged: true,
      termsVersion: termsVersion || '2026-v1.2',
      termsAcknowledgedAt: nowIso,
      termsDocumentId: termsDocumentId || 'terms-of-service-v1.2',
      checkoutAcknowledgementVersion:
        checkoutAcknowledgementVersion || 'seller-responsibility-v1.2',
    };

    // Save in server registry and persist to Firestore
    serverOrdersRegistry.set(orderId, newOrder);
    await syncOrderToFirestore(newOrder);

    // 9. Generate Seller Notification Record (In-App Order Notification)
    const newNotification: SellerNotification = {
      id: `notif-${orderId}`,
      sellerId: store.sellerId,
      sellerUid: store.ownerUid || `seller-${store.sellerId}`,
      orderId,
      title: `New Order #${orderId}`,
      message: `Received order #${orderId} for ${verifiedItems.length} item(s) (₹${serverTotal}) from ${customer.fullName.trim()}.`,
      type: 'NEW_ORDER',
      isRead: false,
      createdAt: nowIso,
    };
    serverNotificationsRegistry.set(newNotification.id, newNotification);

    // 10. Dispatch FCM Push Notifications to Seller and Buyer Devices (Safe & Idempotent)
    let notificationDelivery;
    try {
      notificationDelivery = await sendNewOrderPushNotifications(newOrder);
    } catch (pushErr) {
      console.warn('[Orders API] FCM push notification dispatch warning:', pushErr);
      notificationDelivery = {
        status: 'FCM_SEND_FAILED',
        idempotentSkip: false,
        inAppSellerNotificationPersisted: true,
        sellerTokensFound: 0,
        sellerSuccessCount: 0,
        buyerTokensFound: 0,
        buyerSuccessCount: 0,
        errors: [pushErr instanceof Error ? pushErr.message : String(pushErr)],
      };
    }

    // Save in idempotency cache
    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, {
        order: newOrder,
        timestampMs: Date.now(),
      });
    }

    // Decrement stock for purchased items
    for (const item of verifiedItems) {
      const p = ALL_PRODUCTS_MAP.get(item.product.id);
      if (p) {
        p.stock = Math.max(0, p.stock - item.quantity);
        p.isAvailable = p.stock > 0;
        p.orderCount = (p.orderCount || 0) + 1;
        p.quantitySold = (p.quantitySold || 0) + item.quantity;
        p.lastOrderedAt = nowIso;
      }
    }

    return NextResponse.json({
      ok: true,
      order: newOrder,
      notification: newNotification,
      notificationDelivery,
      message: `Order #${orderId} verified and placed successfully with ${store.name}.`,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal error while processing order.',
      },
      {status: 500}
    );
  }
}

export async function GET(req: NextRequest) {
  const {searchParams} = new URL(req.url);
  const sellerId = searchParams.get('sellerId');
  const storeId = searchParams.get('storeId');
  const buyerPhone = searchParams.get('phone');
  const buyerUid = searchParams.get('buyerUid');
  const orderId = searchParams.get('orderId');
  const fetchType = searchParams.get('type'); // 'notifications' | undefined

  if (fetchType === 'notifications') {
    const notifMap = new Map<string, SellerNotification>();
    for (const n of serverNotificationsRegistry.values()) {
      if (!sellerId || n.sellerId === sellerId) {
        notifMap.set(n.id, n);
      }
    }
    try {
      const notifCol = collection(db, 'sellerNotifications');
      const q = sellerId
        ? query(notifCol, where('sellerId', '==', sellerId))
        : notifCol;
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const d = docSnap.data() as SellerNotification;
        if (d && d.id) {
          notifMap.set(d.id, d);
          serverNotificationsRegistry.set(d.id, d);
        }
      });
    } catch {
      // Ignore Firestore read warning
    }
    const notifs = Array.from(notifMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return NextResponse.json({ok: true, notifications: notifs});
  }

  if (orderId) {
    let ord = serverOrdersRegistry.get(orderId);
    if (!ord) {
      try {
        const snap = await getDoc(doc(db, 'orders', orderId));
        if (snap.exists()) {
          ord = snap.data() as OrderRecord;
          serverOrdersRegistry.set(orderId, ord);
        }
      } catch {
        // Ignore
      }
    }
    if (!ord) {
      return NextResponse.json({ok: false, error: 'Order not found'}, {status: 404});
    }
    return NextResponse.json({ok: true, order: ord});
  }

  const orderMap = new Map<string, OrderRecord>();
  for (const o of serverOrdersRegistry.values()) {
    orderMap.set(o.id, o);
  }

  try {
    const ordersCol = collection(db, 'orders');
    if (sellerId) {
      const snap = await getDocs(query(ordersCol, where('sellerId', '==', sellerId)));
      snap.forEach((d) => {
        const ord = d.data() as OrderRecord;
        if (ord?.id) orderMap.set(ord.id, ord);
      });
    } else if (storeId) {
      const snap = await getDocs(query(ordersCol, where('storeId', '==', storeId)));
      snap.forEach((d) => {
        const ord = d.data() as OrderRecord;
        if (ord?.id) orderMap.set(ord.id, ord);
      });
    } else if (buyerUid) {
      const snap = await getDocs(query(ordersCol, where('buyerUid', '==', buyerUid)));
      snap.forEach((d) => {
        const ord = d.data() as OrderRecord;
        if (ord?.id) orderMap.set(ord.id, ord);
      });
    }
  } catch {
    // Ignore Firestore query fallback errors
  }

  let list = Array.from(orderMap.values());

  if (sellerId) {
    list = list.filter((o) => o.sellerId === sellerId);
  } else if (storeId) {
    list = list.filter((o) => o.storeId === storeId);
  } else if (buyerUid) {
    list = list.filter((o) => o.buyerUid === buyerUid);
  } else if (buyerPhone) {
    list = list.filter((o) => o.customer.phone.replace(/\s+/g, '') === buyerPhone.replace(/\s+/g, ''));
  }

  list.sort((a, b) => {
    const timeA = a.createdAtIso ? new Date(a.createdAtIso).getTime() : 0;
    const timeB = b.createdAtIso ? new Date(b.createdAtIso).getTime() : 0;
    return timeB - timeA;
  });

  return NextResponse.json({ok: true, orders: list});
}
