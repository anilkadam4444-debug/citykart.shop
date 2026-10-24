// Firebase Cloud Messaging Service Worker for Citykart.shop
// Handles background push notifications when the web app is minimized or closed.

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize Firebase inside the Service Worker
firebase.initializeApp({
  projectId: "urbandirectintracity",
  appId: "1:397772731387:web:0896d9396c3966a283915e",
  apiKey: "AIzaSyDxbT6rWpl3mrVT5RcwNHVT_T_gecLubkA",
  authDomain: "urbandirectintracity.firebaseapp.com",
  messagingSenderId: "397772731387",
  storageBucket: "urbandirectintracity.firebasestorage.app"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[Citykart FCM SW] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Citykart Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new update on Citykart.',
    icon: '/citykart-icon.png',
    badge: '/citykart-icon.png',
    data: {
      orderId: payload.data?.orderId || '',
      url: payload.data?.url || (payload.data?.orderId ? `/?orderId=${payload.data.orderId}` : '/'),
    },
    tag: payload.data?.orderId ? `order-${payload.data.orderId}` : 'citykart-notif',
    renotify: true,
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
