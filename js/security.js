/**
 * security.js — camada de segurança do navegador.
 * --------------------------------------------------------------------------
 * CAPTCHA melhora resistência a abuso, mas não substitui a validação Python,
 * RLS ou rate limiting. Quando BH_TURNSTILE_SITE_KEY estiver vazio, o módulo
 * permanece inativo sem quebrar os formulários.
 * --------------------------------------------------------------------------
 */
(function securityHelpers(global) {
  "use strict";

  let scriptPromise = null;
  const widgets = new Map();

  function enabled() {
    return typeof BH_TURNSTILE_SITE_KEY !== "undefined" && Boolean(String(BH_TURNSTILE_SITE_KEY).trim());
  }

  function loadScript() {
    if (!enabled()) return Promise.resolve(false);
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
    if (!enabled() || !form) return null;
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
        sitekey: BH_TURNSTILE_SITE_KEY,
        theme: document.body.classList.contains("claro") ? "light" : "dark",
        size: "flexible"
      });
      widgets.set(form, id);
    }
    return widgets.get(form);
  }

  async function token(form) {
    if (!enabled()) return undefined;
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

  global.bhSecurity = { enabled, ensure, token, reset };
  document.addEventListener("DOMContentLoaded", () => {
    if (!enabled()) return;
    ["formLogin", "formCadastro", "formRecuperarSenha"].forEach(id => {
      const form = document.getElementById(id);
      if (form) ensure(form).catch(console.warn);
    });
  });
})(window);
