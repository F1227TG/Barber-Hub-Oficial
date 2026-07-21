const CACHE = 'barberhub-v1.3.2';
const CORE = [
  './', './index.html', './offline.html',
  './css/framework.css', './css/global.css', './css/pages.css', './css/index.css',
  './vendor/bootstrap.min.css', './vendor/bootstrap.bundle.min.js',
  './js/utils.js', './js/toast.js', './js/supabase-config.js', './js/supabase-client.js',
  './js/auth.js', './js/api.js', './js/status.js', './js/ia.js', './js/ui.js',
  './js/notificacoes.js', './js/barbearia.js', './js/cliente.js', './js/painel.js',
  './html/notificacoes.html', './html/sobre.html', './html/planos.html',
  './html/portal.html', './html/conta.html', './html/barbearia.html',
  './html/cliente.html', './html/painel.html',
  './img/logomarcaTRANSPARENTE.png', './img/favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  const isNavigation = event.request.mode === 'navigate';
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => isNavigation
        ? (await caches.match(event.request) || await caches.match('./offline.html'))
        : caches.match(event.request))
  );
});
