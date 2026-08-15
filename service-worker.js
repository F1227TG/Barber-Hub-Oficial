/*
 * Barber Hub PWA — cache 1.7.1
 * Network-first para conteúdo; API nunca é armazenada. A experiência instalada
 * inicia na interface HTML dedicada em /mobile.
 */
const CACHE = 'barberhub-v1.7.1';
const CORE = [
  './', './index.html', './offline.html', './mobile/index.html',
  './css/framework.css', './css/global.css', './css/pages.css', './css/index.css', './css/mobile-app.css', './css/release-1.4.1.css', './css/product-redesign.css', './css/release-1.6.css', './css/release-1.7.css', './css/release-1.7.1.css',
  './vendor/bootstrap.min.css', './vendor/bootstrap.bundle.min.js',
  './js/utils.js', './js/toast.js', './js/supabase-config.js', './js/supabase-client.js', './js/security.js', './js/backend-api.js',
  './js/auth.js', './js/api.js', './js/status.js', './js/ia.js', './js/ui.js', './js/mobile-app.js', './js/product-redesign.js',
  './js/home.js', './js/device-router.js', './js/portal.js', './js/notificacoes.js', './js/barbearia.js', './js/booking-modal.js', './js/conta.js',
  './js/cliente.js', './js/painel.js', './js/admin.js', './js/contato.js', './js/mobile-shell-v1.7.js', './js/mobile-native-v1.7.1.js', './js/mobile-home-v1.6.js',
  './html/admin.html', './html/agendamento.html', './html/barbearia.html', './html/beauty-hub.html', './html/cadastro-barbearia.html', './html/cadastro.html', './html/cliente.html', './html/conta.html', './html/contato.html', './html/login.html', './html/mapa-sistema.html', './html/notificacoes.html', './html/painel.html', './html/planos.html', './html/portal.html', './html/privacidade.html', './html/recuperar-senha.html', './html/redefinir-senha.html', './html/servicos.html', './html/sobre.html', './html/termos.html',
  './mobile/admin.html', './mobile/agendamento.html', './mobile/barbearia.html', './mobile/beauty-hub.html', './mobile/cadastro-barbearia.html', './mobile/cadastro.html', './mobile/cliente.html', './mobile/conta.html', './mobile/contato.html', './mobile/index.html', './mobile/login.html', './mobile/mapa-sistema.html', './mobile/notificacoes.html', './mobile/painel.html', './mobile/planos.html', './mobile/portal.html', './mobile/privacidade.html', './mobile/recuperar-senha.html', './mobile/redefinir-senha.html', './mobile/servicos.html', './mobile/sobre.html', './mobile/termos.html',
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
