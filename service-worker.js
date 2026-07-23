/*
 * Barber Hub PWA — cache 1.4.1
 * Estratégia: rede primeiro para manter dados e páginas atualizados, com
 * fallback para o cache e para a página offline quando não houver conexão.
 */
const CACHE = 'barberhub-v1.4.1';
const CORE = [
  './', './index.html', './offline.html',
  './css/framework.css', './css/global.css', './css/pages.css', './css/index.css', './css/mobile-app.css', './css/release-1.4.1.css',
  './vendor/bootstrap.min.css', './vendor/bootstrap.bundle.min.js',
  './js/utils.js', './js/toast.js', './js/supabase-config.js', './js/supabase-client.js', './js/backend-api.js',
  './js/auth.js', './js/api.js', './js/status.js', './js/ia.js', './js/ui.js', './js/mobile-app.js',
  './js/home.js', './js/portal.js', './js/notificacoes.js', './js/barbearia.js',
  './js/cliente.js', './js/painel.js', './js/admin.js', './js/agendamento.js', './js/contato.js',
  './html/notificacoes.html', './html/sobre.html', './html/planos.html', './html/contato.html',
  './html/portal.html', './html/conta.html', './html/barbearia.html',
  './html/cliente.html', './html/painel.html', './html/admin.html', './html/agendamento.html',
  './img/logomarcaTRANSPARENTE.png', './img/android-chrome-192x192.png',
  './img/android-chrome-512x512.png', './img/favicon.ico'
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
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;

  // Respostas da API contêm dados dinâmicos e nunca devem ser armazenadas pelo PWA.
  if (url.pathname.startsWith('/api/')) return;

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
