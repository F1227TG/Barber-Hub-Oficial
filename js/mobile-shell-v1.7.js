/**
 * mobile-shell-v1.7.js
 * Shell exclusivo de /mobile: header com menu acessível, navegação inferior e
 * acesso garantido a conta/logout por meio do drawer compartilhado de ui.js.
 */
(function mobileShell(global) {
  "use strict";

  const pageName = (location.pathname.split("/").pop() || "index.html").replace(".html", "");
  const esc = typeof global.escapeHTML === "function"
    ? global.escapeHTML
    : value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const labels = {
    index: ["Barber Hub", "Encontre, escolha e agende"],
    portal: ["Explorar", "Encontre seu próximo atendimento"],
    barbearia: ["Estabelecimento", "Serviços, equipe e agenda"],
    cliente: ["Minha agenda", "Seus atendimentos e favoritos"],
    painel: ["Meu negócio", "Gestão rápida e objetiva"],
    conta: ["Conta", "Perfil e segurança"],
    notificacoes: ["Notificações", "Atualizações do Barber Hub"],
    contato: ["Suporte", "Como podemos ajudar?"],
    planos: ["Planos", "Recursos para o negócio"],
    login: ["Entrar", "Acesse sua conta"],
    cadastro: ["Criar conta", "Comece no Barber Hub"],
    "cadastro-barbearia": ["Cadastrar negócio", "Configure seu estabelecimento"],
    admin: ["Administração", "Saúde e controle da plataforma"],
    "admin-assinaturas": ["Assinaturas", "Planos e benefícios"],
    sobre: ["Sobre", "A proposta do Barber Hub"],
    servicos: ["Recursos", "O que a plataforma oferece"],
    "beauty-hub": ["Beauty Hub", "Expansão do ecossistema"],
    privacidade: ["Privacidade", "Como tratamos seus dados"],
    termos: ["Termos", "Regras de uso da plataforma"],
    "recuperar-senha": ["Recuperar senha", "Volte para sua conta"],
    "redefinir-senha": ["Nova senha", "Proteja seu acesso"],
    "mapa-sistema": ["Mapa do sistema", "Visão técnica da plataforma"],
  };

  function appUrl(path) {
    if (typeof global.bhUrl === "function") return global.bhUrl(`html/${path}`);
    if (location.protocol === "file:") return `./${path}`;
    return `/mobile/${path}`;
  }

  const backFallbacks = {
    barbearia: "portal.html",
    cliente: "index.html",
    conta: "index.html",
    notificacoes: "index.html",
    contato: "index.html",
    planos: "index.html",
    login: "index.html",
    cadastro: "index.html",
    "cadastro-barbearia": "painel.html",
    painel: "index.html",
    admin: "index.html",
    "admin-assinaturas": "admin.html",
    sobre: "index.html",
    servicos: "index.html",
    "beauty-hub": "index.html",
    privacidade: "conta.html",
    termos: "conta.html",
    "recuperar-senha": "login.html",
    "redefinir-senha": "login.html",
    "mapa-sistema": "admin.html",
    agendamento: "portal.html"
  };

  function goBack() {
    try {
      const ref = document.referrer ? new URL(document.referrer, location.href) : null;
      if (ref && ref.origin === location.origin && history.length > 1) {
        history.back();
        return;
      }
    } catch (_) {}
    location.href = appUrl(backFallbacks[pageName] || "index.html");
  }

  function link(path, icon, text, active = false, badge = "") {
    const badgeHtml = badge ? `<span class="nav-badge" ${badge} hidden aria-hidden="true"></span>` : "";
    return `<a href="${appUrl(path)}" class="${active ? "ativo" : ""}"><i class="bi ${icon}"></i><span>${text}</span>${badgeHtml}</a>`;
  }

  function prepareResponsiveTables(root = document) {
    root.querySelectorAll?.("table").forEach(table => {
      table.classList.add("responsive-table");
      const labels = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());
      table.querySelectorAll("tbody tr").forEach(row => {
        const cells = [...row.children];
        cells.forEach((cell, index) => {
          if (Number(cell.getAttribute("colspan") || 1) > 1 || cells.length === 1) {
            cell.dataset.label = "";
            cell.classList.add("mobile-table-full-row");
            return;
          }
          if (!cell.dataset.label) cell.dataset.label = labels[index] || "Informação";
        });
      });
    });
  }

  function openDrawer() {
    if (typeof global.bhAbrirDrawer === "function") global.bhAbrirDrawer();
    else document.getElementById("appDrawer")?.classList.add("aberto");
  }

  async function build() {
    document.body.classList.add("mobile-native");
    if (document.querySelector(".mobile-app-header")) return;

    const [title, subtitle] = labels[pageName] || ["Barber Hub", "Uma plataforma de The Gamers Tech"];
    const header = document.createElement("header");
    header.className = "mobile-app-header";
    const backButton = pageName === "index" ? "" : `<button class="icon-btn mobile-app-back" type="button" id="mobileBackButton" aria-label="Voltar"><i class="bi bi-chevron-left"></i></button>`;
    header.innerHTML = `<div class="mobile-app-header-inner">
      ${backButton}
      <a class="mobile-app-brand" href="${appUrl("index.html")}"><img src="../img/branding/barber-hub-compacta.png" alt=""><span><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></span></a>
      <div class="mobile-app-header-actions">
        <button class="icon-btn" type="button" id="mobileThemeButton" aria-label="Alternar tema"><i class="bi bi-circle-half"></i></button>
        <a class="icon-btn" href="${appUrl("notificacoes.html")}" aria-label="Notificações"><i class="bi bi-bell"></i><span class="nav-badge" data-badge-notificacoes hidden aria-hidden="true"></span></a>
        <button class="icon-btn mobile-app-menu-button" type="button" id="mobileMenuButton" aria-label="Abrir menu da conta" aria-haspopup="dialog"><i class="bi bi-list"></i></button>
      </div>
    </div>`;
    document.body.prepend(header);

    header.querySelector("#mobileBackButton")?.addEventListener("click", goBack);

    header.querySelector("#mobileThemeButton")?.addEventListener("click", () => {
      const claro = !document.body.classList.contains("claro");
      localStorage.setItem("bh_tema", claro ? "claro" : "escuro");
      if (typeof global.bhAplicarPreferencias === "function") global.bhAplicarPreferencias();
      else document.body.classList.toggle("claro", claro);
    });
    header.querySelector("#mobileMenuButton")?.addEventListener("click", openDrawer);

    let profile = null;
    try { if (typeof global.bhGetPerfil === "function") profile = await global.bhGetPerfil(); } catch (_) {}

    const dock = document.createElement("nav");
    dock.className = "mobile-app-dock";
    dock.setAttribute("aria-label", "Navegação principal do aplicativo");

    if (profile?.tipo === "barbeiro") {
      dock.innerHTML = [
        link("painel.html", "bi-grid", "Painel", pageName === "painel"),
        link("painel.html#agenda", "bi-calendar-week", "Agenda"),
        link("portal.html", "bi-compass", "Explorar", pageName === "portal" || pageName === "barbearia"),
        link("notificacoes.html", "bi-bell", "Avisos", pageName === "notificacoes", "data-badge-notificacoes"),
        link("conta.html", "bi-person", "Conta", pageName === "conta")
      ].join("");
    } else if (profile?.tipo === "admin") {
      dock.innerHTML = [
        link("admin.html", "bi-shield-check", "Admin", pageName === "admin"),
        link("mapa-sistema.html", "bi-diagram-3", "Mapa", pageName === "mapa-sistema"),
        link("notificacoes.html", "bi-bell", "Avisos", pageName === "notificacoes", "data-badge-notificacoes"),
        link("contato.html", "bi-headset", "Suporte", pageName === "contato"),
        link("conta.html", "bi-person", "Conta", pageName === "conta")
      ].join("");
    } else if (profile) {
      dock.innerHTML = [
        link("index.html", "bi-house-door", "Início", pageName === "index"),
        link("portal.html", "bi-compass", "Explorar", pageName === "portal" || pageName === "barbearia"),
        link("cliente.html", "bi-calendar2-check", "Agenda", pageName === "cliente"),
        link("notificacoes.html", "bi-bell", "Avisos", pageName === "notificacoes", "data-badge-notificacoes"),
        link("conta.html", "bi-person", "Conta", pageName === "conta")
      ].join("");
    } else {
      dock.innerHTML = [
        link("index.html", "bi-house-door", "Início", pageName === "index"),
        link("portal.html", "bi-compass", "Explorar", pageName === "portal" || pageName === "barbearia"),
        link("login.html", "bi-box-arrow-in-right", "Entrar", pageName === "login"),
        link("cadastro.html", "bi-person-plus", "Criar", pageName === "cadastro"),
        link("contato.html", "bi-headset", "Suporte", pageName === "contato")
      ].join("");
    }

    document.body.appendChild(dock);
    prepareResponsiveTables();
    const observer = new MutationObserver(() => prepareResponsiveTables());
    observer.observe(document.body, { childList: true, subtree: true });

    // ui.js pode terminar de calcular contadores depois do shell.
    document.addEventListener("bh:interface-ready", event => {
      if (typeof global.bhAtualizarBadgesNavegacao === "function") {
        global.bhAtualizarBadgesNavegacao(event.detail?.contadores || {});
      }
    }, { once: true });
  }

  document.addEventListener("DOMContentLoaded", build);
})(window);
