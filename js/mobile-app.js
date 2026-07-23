/**
 * mobile-app.js
 * Experiência mobile do Barber Hub 1.4.
 *
 * Responsabilidades:
 * - identificar a página atual e ajustar o cabeçalho compacto;
 * - transformar filtros do portal em uma folha inferior;
 * - criar atalhos contextuais por página;
 * - criar uma barra de ação fixa na página pública do estabelecimento;
 * - melhorar rótulos e ações de toque sem duplicar regras de negócio.
 */

(() => {
  "use strict";

  const PAGINAS = {
    index: ["Barber Hub", "Início"],
    portal: ["Explorar", "Barbearias e serviços"],
    barbearia: ["Estabelecimento", "Perfil público"],
    agendamento: ["Agendar", "Serviço e horário"],
    cliente: ["Minha área", "Agenda e favoritos"],
    painel: ["Meu negócio", "Painel profissional"],
    admin: ["Administração", "Painel da plataforma"],
    planos: ["Planos", "Cresça no seu ritmo"],
    sobre: ["Sobre", "Objetivo e visão"],
    conta: ["Minha conta", "Perfil e segurança"],
    notificacoes: ["Notificações", "Suas atualizações"],
    contato: ["Suporte", "Central de atendimento"],
    servicos: ["Recursos", "Tudo em um só lugar"],
    cadastro: ["Criar conta", "Comece no Barber Hub"],
    "cadastro-barbearia": ["Novo negócio", "Configure sua página"],
    login: ["Entrar", "Acesse sua conta"],
    "recuperar-senha": ["Recuperar acesso", "Redefina sua senha"],
    "redefinir-senha": ["Nova senha", "Proteja sua conta"],
    "beauty-hub": ["Beauty Hub", "Expansão do ecossistema"],
    privacidade: ["Privacidade", "Uso responsável de dados"],
    termos: ["Termos", "Regras da plataforma"]
  };

  function paginaAtual() {
    const arquivo = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/i, "");
    return arquivo || "index";
  }

  function dispararMudanca(elemento, tipo = "change") {
    elemento?.dispatchEvent(new Event(tipo, { bubbles: true }));
  }

  function rotularPagina() {
    const pagina = paginaAtual();
    document.body.classList.add("barberhub-mobile-ready", `app-${pagina}`);
    document.body.dataset.appPage = pagina;

    const logo = document.querySelector(".header .logo");
    if (!logo || logo.querySelector(".mobile-context-title")) return;

    const [titulo, subtitulo] = PAGINAS[pagina] || ["Barber Hub", "Uma plataforma de The Gamers Tech"];
    const contexto = document.createElement("span");
    contexto.className = "mobile-context-title";
    contexto.innerHTML = `<strong>${titulo}</strong><span>${subtitulo}</span>`;
    logo.insertAdjacentElement("afterend", contexto);
  }

  function criarAtalhos(itens, destino) {
    if (!destino || destino.querySelector(":scope > .mobile-quick-actions")) return;
    const barra = document.createElement("nav");
    barra.className = "mobile-quick-actions";
    barra.setAttribute("aria-label", "Atalhos desta página");
    barra.innerHTML = itens.map(item => {
      const classe = item.primary ? "primary" : "";
      if (item.action) {
        return `<button type="button" class="${classe}" data-mobile-action="${item.action}"><i class="bi ${item.icon}"></i>${item.label}</button>`;
      }
      return `<a class="${classe}" href="${item.href}"><i class="bi ${item.icon}"></i>${item.label}</a>`;
    }).join("");
    destino.appendChild(barra);
  }

  function configurarAtalhosContextuais() {
    const pagina = paginaAtual();
    const hero = document.querySelector(".page-hero .container");

    if (pagina === "cliente") {
      criarAtalhos([
        { href: "agendamento.html", icon: "bi-calendar2-plus", label: "Novo horário", primary: true },
        { href: "#favoritos", icon: "bi-heart", label: "Favoritos" },
        { href: "#historico", icon: "bi-clock-history", label: "Histórico" },
        { href: "conta.html", icon: "bi-person-gear", label: "Conta" }
      ], hero);
    }

    if (pagina === "admin") {
      criarAtalhos([
        { href: "#estabelecimentos", icon: "bi-shop-window", label: "Negócios", primary: true },
        { href: "#usuarios", icon: "bi-people", label: "Usuários" },
        { href: "#moderacao", icon: "bi-flag", label: "Moderação" },
        { href: "#tickets", icon: "bi-headset", label: "Tickets" }
      ], hero);
    }

    if (pagina === "planos") {
      criarAtalhos([
        { href: ".pricing-section", icon: "bi-wallet2", label: "Planos", primary: true },
        { href: "#programa-fundador", icon: "bi-stars", label: "Fundadores" },
        { href: ".faq-section", icon: "bi-question-circle", label: "Dúvidas" }
      ], hero);
    }

    if (pagina === "conta") {
      criarAtalhos([
        { href: "#formConta", icon: "bi-person", label: "Perfil", primary: true },
        { href: "#formSenhaConta", icon: "bi-shield-lock", label: "Segurança" },
        { href: "#tituloExcluirConta", icon: "bi-trash3", label: "Excluir conta" }
      ], hero);
    }

    if (pagina === "sobre") {
      criarAtalhos([
        { href: ".about-purpose", icon: "bi-bullseye", label: "Objetivo", primary: true },
        { href: ".about-two-sides", icon: "bi-people", label: "Dois lados" },
        { href: ".about-brand-section", icon: "bi-diagram-3", label: "The Gamers Tech" }
      ], hero);
    }
  }

  function configurarFiltroPortal() {
    if (paginaAtual() !== "portal") return;
    const filtros = document.querySelector(".filters");
    if (!filtros || filtros.dataset.mobileReady === "true") return;
    filtros.dataset.mobileReady = "true";

    const gatilho = document.createElement("button");
    gatilho.type = "button";
    gatilho.className = "mobile-filter-trigger";
    gatilho.innerHTML = `<span><i class="bi bi-sliders"></i> Filtrar estabelecimentos</span><span class="mobile-filter-count" aria-label="Filtros ativos">0</span>`;
    filtros.before(gatilho);

    const cabecalho = document.createElement("div");
    cabecalho.className = "mobile-sheet-head";
    cabecalho.innerHTML = `<div><strong>Filtros</strong><p class="texto-section">Ajuste a busca do portal.</p></div><button type="button" class="icon-btn" data-mobile-filter-close aria-label="Fechar filtros"><i class="bi bi-x-lg"></i></button>`;
    filtros.prepend(cabecalho);

    const acoes = document.createElement("div");
    acoes.className = "mobile-sheet-actions";
    acoes.innerHTML = `<button type="button" class="btn btn-outline" data-mobile-filter-clear>Limpar</button><button type="button" class="btn btn-primary" data-mobile-filter-apply>Ver resultados</button>`;
    filtros.appendChild(acoes);

    const backdrop = document.createElement("div");
    backdrop.className = "mobile-filter-backdrop";
    document.body.appendChild(backdrop);

    const campos = ["filtroTipo", "filtroStatus", "filtroAgendamento"]
      .map(id => document.getElementById(id))
      .filter(Boolean);

    const atualizarContador = () => {
      const ativos = campos.filter(campo => campo.value && campo.value !== "todos").length;
      const contador = gatilho.querySelector(".mobile-filter-count");
      contador.textContent = String(ativos);
      contador.classList.toggle("ativo", ativos > 0);
    };

    const fechar = () => {
      filtros.classList.remove("mobile-open");
      backdrop.classList.remove("ativo");
      document.body.classList.remove("drawer-open");
      gatilho.focus();
    };

    const abrir = () => {
      filtros.classList.add("mobile-open");
      backdrop.classList.add("ativo");
      document.body.classList.add("drawer-open");
      setTimeout(() => filtros.querySelector("input,select")?.focus(), 120);
    };

    gatilho.addEventListener("click", abrir);
    backdrop.addEventListener("click", fechar);
    filtros.querySelector("[data-mobile-filter-close]")?.addEventListener("click", fechar);
    filtros.querySelector("[data-mobile-filter-apply]")?.addEventListener("click", fechar);
    filtros.querySelector("[data-mobile-filter-clear]")?.addEventListener("click", () => {
      const pesquisa = document.getElementById("pesquisa");
      if (pesquisa) {
        pesquisa.value = "";
        dispararMudanca(pesquisa, "input");
      }
      campos.forEach(campo => {
        campo.value = "todos";
        dispararMudanca(campo);
      });
      atualizarContador();
    });
    campos.forEach(campo => campo.addEventListener("change", atualizarContador));
    document.addEventListener("keydown", evento => {
      if (evento.key === "Escape" && filtros.classList.contains("mobile-open")) fechar();
    });
    atualizarContador();
  }

  function configurarAcoesRapidasPortal() {
    if (paginaAtual() !== "portal") return;
    const gatilho = document.querySelector(".mobile-filter-trigger");
    if (!gatilho || document.querySelector(".portal-mobile-chips")) return;

    const barra = document.createElement("div");
    barra.className = "mobile-quick-actions portal-mobile-chips";
    barra.innerHTML = `
      <button type="button" data-portal-quick="aberta"><i class="bi bi-door-open"></i>Abertos agora</button>
      <button type="button" data-portal-quick="agenda"><i class="bi bi-calendar-check"></i>Com agenda</button>
      <button type="button" data-portal-quick="todos"><i class="bi bi-arrow-counterclockwise"></i>Limpar</button>`;
    gatilho.after(barra);

    barra.addEventListener("click", evento => {
      const botao = evento.target.closest("[data-portal-quick]");
      if (!botao) return;
      const tipo = botao.dataset.portalQuick;
      const status = document.getElementById("filtroStatus");
      const agenda = document.getElementById("filtroAgendamento");
      if (tipo === "aberta" && status) {
        status.value = status.value === "aberta" ? "todos" : "aberta";
        dispararMudanca(status);
        botao.classList.toggle("ativo", status.value === "aberta");
      }
      if (tipo === "agenda" && agenda) {
        agenda.value = agenda.value === "sim" ? "todos" : "sim";
        dispararMudanca(agenda);
        botao.classList.toggle("ativo", agenda.value === "sim");
      }
      if (tipo === "todos") {
        if (status) { status.value = "todos"; dispararMudanca(status); }
        if (agenda) { agenda.value = "todos"; dispararMudanca(agenda); }
        barra.querySelectorAll("button").forEach(item => item.classList.remove("ativo"));
      }
    });
  }

  function configurarBarraEstabelecimento() {
    if (paginaAtual() !== "barbearia" || document.querySelector(".mobile-business-cta")) return;
    const heroActions = document.querySelector(".business-hero .hero-actions");
    if (!heroActions) return;

    const acaoPrincipal = heroActions.querySelector("a.btn-primary") || heroActions.querySelector('a[href*="wa.me"]') || heroActions.querySelector("a.btn");
    const favorito = heroActions.querySelector("[data-favoritar-estabelecimento]") || heroActions.querySelector('a[href*="login"]');
    if (!acaoPrincipal) return;

    const barra = document.createElement("div");
    barra.className = "mobile-business-cta";
    const principal = document.createElement("button");
    principal.type = "button";
    principal.className = "btn btn-primary";
    principal.innerHTML = acaoPrincipal.innerHTML || "Continuar";
    principal.addEventListener("click", () => acaoPrincipal.click());
    barra.appendChild(principal);

    if (favorito) {
      const secundario = document.createElement("button");
      secundario.type = "button";
      secundario.className = "btn btn-outline mobile-business-secondary";
      secundario.setAttribute("aria-label", "Favoritar estabelecimento");
      secundario.innerHTML = favorito.querySelector("i")?.outerHTML || '<i class="bi bi-heart"></i>';
      secundario.addEventListener("click", () => favorito.click());
      barra.appendChild(secundario);
    }

    document.body.appendChild(barra);
    document.body.classList.add("has-mobile-business-cta");
  }

  function configurarLinksDeSeletor() {
    document.addEventListener("click", evento => {
      const link = evento.target.closest('a[href^="."]');
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href === "./" || !href.startsWith(".")) return;
      try {
        const alvo = document.querySelector(href);
        if (!alvo) return;
        evento.preventDefault();
        alvo.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (_) {
        // Seletores inválidos continuam com o comportamento padrão do navegador.
      }
    });
  }

  function melhorarBotoesIcone() {
    document.querySelectorAll("button.icon-btn, .btn-menu, .btn-tema").forEach(botao => {
      if (botao.hasAttribute("aria-label")) return;
      const texto = botao.getAttribute("title") || botao.textContent.trim() || "Ação";
      botao.setAttribute("aria-label", texto);
    });
  }

  function observarConteudoDinamico() {
    const observador = new MutationObserver(() => {
      configurarBarraEstabelecimento();
      melhorarBotoesIcone();
    });
    observador.observe(document.body, { childList: true, subtree: true });
  }

  function iniciar() {
    rotularPagina();
    configurarAtalhosContextuais();
    configurarFiltroPortal();
    configurarAcoesRapidasPortal();
    configurarLinksDeSeletor();
    melhorarBotoesIcone();
    configurarBarraEstabelecimento();
    observarConteudoDinamico();
  }

  document.addEventListener("DOMContentLoaded", iniciar);
})();
