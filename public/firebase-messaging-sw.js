// Firebase Cloud Messaging Service Worker for Citykart.shop (urbandirectintracity)
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA2u0hT4A9w4bQxX_rB8u_9x1tY7jZ8s7A",
  authDomain: "urbandirectintracity.firebaseapp.com",
  projectId: "urbandirectintracity",
  storageBucket: "urbandirectintracity.firebasestorage.app",
  messagingSenderId: "397772731387",
  appId: "1:397772731387:web:0896d9396c3966a283915e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const orderId = data.orderId || 'latest';
  const recipientRole = data.recipientRole || 'SELLER';

  // If the FCM payload already includes a top-level `notification` block,
  // the browser displays it automatically using the `webpush.fcmOptions.link` and `tag`.
  // Only call `showNotification` manually for data-only background messages to prevent duplicate alerts.
  if (payload.notification) {
    return;
  }

  const notificationTitle =
    data.title || 'New Order Update — Citykart.shop';
  const notificationBody =
    data.body || 'Tap to view your order details on Citykart.shop';

  const defaultClickAction =
    recipientRole === 'BUYER'
      ? `/orders?orderId=${encodeURIComponent(orderId)}`
      : `/seller/dashboard?section=orders&orderId=${encodeURIComponent(orderId)}`;

  const notificationOptions = {
    body: notificationBody,
    icon: '/citykart-icon.png',
    badge: '/citykart-icon.png',
    tag: `citykart-order-${orderId}-${recipientRole}`,
    renotify: false,
    data: {
      ...data,
      clickAction: data.clickAction || defaultClickAction,
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const orderId = data.orderId || '';
  const recipientRole = data.recipientRole || '';

  let targetUrl = data.clickAction || '/';
  if (!data.clickAction && orderId) {
    targetUrl =
      recipientRole === 'BUYER'
        ? `/orders?orderId=${encodeURIComponent(orderId)}`
        : `/seller/dashboard?section=orders&orderId=${encodeURIComponent(orderId)}`;
  }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            if ('navigate' in client) {
              return client.navigate(targetUrl).then((c) => (c ? c.focus() : null));
            }
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
