/**
 * mobile-shell-v1.7.js
 * Shell exclusivo de /mobile, refinado na 1.9.3: header acessível, navegação
 * inferior e folha “Mais” profissional filtrada pelos recursos do plano.
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
    return `<a href="${appUrl(path)}" class="${active ? "ativo" : ""}" ${active ? 'aria-current="page"' : ""}><i class="bi ${icon}"></i><span>${text}</span>${badgeHtml}</a>`;
  }

  function moreButton(active = false) {
    return `<button type="button" class="mobile-dock-action ${active ? "ativo" : ""}" id="mobileProfessionalMore" aria-haspopup="dialog" aria-expanded="false"><i class="bi bi-grid-3x3-gap"></i><span>Mais</span></button>`;
  }

  function professionalMoreItems(entitlements, permissions = null) {
    const can = key => !entitlements || Boolean(entitlements[key]);
    const allowed = capability => !capability || !permissions || Boolean(permissions[capability]);
    return [
      { group:"Gestão", path:"painel.html#servicos", icon:"bi-scissors", label:"Serviços", detail:"Catálogo e preços", capability:"configuracoes" },
      { group:"Gestão", path:"painel.html#equipe", icon:"bi-people", label:"Equipe", detail:"Profissionais e acessos", capability:"equipe" },
      { group:"Gestão", path:"painel.html#galeria", icon:"bi-images", label:"Portfólio", detail:"Trabalhos publicados" },
      { group:"Gestão", path:"painel.html#avaliacoes", icon:"bi-star", label:"Avaliações", detail:"Reputação do negócio" },
      { group:"Relacionamento", path:"painel.html#relacionamento", icon:"bi-person-heart", label:"Retenção", detail:"Espera, recorrência e fidelidade", show:["permite_lista_espera","permite_recorrencia","permite_fidelidade","permite_cupons","permite_campanhas","permite_lembretes"].some(can) && (!permissions || permissions.retencao || permissions.campanhas) },
      { group:"Crescimento", path:"painel.html#crescimento", icon:"bi-stars", label:"Crescimento", detail:"Oportunidades, insights e metas", show:["permite_oportunidades","permite_insights","permite_metas"].some(can) && (!permissions || permissions.crescimento || permissions.metas) },
      { group:"Crescimento", path:"painel.html#promocoes", icon:"bi-megaphone", label:"Promoções", detail:"Ofertas do estabelecimento", show:can("permite_promocoes") },
      { group:"Crescimento", path:"painel.html#relatorios", icon:"bi-bar-chart", label:"Relatórios", detail:"Indicadores do negócio", show:can("permite_relatorios") },
      { group:"Negócio", path:"painel.html#configuracoes", icon:"bi-sliders", label:"Configurações", detail:"Status, horários e dados", capability:"configuracoes" },
      { group:"Negócio", path:"painel.html#pagina", icon:"bi-shop-window", label:"Página pública", detail:"Veja como o cliente enxerga" },
      { group:"Conta", path:"conta.html", icon:"bi-person-gear", label:"Minha conta", detail:"Perfil, senha e privacidade" },
      { group:"Conta", path:"planos.html", icon:"bi-stars", label:"Plano", detail:"Benefícios e limites" },
      { group:"Conta", path:"contato.html", icon:"bi-headset", label:"Suporte", detail:"Ajuda do Barber Hub" }
    ].filter(item => item.show !== false && allowed(item.capability));
  }

  function createProfessionalMoreSheet(profile) {
    const backdrop = document.createElement("div");
    backdrop.className = "mobile-more-backdrop";
    backdrop.hidden = true;
    const sheet = document.createElement("section");
    sheet.className = "mobile-more-sheet";
    sheet.id = "mobileProfessionalMoreSheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "mobileMoreTitle");
    sheet.hidden = true;
    document.body.append(backdrop, sheet);

    const trigger = document.getElementById("mobileProfessionalMore");
    let lastFocus = null;
    let currentPlan = null;
    let currentPermissions = null;

    const close = () => {
      sheet.classList.remove("aberto");
      backdrop.classList.remove("aberto");
      document.body.classList.remove("mobile-more-open");
      trigger?.setAttribute("aria-expanded", "false");
      setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; }, 220);
      lastFocus?.focus?.();
    };

    const render = (planSummary, permissions = currentPermissions) => {
      currentPlan = planSummary || currentPlan;
      currentPermissions = permissions || currentPermissions;
      const entitlements = currentPlan?.entitlements || null;
      const planName = entitlements?.plano_nome || "Plano atual";
      const items = professionalMoreItems(entitlements, currentPermissions);
      const groups = [...new Set(items.map(item => item.group))];
      sheet.innerHTML = `<header class="mobile-more-head"><div><span>${esc(profile?.nome || "Meu negócio")}</span><h2 id="mobileMoreTitle">Mais opções</h2><small>${esc(planName)} · somente recursos disponíveis</small></div><button type="button" class="icon-btn" data-mobile-more-close aria-label="Fechar"><i class="bi bi-x-lg"></i></button></header><div class="mobile-more-content">${groups.map(group => `<section class="mobile-more-group"><h3>${esc(group)}</h3><div class="mobile-more-grid">${items.filter(item => item.group === group).map(item => `<a href="${appUrl(item.path)}"><i class="bi ${item.icon}"></i><span><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></span><i class="bi bi-chevron-right"></i></a>`).join("")}</div></section>`).join("")}</div>`;
      sheet.querySelector("[data-mobile-more-close]")?.addEventListener("click", close);
      sheet.querySelectorAll("a").forEach(item => item.addEventListener("click", close));
    };

    const open = () => {
      lastFocus = document.activeElement;
      sheet.hidden = false;
      backdrop.hidden = false;
      requestAnimationFrame(() => {
        sheet.classList.add("aberto");
        backdrop.classList.add("aberto");
        document.body.classList.add("mobile-more-open");
        trigger?.setAttribute("aria-expanded", "true");
        sheet.querySelector("[data-mobile-more-close]")?.focus();
      });
    };

    trigger?.addEventListener("click", open);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !sheet.hidden) close();
    });
    render(null);
    return { update:render, close };
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
      const secondaryHashes = ["relacionamento", "crescimento", "promocoes", "servicos", "equipe", "relatorios", "galeria", "avaliacoes", "configuracoes", "pagina"];
      const currentHash = location.hash.replace("#", "");
      const moreActive = pageName === "conta" || (pageName === "painel" && secondaryHashes.includes(currentHash));
      dock.innerHTML = [
        link("painel.html", "bi-grid", "Painel", pageName === "painel" && !currentHash),
        link("painel.html#agenda", "bi-calendar-week", "Agenda", pageName === "painel" && currentHash === "agenda"),
        link("painel.html#clientes", "bi-person-lines-fill", "Clientes", pageName === "painel" && currentHash === "clientes"),
        link("painel.html#financeiro", "bi-wallet2", "Financeiro", pageName === "painel" && currentHash === "financeiro"),
        moreButton(moreActive)
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
    if (profile?.tipo === "barbeiro") {
      const moreSheet = createProfessionalMoreSheet(profile);
      const syncProfessionalDock = () => {
        const hash = location.hash.replace("#", "");
        const primary = { agenda:"agenda", clientes:"clientes", financeiro:"financeiro" };
        dock.querySelectorAll("a").forEach(item => {
          const itemHash = new URL(item.href, location.href).hash.replace("#", "");
          const active = pageName === "painel" && (itemHash ? itemHash === hash : !hash);
          item.classList.toggle("ativo", active);
          if (active) item.setAttribute("aria-current", "page");
          else item.removeAttribute("aria-current");
        });
        const more = dock.querySelector("#mobileProfessionalMore");
        const moreActive = pageName === "conta" || (pageName === "painel" && hash && !primary[hash]);
        more?.classList.toggle("ativo", moreActive);
      };
      global.addEventListener("hashchange", syncProfessionalDock);
      syncProfessionalDock();
      if (typeof global.bhObterResumoAssinaturaBarbeiro === "function") {
        global.bhObterResumoAssinaturaBarbeiro()
          .then(async summary => {
            let permissions = null;
            try {
              const establishment = typeof global.bhObterMeuEstabelecimento === "function" ? await global.bhObterMeuEstabelecimento() : null;
              if (establishment?.id && global.bhBackendApi?.teamPermissions) permissions = await global.bhBackendApi.teamPermissions(establishment.id);
            } catch (_) { /* A API continua sendo a barreira de autorização. */ }
            moreSheet.update(summary, permissions);
            if (permissions) {
              const capabilityByHash = { agenda:"agenda", clientes:"crm", financeiro:"financeiro" };
              dock.querySelectorAll("a").forEach(item => {
                const hash = new URL(item.href, location.href).hash.replace("#", "");
                const capability = capabilityByHash[hash];
                if (capability && !permissions[capability]) item.hidden = true;
              });
            }
          })
          .catch(() => { /* O menu-base continua disponível quando o plano não responde. */ });
      }
    }
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
