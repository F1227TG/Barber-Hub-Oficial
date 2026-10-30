/* Shared OAuth controller. Supabase owns provider state/session validation. */
(function (global) {
  'use strict';
  const key = 'oauth-google-continuation-v1';
  function safeDestination(value) {
    if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value) || /[\\\u0000-\u001f]/.test(value)) return null;
    try {
      const url = new URL(value, global.location.href);
      return url.origin === global.location.origin ? url.pathname + url.search + url.hash : null;
    } catch (_) { return null; }
  }
  global.setupGoogleLogin = async function ({ enabled, button, client, next, finish, report }) {
    const url = new URL(global.location.href);
    const callback = url.searchParams.get('oauth') === 'google';
    if (button) {
      button.hidden = !enabled;
      button.addEventListener('click', async () => {
        if (!enabled) return;
        button.disabled = true;
        try {
          global.sessionStorage.setItem(key, JSON.stringify({ next: safeDestination(next), created: Date.now() }));
          const redirect = new URL(global.location.pathname, global.location.origin);
          redirect.searchParams.set('oauth', 'google');
          const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect.href, queryParams: { prompt: 'select_account' } } });
          if (error) throw error;
        } catch (_) {
          global.sessionStorage.removeItem(key);
          report('Não foi possível iniciar o acesso com Google. Tente novamente.');
          button.disabled = false;
        }
      });
    }
    if (!callback) return;
    try {
      const hash = new URLSearchParams(global.location.hash.slice(1));
      if (url.searchParams.has('error') || hash.has('error')) throw new Error('Provider cancelled');
      // getSession waits for SDK URL/session initialization; getUser validates with Auth.
      const session = await client.auth.getSession();
      if (session.error || !session.data?.session) throw new Error('No session');
      const user = await client.auth.getUser();
      if (user.error || !user.data?.user) throw new Error('Invalid user');
      let record;
      try { record = JSON.parse(global.sessionStorage.getItem(key)); } catch (_) {}
      const valid = record && Number.isFinite(record.created) && Date.now() - record.created >= 0 && Date.now() - record.created < 45 * 60 * 1000;
      const destination = await finish(valid ? safeDestination(record.next) : null);
      const safe = safeDestination(destination);
      if (!safe) throw new Error('Invalid destination');
      global.sessionStorage.removeItem(key);
      global.history.replaceState(null, '', global.location.pathname);
      global.location.replace(safe);
    } catch (_) {
      global.sessionStorage.removeItem(key);
      global.history.replaceState(null, '', global.location.pathname);
      report('O acesso com Google não foi concluído. Tente novamente ou entre com e-mail e senha.');
    }
  };
})(window);
