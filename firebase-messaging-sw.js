importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');
importScripts('./firebase-config-sw.js');

if (self.GRADE2_FIREBASE_CONFIG && self.GRADE2_FIREBASE_CONFIG.apiKey) {
  firebase.initializeApp(self.GRADE2_FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || payload?.data?.title || '2年便利サイト';
    const options = {
      body: payload?.notification?.body || payload?.data?.body || '更新通知を受信しました。',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: payload?.data || {}
    };
    self.registration.showNotification(title, options);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.screen ? `./#${event.notification.data.screen}` : './';
  event.waitUntil(clients.openWindow(url));
});
