/**
 * view-state.js — continuidade visual segura da interface.
 *
 * Preserva somente navegação e controles explicitamente seguros nesta aba.
 * Senhas, códigos, tokens, arquivos e campos marcados como privados nunca são
 * serializados. O estado expira, não dispara envios e é removido no logout.
 */
(function createViewState(global) {
  "use strict";

  const PREFIX = "barber-hub:view-state:v2:";
  const OWNER_KEY = `${PREFIX}owner`;
  const TTL_MS = 2 * 60 * 60 * 1000;
  const MAX_SCROLL = 10_000_000;
  const SENSITIVE = /(pass|senha|secret|token|captcha|otp|codigo|code|authorization|card|cartao|cvv)/i;
  const timers = new Map();
  let ownerReady = false;
  let restored = false;

  function storage() {
    return global.sessionStorage;
  }

  function pageKey() {
    const path = String(global.location.pathname || "/").replace(/\/{2,}/g, "/");
    return `${PREFIX}${encodeURIComponent(path)}`;
  }

  function parse(raw) {
    try { return JSON.parse(raw || "null"); } catch (_) { return null; }
  }

  function read() {
    try {
      const record = parse(storage().getItem(pageKey()));
      if (!record || Number(record.expiresAt || 0) <= Date.now()) {
        storage().removeItem(pageKey());
        return { version: 2, controls: {}, memory: {} };
      }
      return {
        version: 2,
        controls: record.controls && typeof record.controls === "object" ? record.controls : {},
        memory: record.memory && typeof record.memory === "object" ? record.memory : {},
        hash: typeof record.hash === "string" ? record.hash : "",
        scrollY: Number.isFinite(Number(record.scrollY)) ? Number(record.scrollY) : 0
      };
    } catch (_) {
      return { version: 2, controls: {}, memory: {} };
    }
  }

  function write(record) {
    try {
      storage().setItem(pageKey(), JSON.stringify({
        ...record,
        version: 2,
        updatedAt: Date.now(),
        expiresAt: Date.now() + TTL_MS
      }));
    } catch (_) {
      // A página continua funcional quando o armazenamento da aba é bloqueado.
    }
  }

  function clearAll() {
    try {
      Object.keys(storage()).filter(key => key.startsWith(PREFIX)).forEach(key => storage().removeItem(key));
    } catch (_) { /* armazenamento indisponível */ }
  }

  function safeControl(element) {
    if (!(element instanceof HTMLElement) || element.disabled || element.matches("[data-no-persist]")) return false;
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return false;
    const type = String(element.type || "").toLowerCase();
    const identity = `${element.id} ${element.name} ${element.autocomplete}`;
    if (["password", "file", "hidden", "submit", "button", "reset", "image"].includes(type) || SENSITIVE.test(identity)) return false;
    if (element.closest("[data-private-form], .delete-account-form, .security-card")) return false;
    return Boolean(
      element.matches("[data-view-state], [data-safe-draft], input[type='search'], input[type='date']") ||
      element.closest("[data-view-state-scope], .filters, .marketplace-filter-dialog, .notification-filters, .agenda-toolbar, .crm-workspace")
    );
  }

  function identity(element) {
    const value = element.id || element.name;
    return value && !SENSITIVE.test(value) ? value : null;
  }

  function serialize(element) {
    if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)) return Boolean(element.checked);
    return String(element.value ?? "").slice(0, 500);
  }

  function applyValue(element, value) {
    if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)) element.checked = Boolean(value);
    else if (typeof value === "string" && value.length <= 500) element.value = value;
  }

  function saveControl(element) {
    if (!ownerReady) return;
    if (!safeControl(element)) return;
    const key = identity(element);
    if (!key) return;
    const record = read();
    record.controls[key] = serialize(element);
    write(record);
  }

  function restoreControls() {
    const record = read();
    document.querySelectorAll("input,select,textarea").forEach(element => {
      if (!safeControl(element)) return;
      const key = identity(element);
      if (key && Object.prototype.hasOwnProperty.call(record.controls, key)) applyValue(element, record.controls[key]);
    });
    document.dispatchEvent(new CustomEvent("bh:view-state-restored", { detail: record }));
  }

  function rememberLocation() {
    if (!ownerReady) return;
    const record = read();
    record.hash = /^#[A-Za-z][\w:-]{0,80}$/.test(global.location.hash) ? global.location.hash : "";
    record.scrollY = Math.max(0, Math.min(MAX_SCROLL, Math.round(global.scrollY || 0)));
    write(record);
  }

  function restoreLocation() {
    const record = read();
    if (!global.location.hash && record.hash && document.querySelector(record.hash)) {
      global.history.replaceState(global.history.state, "", `${global.location.pathname}${global.location.search}${record.hash}`);
    }
    if (global.location.hash || !record.scrollY) return;
    const restore = () => global.scrollTo({ top: Math.min(record.scrollY, Math.max(document.documentElement.scrollHeight - global.innerHeight, 0)), behavior: "instant" });
    global.setTimeout(restore, 220);
    global.setTimeout(restore, 900);
  }

  function setMemory(key, value) {
    if (!ownerReady) return;
    if (!/^[a-z][\w.-]{0,50}$/i.test(String(key || ""))) return;
    if (SENSITIVE.test(String(key)) || !["string", "number", "boolean"].includes(typeof value)) return;
    const record = read();
    record.memory[key] = value;
    write(record);
  }

  function getMemory(key, fallback = null) {
    if (!ownerReady) return fallback;
    const record = read();
    return Object.prototype.hasOwnProperty.call(record.memory, key) ? record.memory[key] : fallback;
  }

  function clearPage() {
    try { storage().removeItem(pageKey()); } catch (_) { /* armazenamento indisponível */ }
  }

  document.addEventListener("input", event => {
    const element = event.target;
    if (!safeControl(element)) return;
    clearTimeout(timers.get(element));
    timers.set(element, setTimeout(() => saveControl(element), 180));
  });
  document.addEventListener("change", event => saveControl(event.target));
  global.addEventListener("scroll", () => {
    clearTimeout(timers.get(global));
    timers.set(global, setTimeout(rememberLocation, 180));
  }, { passive: true });
  global.addEventListener("hashchange", rememberLocation);
  global.addEventListener("pagehide", rememberLocation);

  document.addEventListener("bh:interface-ready", event => {
    const owner = event.detail?.perfil?.id || "visitante";
    try {
      const previous = storage().getItem(OWNER_KEY);
      if (previous && previous !== owner) clearAll();
      storage().setItem(OWNER_KEY, owner);
    } catch (_) { /* armazenamento indisponível */ }
    ownerReady = true;
    if (!restored) {
      restored = true;
      restoreControls();
      restoreLocation();
    }
  });

  global.bhViewState = { clearAll, clearPage, getMemory, setMemory, restoreControls, rememberLocation, isReady:() => ownerReady };
})(window);
