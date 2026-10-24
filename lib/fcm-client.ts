import { firebaseApp } from './firebase';

export interface FcmInitResult {
  supported: boolean;
  permission: NotificationPermission;
  token: string | null;
  error: string | null;
}

export async function requestAndRegisterFcmToken(params?: {
  uid?: string;
  sellerId?: string;
  buyerPhone?: string;
  role?: 'BUYER' | 'SELLER' | 'BOTH';
}): Promise<FcmInitResult> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in window)) {
    return {
      supported: false,
      permission: 'denied',
      token: null,
      error: 'Push notifications are not supported in this browser environment.',
    };
  }

  try {
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    const supported = await isSupported();
    if (!supported) {
      return {
        supported: false,
        permission: Notification.permission,
        token: null,
        error: 'Firebase Cloud Messaging is not supported in this browser.',
      };
    }

    // 1. Request Notification Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        supported: true,
        permission,
        token: null,
        error: 'Notification permission was denied by the user.',
      };
    }

    // 2. Register Service Worker
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;

    // 3. Obtain FCM Token
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      return {
        supported: true,
        permission,
        token: null,
        error: 'Failed to retrieve FCM registration token from Firebase.',
      };
    }

    // 4. Save Token on Server Registry and Firestore
    await fetch('/api/fcm/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'REGISTER',
        token,
        uid: params?.uid,
        sellerId: params?.sellerId,
        buyerPhone: params?.buyerPhone,
        role: params?.role || 'BUYER',
      }),
    });

    return {
      supported: true,
      permission,
      token,
      error: null,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn('[FCM Client] Registration notice:', errMsg);
    return {
      supported: true,
      permission: typeof Notification !== 'undefined' ? Notification.permission : 'denied',
      token: null,
      error: errMsg,
    };
  }
}

export function subscribeToForegroundMessages(
  onForegroundNotification: (payload: { title: string; body: string; orderId?: string }) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let unsubscribe: (() => void) | null = null;

  void (async () => {
    try {
      const { getMessaging, onMessage, isSupported } = await import('firebase/messaging');
      const supported = await isSupported();
      if (!supported) return;

      const messaging = getMessaging(firebaseApp);
      unsubscribe = onMessage(messaging, (payload) => {
        console.log('[FCM Client] Foreground message received:', payload);
        const title = payload.notification?.title || payload.data?.title || 'Citykart Notification';
        const body = payload.notification?.body || payload.data?.body || '';
        const orderId = payload.data?.orderId;
        onForegroundNotification({ title, body, orderId });
      });
    } catch (err) {
      console.warn('[FCM Client] Foreground listener subscription warning:', err);
    }
  })();

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}
