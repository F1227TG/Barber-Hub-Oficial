/** Barber Hub 1.8 — UX exclusiva de /mobile. */
(() => {
  "use strict";
  const isMobile = () => document.body.classList.contains("mobile-native") || location.pathname.includes("/mobile/");

  function removeInstallPrompts(root = document) {
    if (!isMobile()) return;
    root.querySelectorAll?.("[data-install-app]").forEach(node => node.remove());
  }

  function compactCopy() {
    if (!isMobile()) return;
    const map = {
      "page-portal": ["Explorar", "Busque por barbearia, serviço ou região."],
      "page-sobre": ["Sobre o Barber Hub", "Tecnologia para aproximar clientes e profissionais."],
      "page-contato": ["Como podemos ajudar?", "Escolha um assunto e fale com o suporte."],
      "page-planos": ["Planos", "Escolha os recursos que fazem sentido para o seu negócio."],
      "page-cliente": ["Minha agenda", "Seus próximos atendimentos em um só lugar."],
      "page-painel": ["Meu negócio", "O que precisa da sua atenção hoje."],
      "page-conta": ["Minha conta", "Perfil e segurança."],
      "page-notificacoes": ["Notificações", "Agenda, conta e sistema."],
    };
    for (const [cls, content] of Object.entries(map)) {
      if (!document.body.classList.contains(cls)) continue;
      const hero = document.querySelector(".page-hero");
      if (!hero) break;
      const title = hero.querySelector("h1");
      const paragraph = hero.querySelector("p");
      if (title && cls !== "page-painel" && cls !== "page-cliente") title.textContent = content[0];
      if (paragraph) paragraph.textContent = content[1];
      break;
    }
  }

  function enhanceMarketplaceFilters() {
    if (!isMobile() || !document.body.classList.contains("page-portal")) return;
    const dialog = document.querySelector(".marketplace-filter-dialog");
    if (!dialog || dialog.dataset.mobileEnhanced === "1") return;
    dialog.dataset.mobileEnhanced = "1";

    dialog.querySelectorAll(".marketplace-filter-grid select").forEach(select => {
      const field = select.closest(".campo");
      const label = field?.querySelector(`label[for="${select.id}"]`);
      const labelText = label?.textContent?.trim() || "Opções";
      if (label) {
        const visualLabel = document.createElement("span");
        visualLabel.className = "mobile-filter-label";
        visualLabel.textContent = labelText;
        label.replaceWith(visualLabel);
      }
      select.setAttribute("aria-hidden", "true");
      select.tabIndex = -1;
      const wrap = document.createElement("div");
      wrap.className = "mobile-filter-options";
      wrap.setAttribute("role", "group");
      wrap.setAttribute("aria-label", labelText);
      [...select.options].forEach(option => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mobile-filter-option";
        btn.dataset.value = option.value;
        btn.textContent = option.textContent;
        btn.classList.toggle("ativo", select.value === option.value);
        btn.addEventListener("click", () => {
          select.value = option.value;
          wrap.querySelectorAll("button").forEach(item => item.classList.toggle("ativo", item === btn));
          select.dispatchEvent(new Event("change", { bubbles:true }));
        });
        wrap.appendChild(btn);
      });
      select.insertAdjacentElement("afterend", wrap);
    });

    const sync = () => dialog.querySelectorAll("select").forEach(select => {
      const wrap = select.nextElementSibling;
      if (!wrap?.classList.contains("mobile-filter-options")) return;
      wrap.querySelectorAll("button").forEach(btn => btn.classList.toggle("ativo", btn.dataset.value === select.value));
    });
    document.getElementById("abrirFiltrosMarketplace")?.addEventListener("click", () => requestAnimationFrame(sync));
    document.getElementById("limparFiltrosMarketplace")?.addEventListener("click", () => requestAnimationFrame(sync));

    let startY = null;
    let delta = 0;
    const dragStart = event => {
      const point = event.touches?.[0] || event;
      startY = point.clientY;
      delta = 0;
    };
    const dragMove = event => {
      if (startY == null) return;
      const point = event.touches?.[0] || event;
      delta = Math.max(0, point.clientY - startY);
      if (delta) dialog.style.transform = `translateY(${Math.min(delta, 180)}px)`;
    };
    const dragEnd = () => {
      if (startY == null) return;
      dialog.style.transform = "";
      if (delta > 105) document.querySelector("[data-fechar-filtros]")?.click();
      startY = null;
      delta = 0;
    };
    const handle = dialog.querySelector("header");
    handle?.addEventListener("touchstart", dragStart, { passive:true });
    handle?.addEventListener("touchmove", dragMove, { passive:true });
    handle?.addEventListener("touchend", dragEnd);
  }

  function simplifyAbout() {
    if (!isMobile() || !document.body.classList.contains("page-sobre")) return;
    const heroTitle = document.querySelector(".about-hero h1");
    const heroText = document.querySelector(".about-hero p");
    if (heroTitle) heroTitle.textContent = "Tecnologia para quem atende e para quem procura.";
    if (heroText) heroText.textContent = "Descoberta, agenda e gestão conectadas em uma experiência simples.";
    document.querySelectorAll(".about-values-list article p").forEach(p => {
      const txt = p.textContent.trim();
      if (txt.length > 105) p.textContent = `${txt.slice(0, 102).replace(/[,;:]?\s+\S*$/, "")}…`;
    });
  }

  function improvePanelNavigation() {
    if (!isMobile() || !document.body.classList.contains("page-painel")) return;
    const sidebar = document.querySelector(".dashboard .sidebar");
    if (!sidebar) return;
    sidebar.setAttribute("aria-label", "Áreas do painel");
    const active = sidebar.querySelector("button.btn-primary,[data-panel].btn-primary");
    active?.scrollIntoView?.({ inline:"center", block:"nearest" });
    sidebar.querySelectorAll("[data-panel]").forEach(button => button.addEventListener("click", () => {
      requestAnimationFrame(() => button.scrollIntoView({ behavior:"smooth", inline:"center", block:"nearest" }));
    }));
  }

  function cleanDecorativeText() {
    if (!isMobile()) return;
    if (document.body.classList.contains("page-notificacoes")) document.querySelector(".notifications-hero p")?.remove();
    if (document.body.classList.contains("page-mapa-sistema")) {
      const p = document.querySelector(".page-hero p");
      if (p) p.textContent = "Visão resumida das áreas da plataforma.";
    }
  }

  function enhancePlansComparison() {
    if (!isMobile() || !document.body.classList.contains("page-planos")) return;
    const source = document.querySelector(".plans-table-wrap");
    if (!source || source.dataset.mobileComparisonReady === "1") return;
    source.dataset.mobileComparisonReady = "1";
    source.classList.add("mobile-plan-comparison-source");
    const container = source.parentElement;
    const block = document.createElement("section");
    block.className = "mobile-plan-comparison";
    block.innerHTML = `
      <div class="mobile-plan-comparison-head">
        <span>Comparação simples</span>
        <h2>O que muda em cada plano</h2>
        <p>Veja apenas os recursos que cada nível adiciona.</p>
      </div>
      <div class="mobile-plan-deltas">
        <details>
          <summary><span><b>Gratuito</b><small>Para começar</small></span><i class="bi bi-chevron-down"></i></summary>
          <ul><li>Página pública e reputação</li><li>Status aberto/fechado</li><li>Até 10 publicações</li><li>1 profissional ativo</li></ul>
        </details>
        <details open>
          <summary><span><b>Essencial</b><small>Tudo do Gratuito +</small></span><i class="bi bi-chevron-down"></i></summary>
          <ul><li>Agenda online</li><li>Carteira de clientes</li><li>Promoções públicas</li><li>Relatórios essenciais</li><li>50 publicações e 2 destaques</li></ul>
        </details>
        <details>
          <summary><span><b>Profissional</b><small>Tudo do Essencial +</small></span><i class="bi bi-chevron-down"></i></summary>
          <ul><li>Até 3 profissionais</li><li>Relatórios por profissional e receita</li><li>Exportação CSV</li><li>150 publicações e 3 destaques</li><li>Prioridade adicional no marketplace</li></ul>
        </details>
        <details>
          <summary><span><b>Elite</b><small>Tudo do Profissional +</small></span><i class="bi bi-chevron-down"></i></summary>
          <ul><li>Até 10 profissionais</li><li>500 publicações</li><li>5 destaques de portfólio</li><li>Prioridade máxima no marketplace</li></ul>
        </details>
      </div>`;
    container?.insertBefore(block, source);
  }

  function init() {
    if (!isMobile()) return;
    removeInstallPrompts();
    compactCopy();
    simplifyAbout();
    enhanceMarketplaceFilters();
    enhancePlansComparison();
    improvePanelNavigation();
    cleanDecorativeText();
    window.bhLiberarTravasOrfas?.();

    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) removeInstallPrompts(node);
      }
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
