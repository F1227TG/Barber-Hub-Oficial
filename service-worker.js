/*
 * Barber Hub PWA — cache 1.6.0
 * Network-first para conteúdo; API nunca é armazenada. A experiência instalada
 * inicia na interface HTML dedicada em /mobile.
 */
const CACHE = 'barberhub-v1.6.0';
const CORE = [
  './', './index.html', './offline.html', './mobile/index.html',
  './css/framework.css', './css/global.css', './css/pages.css', './css/index.css', './css/mobile-app.css', './css/release-1.4.1.css', './css/product-redesign.css', './css/release-1.6.css',
  './vendor/bootstrap.min.css', './vendor/bootstrap.bundle.min.js',
  './js/utils.js', './js/toast.js', './js/supabase-config.js', './js/supabase-client.js', './js/security.js', './js/backend-api.js',
  './js/auth.js', './js/api.js', './js/status.js', './js/ia.js', './js/ui.js', './js/mobile-app.js', './js/product-redesign.js',
  './js/home.js', './js/device-router.js', './js/portal.js', './js/notificacoes.js', './js/barbearia.js', './js/booking-modal.js', './js/conta.js',
  './js/cliente.js', './js/painel.js', './js/admin.js', './js/contato.js', './js/mobile-shell-v1.6.js', './js/mobile-home-v1.6.js',
  './html/notificacoes.html', './html/sobre.html', './html/planos.html', './html/contato.html', './html/mapa-sistema.html',
  './html/portal.html', './html/conta.html', './html/barbearia.html', './html/cliente.html', './html/painel.html', './html/admin.html',
  './mobile/portal.html', './mobile/barbearia.html', './mobile/cliente.html', './mobile/painel.html', './mobile/conta.html', './mobile/notificacoes.html', './mobile/contato.html',
  './img/logomarcaTRANSPARENTE.png', './img/android-chrome-192x192.png', './img/android-chrome-512x512.png', './img/favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  const isNavigation = event.request.mode === 'navigate';
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(async () => isNavigation ? (await caches.match(event.request) || await caches.match('./offline.html')) : caches.match(event.request))
  );
});
