/**
 * notification-center.js — central contextual de avisos.
 *
 * Desktop abre como painel lateral; telas menores usam uma folha inferior.
 * A página completa continua disponível para histórico e filtros avançados.
 */
(function createNotificationCenter(global) {
  "use strict";

  const PAGE_SIZE = 12;
  const ICONS = {
    agendamento: "bi-calendar2-check",
    avaliacao: "bi-star",
    suporte: "bi-headset",
    portfolio: "bi-images",
    sistema: "bi-megaphone",
    conta: "bi-shield-check",
    campanha: "bi-send"
  };
  const state = { profile: null, items: [], unread: 0, filter: "todas", loading: false, hasMore: false, returnFocus: null };

  function setBackgroundInactive(drawer, inactive) {
    [...document.body.children].forEach(element => {
      if (element === drawer || ["SCRIPT", "STYLE", "LINK"].includes(element.tagName)) return;
      if (inactive) {
        if (!element.hasAttribute("inert")) { element.setAttribute("inert", ""); element.dataset.notificationInert111 = "1"; }
      } else if (element.dataset.notificationInert111 === "1") {
        element.removeAttribute("inert"); delete element.dataset.notificationInert111;
      }
    });
  }

  function trapFocus(event, panel) {
    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(item => !item.hidden && item.getClientRects().length);
    if (!focusable.length) { event.preventDefault(); panel.focus(); return; }
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function normalizedItems(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data)) return value.data;
    return [];
  }

  function relativeTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `há ${days} dia${days === 1 ? "" : "s"}`;
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
  }

  function safeNotificationUrl(value) {
    const raw = String(value || "").trim();
    if (!raw || /^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith("//") || raw.includes("\\")) return null;
    try {
      const url = new URL(bhUrl(raw), location.href);
      return url.origin === location.origin || location.protocol === "file:" ? url.href : null;
    } catch (_) { return null; }
  }

  function visibleItems() {
    if (state.filter === "nao_lidas") return state.items.filter(item => !item.lida_em);
    if (state.filter === "todas") return state.items;
    return state.items.filter(item => item.tipo === state.filter);
  }

  function dayLabel(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "Data não informada";
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.round((startToday - startDate) / 86_400_000);
    if (diff === 0) return "Hoje";
    if (diff === 1) return "Ontem";
    return new Intl.DateTimeFormat("pt-BR", { day:"2-digit", month:"long" }).format(date);
  }

  function groupedItems(items) {
    const groups = new Map();
    items.forEach(item => {
      const date = new Date(item.created_at);
      const key = Number.isFinite(date.getTime()) ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : "unknown";
      if (!groups.has(key)) groups.set(key, { label:dayLabel(item.created_at), items:[] });
      groups.get(key).items.push(item);
    });
    return [...groups.values()];
  }

  function ensure() {
    let drawer = document.getElementById("notificationCenter111");
    if (drawer) return drawer;
    drawer = document.createElement("div");
    drawer.id = "notificationCenter111";
    drawer.className = "notification-center111";
    drawer.innerHTML = `
      <button class="notification-center111-backdrop" type="button" data-notification-close aria-label="Fechar notificações"></button>
      <aside class="notification-center111-panel" role="dialog" aria-modal="true" aria-labelledby="notificationCenterTitle111" aria-hidden="true" inert>
        <header class="notification-center111-head">
          <div><span>Atualizações</span><h2 id="notificationCenterTitle111">Notificações</h2></div>
          <button class="icon-btn" type="button" data-notification-close aria-label="Fechar"><i class="bi bi-x-lg"></i></button>
        </header>
        <div class="notification-center111-toolbar">
          <div class="notification-center111-filters" role="group" aria-label="Filtrar notificações">
            <button class="ativo" type="button" data-notification-filter="todas">Todas</button>
            <button type="button" data-notification-filter="nao_lidas">Não lidas</button>
            <button type="button" data-notification-filter="agendamento">Agenda</button>
          </div>
          <button class="notification-center111-read-all" type="button" data-notification-read-all><i class="bi bi-check2-all"></i> Ler todas</button>
        </div>
        <div class="notification-center111-list" data-notification-list aria-live="polite"></div>
        <footer class="notification-center111-footer">
          <button class="btn btn-outline btn-small" type="button" data-notification-more hidden>Carregar mais</button>
          <a class="btn btn-primary btn-small" href="${bhUrl("html/notificacoes.html")}">Abrir histórico</a>
        </footer>
      </aside>`;
    document.body.appendChild(drawer);
    drawer.addEventListener("click", onClick);
    return drawer;
  }

  function renderBadge() {
    document.querySelectorAll("[data-notification-center-count]").forEach(badge => {
      badge.textContent = state.unread > 99 ? "99+" : String(state.unread || "");
      badge.hidden = state.unread <= 0;
      badge.setAttribute("aria-hidden", state.unread > 0 ? "false" : "true");
    });
    document.querySelectorAll("[data-notification-center-trigger]").forEach(button => {
      button.setAttribute("aria-label", state.unread ? `Notificações, ${state.unread} não lida${state.unread === 1 ? "" : "s"}` : "Notificações");
    });
    document.querySelectorAll("[data-badge-notificacoes]").forEach(badge => {
      badge.textContent = state.unread > 99 ? "99+" : String(state.unread || "");
      badge.hidden = state.unread <= 0;
      badge.classList.toggle("ativo", state.unread > 0);
    });
  }

  function render() {
    const drawer = ensure();
    const list = drawer.querySelector("[data-notification-list]");
    const items = visibleItems();
    drawer.querySelectorAll("[data-notification-filter]").forEach(button => button.classList.toggle("ativo", button.dataset.notificationFilter === state.filter));
    drawer.querySelector("[data-notification-read-all]").disabled = state.unread <= 0 || state.loading;
    drawer.querySelector("[data-notification-more]").hidden = !state.hasMore || state.filter !== "todas";
    if (state.loading && !state.items.length) {
      list.innerHTML = '<div class="notification-center111-state"><span class="state-spinner"></span><strong>Buscando suas atualizações</strong></div>';
      return;
    }
    if (!items.length) {
      list.innerHTML = `<div class="notification-center111-state"><i class="bi bi-bell-slash"></i><strong>${state.filter === "nao_lidas" ? "Tudo lido por aqui" : "Nenhuma atualização"}</strong><span>Novos avisos aparecerão neste painel.</span></div>`;
      return;
    }
    list.innerHTML = groupedItems(items).map(group => `<section class="notification-center111-day"><h3>${escapeHTML(group.label)}</h3><div>${group.items.map(item => {
      const target = safeNotificationUrl(item.url);
      return `<article class="notification-center111-item ${item.lida_em ? "is-read" : "is-unread"}" data-notification-item="${escapeHTML(item.id)}">
        <span class="notification-center111-icon"><i class="bi ${ICONS[item.tipo] || "bi-bell"}"></i></span>
        <div><div class="notification-center111-title"><strong>${escapeHTML(item.titulo || "Atualização")}</strong><time datetime="${escapeHTML(item.created_at || "")}">${relativeTime(item.created_at)}</time></div><p>${escapeHTML(item.mensagem || "")}</p>
          <div class="notification-center111-actions">${target ? `<a href="${escapeHTML(target)}" data-notification-open>Ver detalhes</a>` : ""}${!item.lida_em ? '<button type="button" data-notification-read>Marcar como lida</button>' : '<span><i class="bi bi-check2-all"></i> Lida</span>'}</div>
        </div>
      </article>`;
    }).join("")}</div></section>`).join("");
  }

  async function load(reset = true) {
    if (state.loading) return;
    state.loading = true;
    if (reset) state.items = [];
    render();
    try {
      const page = await bhListarNotificacoes({ offset: reset ? 0 : state.items.length, limite: PAGE_SIZE });
      const items = normalizedItems(page);
      const existing = new Set(state.items.map(item => item.id));
      state.items = reset ? items : [...state.items, ...items.filter(item => !existing.has(item.id))];
      state.hasMore = typeof page?.has_more === "boolean" ? page.has_more : items.length === PAGE_SIZE;
      state.unread = await bhContarNotificacoesNaoLidas();
    } catch (error) {
      if (!state.items.length) {
        ensure().querySelector("[data-notification-list]").innerHTML = '<div class="notification-center111-state"><i class="bi bi-exclamation-circle"></i><strong>Não foi possível carregar agora</strong><span>Tente novamente em instantes.</span><button class="btn btn-outline btn-small" type="button" data-notification-retry>Tentar novamente</button></div>';
      }
    } finally {
      state.loading = false;
      renderBadge();
      if (state.items.length) render();
    }
  }

  function open(trigger = null) {
    const drawer = ensure();
    const panel = drawer.querySelector(".notification-center111-panel");
    if (drawer.classList.contains("is-open")) return;
    state.returnFocus = trigger || document.activeElement;
    drawer.classList.add("is-open");
    panel.removeAttribute("inert");
    panel.setAttribute("aria-hidden", "false");
    panel.setAttribute("tabindex", "-1");
    document.body.classList.add("notification-center-open");
    setBackgroundInactive(drawer, true);
    history.pushState({ ...(history.state || {}), bhNotificationCenter111:true }, "", location.href);
    drawer.dataset.historyEntry = "1";
    requestAnimationFrame(() => panel.querySelector("[data-notification-close]")?.focus());
    load(true);
  }

  function close({ fromHistory = false } = {}) {
    const drawer = ensure();
    const panel = drawer.querySelector(".notification-center111-panel");
    if (!drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("inert", "");
    document.body.classList.remove("notification-center-open");
    setBackgroundInactive(drawer, false);
    state.returnFocus?.focus?.({ preventScroll: true });
    if (!fromHistory && drawer.dataset.historyEntry === "1") {
      drawer.dataset.historyEntry = "0";
      history.back();
    } else drawer.dataset.historyEntry = "0";
  }

  async function readOne(id) {
    const item = state.items.find(current => String(current.id) === String(id));
    if (!item || item.lida_em) return true;
    const previous = item.lida_em;
    item.lida_em = new Date().toISOString();
    state.unread = Math.max(0, state.unread - 1);
    render(); renderBadge();
    try {
      await bhMarcarNotificacaoLida(item.id);
      document.dispatchEvent(new CustomEvent("bh:notifications-changed"));
      return true;
    } catch (error) {
      item.lida_em = previous;
      state.unread += 1;
      render(); renderBadge();
      global.mostrarToast?.("erro", "Aviso não atualizado", "Sua notificação continua como não lida. Tente novamente.");
      return false;
    }
  }

  async function readAll() {
    const snapshot = state.items.map(item => ({ id: item.id, lida_em: item.lida_em }));
    const previousUnread = state.unread;
    const now = new Date().toISOString();
    state.items.forEach(item => { item.lida_em ||= now; });
    state.unread = 0;
    render(); renderBadge();
    try {
      await bhMarcarTodasNotificacoesLidas();
      document.dispatchEvent(new CustomEvent("bh:notifications-changed"));
    } catch (error) {
      snapshot.forEach(previous => {
        const item = state.items.find(current => current.id === previous.id);
        if (item) item.lida_em = previous.lida_em;
      });
      state.unread = previousUnread;
      render(); renderBadge();
      global.mostrarToast?.("erro", "Avisos não atualizados", "Nada foi perdido. Tente novamente.");
    }
  }

  async function onClick(event) {
    if (event.target.closest("[data-notification-close]")) return close();
    if (event.target.closest("[data-notification-retry]")) return load(true);
    if (event.target.closest("[data-notification-more]")) return load(false);
    const filter = event.target.closest("[data-notification-filter]");
    if (filter) { state.filter = filter.dataset.notificationFilter; render(); return; }
    if (event.target.closest("[data-notification-read-all]")) return readAll();
    const article = event.target.closest("[data-notification-item]");
    if (!article) return;
    if (event.target.closest("[data-notification-read]")) return readOne(article.dataset.notificationItem);
    const link = event.target.closest("[data-notification-open]");
    if (link) {
      event.preventDefault();
      await readOne(article.dataset.notificationItem);
      location.href = link.href;
    }
  }

  function addTrigger() {
    if (document.querySelector("[data-notification-center-trigger]")) return;
    const actions = document.querySelector(".header .nav-actions");
    if (!actions) return;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "notification-center111-trigger";
    trigger.dataset.notificationCenterTrigger = "";
    trigger.innerHTML = '<i class="bi bi-bell"></i><span data-notification-center-count hidden aria-hidden="true"></span>';
    trigger.addEventListener("click", () => open(trigger));
    actions.insertBefore(trigger, actions.querySelector(".account-link, .btn-menu"));
  }

  document.addEventListener("bh:interface-ready", event => {
    state.profile = event.detail?.perfil || null;
    if (!state.profile) return;
    addTrigger();
    state.unread = Number(event.detail?.contadores?.notificacoes || 0);
    renderBadge();
  });
  document.addEventListener("keydown", event => {
    const drawer = document.getElementById("notificationCenter111");
    if (!drawer?.classList.contains("is-open")) return;
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    trapFocus(event, drawer.querySelector(".notification-center111-panel"));
  });
  global.addEventListener("popstate", () => {
    const drawer = document.getElementById("notificationCenter111");
    if (drawer?.classList.contains("is-open")) close({ fromHistory:true });
  });

  global.bhNotificationCenter = { open, close, reload: () => load(true) };
})(window);
