// Firebase Cloud Messaging Service Worker for Citykart.shop (urbandirectintracity)
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDxbT6rWpl3mrVT5RcwNHVT_T_gecLubkA",
  authDomain: "urbandirectintracity.firebaseapp.com",
  projectId: "urbandirectintracity",
  storageBucket: "urbandirectintracity.firebasestorage.app",
  messagingSenderId: "397772731387",
  appId: "1:397772731387:web:0896d9396c3966a283915e"
});

const messaging = firebase.messaging();

function resolveDefaultDestinationRoute(data) {
  if (data.destinationRoute) return data.destinationRoute;
  if (data.clickAction) return data.clickAction;
  const recipientRole = String(data.recipientRole || 'BUYER').toUpperCase();
  const orderId = data.orderId || data.relatedEntityId || '';
  if (recipientRole === 'BUYER') {
    return orderId ? `/orders?orderId=${encodeURIComponent(orderId)}` : '/orders';
  }
  if (recipientRole === 'SELLER') {
    return orderId
      ? `/?view=seller&section=orders&orderId=${encodeURIComponent(orderId)}`
      : '/?view=seller';
  }
  if (recipientRole === 'PARTNER') {
    return '/partner';
  }
  if (recipientRole === 'ADMIN' || recipientRole === 'SUPER_ADMIN') {
    return '/?view=admin';
  }
  return '/';
}

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const recipientRole = data.recipientRole || 'BUYER';
  const notificationId = data.notificationId || data.eventKey || data.orderId || 'latest';

  // If the FCM payload already includes a top-level `notification` block,
  // the browser displays it automatically using the `webpush.fcmOptions.link` and `tag`.
  // Only call `showNotification` manually for data-only background messages to prevent duplicate alerts.
  if (payload.notification) {
    return;
  }

  const notificationTitle =
    data.title || 'Citykart Notification';
  const notificationBody =
    data.body || data.message || 'Tap to view your latest update on Citykart.shop';

  const destinationRoute = resolveDefaultDestinationRoute(data);

  const notificationOptions = {
    body: notificationBody,
    icon: '/citykart-icon.png',
    badge: '/citykart-icon.png',
    tag: `citykart-notif-${notificationId}-${recipientRole}`,
    renotify: false,
    data: {
      ...data,
      destinationRoute,
      clickAction: destinationRoute,
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = resolveDefaultDestinationRoute(data);

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
