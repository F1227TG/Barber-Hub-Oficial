/*
 * Barber Hub PWA — cache 1.10 — operação real e avisos com consentimento
 * Network-first para conteúdo; API nunca é armazenada. A experiência instalada
 * inicia na interface HTML dedicada em /mobile.
 */
const CACHE = 'barberhub-v1.10.1-mobile-r1';
const CORE_SOURCE = [
  './', './index.html', './offline.html', './mobile/index.html',
  './css/framework.css', './css/global.css', './css/pages.css', './css/index.css', './css/mobile-app.css', './css/release-1.4.1.css', './css/product-redesign.css', './css/release-1.6.css', './css/release-1.7.css', './css/release-1.7.1.css', './css/release-1.8.css', './css/release-1.9.css', './css/release-1.9.3.css', './css/releases/release-1.10.css', './css/brand-assets-1.8.css', './css/mobile-redesign-1.8.css', './css/image-editor.css',
  './vendor/bootstrap.min.css', './vendor/bootstrap.bundle.min.js',
  './js/utils.js', './js/core/continuation.js', './js/core/operation-draft.js', './js/toast.js', './js/supabase-config.js', './js/supabase-client.js', './js/security.js', './js/backend-api.js',
  './js/auth.js', './js/api.js', './js/status.js', './js/ia.js', './js/ui.js', './js/password-policy.js', './js/mobile-app.js', './js/product-redesign.js',
  './js/home.js', './js/device-router.js', './js/portal.js', './js/notificacoes.js', './js/barbearia.js', './js/features/booking.js', './js/conta.js',
  './js/cliente.js', './js/painel.js', './js/features/professional-operation.js', './js/features/retention-growth.js', './js/features/operation-real-1.10.js', './js/admin.js', './js/admin-assinaturas.js', './js/contato.js', './js/mobile-shell-v1.7.js', './js/mobile-native-v1.7.1.js', './js/mobile-redesign-1.8.js', './js/image-editor.js', './js/mobile-home-v1.6.js',
  './html/admin.html', './html/admin-assinaturas.html', './html/agendamento.html', './html/barbearia.html', './html/beauty-hub.html', './html/cadastro-barbearia.html', './html/cadastro.html', './html/cliente.html', './html/conta.html', './html/contato.html', './html/login.html', './html/mapa-sistema.html', './html/notificacoes.html', './html/painel.html', './html/planos.html', './html/portal.html', './html/privacidade.html', './html/recuperar-senha.html', './html/redefinir-senha.html', './html/servicos.html', './html/sobre.html', './html/termos.html',
  './mobile/admin.html', './mobile/admin-assinaturas.html', './mobile/agendamento.html', './mobile/barbearia.html', './mobile/beauty-hub.html', './mobile/cadastro-barbearia.html', './mobile/cadastro.html', './mobile/cliente.html', './mobile/conta.html', './mobile/contato.html', './mobile/login.html', './mobile/mapa-sistema.html', './mobile/notificacoes.html', './mobile/painel.html', './mobile/planos.html', './mobile/portal.html', './mobile/privacidade.html', './mobile/recuperar-senha.html', './mobile/redefinir-senha.html', './mobile/servicos.html', './mobile/sobre.html', './mobile/termos.html',
  './img/logomarcaTRANSPARENTE.png', './img/android-chrome-192x192.png', './img/android-chrome-512x512.png', './img/apple-touch-icon.png', './img/favicon-16x16.png', './img/favicon-32x32.png', './img/favicon.ico',
  './img/branding/barber-hub-compacta.png', './img/branding/barber-hub-horizontal.png', './img/branding/barber-hub-logo.png', './img/branding/barber-hub-wordmark.png',
  './img/backgrounds/barber-home-hero.webp', './img/backgrounds/portal-hero.webp', './img/backgrounds/barbearia-hero-default.webp', './img/backgrounds/home-institucional.webp', './img/backgrounds/home-assinatura.webp', './img/backgrounds/sobre-craft.webp',
  './img/library/barbershop-covers/classic-warm.webp', './img/library/barbershop-covers/modern-clean.webp', './img/library/barbershop-covers/premium-dark.webp', './img/library/barbershop-covers/light-airy.webp', './img/library/barbershop-covers/contemporary-night.webp',
  './img/placeholders/barbearia-01.webp', './img/placeholders/barbearia-02.webp', './img/placeholders/barbearia-03.webp', './img/decor/poste-barbearia.png'
];

// Defesa extra: mesmo que um asset seja adicionado duas vezes no futuro,
// o instalador nunca enviará requisições duplicadas ao Cache API.
const CORE = [...new Set(CORE_SOURCE)];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const results = await Promise.allSettled(CORE.map(asset => cache.add(asset)));
    const failures = results
      .map((result, index) => ({ result, asset: CORE[index] }))
      .filter(({ result }) => result.status === 'rejected');

    if (failures.length) {
      console.warn('[Barber Hub SW] alguns assets não entraram no pré-cache:', failures.map(({ asset, result }) => ({ asset, reason: String(result.reason) })));
    }

    await self.skipWaiting();
  })());
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
        // A cópia precisa ser criada ANTES de devolver a Response ao navegador.
        // Se o clone for feito dentro de uma Promise posterior, o body pode já
        // ter sido consumido e o Chromium lança: "Response body is already used".
        if (response.ok) {
          const cacheCopy = response.clone();
          caches.open(CACHE)
            .then(cache => cache.put(event.request, cacheCopy))
            .catch(error => console.warn('[Barber Hub SW] cache put ignorado:', error));
        }
        return response;
      })
      .catch(async () => isNavigation
        ? (await caches.match(event.request) || await caches.match('./offline.html'))
        : caches.match(event.request))
  );
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json?.() || {}; } catch (_) { payload = { body:event.data?.text?.() || '' }; }
  const title = String(payload.title || 'Barber Hub').slice(0, 80);
  const options = {
    body:String(payload.body || 'Você recebeu uma nova atualização.').slice(0, 240),
    icon:'./img/android-chrome-192x192.png',
    badge:'./img/favicon-32x32.png',
    tag:String(payload.tag || 'barber-hub-update').slice(0, 100),
    data:{ url:String(payload.url || '/mobile/notificacoes.html') }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  let target = new URL('/mobile/notificacoes.html', self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.url || target.href, self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate;
  } catch (_) { /* destino padrão */ }
  event.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(windows => {
    const current = windows.find(client => new URL(client.url).origin === target.origin);
    if (current) { current.navigate(target.href); return current.focus(); }
    return self.clients.openWindow(target.href);
  }));
});
