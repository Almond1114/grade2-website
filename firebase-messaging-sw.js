const SITE_CACHE = "grade2-firebase-pwa-v6-live-system-20260712";
const SITE_ASSETS = [
  "./",
  "./index.html",
  "./classes.html",
  "./tests.html",
  "./homework.html",
  "./announcements.html",
  "./links.html",
  "./edit.html",
  "./notifications.html",
  "./reset-cache.html",
  "./style.css",
  "./responsive-ui.css",
  "./mobile-editor-fix.css",
  "./brand-icon.css",
  "./stylish-ui.css",
  "./exceptional-ui.css",
  "./live-system-ui.css",
  "./theme.js",
  "./ux-enhancements.js",
  "./live-system-ui.js",
  "./app-config.js",
  "./app-core.js",
  "./editor-add.js",
  "./notifications-web.js",
  "./mobile-notification-fix.js",
  "./manifest.webmanifest",
  "./icons/brand-icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SITE_CACHE)
      .then(cache => cache.addAll(SITE_ASSETS))
      .catch(error => console.warn("2Base precache skipped", error))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== SITE_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(SITE_CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
  );
});

try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");
  importScripts("./firebase-config-sw.js");

  if (self.GRADE2_FIREBASE_CONFIG && self.GRADE2_FIREBASE_CONFIG.apiKey) {
    if (!firebase.apps.length) firebase.initializeApp(self.GRADE2_FIREBASE_CONFIG);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(payload => {
      if (payload && payload.notification) return;
      const title = payload?.data?.title || "2Base";
      const options = {
        body: payload?.data?.body || "更新通知を受信しました。",
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-192.png",
        data: payload?.data || {},
        tag: payload?.data?.type ? `2base-${payload.data.type}` : "2base-update",
        renotify: true
      };
      self.registration.showNotification(title, options);
    });
  }
} catch (error) {
  console.error("firebase-messaging-sw.js error:", error);
}

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const screen = event.notification?.data?.screen || "home";
  const map = {
    home: "index.html",
    prep: "index.html",
    editor: "edit.html",
    edit: "edit.html",
    tests: "tests.html",
    homework: "homework.html",
    announcements: "announcements.html",
    links: "links.html",
    notifications: "notifications.html"
  };
  const targetUrl = new URL(map[screen] || "index.html", self.registration.scope).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      const existing = windowClients.find(client => client.url.startsWith(self.registration.scope));
      if (existing) {
        existing.navigate(targetUrl);
        return existing.focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});