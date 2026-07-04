try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");
  importScripts("./firebase-config-sw.js");

  if (self.GRADE2_FIREBASE_CONFIG && self.GRADE2_FIREBASE_CONFIG.apiKey) {
    firebase.initializeApp(self.GRADE2_FIREBASE_CONFIG);

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(function(payload) {
      const title =
        (payload.notification && payload.notification.title) ||
        (payload.data && payload.data.title) ||
        "2年便利サイト";

      const options = {
        body:
          (payload.notification && payload.notification.body) ||
          (payload.data && payload.data.body) ||
          "更新通知を受信しました。",
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-192.png",
        data: payload.data || {}
      };

      self.registration.showNotification(title, options);
    });
  }
} catch (error) {
  console.error("firebase-messaging-sw.js error:", error);
}

self.addEventListener("notificationclick", function(event) {
  event.notification.close();

  const url =
    event.notification &&
    event.notification.data &&
    event.notification.data.screen
      ? "./#" + event.notification.data.screen
      : "./";

  event.waitUntil(clients.openWindow(url));
});
