const CACHE_NAME = "grade2-website-pages-v2-20260704";
const ASSETS = [
  "./", "./index.html", "./classes.html", "./tests.html", "./homework.html", "./announcements.html", "./links.html", "./edit.html", "./notifications.html",
  "./class-2-1.html", "./class-2-2.html", "./class-2-3.html", "./class-2-4.html", "./class-2-5.html",
  "./style.css", "./theme.js", "./app-core.js", "./notifications-web.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"
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
