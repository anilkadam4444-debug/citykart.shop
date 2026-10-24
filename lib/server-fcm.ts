import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getMessaging, SendResponse } from 'firebase-admin/messaging';
import firebaseConfig from '../firebase-applet-config.json';
import { getFcmTokensForRecipient, removeInvalidFcmToken } from './fcm-registry';

// Initialize Firebase Admin SDK once on server if not initialized
if (!getApps().length) {
  try {
    initializeApp({
      projectId: firebaseConfig.projectId,
      credential: applicationDefault(),
    });
  } catch {
    try {
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
    } catch (err) {
      console.warn('[Server FCM] Admin app init deferred:', err);
    }
  }
}

// Idempotency tracking set to ensure a single order creation event never sends duplicate push notifications
const sentOrderPushSet = new Set<string>();

export interface OrderPushPayload {
  orderId: string;
  sellerId: string;
  sellerUid?: string;
  buyerUid?: string;
  buyerPhone?: string;
  storeName: string;
  itemCount: number;
  totalAmount: number;
  customerName: string;
}

export interface PushDeliveryResult {
  sellerTokensFound: number;
  buyerTokensFound: number;
  sellerSuccessCount: number;
  buyerSuccessCount: number;
  errors: string[];
  idempotentSkipped?: boolean;
}

export async function sendNewOrderPushNotifications(payload: OrderPushPayload): Promise<PushDeliveryResult> {
  const pushKey = `order-push-${payload.orderId}`;

  // Idempotency check: avoid repeated pushes for the same order
  if (sentOrderPushSet.has(pushKey)) {
    return {
      sellerTokensFound: 0,
      buyerTokensFound: 0,
      sellerSuccessCount: 0,
      buyerSuccessCount: 0,
      errors: [],
      idempotentSkipped: true,
    };
  }

  sentOrderPushSet.add(pushKey);

  const result: PushDeliveryResult = {
    sellerTokensFound: 0,
    buyerTokensFound: 0,
    sellerSuccessCount: 0,
    buyerSuccessCount: 0,
    errors: [],
  };

  // 1. Fetch Tokens for Seller & Buyer
  const [sellerTokens, buyerTokens] = await Promise.all([
    getFcmTokensForRecipient({ sellerId: payload.sellerId, sellerUid: payload.sellerUid }),
    getFcmTokensForRecipient({ buyerUid: payload.buyerUid, buyerPhone: payload.buyerPhone }),
  ]);

  result.sellerTokensFound = sellerTokens.length;
  result.buyerTokensFound = buyerTokens.length;

  // 2. Dispatch Push to Seller Device(s)
  if (sellerTokens.length > 0) {
    const title = `🚨 New Order #${payload.orderId}`;
    const body = `New order from ${payload.customerName} for ${payload.itemCount} item(s) (₹${payload.totalAmount}) at ${payload.storeName}.`;

    const sellerRes = await sendFcmMulticast(sellerTokens, {
      title,
      body,
      orderId: payload.orderId,
      recipientType: 'SELLER',
      url: `/?view=seller_dashboard&orderId=${payload.orderId}`,
    });

    result.sellerSuccessCount = sellerRes.successCount;
    result.errors.push(...sellerRes.errors);
  }

  // 3. Dispatch Confirmation Push to Buyer Device(s)
  if (buyerTokens.length > 0) {
    const title = `🎉 Order Placed #${payload.orderId}`;
    const body = `Your order with ${payload.storeName} for ₹${payload.totalAmount} has been received and confirmed!`;

    const buyerRes = await sendFcmMulticast(buyerTokens, {
      title,
      body,
      orderId: payload.orderId,
      recipientType: 'BUYER',
      url: `/?view=buyer_orders&orderId=${payload.orderId}`,
    });

    result.buyerSuccessCount = buyerRes.successCount;
    result.errors.push(...buyerRes.errors);
  }

  return result;
}

async function sendFcmMulticast(
  tokens: string[],
  dataPayload: { title: string; body: string; orderId: string; recipientType: string; url: string }
): Promise<{ successCount: number; errors: string[] }> {
  let successCount = 0;
  const errors: string[] = [];

  try {
    const messaging = getMessaging();

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: dataPayload.title,
        body: dataPayload.body,
      },
      data: {
        title: dataPayload.title,
        body: dataPayload.body,
        orderId: dataPayload.orderId,
        recipientType: dataPayload.recipientType,
        url: dataPayload.url,
      },
      webpush: {
        notification: {
          title: dataPayload.title,
          body: dataPayload.body,
          icon: '/citykart-icon.png',
          badge: '/citykart-icon.png',
        },
        fcmOptions: {
          link: dataPayload.url,
        },
      },
    });

    successCount = response.successCount;

    // Clean up invalid or unregistered tokens
    response.responses.forEach((res: SendResponse, idx: number) => {
      if (!res.success && res.error) {
        const errCode = res.error.code;
        if (
          errCode === 'messaging/invalid-registration-token' ||
          errCode === 'messaging/registration-token-not-registered'
        ) {
          void removeInvalidFcmToken(tokens[idx]);
        } else {
          errors.push(`Token [${tokens[idx].slice(0, 8)}...]: ${res.error.message}`);
        }
      }
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn('[Server FCM] Multicast delivery notice:', errMsg);
    errors.push(`FCM delivery error: ${errMsg}`);
  }

  return { successCount, errors };
}
