/**
 * security.js — camada de segurança do navegador.
 * --------------------------------------------------------------------------
 * CAPTCHA melhora resistência a abuso, mas não substitui a validação Python,
 * RLS ou rate limiting. A site key publica vem da API em producao e pode usar
 * um fallback local sem expor a secret do provedor.
 * --------------------------------------------------------------------------
 */
(function securityHelpers(global) {
  "use strict";

  let scriptPromise = null;
  let configPromise = null;
  let siteKey = typeof BH_TURNSTILE_SITE_KEY_FALLBACK !== "undefined"
    ? String(BH_TURNSTILE_SITE_KEY_FALLBACK || "").trim()
    : "";
  const widgets = new Map();

  function enabled() {
    return Boolean(siteKey);
  }

  async function resolveSiteKey() {
    if (siteKey) return siteKey;
    if (configPromise) return configPromise;
    configPromise = fetch("/api/v1/public-config", {
      headers: { Accept: "application/json" },
      cache: "no-store"
    })
      .then(async response => {
        if (!response.ok) return "";
        const payload = await response.json();
        siteKey = String(payload?.data?.turnstile_site_key || "").trim();
        return siteKey;
      })
      .catch(() => "");
    return configPromise;
  }

  async function loadScript() {
    if (!await resolveSiteKey()) return false;
    if (global.turnstile) return Promise.resolve(true);
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error("Não foi possível carregar a proteção anti-robô."));
      document.head.appendChild(script);
    });
    return scriptPromise;
  }

  async function ensure(form) {
    if (!form || !await resolveSiteKey()) return null;
    await loadScript();
    let holder = form.querySelector("[data-barberhub-turnstile]");
    if (!holder) {
      holder = document.createElement("div");
      holder.dataset.barberhubTurnstile = "";
      holder.style.margin = "12px 0";
      const submit = form.querySelector("button[type='submit']");
      submit?.parentNode?.insertBefore(holder, submit);
    }
    if (!widgets.has(form)) {
      const id = global.turnstile.render(holder, {
        sitekey: siteKey,
        theme: document.body.classList.contains("claro") ? "light" : "dark",
        size: "flexible"
      });
      widgets.set(form, id);
    }
    return widgets.get(form);
  }

  async function token(form) {
    if (!await resolveSiteKey()) return undefined;
    const id = await ensure(form);
    const value = global.turnstile?.getResponse(id);
    if (!value) {
      const error = new Error("Confirme a verificação anti-robô para continuar.");
      error.code = "CAPTCHA_REQUIRED";
      throw error;
    }
    return value;
  }

  function reset(form) {
    const id = widgets.get(form);
    if (id !== undefined && global.turnstile) global.turnstile.reset(id);
  }

  global.bhSecurity = { enabled, ensure, token, reset, resolveSiteKey };
  document.addEventListener("DOMContentLoaded", () => {
    ["formLogin", "formCadastro", "formRecuperarSenha"].forEach(id => {
      const form = document.getElementById(id);
      if (form) ensure(form).catch(console.warn);
    });
  });
})(window);
