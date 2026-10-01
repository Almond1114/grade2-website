const CACHE_PREFIX = 'nankosai-seiryo:';
const CACHE_NAME = CACHE_PREFIX + 'f4753749f056';
const ASSETS = ["./","./admin.html","./assets/favicon.svg","./assets/icon-192.png","./assets/icon-512.png","./assets/maps/1F.svg","./assets/maps/2F.svg","./assets/maps/3F.svg","./assets/posters/bell.svg","./assets/posters/brass.svg","./assets/posters/deep.svg","./assets/posters/glass.svg","./assets/posters/live.svg","./assets/posters/sky.svg","./css/admin.css","./css/animations.css","./css/base.css","./css/public.css","./data/demo.json","./index.html","./js/admin-app.js","./js/animations.js","./js/api.js","./js/cards.js","./js/dom.js","./js/editor-storage.js","./js/festival-data.js","./js/icons.js","./js/media.js","./js/public-app.js","./js/pwa.js","./js/schema.js","./js/site-config.js","./js/storage.js","./js/utils.js","./manifest.webmanifest"];
const BASE = new URL('./', self.location.href);
self.addEventListener('install', event => {
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME),version=CACHE_NAME.slice(CACHE_PREFIX.length);
  const requests=ASSETS.map(path=>{const url=new URL(path,BASE);url.searchParams.set('v',version);return new Request(url.href,{cache:'reload'});});
  await cache.addAll(requests);
  // Activate only after every offline asset is ready. Open editors are not reloaded.
  await self.skipWaiting();
 })());
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
 const url=new URL(event.request.url);
 // Never cache Google API requests, tokens, external images, or any other site's resources.
 if(event.request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
 const known=ASSETS.some(path=>new URL(path,BASE).pathname===url.pathname);
 if(!known)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  try{
   const response=await fetch(event.request,{cache:'no-store'});
   if(response.ok)await cache.put(event.request,response.clone());
   return response;
  }catch{
   const cached=await cache.match(event.request,{ignoreSearch:true});
   if(cached)return cached;
   if(event.request.mode==='navigate')return cache.match(new URL('./index.html',BASE).href,{ignoreSearch:true});
   return Response.error();
  }
 })());
});
