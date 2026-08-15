/* Barber Hub PWA — cache 1.7.4 | hotfix de estabilidade */
const CACHE = "barberhub-v1.7.4";
const CACHE_PREFIX = "barberhub-";
const OFFLINE_URL = "/offline.html";
const CORE = [...new Set([
  "/", "/index.html", "/mobile/index.html", OFFLINE_URL,
  "/css/framework.css", "/css/global.css", "/css/index.css", "/css/mobile-app.css",
  "/css/release-1.4.1.css", "/css/product-redesign.css", "/css/release-1.6.css",
  "/css/release-1.7.css", "/css/release-1.7.1.css", "/css/release-1.7.4.css",
  "/vendor/bootstrap.min.css", "/vendor/bootstrap.bundle.min.js",
  "/js/supabase-config.js", "/js/supabase-client.js", "/js/backend-api.js",
  "/js/utils.js", "/js/toast.js", "/js/auth.js", "/js/api.js", "/js/status.js",
  "/js/ui.js", "/js/home.js", "/js/device-router.js", "/js/product-redesign.js",
  "/js/mobile-shell-v1.7.js", "/js/mobile-native-v1.7.1.js", "/js/mobile-home-v1.6.js",
  "/img/logomarcaTRANSPARENTE.png", "/img/favicon.ico"
])];
async function precacheSafely() {
  const cache = await caches.open(CACHE);
  for (const asset of CORE) {
    try {
      const request = new Request(asset, { cache: "reload", credentials: "same-origin" });
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response);
    } catch (error) {
      console.warn("[Barber Hub SW] pré-cache ignorado:", asset, String(error));
    }
  }
}

self.addEventListener("install", event => {
  event.waitUntil(precacheSafely().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isStaticAsset(request, url) {
  if (["style", "script", "image", "font"].includes(request.destination)) return true;
  return /\.(?:css|js|png|jpe?g|webp|svg|ico|woff2?|ttf)$/i.test(url.pathname);
}

async function networkNavigation(request) {
  try {
    return await fetch(request);
  } catch (_) {
    const cachedExact = await caches.match(request, { ignoreSearch: true });
    if (cachedExact) return cachedExact;
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function networkStatic(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy)).catch(error => console.warn("[Barber Hub SW] cache estático ignorado:", error));
    }
    return response;
  } catch (_) {
    return (await caches.match(request)) || Response.error();
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (request.headers.has("range")) return;
  if (request.mode === "navigate") {
    event.respondWith(networkNavigation(request));
    return;
  }
  if (isStaticAsset(request, url)) event.respondWith(networkStatic(request));
});
