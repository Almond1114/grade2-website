const CACHE_NAME = "grade2-site-fix3-20260712";
const ASSETS = [
  "./", "./index.html", "./classes.html", "./tests.html", "./homework.html", "./announcements.html", "./links.html", "./edit.html", "./notifications.html", "./reset-cache.html",
  "./class-2-1.html", "./class-2-2.html", "./class-2-3.html", "./class-2-4.html", "./class-2-5.html",
  "./style.css", "./responsive-ui.css", "./mobile-editor-fix.css", "./brand-icon.css", "./theme.js", "./app-config.js", "./app-core.js", "./editor-add.js", "./notifications-web.js", "./mobile-notification-fix.js", "./manifest.webmanifest", "./icons/brand-icon.svg", "./icons/icon-192.png", "./icons/icon-512.png"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
});
