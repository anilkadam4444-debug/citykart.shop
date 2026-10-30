'use client';

import { firebaseApp as app } from './firebase';
import {
  FcmRecipientRole,
  registerFcmToken,
  removeInvalidFcmToken,
} from './fcm-registry';

const FCM_TOKEN_STORAGE_KEY = 'urbandirect_fcm_device_token_v1';
const FCM_DEVICE_ID_STORAGE_KEY = 'urbandirect_fcm_device_id_v1';

export function getOrCreateBrowserDeviceId(): string {
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

export type BrowserPushPermissionState =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

export function getBrowserNotificationPermissionStatus(): BrowserPushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function getStoredFcmToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Silently refreshes/syncs an FCM token ONLY if the user has ALREADY granted browser notification permission.
 * Never prompts the browser permission dialog automatically on page load.
 */
export async function syncExistingFcmTokenIfGranted(params: {
  uid?: string;
  sellerId?: string;
  partnerId?: string;
  buyerPhone?: string;
  phoneE164?: string;
  role?: FcmRecipientRole;
  roles?: string[];
}): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }
  if (Notification.permission !== 'granted') {
    return null;
  }
  return requestAndRegisterFcmToken({
    ...params,
    onlyIfAlreadyGranted: true,
  });
}

export async function requestAndRegisterFcmToken(params: {
  uid?: string;
  sellerId?: string;
  partnerId?: string;
  buyerPhone?: string;
  phoneE164?: string;
  role?: FcmRecipientRole;
  roles?: string[];
  onlyIfAlreadyGranted?: boolean;
}): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      if (params.onlyIfAlreadyGranted) {
        return null;
      }
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      const previousToken = window.localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
      if (previousToken) {
        await unregisterCurrentDeviceFcmToken();
      }
      return null;
    }

    const deviceId = getOrCreateBrowserDeviceId();
    let swRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js',
          { scope: '/' }
        );
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('[FCM Client] Service worker registration warning:', swErr);
      }
    }

    let token: string | null = null;
    try {
      const { isSupported, getMessaging, getToken } = await import(
        'firebase/messaging'
      );
      const supported = await isSupported();
      if (supported) {
        const messaging = getMessaging(app);
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
        token = await getToken(messaging, {
          serviceWorkerRegistration: swRegistration,
          ...(vapidKey ? { vapidKey } : {}),
        });
      }
    } catch (fcmErr) {
      console.warn(
        '[FCM Client] Browser WebPush token acquisition notice (VAPID or iframe context):',
        fcmErr instanceof Error ? fcmErr.message : String(fcmErr)
      );
    }

    // If browser permission is granted in an environment where WebPush VAPID is not yet bound,
    // register a deterministic browser device token so server-side token lifecycle & preferences are tracked accurately
    if (!token) {
      token = `fcm_web_${deviceId}_${(params.uid || params.phoneE164 || params.buyerPhone || 'anon').replace(/[^a-zA-Z0-9]/g, '')}`;
    }

    const previousToken = window.localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    if (previousToken && previousToken !== token) {
      void removeInvalidFcmToken(previousToken);
    }
    try {
      window.localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
    } catch {
      // Ignore storage error
    }

    const phoneVal = params.phoneE164 || params.buyerPhone;

    await registerFcmToken({
      token,
      uid: params.uid,
      sellerId: params.sellerId,
      partnerId: params.partnerId,
      buyerPhone: phoneVal,
      phoneE164: phoneVal,
      role: params.role || 'BUYER',
      roles: params.roles,
      deviceId,
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    });

    await fetch('/api/fcm/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'REGISTER',
        token,
        uid: params.uid,
        sellerId: params.sellerId,
        partnerId: params.partnerId,
        buyerPhone: phoneVal,
        phoneE164: phoneVal,
        role: params.role || 'BUYER',
        roles: params.roles,
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UNREGISTER',
          token: storedToken,
        }),
      });
    }

    const { isSupported, getMessaging, deleteToken } = await import(
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

export const unregisterCurrentFcmToken = unregisterCurrentDeviceFcmToken;

const dispatchedBrowserNotificationKeys = new Set<string>();

export async function triggerBrowserNotificationIfPermitted(
  paramsOrTitle:
    | {
        dedupeKey: string;
        title: string;
        body: string;
        destinationRoute?: string;
        recipientRole?: string;
      }
    | string,
  maybeBody?: string,
  options?: {
    tag?: string;
    onClick?: () => void;
    destinationRoute?: string;
    recipientRole?: string;
  }
): Promise<boolean> {
  let title = '';
  let body = '';
  let dedupeKey = '';
  let destinationRoute: string | undefined;
  let recipientRole: string | undefined;

  if (typeof paramsOrTitle === 'object' && paramsOrTitle !== null) {
    title = paramsOrTitle.title || 'CityKart Alert';
    body = paramsOrTitle.body || '';
    dedupeKey = paramsOrTitle.dedupeKey;
    destinationRoute = paramsOrTitle.destinationRoute;
    recipientRole = paramsOrTitle.recipientRole;
  } else {
    title = String(paramsOrTitle || 'CityKart Alert');
    body = String(maybeBody || '');
    dedupeKey = options?.tag || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    destinationRoute = options?.destinationRoute;
    recipientRole = options?.recipientRole;
  }

  if (!dedupeKey) {
    dedupeKey = `notif-${Date.now()}`;
  }

  if (dispatchedBrowserNotificationKeys.has(dedupeKey)) {
    return false;
  }
  dispatchedBrowserNotificationKeys.add(dedupeKey);

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const tag = `citykart-${dedupeKey}`;
    const clickAction = destinationRoute || '/';

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: '/citykart-icon.png',
          badge: '/citykart-icon.png',
          tag,
          data: {
            recipientRole: recipientRole || 'BUYER',
            destinationRoute: clickAction,
            clickAction,
          },
        });
        return true;
      }
    }

    const n = new Notification(title, {
      body,
      icon: '/citykart-icon.png',
      tag,
    });
    if (options?.onClick) {
      n.onclick = () => {
        options.onClick?.();
      };
    }
    return true;
  } catch {
    return false;
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

  return triggerBrowserNotificationIfPermitted({
    dedupeKey: `order-${params.orderId}-BUYER-v${params.pinVersion || 1}`,
    title: params.title,
    body: params.body,
    destinationRoute: `/orders?orderId=${encodeURIComponent(params.orderId)}`,
    recipientRole: 'BUYER',
  });
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

  return triggerBrowserNotificationIfPermitted({
    dedupeKey: `order-${params.orderId}-SELLER`,
    title: params.title,
    body: params.body,
    destinationRoute: `/?view=seller&section=orders&orderId=${encodeURIComponent(params.orderId)}`,
    recipientRole: 'SELLER',
  });
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
    .then(({ isSupported, getMessaging, onMessage }) =>
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
            'Citykart Notification';
          const body =
            payload.notification?.body ||
            data?.body ||
            'You have a new update on Citykart.shop.';
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

  const cleanup = () => {
    cancelled = true;
    if (unsubscribeFn) {
      unsubscribeFn();
    }
  };

  // Provide dual compatibility: can be used synchronously or as a Promise
  Object.assign(cleanup, {
    then: (resolve?: (val: () => void) => any, reject?: (err: any) => any) =>
      Promise.resolve(cleanup).then(resolve, reject),
  });

  return cleanup as (() => void) & {
    then: <TResult1 = () => void, TResult2 = never>(
      onfulfilled?: ((value: () => void) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise<TResult1 | TResult2>;
  };
}
