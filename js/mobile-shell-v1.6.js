/**
 * mobile-shell-v1.6.js
 * --------------------------------------------------------------------------
 * Navegação exclusiva da interface /mobile. A lógica de negócio continua nos
 * mesmos módulos JS utilizados pelo desktop; apenas o shell visual é separado.
 * --------------------------------------------------------------------------
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
    cliente: ["Minha agenda", "Seus próximos atendimentos"],
    painel: ["Meu negócio", "Gestão rápida do dia"],
    conta: ["Conta", "Perfil e segurança"],
    notificacoes: ["Notificações", "Atualizações do Barber Hub"],
    contato: ["Suporte", "Como podemos ajudar?"],
    planos: ["Planos", "Recursos para o negócio"],
    login: ["Entrar", "Acesse sua conta"],
    cadastro: ["Criar conta", "Comece no Barber Hub"],
    "cadastro-barbearia": ["Cadastrar negócio", "Configure seu estabelecimento"],
    admin: ["Administração", "Saúde e controle da plataforma"],
    sobre: ["Sobre", "A proposta do Barber Hub"],
    servicos: ["Recursos", "O que a plataforma oferece"],
    "beauty-hub": ["Beauty Hub", "Expansão do ecossistema"],
    privacidade: ["Privacidade", "Como tratamos seus dados"],
    termos: ["Termos", "Regras de uso da plataforma"],
    "recuperar-senha": ["Recuperar senha", "Volte para sua conta"],
    "redefinir-senha": ["Nova senha", "Proteja seu acesso"],
    "mapa-sistema": ["Mapa do sistema", "Visão técnica da plataforma"],
  };

  function link(path, icon, text, active = false) {
    return `<a href="${path}" class="${active ? "ativo" : ""}"><i class="bi ${icon}"></i><span>${text}</span></a>`;
  }


  function prepareResponsiveTables(root = document) {
    root.querySelectorAll?.("table").forEach(table => {
      table.classList.add("responsive-table");
      const labels = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());
      table.querySelectorAll("tbody tr").forEach(row => {
        [...row.children].forEach((cell, index) => {
          if (!cell.dataset.label) cell.dataset.label = labels[index] || "Informação";
        });
      });
    });
  }

  async function build() {
    document.body.classList.add("mobile-native");
    const [title, subtitle] = labels[pageName] || ["Barber Hub", "Uma plataforma de The Gamers Tech"];
    const header = document.createElement("header");
    header.className = "mobile-app-header";
    header.innerHTML = `<div class="mobile-app-header-inner">
      <a class="mobile-app-brand" href="index.html"><img src="../img/logomarcaTRANSPARENTE.png" alt=""><span><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></span></a>
      <div class="mobile-app-header-actions">
        <button class="icon-btn" type="button" id="mobileThemeButton" aria-label="Alternar tema"><i class="bi bi-circle-half"></i></button>
        <a class="icon-btn" href="notificacoes.html" aria-label="Notificações"><i class="bi bi-bell"></i></a>
      </div>
    </div>`;
    document.body.prepend(header);
    header.querySelector("#mobileThemeButton")?.addEventListener("click", () => {
      const claro = !document.body.classList.contains("claro");
      localStorage.setItem("bh_tema", claro ? "claro" : "escuro");
      if (typeof bhAplicarPreferencias === "function") bhAplicarPreferencias();
      else document.body.classList.toggle("claro", claro);
    });

    let profile = null;
    try { if (typeof global.bhGetPerfil === "function") profile = await global.bhGetPerfil(); } catch (_) {}
    const dock = document.createElement("nav");
    dock.className = "mobile-app-dock";
    dock.setAttribute("aria-label", "Navegação principal do aplicativo");

    if (profile?.tipo === "barbeiro") {
      dock.innerHTML = [
        link("painel.html", "bi-grid", "Painel", pageName === "painel"),
        link("painel.html#agenda", "bi-calendar-week", "Agenda"),
        link("painel.html#servicos", "bi-scissors", "Serviços"),
        link("notificacoes.html", "bi-bell", "Avisos", pageName === "notificacoes"),
        link("conta.html", "bi-person", "Conta", pageName === "conta")
      ].join("");
    } else if (profile?.tipo === "admin") {
      dock.innerHTML = [
        link("admin.html", "bi-shield-check", "Resumo", pageName === "admin"),
        link("admin.html#estabelecimentos", "bi-shop-window", "Negócios"),
        link("admin.html#usuarios", "bi-people", "Usuários"),
        link("notificacoes.html", "bi-bell", "Avisos", pageName === "notificacoes"),
        link("conta.html", "bi-person", "Conta", pageName === "conta")
      ].join("");
    } else if (profile) {
      dock.innerHTML = [
        link("index.html", "bi-house-door", "Início", pageName === "index"),
        link("portal.html", "bi-compass", "Explorar", pageName === "portal" || pageName === "barbearia"),
        link("cliente.html", "bi-calendar2-check", "Agenda", pageName === "cliente"),
        link("notificacoes.html", "bi-bell", "Avisos", pageName === "notificacoes"),
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
  }

  document.addEventListener("DOMContentLoaded", build);
})(window);
