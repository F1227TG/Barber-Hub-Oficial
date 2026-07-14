const CACHE='barberhub-v1.0.0';
const CORE=['./','./index.html','./offline.html','./css/global.css','./css/pages.css','./css/index.css','./js/utils.js','./js/toast.js','./js/ui.js','./img/logomarcaTRANSPARENTE.png','./img/favicon.ico'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;const html=e.request.mode==='navigate';e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(async()=>html?(await caches.match(e.request)||await caches.match('./offline.html')):(await caches.match(e.request))))});
