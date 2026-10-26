import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import {getMessaging} from 'firebase-admin/messaging';
import {OrderRecord} from './catalog-data';
import {
  getFcmTokensForRecipient,
  removeInvalidFcmToken,
} from './fcm-registry';
import {db} from './firebase';
import {doc, setDoc} from 'firebase/firestore';
import {
  buildUnifiedBuyerOrderAndPinNotification,
  buildUnifiedSellerOrderNotification,
  MANDATORY_BUYER_PIN_WARNING,
  resolveEstimatedDeliveryMinsForOrder,
  resolveSellerPhoneForOrder,
} from './delivery-pin';

let adminInitialized = false;
let hasExplicitServiceAccount = false;

// Idempotency guard to ensure each new order triggers push notifications at most once
const dispatchedNewOrderIds = new Set<string>();

function ensureFirebaseAdminInitialized(): boolean {
  if (adminInitialized) return true;
  try {
    if (getApps().length === 0) {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (serviceAccountJson && serviceAccountJson.trim().startsWith('{')) {
        const parsedCert = JSON.parse(serviceAccountJson);
        initializeApp({
          credential: cert(parsedCert),
          projectId: 'urbandirectintracity',
        });
        hasExplicitServiceAccount = true;
      } else {
        try {
          initializeApp({
            credential: applicationDefault(),
            projectId: 'urbandirectintracity',
          });
        } catch {
          initializeApp({
            projectId: 'urbandirectintracity',
          });
        }
      }
    }
    adminInitialized = true;
    return true;
  } catch (err) {
    console.warn(
      '[Server FCM] Firebase Admin initialization warning:',
      err instanceof Error ? err.message : String(err)
    );
    return false;
  }
}

export type PushDeliveryStatus =
  | 'ACCEPTED_BY_FCM'
  | 'IN_APP_QUEUED_NO_FCM_TOKENS'
  | 'IN_APP_QUEUED_FCM_CREDENTIALS_REQUIRED'
  | 'DUPLICATE_SKIPPED'
  | 'FCM_SEND_FAILED';

export interface NewOrderNotificationResult {
  status: PushDeliveryStatus;
  idempotentSkip: boolean;
  inAppSellerNotificationPersisted: boolean;
  sellerTokensFound: number;
  sellerSuccessCount: number;
  sellerUnifiedTitle?: string;
  sellerUnifiedBody?: string;
  sellerUnifiedSmsText?: string;
  buyerTokensFound: number;
  buyerSuccessCount: number;
  buyerUnifiedTitle?: string;
  buyerUnifiedBody?: string;
  errors: string[];
}

export async function sendNewOrderPushNotifications(
  order: OrderRecord,
  deliveryPin?: string
): Promise<NewOrderNotificationResult> {
  if (dispatchedNewOrderIds.has(order.id)) {
    return {
      status: 'DUPLICATE_SKIPPED',
      idempotentSkip: true,
      inAppSellerNotificationPersisted: true,
      sellerTokensFound: 0,
      sellerSuccessCount: 0,
      buyerTokensFound: 0,
      buyerSuccessCount: 0,
      errors: [],
    };
  }
  dispatchedNewOrderIds.add(order.id);

  const errors: string[] = [];
  let inAppPersisted = false;

  const unifiedSellerNotif = buildUnifiedSellerOrderNotification({ order });

  try {
    const notifId = `notif-${order.id}`;
    await setDoc(
      doc(db, 'sellerNotifications', notifId),
      {
        id: notifId,
        sellerId: order.sellerId,
        sellerUid: order.sellerUid || order.sellerId,
        storeId: order.storeId,
        orderId: order.id,
        title: unifiedSellerNotif.title,
        message: unifiedSellerNotif.body,
        smsText: unifiedSellerNotif.smsText,
        buyerFullName: unifiedSellerNotif.buyerFullName,
        buyerPhone: unifiedSellerNotif.buyerPhone,
        buyerFullAddress: unifiedSellerNotif.buyerFullAddress,
        ...(unifiedSellerNotif.deliveryNotes
          ? { deliveryNotes: unifiedSellerNotif.deliveryNotes }
          : {}),
        createdAt: order.createdAtIso || new Date().toISOString(),
        isRead: false,
        type: 'NEW_ORDER',
      },
      {merge: true}
    );
    inAppPersisted = true;
  } catch (err) {
    console.warn(
      '[Server FCM] Could not persist sellerNotification to Firestore:',
      err instanceof Error ? err.message : String(err)
    );
  }

  const [sellerTokens, buyerTokens] = await Promise.all([
    getFcmTokensForRecipient({
      sellerId: order.sellerId,
      sellerUid: order.sellerUid,
    }),
    getFcmTokensForRecipient({
      buyerUid: order.buyerUid,
      buyerPhone: order.customer.phone,
    }),
  ]);

  let sellerSuccessCount = 0;
  let buyerSuccessCount = 0;

  if (sellerTokens.length === 0 && buyerTokens.length === 0) {
    return {
      status: 'IN_APP_QUEUED_NO_FCM_TOKENS',
      idempotentSkip: false,
      inAppSellerNotificationPersisted: inAppPersisted,
      sellerTokensFound: 0,
      sellerSuccessCount: 0,
      buyerTokensFound: 0,
      buyerSuccessCount: 0,
      errors: [],
    };
  }

  if (!ensureFirebaseAdminInitialized()) {
    return {
      status: 'IN_APP_QUEUED_FCM_CREDENTIALS_REQUIRED',
      idempotentSkip: false,
      inAppSellerNotificationPersisted: inAppPersisted,
      sellerTokensFound: sellerTokens.length,
      sellerSuccessCount: 0,
      buyerTokensFound: buyerTokens.length,
      buyerSuccessCount: 0,
      errors: ['Firebase Admin SDK could not be initialized.'],
    };
  }

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const sellerClickAction = `/seller/dashboard?section=orders&orderId=${encodeURIComponent(
    order.id
  )}`;
  const buyerClickAction = `/orders?orderId=${encodeURIComponent(order.id)}`;

  const sellerTitle = unifiedSellerNotif.title;
  const sellerBody = unifiedSellerNotif.body;

  if (sellerTokens.length > 0) {
    try {
      const sellerResponse = await getMessaging().sendEachForMulticast({
        tokens: sellerTokens,
        notification: {
          title: sellerTitle,
          body: sellerBody,
        },
        data: {
          orderId: String(order.id),
          storeId: String(order.storeId),
          storeName: String(order.storeName),
          sellerId: String(order.sellerId),
          buyerFullName: String(unifiedSellerNotif.buyerFullName),
          buyerPhone: String(unifiedSellerNotif.buyerPhone),
          buyerFullAddress: String(unifiedSellerNotif.buyerFullAddress),
          deliveryNotes: String(unifiedSellerNotif.deliveryNotes || ''),
          totalAmount: String(order.total),
          currency: 'INR',
          status: String(order.orderStatus || 'NEW'),
          eventType: 'NEW_ORDER',
          recipientRole: 'SELLER',
          title: sellerTitle,
          body: sellerBody,
          clickAction: sellerClickAction,
          timestamp: new Date().toISOString(),
        },
        webpush: {
          notification: {
            title: sellerTitle,
            body: sellerBody,
            icon: '/citykart-icon.png',
            badge: '/citykart-icon.png',
            tag: `citykart-order-${order.id}-SELLER`,
            renotify: false,
          },
          fcmOptions: {
            link: sellerClickAction,
          },
        },
      });

      sellerSuccessCount = sellerResponse.successCount;

      sellerResponse.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          errors.push(`Seller FCM [${code}]: ${resp.error.message}`);
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            void removeInvalidFcmToken(sellerTokens[idx]);
          }
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Seller FCM dispatch notice: ${msg}`);
    }
  }

  const unifiedBuyerNotif = deliveryPin
    ? buildUnifiedBuyerOrderAndPinNotification({
        order,
        pin: deliveryPin,
      })
    : null;

  const resolvedSellerPhone =
    unifiedBuyerNotif?.sellerPhone || resolveSellerPhoneForOrder(order);
  const resolvedEstMins =
    unifiedBuyerNotif?.estimatedDeliveryMins ||
    resolveEstimatedDeliveryMinsForOrder(order);

  const buyerTitle = unifiedBuyerNotif
    ? unifiedBuyerNotif.title
    : `Order Confirmed #${order.id}`;
  const buyerBody = unifiedBuyerNotif
    ? unifiedBuyerNotif.body
    : `${order.storeName} received your order of ₹${order.total} (${itemCount} item(s)). Estimated Delivery: ~${resolvedEstMins} mins. Seller Mobile: ${resolvedSellerPhone}.`;

  if (buyerTokens.length > 0) {
    try {
      const buyerResponse = await getMessaging().sendEachForMulticast({
        tokens: buyerTokens,
        notification: {
          title: buyerTitle,
          body: buyerBody,
        },
        data: {
          orderId: String(order.id),
          storeId: String(order.storeId),
          storeName: String(order.storeName),
          sellerId: String(order.sellerId),
          sellerPhone: String(resolvedSellerPhone),
          estimatedDeliveryMins: String(resolvedEstMins),
          totalAmount: String(order.total),
          currency: 'INR',
          status: String(order.orderStatus || 'NEW'),
          eventType: 'ORDER_PLACED_WITH_DELIVERY_PIN',
          recipientRole: 'BUYER',
          deliveryPin: String(deliveryPin || ''),
          safetyInstructions: MANDATORY_BUYER_PIN_WARNING,
          title: buyerTitle,
          body: buyerBody,
          clickAction: buyerClickAction,
          timestamp: new Date().toISOString(),
        },
        webpush: {
          notification: {
            title: buyerTitle,
            body: buyerBody,
            icon: '/citykart-icon.png',
            badge: '/citykart-icon.png',
            tag: `citykart-order-${order.id}-BUYER`,
            renotify: false,
          },
          fcmOptions: {
            link: buyerClickAction,
          },
        },
      });

      buyerSuccessCount = buyerResponse.successCount;

      buyerResponse.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          errors.push(`Buyer FCM [${code}]: ${resp.error.message}`);
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            void removeInvalidFcmToken(buyerTokens[idx]);
          }
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Buyer FCM dispatch notice: ${msg}`);
    }
  }

  const totalSuccess = sellerSuccessCount + buyerSuccessCount;
  let status: PushDeliveryStatus = 'ACCEPTED_BY_FCM';
  if (totalSuccess === 0) {
    const isCredentialError =
      !hasExplicitServiceAccount &&
      errors.some(
        (e) =>
          e.includes('credential') ||
          e.includes('authentication') ||
          e.includes('access token') ||
          e.includes('Permission')
      );
    status = isCredentialError
      ? 'IN_APP_QUEUED_FCM_CREDENTIALS_REQUIRED'
      : 'FCM_SEND_FAILED';
  }

  return {
    status,
    idempotentSkip: false,
    inAppSellerNotificationPersisted: inAppPersisted,
    sellerTokensFound: sellerTokens.length,
    sellerSuccessCount,
    sellerUnifiedTitle: sellerTitle,
    sellerUnifiedBody: sellerBody,
    sellerUnifiedSmsText: unifiedSellerNotif.smsText,
    buyerTokensFound: buyerTokens.length,
    buyerSuccessCount,
    buyerUnifiedTitle: buyerTitle,
    buyerUnifiedBody: buyerBody,
    errors,
  };
}
