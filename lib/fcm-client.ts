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

    const vapidKey =
      process.env.NEXT_PUBLIC_FIREBASE_WEB_PUSH_CERTIFICATE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
      ...(vapidKey ? {vapidKey} : {}),
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
          const title =
            payload.notification?.title ||
            payload.data?.title ||
            'Citykart Order Update';
          const body =
            payload.notification?.body ||
            payload.data?.body ||
            'You have a new order update.';
          onNotification({
            title,
            body,
            data: payload.data as Record<string, string> | undefined,
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
