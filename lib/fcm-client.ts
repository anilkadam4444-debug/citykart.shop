'use client';

import {firebaseApp as app} from './firebase';
import {registerFcmToken, removeInvalidFcmToken} from './fcm-registry';

const FCM_TOKEN_STORAGE_KEY = 'urbandirect_fcm_device_token_v1';
const FCM_DEVICE_ID_STORAGE_KEY = 'urbandirect_fcm_device_id_v1';

function getOrCreateBrowserDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const existing = window.localStorage.getItem(FCM_DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const generated = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(FCM_DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `dev-${Date.now()}`;
  }
}

export async function requestAndRegisterFcmToken(params: {
  uid?: string;
  sellerId?: string;
  buyerPhone?: string;
  role?: 'BUYER' | 'SELLER' | 'BOTH';
}): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  try {
    const {isSupported, getMessaging, getToken} = await import(
      'firebase/messaging'
    );
    const supported = await isSupported();
    if (!supported) {
      return null;
    }

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      const previousToken = window.localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
      if (previousToken) {
        await unregisterCurrentDeviceFcmToken();
      }
      return null;
    }

    const messaging = getMessaging(app);

    let swRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js',
          {scope: '/'}
        );
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('[FCM Client] Service worker registration warning:', swErr);
      }
    }

    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      return null;
    }

    const deviceId = getOrCreateBrowserDeviceId();
    const previousToken = window.localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    if (previousToken && previousToken !== token) {
      void removeInvalidFcmToken(previousToken);
    }
    try {
      window.localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
    } catch {
      // Ignore storage error
    }

    await registerFcmToken({
      token,
      uid: params.uid,
      sellerId: params.sellerId,
      buyerPhone: params.buyerPhone,
      role: params.role || 'BUYER',
      deviceId,
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    });

    await fetch('/api/fcm/token', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        action: 'REGISTER',
        token,
        uid: params.uid,
        sellerId: params.sellerId,
        buyerPhone: params.buyerPhone,
        role: params.role || 'BUYER',
        deviceId,
      }),
    });

    return token;
  } catch (err) {
    console.warn(
      '[FCM Client] Could not acquire or register FCM token:',
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

export async function unregisterCurrentDeviceFcmToken(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const storedToken = window.localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    if (storedToken) {
      window.localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
      await removeInvalidFcmToken(storedToken);
      await fetch('/api/fcm/token', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'UNREGISTER',
          token: storedToken,
        }),
      });
    }

    const {isSupported, getMessaging, deleteToken} = await import(
      'firebase/messaging'
    );
    if (await isSupported()) {
      const messaging = getMessaging(app);
      await deleteToken(messaging);
    }
  } catch {
    // Ignore cleanup errors on logout
  }
}

const dispatchedUnifiedBuyerOrderNotificationIds = new Set<string>();

/**
 * Triggers a single unified Browser Push Notification for the buyer containing:
 * 1. Successful Order Placement confirmation
 * 2. The 6-digit Delivery PIN
 * 3. Clear buyer safety instructions in the same notification.
 * Deduplicated per orderId + pinVersion so separate or duplicate notifications are never sent.
 */
export async function triggerUnifiedBuyerOrderBrowserNotification(params: {
  orderId: string;
  title: string;
  body: string;
  pinVersion?: number;
}): Promise<boolean> {
  const dedupeKey = `${params.orderId}:v${params.pinVersion || 1}`;
  if (dispatchedUnifiedBuyerOrderNotificationIds.has(dedupeKey)) {
    return false;
  }
  dispatchedUnifiedBuyerOrderNotificationIds.add(dedupeKey);

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    if (Notification.permission !== 'granted') {
      return false;
    }

    const tag = `citykart-order-${params.orderId}-BUYER`;
    const clickAction = `/orders?orderId=${encodeURIComponent(params.orderId)}`;

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(params.title, {
          body: params.body,
          icon: '/citykart-icon.png',
          badge: '/citykart-icon.png',
          tag,
          data: {
            orderId: params.orderId,
            recipientRole: 'BUYER',
            clickAction,
          },
        });
        return true;
      }
    }

    new Notification(params.title, {
      body: params.body,
      icon: '/citykart-icon.png',
      tag,
    });
    return true;
  } catch {
    return false;
  }
}

export function hasDispatchedUnifiedBuyerOrderNotification(
  orderId: string,
  pinVersion: number = 1
): boolean {
  return dispatchedUnifiedBuyerOrderNotificationIds.has(
    `${orderId}:v${pinVersion}`
  );
}

const dispatchedUnifiedSellerOrderNotificationIds = new Set<string>();

/**
 * Triggers a single unified Browser Push Notification for the seller when a buyer places an order,
 * containing the buyer's full delivery address, mobile number, and delivery note (if any).
 * Deduplicated per orderId so separate or duplicate notifications are never sent.
 */
export async function triggerUnifiedSellerOrderBrowserNotification(params: {
  orderId: string;
  title: string;
  body: string;
}): Promise<boolean> {
  if (dispatchedUnifiedSellerOrderNotificationIds.has(params.orderId)) {
    return false;
  }
  dispatchedUnifiedSellerOrderNotificationIds.add(params.orderId);

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    if (Notification.permission !== 'granted') {
      return false;
    }

    const tag = `citykart-order-${params.orderId}-SELLER`;
    const clickAction = `/seller/dashboard?section=orders&orderId=${encodeURIComponent(
      params.orderId
    )}`;

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(params.title, {
          body: params.body,
          icon: '/citykart-icon.png',
          badge: '/citykart-icon.png',
          tag,
          data: {
            orderId: params.orderId,
            recipientRole: 'SELLER',
            clickAction,
          },
        });
        return true;
      }
    }

    new Notification(params.title, {
      body: params.body,
      icon: '/citykart-icon.png',
      tag,
    });
    return true;
  } catch {
    return false;
  }
}

export function hasDispatchedUnifiedSellerOrderNotification(
  orderId: string
): boolean {
  return dispatchedUnifiedSellerOrderNotificationIds.has(orderId);
}

export function subscribeToForegroundMessages(
  onNotification: (payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let unsubscribeFn: (() => void) | null = null;
  let cancelled = false;

  import('firebase/messaging')
    .then(({isSupported, getMessaging, onMessage}) =>
      isSupported().then((supported) => {
        if (!supported || cancelled) return;
        const messaging = getMessaging(app);
        unsubscribeFn = onMessage(messaging, (payload) => {
          const data = payload.data as Record<string, string> | undefined;
          if (
            data?.recipientRole === 'BUYER' &&
            data?.orderId &&
            hasDispatchedUnifiedBuyerOrderNotification(data.orderId, 1)
          ) {
            // Already dispatched the unified order placement + PIN notification for this order
            return;
          }
          if (
            data?.recipientRole === 'SELLER' &&
            data?.orderId &&
            hasDispatchedUnifiedSellerOrderNotification(data.orderId)
          ) {
            return;
          }
          const title =
            payload.notification?.title ||
            data?.title ||
            'Citykart Order Update';
          const body =
            payload.notification?.body ||
            data?.body ||
            'You have a new order update.';
          onNotification({
            title,
            body,
            data,
          });
        });
      })
    )
    .catch(() => {
      // Ignore if unsupported in current browser environment
    });

  return () => {
    cancelled = true;
    if (unsubscribeFn) {
      unsubscribeFn();
    }
  };
}
