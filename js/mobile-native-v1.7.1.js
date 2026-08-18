/** Barber Hub 1.7.2 hotfix — navegação mobile resiliente + microinterações seguras. */
(() => {
  "use strict";

  const MOBILE_PAGES = new Set([
    "index.html","admin.html","admin-assinaturas.html","agendamento.html","barbearia.html","beauty-hub.html",
    "cadastro-barbearia.html","cadastro.html","cliente.html","conta.html","contato.html",
    "login.html","mapa-sistema.html","notificacoes.html","painel.html","planos.html",
    "portal.html","privacidade.html","recuperar-senha.html","redefinir-senha.html",
    "servicos.html","sobre.html","termos.html"
  ]);

  function isMobileArea() {
    return location.pathname.includes("/mobile/");
  }

  function mobileUrl(url) {
    try {
      const parsed = new URL(url, location.href);
      if (parsed.origin !== location.origin) return null;
      const file = parsed.pathname.split("/").pop() || "index.html";
      if (!MOBILE_PAGES.has(file)) return null;
      parsed.pathname = `/mobile/${file}`;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function normalizeLinks(root = document) {
    if (!isMobileArea()) return;
    root.querySelectorAll?.("a[href]").forEach(anchor => {
      const raw = anchor.getAttribute("href") || "";
      if (!raw || raw.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(raw)) return;
      const normalized = mobileUrl(raw);
      if (!normalized) return;
      anchor.href = `${normalized.pathname}${normalized.search}${normalized.hash}`;
    });
  }

  function shouldTransition(event, anchor) {
    if (!isMobileArea() || event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (anchor.target && anchor.target !== "_self") return false;
    if (anchor.hasAttribute("download") || anchor.dataset.noPageTransition != null) return false;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname && url.search === location.search) return false;
    return url.pathname.includes("/mobile/");
  }

  document.addEventListener("click", event => {
    const anchor = event.target.closest?.("a[href]");
    if (!anchor || !shouldTransition(event, anchor)) return;
    event.preventDefault();
    document.body.classList.add("mobile-nav-leaving");
    const target = anchor.href;
    const delay = document.body.classList.contains("reduzir-movimento") ? 0 : 90;

    // Fail-safe: se a navegação for bloqueada/abortada, a página nunca fica
    // presa no estado visual de saída.
    const resetTimer = window.setTimeout(() => {
      document.body.classList.remove("mobile-nav-leaving");
    }, 700);

    window.setTimeout(() => {
      try {
        location.assign(target);
      } catch (error) {
        window.clearTimeout(resetTimer);
        document.body.classList.remove("mobile-nav-leaving");
        console.warn("Barber Hub: navegação animada falhou; usando fallback.", error);
        location.href = target;
      }
    }, delay);
  });

  window.addEventListener("pageshow", () => document.body.classList.remove("mobile-nav-leaving"));

  document.addEventListener("DOMContentLoaded", () => {
    normalizeLinks();
    document.body.classList.add("mobile-native-ready");
  });

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) normalizeLinks(node);
      }
    }
  });
  document.addEventListener("DOMContentLoaded", () => observer.observe(document.body, { childList:true, subtree:true }));
})();
