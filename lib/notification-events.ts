import {
  INITIAL_SELLERS,
  INITIAL_STORES,
  LocalStore,
  OrderRecord,
  Product,
  SellerProfile,
} from './catalog-data';
import {
  buildUnifiedBuyerOrderAndPinNotification,
  buildUnifiedSellerOrderNotification,
} from './delivery-pin';
import { normalizePhoneKey } from './fcm-registry';
import { serverUserAccounts } from './initial-data';
import {
  dispatchUnifiedNotification,
  NotificationCategory,
  NotificationRole,
  NotificationSeverity,
  UnifiedNotificationRecord,
} from './notifications-service';
import { serverProductsRegistry, serverStoresRegistry } from './stores-registry';
import { DESIGNATED_OWNER_PHONE } from './super-admin-auth';

function resolveStoreAndSellerIdentity(params: {
  storeId?: string;
  sellerId?: string;
}): {
  store?: LocalStore;
  seller?: SellerProfile;
  sellerId?: string;
  storeId?: string;
  sellerUid?: string;
  sellerPhoneE164?: string;
  storeName: string;
} {
  const store =
    (params.storeId ? serverStoresRegistry.get(params.storeId) : undefined) ||
    INITIAL_STORES.find(
      (s) =>
        (params.storeId && s.id === params.storeId) ||
        (params.sellerId && s.sellerId === params.sellerId)
    );

  const resolvedSellerId = params.sellerId || store?.sellerId;
  const seller = INITIAL_SELLERS.find((s) => s.id === resolvedSellerId);

  const sellerPhoneE164 = normalizePhoneKey(
    store?.phone || store?.sellerPhone || seller?.phoneE164
  );
  const sellerUid = store?.ownerUid || seller?.ownerUid;

  return {
    store,
    seller,
    sellerId: resolvedSellerId,
    storeId: params.storeId || store?.id,
    sellerUid,
    sellerPhoneE164,
    storeName: store?.name || 'Local Store',
  };
}

/**
 * 1. User Registration & Verification Notifications (Buyer, Seller, Partner + Admin Alerts)
 */
export async function notifyUserRegistrationCompleted(params: {
  uid: string;
  phoneE164: string;
  fullName: string;
  role: 'buyer' | 'seller' | 'partner' | 'admin' | 'super_admin';
  sellerId?: string;
  city?: string;
}): Promise<void> {
  try {
    const cleanPhone = normalizePhoneKey(params.phoneE164) || params.phoneE164;
    const cityLabel = params.city || 'your city';

    if (params.role === 'seller') {
      await dispatchUnifiedNotification({
        eventKey: `SELLER:REG_ACK:${cleanPhone}`,
        recipientUid: params.uid,
        recipientPhoneE164: cleanPhone,
        recipientSellerId: params.sellerId,
        recipientRole: 'SELLER',
        title: 'Seller Account Registered & Verified',
        message: `Welcome to Citykart Seller Studio, ${params.fullName}! Your mobile number (${cleanPhone}) is verified. Complete your store profile and product catalogue to start receiving hyperlocal orders in ${cityLabel}.`,
        type: 'SELLER_REGISTRATION_ACKNOWLEDGED',
        category: 'BUSINESS_UPDATES',
        severity: 'SUCCESS',
        isMandatory: true,
        relatedEntityId: params.sellerId || params.uid,
        relatedEntityType: 'STORE',
        destinationRoute: '/?view=seller',
      });

      await dispatchUnifiedNotification({
        eventKey: `ADMIN:NEW_SELLER:${cleanPhone}`,
        recipientPhoneE164: DESIGNATED_OWNER_PHONE,
        recipientRole: 'ADMIN',
        title: `New Seller Registration: ${params.fullName}`,
        message: `${params.fullName} (${cleanPhone}) registered a new Seller account in ${cityLabel}.`,
        type: 'ADMIN_NEW_SELLER_REGISTERED',
        category: 'ADMIN_ALERTS',
        severity: 'INFO',
        relatedEntityId: params.sellerId || params.uid,
        relatedEntityType: 'USER',
        destinationRoute: '/?view=admin',
      });
    } else if (params.role === 'partner') {
      await dispatchUnifiedNotification({
        eventKey: `PARTNER:ACCOUNT_VERIFIED:${cleanPhone}`,
        recipientUid: params.uid,
        recipientPhoneE164: cleanPhone,
        recipientRole: 'PARTNER',
        title: 'City Partner Account Mobile Verified',
        message: `Hello ${params.fullName}, your mobile number (${cleanPhone}) has been verified for the Citykart Partner Program.`,
        type: 'PARTNER_ACCOUNT_UPDATED',
        category: 'PARTNER_UPDATES',
        severity: 'SUCCESS',
        isMandatory: true,
        relatedEntityId: params.uid,
        relatedEntityType: 'PARTNER',
        destinationRoute: '/partner',
      });
    } else {
      await dispatchUnifiedNotification({
        eventKey: `BUYER:REG_CONFIRMED:${cleanPhone}`,
        recipientUid: params.uid,
        recipientPhoneE164: cleanPhone,
        recipientRole: 'BUYER',
        title: `Welcome to Citykart, ${params.fullName}!`,
        message: `Your buyer account (${cleanPhone}) is registered and verified. Your hyperlocal shopping city is locked to ${cityLabel} for fast intra-city doorstep delivery.`,
        type: 'BUYER_REGISTRATION_CONFIRMED',
        category: 'ACCOUNT_SECURITY',
        severity: 'SUCCESS',
        isMandatory: true,
        relatedEntityId: params.uid,
        relatedEntityType: 'USER',
        destinationRoute: '/',
      });

      await dispatchUnifiedNotification({
        eventKey: `ADMIN:NEW_BUYER:${cleanPhone}`,
        recipientPhoneE164: DESIGNATED_OWNER_PHONE,
        recipientRole: 'ADMIN',
        title: `New Buyer Registered: ${params.fullName}`,
        message: `Buyer ${params.fullName} (${cleanPhone}) registered and verified their account in ${cityLabel}.`,
        type: 'ADMIN_NEW_BUYER_REGISTERED',
        category: 'ADMIN_ALERTS',
        severity: 'INFO',
        relatedEntityId: params.uid,
        relatedEntityType: 'USER',
        destinationRoute: '/?view=admin',
      });
    }
  } catch (err) {
    console.warn('[Notification Events] Registration notification warning:', err);
  }
}

/**
 * 2. Order Placement Notifications (Buyer + Seller + Low Stock check)
 */
export async function notifyOrderPlaced(
  order: OrderRecord,
  deliveryPin?: string
): Promise<void> {
  try {
    const buyerPhone = normalizePhoneKey(
      order.customer?.phoneE164 || order.customer?.phone
    );
    const sellerIdentity = resolveStoreAndSellerIdentity({
      storeId: order.storeId,
      sellerId: order.sellerId,
    });

    const unifiedBuyer = deliveryPin
      ? buildUnifiedBuyerOrderAndPinNotification({ order, pin: deliveryPin })
      : null;
    const unifiedSeller = buildUnifiedSellerOrderNotification({ order });

    // 1. Buyer Notification: Order Placed + 6-digit Delivery PIN
    await dispatchUnifiedNotification({
      eventKey: `BUYER:ORDER_PLACED:${order.id}`,
      recipientUid: order.buyerUid,
      recipientPhoneE164: buyerPhone,
      recipientRole: 'BUYER',
      title: unifiedBuyer?.title || `Order Placed #${order.id} — ${order.storeName}`,
      message:
        unifiedBuyer?.body ||
        `Your order #${order.id} of ₹${order.total} with ${order.storeName} has been placed.${deliveryPin ? ` Your 6-digit Delivery PIN is ${deliveryPin}. Share only at doorstep delivery.` : ''}`,
      type: 'ORDER_PLACED',
      category: 'ORDER_UPDATES',
      severity: 'SUCCESS',
      isMandatory: true,
      relatedEntityId: order.id,
      relatedEntityType: 'ORDER',
      destinationRoute: `/orders?orderId=${encodeURIComponent(order.id)}`,
      metadata: {
        orderId: order.id,
        storeId: order.storeId,
        storeName: order.storeName,
        total: order.total,
        deliveryPin: deliveryPin || order.deliveryPin,
      },
    });

    // 2. Seller Notification: New Customer Order Received
    await dispatchUnifiedNotification({
      eventKey: `SELLER:NEW_CUSTOMER_ORDER:${order.id}`,
      recipientUid: order.sellerUid || sellerIdentity.sellerUid,
      recipientPhoneE164: sellerIdentity.sellerPhoneE164,
      recipientSellerId: order.sellerId || sellerIdentity.sellerId,
      recipientStoreId: order.storeId,
      recipientRole: 'SELLER',
      title: unifiedSeller.title,
      message: unifiedSeller.body,
      type: 'NEW_CUSTOMER_ORDER',
      category: 'ORDER_UPDATES',
      severity: 'SUCCESS',
      isMandatory: true,
      relatedEntityId: order.id,
      relatedEntityType: 'ORDER',
      destinationRoute: `/?view=seller&section=orders&orderId=${encodeURIComponent(order.id)}`,
      metadata: {
        orderId: order.id,
        storeId: order.storeId,
        buyerName: unifiedSeller.buyerFullName,
        buyerPhone: unifiedSeller.buyerPhone,
        buyerAddress: unifiedSeller.buyerFullAddress,
        total: order.total,
      },
    });

    // 3. Check item inventory levels for Low-Stock Alert
    for (const item of order.items || []) {
      const prodId = item.productId || item.product?.id;
      if (!prodId) continue;
      const serverProd = serverProductsRegistry.get(prodId) || item.product;
      if (serverProd && typeof serverProd.stock === 'number') {
        const remainingStock = Math.max(0, serverProd.stock - (item.quantity || 1));
        if (remainingStock <= 5) {
          await notifyLowStockInventoryAlert({
            product: { ...serverProd, stock: remainingStock },
            storeId: order.storeId,
            sellerId: order.sellerId,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Notification Events] Order placed notification warning:', err);
  }
}

/**
 * 3. Order Status Lifecycle Notifications (Accepted, Rejected, Processing, Packed, Dispatched, Out for Delivery, Delivered, Cancelled)
 */
export async function notifyOrderStatusUpdated(params: {
  order: OrderRecord;
  nextStatus: OrderRecord['orderStatus'] | 'PACKED';
  reason?: string;
  actorRole?: string;
}): Promise<void> {
  try {
    const { order, nextStatus, reason } = params;
    const buyerPhone = normalizePhoneKey(
      order.customer?.phoneE164 || order.customer?.phone
    );
    const sellerIdentity = resolveStoreAndSellerIdentity({
      storeId: order.storeId,
      sellerId: order.sellerId,
    });

    const statusKey = String(nextStatus).toUpperCase();

    const statusCopyMap: Record<
      string,
      {
        buyerType: string;
        buyerTitle: string;
        buyerMessage: string;
        buyerSeverity: NotificationSeverity;
        sellerType: string;
        sellerTitle: string;
        sellerMessage: string;
        sellerSeverity: NotificationSeverity;
      }
    > = {
      CONFIRMED: {
        buyerType: 'ORDER_ACCEPTED',
        buyerTitle: `Order Accepted #${order.id}`,
        buyerMessage: `${order.storeName} has accepted your order #${order.id} (₹${order.total}) and will begin preparing your items shortly.`,
        buyerSeverity: 'SUCCESS',
        sellerType: 'SELLER_ORDER_ACCEPTED',
        sellerTitle: `Order #${order.id} Accepted`,
        sellerMessage: `You accepted Order #${order.id} for ${order.customer?.fullName || 'Customer'} (₹${order.total}).`,
        sellerSeverity: 'INFO',
      },
      REJECTED: {
        buyerType: 'ORDER_REJECTED',
        buyerTitle: `Order #${order.id} Could Not Be Accepted`,
        buyerMessage: `${order.storeName} could not fulfill Order #${order.id}.${reason ? ` Reason: ${reason}.` : ''} Any applicable refund or adjustment has been initiated.`,
        buyerSeverity: 'WARNING',
        sellerType: 'SELLER_ORDER_STATUS_UPDATED',
        sellerTitle: `Order #${order.id} Marked Rejected`,
        sellerMessage: `Order #${order.id} was rejected.${reason ? ` Reason: ${reason}.` : ''}`,
        sellerSeverity: 'WARNING',
      },
      PREPARING: {
        buyerType: 'ORDER_PROCESSING',
        buyerTitle: `Order #${order.id} is Being Prepared`,
        buyerMessage: `${order.storeName} is currently processing and preparing your order #${order.id}.`,
        buyerSeverity: 'INFO',
        sellerType: 'SELLER_ORDER_STATUS_UPDATED',
        sellerTitle: `Order #${order.id} Moved to Preparing`,
        sellerMessage: `Order #${order.id} for ${order.customer?.fullName || 'Customer'} is now in PREPARING stage.`,
        sellerSeverity: 'INFO',
      },
      PACKED: {
        buyerType: 'ORDER_PACKED',
        buyerTitle: `Order #${order.id} Packed & Ready`,
        buyerMessage: `Your order #${order.id} at ${order.storeName} has been packed and is ready for dispatch.`,
        buyerSeverity: 'INFO',
        sellerType: 'SELLER_ORDER_STATUS_UPDATED',
        sellerTitle: `Order #${order.id} Packed`,
        sellerMessage: `Order #${order.id} is packed and ready for local dispatch.`,
        sellerSeverity: 'INFO',
      },
      DISPATCHED: {
        buyerType: 'ORDER_DISPATCHED',
        buyerTitle: `Order #${order.id} Dispatched`,
        buyerMessage: `${order.storeName} has dispatched your order #${order.id}. Please keep your 6-digit Delivery PIN ready.`,
        buyerSeverity: 'INFO',
        sellerType: 'SELLER_ORDER_STATUS_UPDATED',
        sellerTitle: `Order #${order.id} Dispatched`,
        sellerMessage: `Order #${order.id} has been dispatched to ${order.customer?.fullName || 'Customer'}.`,
        sellerSeverity: 'INFO',
      },
      OUT_FOR_DELIVERY: {
        buyerType: 'ORDER_OUT_FOR_DELIVERY',
        buyerTitle: `Order #${order.id} is Out for Delivery!`,
        buyerMessage: `Your order #${order.id} from ${order.storeName} is out for delivery to ${order.customer?.address || 'your address'}. Share your 6-digit Delivery PIN only after inspecting your package.`,
        buyerSeverity: 'INFO',
        sellerType: 'SELLER_ORDER_STATUS_UPDATED',
        sellerTitle: `Order #${order.id} Out for Delivery`,
        sellerMessage: `Order #${order.id} is out for delivery to ${order.customer?.fullName || 'Customer'}. Verify the buyer's 6-digit PIN at doorstep.`,
        sellerSeverity: 'INFO',
      },
      DELIVERED: {
        buyerType: 'ORDER_DELIVERED',
        buyerTitle: `Order #${order.id} Delivered Successfully`,
        buyerMessage: `Your order #${order.id} from ${order.storeName} has been verified via 6-digit Delivery PIN and marked DELIVERED. Thank you for shopping local on Citykart!`,
        buyerSeverity: 'SUCCESS',
        sellerType: 'SELLER_ORDER_STATUS_UPDATED',
        sellerTitle: `Order #${order.id} Delivered & PIN Verified`,
        sellerMessage: `Order #${order.id} (₹${order.total}) for ${order.customer?.fullName || 'Customer'} is verified and completed.`,
        sellerSeverity: 'SUCCESS',
      },
      CANCELLED: {
        buyerType: 'ORDER_CANCELLED',
        buyerTitle: `Order #${order.id} Cancelled`,
        buyerMessage: `Order #${order.id} with ${order.storeName} has been cancelled.${reason ? ` Reason: ${reason}.` : ''}`,
        buyerSeverity: 'WARNING',
        sellerType: 'SELLER_ORDER_CANCELLED',
        sellerTitle: `Order #${order.id} Cancelled`,
        sellerMessage: `Order #${order.id} (${order.customer?.fullName || 'Customer'}, ₹${order.total}) was cancelled.${reason ? ` Reason: ${reason}.` : ''}`,
        sellerSeverity: 'WARNING',
      },
    };

    const copy = statusCopyMap[statusKey];
    if (!copy) return;

    await dispatchUnifiedNotification({
      eventKey: `BUYER:ORDER_STATUS:${order.id}:${statusKey}`,
      recipientUid: order.buyerUid,
      recipientPhoneE164: buyerPhone,
      recipientRole: 'BUYER',
      title: copy.buyerTitle,
      message: copy.buyerMessage,
      type: copy.buyerType,
      category: 'ORDER_UPDATES',
      severity: copy.buyerSeverity,
      isMandatory: statusKey === 'DELIVERED' || statusKey === 'CANCELLED' || statusKey === 'REJECTED',
      relatedEntityId: order.id,
      relatedEntityType: 'ORDER',
      destinationRoute: `/orders?orderId=${encodeURIComponent(order.id)}`,
      metadata: {
        orderId: order.id,
        status: statusKey,
        reason,
      },
    });

    await dispatchUnifiedNotification({
      eventKey: `SELLER:ORDER_STATUS:${order.id}:${statusKey}`,
      recipientUid: order.sellerUid || sellerIdentity.sellerUid,
      recipientPhoneE164: sellerIdentity.sellerPhoneE164,
      recipientSellerId: order.sellerId || sellerIdentity.sellerId,
      recipientStoreId: order.storeId,
      recipientRole: 'SELLER',
      title: copy.sellerTitle,
      message: copy.sellerMessage,
      type: copy.sellerType,
      category: 'ORDER_UPDATES',
      severity: copy.sellerSeverity,
      relatedEntityId: order.id,
      relatedEntityType: 'ORDER',
      destinationRoute: `/?view=seller&section=orders&orderId=${encodeURIComponent(order.id)}`,
      metadata: {
        orderId: order.id,
        status: statusKey,
        reason,
      },
    });
  } catch (err) {
    console.warn('[Notification Events] Order status notification warning:', err);
  }
}

/**
 * 4. Order Payment / Refund / Dispute Escalation Notifications
 */
export async function notifyOrderPaymentUpdated(params: {
  order: OrderRecord;
  paymentStatus: 'PENDING' | 'PAID' | 'DISPUTED' | 'REFUNDED';
  collectionMethod?: string;
  referenceNote?: string;
}): Promise<void> {
  try {
    const { order, paymentStatus, collectionMethod, referenceNote } = params;
    const buyerPhone = normalizePhoneKey(
      order.customer?.phoneE164 || order.customer?.phone
    );
    const sellerIdentity = resolveStoreAndSellerIdentity({
      storeId: order.storeId,
      sellerId: order.sellerId,
    });

    const methodLabel =
      collectionMethod === 'UPI_ON_DELIVERY'
        ? 'UPI on Delivery'
        : 'Cash on Delivery';

    if (paymentStatus === 'PAID') {
      await dispatchUnifiedNotification({
        eventKey: `BUYER:ORDER_PAID:${order.id}`,
        recipientUid: order.buyerUid,
        recipientPhoneE164: buyerPhone,
        recipientRole: 'BUYER',
        title: `Payment Confirmed for Order #${order.id}`,
        message: `Your payment of ₹${order.total} via ${methodLabel} for Order #${order.id} (${order.storeName}) has been recorded.`,
        type: 'REFUND_PAYMENT_STATUS',
        category: 'ORDER_UPDATES',
        severity: 'SUCCESS',
        relatedEntityId: order.id,
        relatedEntityType: 'ORDER',
      });

      await dispatchUnifiedNotification({
        eventKey: `SELLER:ORDER_PAID:${order.id}`,
        recipientUid: order.sellerUid || sellerIdentity.sellerUid,
        recipientPhoneE164: sellerIdentity.sellerPhoneE164,
        recipientSellerId: order.sellerId || sellerIdentity.sellerId,
        recipientStoreId: order.storeId,
        recipientRole: 'SELLER',
        title: `Payment Collected: Order #${order.id} (₹${order.total})`,
        message: `₹${order.total} collected via ${methodLabel} for Order #${order.id}.`,
        type: 'SELLER_SUBSCRIPTION_PAYMENT_STATUS',
        category: 'BUSINESS_UPDATES',
        severity: 'SUCCESS',
        relatedEntityId: order.id,
        relatedEntityType: 'ORDER',
      });
    } else if (paymentStatus === 'DISPUTED' || paymentStatus === 'REFUNDED') {
      await dispatchUnifiedNotification({
        eventKey: `BUYER:ORDER_PAYMENT_${paymentStatus}:${order.id}`,
        recipientUid: order.buyerUid,
        recipientPhoneE164: buyerPhone,
        recipientRole: 'BUYER',
        title:
          paymentStatus === 'REFUNDED'
            ? `Refund Status Updated — Order #${order.id}`
            : `Payment Escalation Logged — Order #${order.id}`,
        message:
          paymentStatus === 'REFUNDED'
            ? `Refund of ₹${order.total} for Order #${order.id} (${order.storeName}) has been processed.${referenceNote ? ` Note: ${referenceNote}` : ''}`
            : `A payment dispute has been logged on Order #${order.id}.${referenceNote ? ` Details: ${referenceNote}` : ''}`,
        type: 'REFUND_PAYMENT_STATUS',
        category: 'ORDER_UPDATES',
        severity: paymentStatus === 'REFUNDED' ? 'INFO' : 'WARNING',
        isMandatory: true,
        relatedEntityId: order.id,
        relatedEntityType: 'ORDER',
      });

      if (paymentStatus === 'DISPUTED') {
        await dispatchUnifiedNotification({
          eventKey: `ADMIN:ORDER_DISPUTE:${order.id}`,
          recipientPhoneE164: DESIGNATED_OWNER_PHONE,
          recipientRole: 'ADMIN',
          title: `Order Payment Escalation: #${order.id} (₹${order.total})`,
          message: `Order #${order.id} at ${order.storeName} was flagged as DISPUTED.${referenceNote ? ` Note: ${referenceNote}` : ''}`,
          type: 'ADMIN_ORDER_ESCALATION',
          category: 'ADMIN_ALERTS',
          severity: 'WARNING',
          isMandatory: true,
          relatedEntityId: order.id,
          relatedEntityType: 'ORDER',
          destinationRoute: '/?view=admin',
        });
      }
    }
  } catch (err) {
    console.warn('[Notification Events] Order payment notification warning:', err);
  }
}

/**
 * 5. Low-Stock & Inventory Alerts for Sellers
 */
export async function notifyLowStockInventoryAlert(params: {
  product: Product;
  storeId?: string;
  sellerId?: string;
}): Promise<void> {
  try {
    const { product } = params;
    const stock = Number(product.stock ?? 0);
    if (stock > 5) return;

    const sellerIdentity = resolveStoreAndSellerIdentity({
      storeId: params.storeId || product.storeId,
      sellerId: params.sellerId || product.sellerId,
    });

    const isOut = stock <= 0;
    await dispatchUnifiedNotification({
      eventKey: `SELLER:STOCK_ALERT:${product.id}:stock_${stock}`,
      recipientUid: product.ownerUid || sellerIdentity.sellerUid,
      recipientPhoneE164: sellerIdentity.sellerPhoneE164,
      recipientSellerId: sellerIdentity.sellerId || product.sellerId,
      recipientStoreId: sellerIdentity.storeId || product.storeId,
      recipientRole: 'SELLER',
      title: isOut
        ? `Out of Stock Alert: ${product.name}`
        : `Low Stock Alert: ${product.name} (${stock} left)`,
      message: isOut
        ? `"${product.name}" (SKU: ${product.sku || product.id}) at ${sellerIdentity.storeName} is now OUT OF STOCK (0 units). Restock in Seller Studio to resume orders.`
        : `"${product.name}" at ${sellerIdentity.storeName} has only ${stock} unit(s) remaining. Update inventory soon to avoid missed orders.`,
      type: isOut ? 'OUT_OF_STOCK_ALERT' : 'LOW_STOCK_ALERT',
      category: 'BUSINESS_UPDATES',
      severity: isOut ? 'CRITICAL' : 'WARNING',
      relatedEntityId: product.id,
      relatedEntityType: 'PRODUCT',
      destinationRoute: '/?view=seller&section=catalog',
    });
  } catch (err) {
    console.warn('[Notification Events] Low stock notification warning:', err);
  }
}

/**
 * 6. Store Onboarding, Verification, & Moderation Notifications
 */
export async function notifyStoreOnboardingOrModeration(params: {
  store: LocalStore;
  seller?: SellerProfile;
  event:
    | 'STORE_CREATED'
    | 'STORE_VERIFIED'
    | 'STORE_REJECTED'
    | 'STORE_SUSPENDED'
    | 'STORE_RESTORED'
    | 'STORE_DELETED';
  reason?: string;
}): Promise<void> {
  try {
    const { store, seller, event, reason } = params;
    const sellerIdentity = resolveStoreAndSellerIdentity({
      storeId: store.id,
      sellerId: store.sellerId || seller?.id,
    });
    const recipientPhone =
      normalizePhoneKey(
        store.phone || store.sellerPhone || seller?.phoneE164
      ) || sellerIdentity.sellerPhoneE164;
    const recipientUid = store.ownerUid || seller?.ownerUid || sellerIdentity.sellerUid;
    const recipientSellerId = store.sellerId || seller?.id || sellerIdentity.sellerId;

    if (event === 'STORE_CREATED') {
      await dispatchUnifiedNotification({
        eventKey: `SELLER:STORE_CREATED:${store.id}`,
        recipientUid,
        recipientPhoneE164: recipientPhone,
        recipientSellerId,
        recipientStoreId: store.id,
        recipientRole: 'SELLER',
        title: `Store Registered: ${store.name}`,
        message: `Your storefront "${store.name}" in ${store.cityName || store.city} is registered on Citykart. Add products to your catalogue to start selling.`,
        type: 'SELLER_REGISTRATION_ACKNOWLEDGED',
        category: 'BUSINESS_UPDATES',
        severity: 'SUCCESS',
        isMandatory: true,
        relatedEntityId: store.id,
        relatedEntityType: 'STORE',
        destinationRoute: '/?view=seller',
      });

      await dispatchUnifiedNotification({
        eventKey: `ADMIN:SELLER_VERIFY_REQ:${store.id}`,
        recipientPhoneE164: DESIGNATED_OWNER_PHONE,
        recipientRole: 'ADMIN',
        title: `Seller Verification Request: ${store.name}`,
        message: `New store "${store.name}" (${store.category}) registered in ${store.cityName || store.city} by ${seller?.businessOwnerName || store.sellerName || 'Seller'} (${recipientPhone || 'Verified Mobile'}).`,
        type: 'ADMIN_SELLER_VERIFICATION_REQUEST',
        category: 'ADMIN_ALERTS',
        severity: 'INFO',
        relatedEntityId: store.id,
        relatedEntityType: 'STORE',
        destinationRoute: '/?view=admin',
      });
    } else if (event === 'STORE_VERIFIED') {
      await dispatchUnifiedNotification({
        eventKey: `SELLER:STORE_VERIFIED:${store.id}:${Date.now()}`,
        recipientUid,
        recipientPhoneE164: recipientPhone,
        recipientSellerId,
        recipientStoreId: store.id,
        recipientRole: 'SELLER',
        title: `Business Verified & Approved: ${store.name}`,
        message: `Congratulations! Your store "${store.name}" location and business profile in ${store.cityName || store.city} have been verified by Citykart Administration.`,
        type: 'SELLER_VERIFICATION_STATUS',
        category: 'BUSINESS_UPDATES',
        severity: 'SUCCESS',
        isMandatory: true,
        relatedEntityId: store.id,
        relatedEntityType: 'STORE',
      });
    } else if (event === 'STORE_SUSPENDED' || event === 'STORE_REJECTED') {
      await dispatchUnifiedNotification({
        eventKey: `SELLER:STORE_${event}:${store.id}:${Date.now()}`,
        recipientUid,
        recipientPhoneE164: recipientPhone,
        recipientSellerId,
        recipientStoreId: store.id,
        recipientRole: 'SELLER',
        title:
          event === 'STORE_REJECTED'
            ? `Business Verification Update: ${store.name}`
            : `Store Paused / Suspended: ${store.name}`,
        message: `Your store "${store.name}" was marked as ${event === 'STORE_REJECTED' ? 'Rejected' : 'Suspended'} by Citykart Administration.${reason ? ` Reason: ${reason}` : ''}`,
        type: 'SELLER_VERIFICATION_STATUS',
        category: 'ACCOUNT_SECURITY',
        severity: 'WARNING',
        isMandatory: true,
        relatedEntityId: store.id,
        relatedEntityType: 'STORE',
      });
    } else if (event === 'STORE_RESTORED') {
      await dispatchUnifiedNotification({
        eventKey: `SELLER:STORE_RESTORED:${store.id}:${Date.now()}`,
        recipientUid,
        recipientPhoneE164: recipientPhone,
        recipientSellerId,
        recipientStoreId: store.id,
        recipientRole: 'SELLER',
        title: `Store Restored & Active: ${store.name}`,
        message: `Your store "${store.name}" has been restored to active status and is live for hyperlocal orders.`,
        type: 'SELLER_VERIFICATION_STATUS',
        category: 'BUSINESS_UPDATES',
        severity: 'SUCCESS',
        isMandatory: true,
        relatedEntityId: store.id,
        relatedEntityType: 'STORE',
      });
    } else if (event === 'STORE_DELETED') {
      await dispatchUnifiedNotification({
        eventKey: `SUPER_ADMIN:STORE_DELETED:${store.id}`,
        recipientPhoneE164: DESIGNATED_OWNER_PHONE,
        recipientRole: 'SUPER_ADMIN',
        title: `Critical Event: Store "${store.name}" Permanently Deleted`,
        message: `Store "${store.name}" (${store.id}) was permanently removed from public discovery.${reason ? ` Reason: ${reason}` : ''}`,
        type: 'SUPER_ADMIN_CRITICAL_EVENT',
        category: 'ADMIN_ALERTS',
        severity: 'CRITICAL',
        isMandatory: true,
        relatedEntityId: store.id,
        relatedEntityType: 'STORE',
      });
    }
  } catch (err) {
    console.warn('[Notification Events] Store notification warning:', err);
  }
}

/**
 * 7. Product Moderation Notifications
 */
export async function notifyProductModeration(params: {
  productId: string;
  productName: string;
  storeId?: string;
  sellerId?: string;
  action: 'UNPUBLISHED' | 'RESTORED' | 'APPROVED';
  reason?: string;
}): Promise<void> {
  try {
    const prod = serverProductsRegistry.get(params.productId);
    const sellerIdentity = resolveStoreAndSellerIdentity({
      storeId: params.storeId || prod?.storeId,
      sellerId: params.sellerId || prod?.sellerId,
    });

    await dispatchUnifiedNotification({
      eventKey: `SELLER:PRODUCT_MOD:${params.productId}:${params.action}:${Date.now()}`,
      recipientUid: prod?.ownerUid || sellerIdentity.sellerUid,
      recipientPhoneE164: sellerIdentity.sellerPhoneE164,
      recipientSellerId: sellerIdentity.sellerId || prod?.sellerId,
      recipientStoreId: sellerIdentity.storeId || prod?.storeId,
      recipientRole: 'SELLER',
      title:
        params.action === 'UNPUBLISHED'
          ? `Product Moderation Alert: ${params.productName}`
          : `Product Approved & Live: ${params.productName}`,
      message:
        params.action === 'UNPUBLISHED'
          ? `Your product "${params.productName}" has been unpublished by platform moderation.${params.reason ? ` Reason: ${params.reason}` : ''}`
          : `Your product "${params.productName}" is approved and visible in local search & discovery.`,
      type: 'PRODUCT_MODERATION_UPDATE',
      category: 'BUSINESS_UPDATES',
      severity: params.action === 'UNPUBLISHED' ? 'WARNING' : 'SUCCESS',
      isMandatory: params.action === 'UNPUBLISHED',
      relatedEntityId: params.productId,
      relatedEntityType: 'PRODUCT',
      destinationRoute: '/?view=seller&section=catalog',
    });

    await dispatchUnifiedNotification({
      eventKey: `ADMIN:PRODUCT_MOD:${params.productId}:${params.action}:${Date.now()}`,
      recipientPhoneE164: DESIGNATED_OWNER_PHONE,
      recipientRole: 'ADMIN',
      title: `Moderation Event: ${params.productName} (${params.action})`,
      message: `Product "${params.productName}" (${params.productId}) was marked ${params.action}.${params.reason ? ` Reason: ${params.reason}` : ''}`,
      type: 'ADMIN_MODERATION_EVENT',
      category: 'ADMIN_ALERTS',
      severity: 'INFO',
      relatedEntityId: params.productId,
      relatedEntityType: 'PRODUCT',
    });
  } catch (err) {
    console.warn('[Notification Events] Product moderation notification warning:', err);
  }
}

/**
 * 8. Customer Enquiry, Messages, and Store Reviews
 */
export async function notifyCustomerInteraction(params: {
  interactionType:
    | 'CUSTOMER_ENQUIRY'
    | 'CUSTOMER_MESSAGE'
    | 'SELLER_RESPONSE'
    | 'CUSTOMER_REVIEW';
  storeId: string;
  sellerId?: string;
  buyerUid?: string;
  buyerPhoneE164?: string;
  buyerName?: string;
  orderId?: string;
  rating?: number;
  messageText: string;
}): Promise<void> {
  try {
    const sellerIdentity = resolveStoreAndSellerIdentity({
      storeId: params.storeId,
      sellerId: params.sellerId,
    });
    const normBuyerPhone = normalizePhoneKey(params.buyerPhoneE164);

    if (params.interactionType === 'SELLER_RESPONSE') {
      await dispatchUnifiedNotification({
        eventKey: `BUYER:SELLER_MSG:${params.orderId || params.storeId}:${Date.now()}`,
        recipientUid: params.buyerUid,
        recipientPhoneE164: normBuyerPhone,
        recipientRole: 'BUYER',
        title: `Message from ${sellerIdentity.storeName}`,
        message: params.messageText,
        type: 'SELLER_MESSAGE_RECEIVED',
        category: 'ORDER_UPDATES',
        severity: 'INFO',
        relatedEntityId: params.orderId || params.storeId,
        relatedEntityType: params.orderId ? 'ORDER' : 'STORE',
        destinationRoute: params.orderId
          ? `/orders?orderId=${encodeURIComponent(params.orderId)}`
          : '/',
      });
    } else if (params.interactionType === 'CUSTOMER_REVIEW') {
      const stars = '★'.repeat(Math.max(1, Math.min(5, params.rating || 5)));
      await dispatchUnifiedNotification({
        eventKey: `SELLER:REVIEW:${params.orderId || params.storeId}`,
        recipientUid: sellerIdentity.sellerUid,
        recipientPhoneE164: sellerIdentity.sellerPhoneE164,
        recipientSellerId: sellerIdentity.sellerId,
        recipientStoreId: params.storeId,
        recipientRole: 'SELLER',
        title: `New ${params.rating || 5}-Star Customer Review (${stars})`,
        message: `${params.buyerName || 'Verified Buyer'} rated ${sellerIdentity.storeName} ${params.rating || 5}/5 stars${params.messageText ? `: "${params.messageText}"` : '.'}`,
        type: 'CUSTOMER_REVIEW_RECEIVED',
        category: 'BUSINESS_UPDATES',
        severity: 'SUCCESS',
        relatedEntityId: params.orderId || params.storeId,
        relatedEntityType: 'STORE',
        destinationRoute: '/?view=seller',
      });
    } else {
      const isEnquiry = params.interactionType === 'CUSTOMER_ENQUIRY';
      await dispatchUnifiedNotification({
        eventKey: `SELLER:${params.interactionType}:${params.storeId}:${Date.now()}`,
        recipientUid: sellerIdentity.sellerUid,
        recipientPhoneE164: sellerIdentity.sellerPhoneE164,
        recipientSellerId: sellerIdentity.sellerId,
        recipientStoreId: params.storeId,
        recipientRole: 'SELLER',
        title: isEnquiry
          ? `New Customer Enquiry for ${sellerIdentity.storeName}`
          : `New Customer Message from ${params.buyerName || 'Customer'}`,
        message: `${params.buyerName || 'Customer'}${normBuyerPhone ? ` (${normBuyerPhone})` : ''}: ${params.messageText}`,
        type: isEnquiry
          ? 'CUSTOMER_ENQUIRY_RECEIVED'
          : 'CUSTOMER_MESSAGE_RECEIVED',
        category: 'BUSINESS_UPDATES',
        severity: 'INFO',
        relatedEntityId: params.orderId || params.storeId,
        relatedEntityType: params.orderId ? 'ORDER' : 'STORE',
        destinationRoute: '/?view=seller',
      });
    }
  } catch (err) {
    console.warn('[Notification Events] Customer interaction warning:', err);
  }
}

/**
 * 9. Seller Subscription, Campaign & Billing Notifications
 */
export async function notifySellerBillingEvent(params: {
  storeId: string;
  sellerId: string;
  eventType:
    | 'SUBSCRIPTION_ACTIVATED'
    | 'CAMPAIGN_ACTIVATED'
    | 'CAMPAIGN_MODERATED'
    | 'SERVICE_BOOKED';
  title: string;
  message: string;
  relatedEntityId: string;
}): Promise<void> {
  try {
    const sellerIdentity = resolveStoreAndSellerIdentity({
      storeId: params.storeId,
      sellerId: params.sellerId,
    });

    await dispatchUnifiedNotification({
      eventKey: `SELLER:BILLING:${params.eventType}:${params.relatedEntityId}`,
      recipientUid: sellerIdentity.sellerUid,
      recipientPhoneE164: sellerIdentity.sellerPhoneE164,
      recipientSellerId: params.sellerId,
      recipientStoreId: params.storeId,
      recipientRole: 'SELLER',
      title: params.title,
      message: params.message,
      type: 'SELLER_SUBSCRIPTION_PAYMENT_STATUS',
      category: 'BUSINESS_UPDATES',
      severity: 'SUCCESS',
      isMandatory: true,
      relatedEntityId: params.relatedEntityId,
      relatedEntityType:
        params.eventType === 'SUBSCRIPTION_ACTIVATED'
          ? 'SUBSCRIPTION'
          : 'CAMPAIGN',
      destinationRoute: '/?view=seller&section=growth',
    });
  } catch (err) {
    console.warn('[Notification Events] Seller billing notification warning:', err);
  }
}

/**
 * 10. City Partner Application & Lifecycle Notifications (Partner + Admin + Super Admin)
 */
export async function notifyPartnerLifecycleEvent(params: {
  applicationId: string;
  partnerId?: string;
  referenceId?: string;
  applicantUid?: string;
  phoneE164: string;
  fullName: string;
  cityId: string;
  cityName: string;
  event:
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'NEEDS_MORE_INFO'
    | 'WITHDRAWN'
    | 'DIRECT_ONBOARD'
    | 'SUSPENDED'
    | 'REACTIVATED'
    | 'DEACTIVATED'
    | 'CITY_REASSIGNED'
    | 'TASK_ASSIGNED';
  reasonOrNotes?: string;
  reason?: string;
  actorUid?: string;
}): Promise<void> {
  try {
    const cleanPhone = normalizePhoneKey(params.phoneE164) || params.phoneE164;
    const refLabel = params.referenceId || params.applicationId;
    const noteText = params.reasonOrNotes || params.reason;

    if (params.event === 'SUBMITTED') {
      await dispatchUnifiedNotification({
        eventKey: `PARTNER:APP_SUBMITTED:${params.applicationId}`,
        recipientUid: params.applicantUid,
        recipientPhoneE164: cleanPhone,
        recipientPartnerId: params.partnerId,
        recipientRole: 'PARTNER',
        title: `Partner Application Submitted (${refLabel})`,
        message: `Your City Partner application for ${params.cityName} has been received and queued for Super Admin verification. We will notify you as soon as your KYC and territory exclusivity check is complete.`,
        type: 'PARTNER_APPLICATION_SUBMITTED',
        category: 'PARTNER_UPDATES',
        severity: 'SUCCESS',
        isMandatory: true,
        relatedEntityId: params.applicationId,
        relatedEntityType: 'PARTNER_APPLICATION',
        destinationRoute: '/partner',
      });

      await dispatchUnifiedNotification({
        eventKey: `ADMIN:PARTNER_APP_REQ:${params.applicationId}`,
        recipientPhoneE164: DESIGNATED_OWNER_PHONE,
        recipientRole: 'ADMIN',
        title: `New City Partner Application: ${params.cityName}`,
        message: `${params.fullName} (${cleanPhone}) submitted a City Partner application (${refLabel}) for ${params.cityName}. Review KYC and city exclusivity in the Partner Console.`,
        type: 'ADMIN_NEW_PARTNER_APPLICATION',
        category: 'ADMIN_ALERTS',
        severity: 'INFO',
        isMandatory: true,
        relatedEntityId: params.applicationId,
        relatedEntityType: 'PARTNER_APPLICATION',
        destinationRoute: '/?view=admin',
      });
    } else if (
      params.event === 'APPROVED' ||
      params.event === 'DIRECT_ONBOARD'
    ) {
      await dispatchUnifiedNotification({
        eventKey: `PARTNER:APP_APPROVED:${params.applicationId}`,
        recipientUid: params.applicantUid,
        recipientPhoneE164: cleanPhone,
        recipientPartnerId: params.partnerId || `partner_${params.applicationId}`,
        recipientRole: 'PARTNER',
        title: `Approved! Exclusive City Partner for ${params.cityName}`,
        message: `Congratulations ${params.fullName}! Your City Partner allocation for ${params.cityName} (${refLabel}) is ACTIVE under the 50/50 Net Eligible Revenue Share model. Onboarding instructions: Open your Partner Portal (/partner) to access your merchant referral link and territory dashboard.`,
        type: 'PARTNER_APPLICATION_APPROVED',
        category: 'PARTNER_UPDATES',
        severity: 'SUCCESS',
        isMandatory: true,
        relatedEntityId: params.partnerId || params.applicationId,
        relatedEntityType: 'PARTNER',
        destinationRoute: '/partner',
      });
    } else if (params.event === 'REJECTED') {
      await dispatchUnifiedNotification({
        eventKey: `PARTNER:APP_REJECTED:${params.applicationId}:${Date.now()}`,
        recipientUid: params.applicantUid,
        recipientPhoneE164: cleanPhone,
        recipientRole: 'PARTNER',
        title: `Partner Application Update (${refLabel})`,
        message: `Your City Partner application for ${params.cityName} could not be approved at this time.${noteText ? ` Reason: ${noteText}` : ''}`,
        type: 'PARTNER_APPLICATION_REJECTED',
        category: 'PARTNER_UPDATES',
        severity: 'WARNING',
        isMandatory: true,
        relatedEntityId: params.applicationId,
        relatedEntityType: 'PARTNER_APPLICATION',
        destinationRoute: '/partner',
      });
    } else if (params.event === 'NEEDS_MORE_INFO') {
      await dispatchUnifiedNotification({
        eventKey: `PARTNER:APP_INFO_REQ:${params.applicationId}:${Date.now()}`,
        recipientUid: params.applicantUid,
        recipientPhoneE164: cleanPhone,
        recipientRole: 'PARTNER',
        title: `Additional Information Requested (${refLabel})`,
        message: `Citykart Administration requested additional details for your ${params.cityName} Partner application.${noteText ? ` Request: ${noteText}` : ''}`,
        type: 'PARTNER_APPLICATION_STATUS_UPDATED',
        category: 'PARTNER_UPDATES',
        severity: 'WARNING',
        isMandatory: true,
        relatedEntityId: params.applicationId,
        relatedEntityType: 'PARTNER_APPLICATION',
        destinationRoute: '/partner',
      });
    } else {
      await dispatchUnifiedNotification({
        eventKey: `PARTNER:LIFECYCLE:${params.applicationId}:${params.event}:${Date.now()}`,
        recipientUid: params.applicantUid,
        recipientPhoneE164: cleanPhone,
        recipientPartnerId: params.partnerId,
        recipientRole: 'PARTNER',
        title: `Partner Account Update — ${params.cityName}`,
        message: `Your City Partner account status for ${params.cityName} was updated (${params.event.replace(/_/g, ' ')}).${noteText ? ` Note: ${noteText}` : ''}`,
        type:
          params.event === 'TASK_ASSIGNED'
            ? 'PARTNER_LEAD_ASSIGNED'
            : 'PARTNER_ACCOUNT_UPDATED',
        category: 'PARTNER_UPDATES',
        severity: params.event === 'SUSPENDED' || params.event === 'DEACTIVATED' ? 'WARNING' : 'INFO',
        isMandatory: true,
        relatedEntityId: params.partnerId || params.applicationId,
        relatedEntityType: 'PARTNER',
        destinationRoute: '/partner',
      });
    }
  } catch (err) {
    console.warn('[Notification Events] Partner lifecycle notification warning:', err);
  }
}

/**
 * 11. Partner Monthly Settlement & Payout Notifications
 */
export async function notifyPartnerSettlementEvent(params: {
  settlementId: string;
  partnerId: string;
  partnerName: string;
  partnerPhoneE164: string;
  cityName: string;
  periodMonth: string;
  amountInr: number;
  event: 'GENERATED' | 'APPROVED' | 'PAYOUT_RECORDED';
  utrNumber?: string;
}): Promise<void> {
  try {
    const cleanPhone =
      normalizePhoneKey(params.partnerPhoneE164) || params.partnerPhoneE164;

    const titleMap = {
      GENERATED: `Monthly Settlement Statement Generated (${params.periodMonth})`,
      APPROVED: `Settlement Approved for Payout (${params.periodMonth})`,
      PAYOUT_RECORDED: `Bank Payout Dispatched: ₹${params.amountInr} (${params.periodMonth})`,
    };

    const msgMap = {
      GENERATED: `Your 50/50 revenue share statement (${params.settlementId}) for ${params.cityName} (${params.periodMonth}) has been generated with net payable ₹${params.amountInr}.`,
      APPROVED: `Your settlement statement (${params.settlementId}) for ${params.cityName} (₹${params.amountInr}) has been approved for bank transfer.`,
      PAYOUT_RECORDED: `₹${params.amountInr} has been transferred for settlement ${params.settlementId} (${params.cityName}).${params.utrNumber ? ` Bank UTR: ${params.utrNumber}.` : ''}`,
    };

    await dispatchUnifiedNotification({
      eventKey: `PARTNER:SETTLEMENT:${params.settlementId}:${params.event}:${params.utrNumber || ''}`,
      recipientPhoneE164: cleanPhone,
      recipientPartnerId: params.partnerId,
      recipientRole: 'PARTNER',
      title: titleMap[params.event],
      message: msgMap[params.event],
      type: 'PARTNER_SETTLEMENT_UPDATE',
      category: 'PARTNER_UPDATES',
      severity: 'SUCCESS',
      isMandatory: true,
      relatedEntityId: params.settlementId,
      relatedEntityType: 'SETTLEMENT',
      destinationRoute: '/partner',
    });
  } catch (err) {
    console.warn('[Notification Events] Partner settlement notification warning:', err);
  }
}

/**
 * 12. Admin & Super Admin Governance, Security, and Configuration Alerts
 */
export async function notifyAdminAndSuperAdminGovernance(params: {
  eventType:
    | 'ADMIN_INVITED'
    | 'ADMIN_REVOKED'
    | 'ADMIN_REACTIVATED'
    | 'ADMIN_UPDATED'
    | 'BUYER_SUSPENDED'
    | 'BUYER_RESTORED'
    | 'SUBSCRIPTION_PLAN_UPDATED'
    | 'PLATFORM_SETTINGS_UPDATED'
    | 'SECURITY_VIOLATION'
    | 'OPERATIONAL_FAILURE';
  targetId: string;
  targetName: string;
  targetPhoneE164?: string;
  summary: string;
  actorPhone?: string;
}): Promise<void> {
  try {
    const cleanTargetPhone = normalizePhoneKey(params.targetPhoneE164);

    // 1. Always alert Super Admin for critical privilege/config/security events
    await dispatchUnifiedNotification({
      eventKey: `SUPER_ADMIN:GOV:${params.eventType}:${params.targetId}:${Date.now()}`,
      recipientPhoneE164: DESIGNATED_OWNER_PHONE,
      recipientRole: 'SUPER_ADMIN',
      title: `Super Admin Alert: ${params.eventType.replace(/_/g, ' ')}`,
      message: params.summary,
      type:
        params.eventType.startsWith('ADMIN_')
          ? 'SUPER_ADMIN_PRIVILEGE_CHANGE'
          : params.eventType === 'SECURITY_VIOLATION'
            ? 'SUPER_ADMIN_SECURITY_EVENT'
            : params.eventType === 'OPERATIONAL_FAILURE'
              ? 'SUPER_ADMIN_BACKEND_FAILURE'
              : 'SUPER_ADMIN_CONFIG_CHANGE',
      category:
        params.eventType === 'SECURITY_VIOLATION'
          ? 'ACCOUNT_SECURITY'
          : 'ADMIN_ALERTS',
      severity:
        params.eventType === 'SECURITY_VIOLATION' ||
        params.eventType === 'OPERATIONAL_FAILURE' ||
        params.eventType === 'ADMIN_REVOKED'
          ? 'CRITICAL'
          : 'INFO',
      isMandatory: true,
      relatedEntityId: params.targetId,
      relatedEntityType: 'ADMIN',
      destinationRoute: '/?view=admin',
    });

    // 2. If an operational Admin was invited/revoked/reactivated, notify that Admin directly
    if (
      cleanTargetPhone &&
      (params.eventType === 'ADMIN_INVITED' ||
        params.eventType === 'ADMIN_REVOKED' ||
        params.eventType === 'ADMIN_REACTIVATED')
    ) {
      await dispatchUnifiedNotification({
        eventKey: `ADMIN:PRIVILEGE:${params.eventType}:${cleanTargetPhone}:${Date.now()}`,
        recipientPhoneE164: cleanTargetPhone,
        recipientRole: 'ADMIN',
        title:
          params.eventType === 'ADMIN_INVITED'
            ? 'Administrator Access Granted — Citykart'
            : params.eventType === 'ADMIN_REVOKED'
              ? 'Administrator Access Revoked — Citykart'
              : 'Administrator Access Reactivated — Citykart',
        message: params.summary,
        type: 'ADMIN_PLATFORM_ALERT',
        category: 'ACCOUNT_SECURITY',
        severity: params.eventType === 'ADMIN_REVOKED' ? 'WARNING' : 'SUCCESS',
        isMandatory: true,
        relatedEntityId: params.targetId,
        relatedEntityType: 'ADMIN',
        destinationRoute: '/?view=admin',
      });
    }

    // 3. If a Buyer account was suspended/restored, notify the Buyer
    if (
      cleanTargetPhone &&
      (params.eventType === 'BUYER_SUSPENDED' ||
        params.eventType === 'BUYER_RESTORED')
    ) {
      await dispatchUnifiedNotification({
        eventKey: `BUYER:STATUS:${params.eventType}:${cleanTargetPhone}:${Date.now()}`,
        recipientPhoneE164: cleanTargetPhone,
        recipientRole: 'BUYER',
        title:
          params.eventType === 'BUYER_SUSPENDED'
            ? 'Account Security Notice: Account Paused'
            : 'Account Restored to Active Status',
        message: params.summary,
        type: 'BUYER_SECURITY_ALERT',
        category: 'ACCOUNT_SECURITY',
        severity: params.eventType === 'BUYER_SUSPENDED' ? 'CRITICAL' : 'SUCCESS',
        isMandatory: true,
        relatedEntityId: params.targetId,
        relatedEntityType: 'USER',
        destinationRoute: '/',
      });
    }
  } catch (err) {
    console.warn('[Notification Events] Governance notification warning:', err);
  }
}

/**
 * 13. Admin / Super Admin Controlled Announcement & Promotional Broadcast
 */
export async function broadcastAdminAnnouncement(params: {
  targetRole: NotificationRole | 'ALL';
  recipientPhoneE164?: string;
  recipientSellerId?: string;
  recipientPartnerId?: string;
  title: string;
  message: string;
  category?: NotificationCategory;
  severity?: NotificationSeverity;
  isMandatory?: boolean;
  destinationRoute?: string;
}): Promise<UnifiedNotificationRecord[]> {
  const created: UnifiedNotificationRecord[] = [];
  const category = params.category || 'MARKETING_PROMOTIONS';
  const severity = params.severity || 'INFO';
  const batchId = `bcast_${Date.now()}`;

  // If targeted to a specific recipient phone, sellerId, or partnerId
  if (
    params.recipientPhoneE164 ||
    params.recipientSellerId ||
    params.recipientPartnerId
  ) {
    const role: NotificationRole =
      params.targetRole === 'ALL' ? 'BUYER' : params.targetRole;
    const res = await dispatchUnifiedNotification({
      eventKey: `BCAST:${batchId}:${role}:${params.recipientPhoneE164 || params.recipientSellerId || params.recipientPartnerId}`,
      recipientPhoneE164: params.recipientPhoneE164,
      recipientSellerId: params.recipientSellerId,
      recipientPartnerId: params.recipientPartnerId,
      recipientRole: role,
      title: params.title,
      message: params.message,
      type:
        category === 'MARKETING_PROMOTIONS'
          ? 'PROMOTIONAL_OFFER_ANNOUNCEMENT'
          : 'ADMIN_ANNOUNCEMENT',
      category,
      severity,
      isMandatory: params.isMandatory,
      relatedEntityId: batchId,
      relatedEntityType: 'SYSTEM',
      destinationRoute: params.destinationRoute,
    });
    created.push(res.notification);
    return created;
  }

  // Otherwise broadcast to all known recipients matching targetRole
  const targetRoles: NotificationRole[] =
    params.targetRole === 'ALL'
      ? ['BUYER', 'SELLER', 'PARTNER', 'ADMIN', 'SUPER_ADMIN']
      : [params.targetRole];

  for (const r of targetRoles) {
    if (r === 'BUYER') {
      const buyerPhones = new Set<string>(['+919876543210']);
      for (const acc of serverUserAccounts.values()) {
        if (acc.phoneE164) buyerPhones.add(acc.phoneE164);
      }
      for (const phone of buyerPhones) {
        const res = await dispatchUnifiedNotification({
          eventKey: `BCAST:${batchId}:BUYER:${phone}`,
          recipientPhoneE164: phone,
          recipientRole: 'BUYER',
          title: params.title,
          message: params.message,
          type: 'PROMOTIONAL_OFFER_ANNOUNCEMENT',
          category,
          severity,
          isMandatory: params.isMandatory,
          relatedEntityId: batchId,
          relatedEntityType: 'SYSTEM',
          destinationRoute: params.destinationRoute || '/',
        });
        created.push(res.notification);
      }
    } else if (r === 'SELLER') {
      const sellerIds = new Set<string>(['seller-1']);
      for (const st of serverStoresRegistry.values()) {
        if (st.sellerId) sellerIds.add(st.sellerId);
      }
      for (const sid of sellerIds) {
        const res = await dispatchUnifiedNotification({
          eventKey: `BCAST:${batchId}:SELLER:${sid}`,
          recipientSellerId: sid,
          recipientRole: 'SELLER',
          title: params.title,
          message: params.message,
          type: 'ADMIN_ANNOUNCEMENT',
          category,
          severity,
          isMandatory: params.isMandatory,
          relatedEntityId: batchId,
          relatedEntityType: 'SYSTEM',
          destinationRoute: params.destinationRoute || '/?view=seller',
        });
        created.push(res.notification);
      }
    } else {
      const res = await dispatchUnifiedNotification({
        eventKey: `BCAST:${batchId}:${r}:role`,
        recipientPhoneE164:
          r === 'SUPER_ADMIN' || r === 'ADMIN'
            ? DESIGNATED_OWNER_PHONE
            : undefined,
        recipientRole: r,
        title: params.title,
        message: params.message,
        type: 'ADMIN_ANNOUNCEMENT',
        category,
        severity,
        isMandatory: params.isMandatory,
        relatedEntityId: batchId,
        relatedEntityType: 'SYSTEM',
        destinationRoute: params.destinationRoute,
      });
      created.push(res.notification);
    }
  }

  return created;
}
