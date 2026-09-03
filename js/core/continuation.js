/**
 * continuation.js — continuidade segura de ações após autenticação.
 *
 * Mantém o contexto no navegador por um período curto e conserva na URL
 * somente o destino interno. Assim, observações e escolhas do cliente não
 * ficam expostas no histórico, em logs ou no link de confirmação de e-mail.
 */
(function createContinuation(global) {
  "use strict";

  const STORAGE_KEY = "barber-hub:continuation:v1";
  const VERSION = 1;
  const TTL_MS = 45 * 60 * 1000;
  const MAX_BYTES = 12_000;

  function safeNext(value, fallback = null) {
    const candidate = String(value || "").trim();
    if (!candidate || candidate.length > 2_000) return fallback;
    if (/^[a-z][a-z\d+.-]*:/i.test(candidate) || candidate.startsWith("//") || candidate.includes("\\")) {
      return fallback;
    }
    if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;

    try {
      const base = new URL(global.location.href);
      const resolved = new URL(candidate, base);
      if (resolved.origin !== base.origin) return fallback;
      if (base.protocol === "file:") return candidate;
      return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    } catch (_error) {
      return fallback;
    }
  }

  function normalizedPayload(payload) {
    const json = JSON.stringify(payload || {});
    if (new Blob([json]).size > MAX_BYTES) throw new Error("O contexto da ação ficou grande demais.");
    return JSON.parse(json);
  }

  function clear() {
    try { global.localStorage.removeItem(STORAGE_KEY); } catch (_error) { /* armazenamento indisponível */ }
  }

  function capture(action, payload, next) {
    const safeAction = String(action || "").trim().toLowerCase();
    const safeDestination = safeNext(next);
    if (!/^[a-z][a-z0-9_.-]{1,39}$/.test(safeAction) || !safeDestination) {
      throw new Error("Não foi possível preservar esta ação com segurança.");
    }
    const now = Date.now();
    const record = {
      version: VERSION,
      action: safeAction,
      payload: normalizedPayload(payload),
      next: safeDestination,
      createdAt: now,
      expiresAt: now + TTL_MS
    };
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch (_error) {
      throw new Error("Seu navegador não permitiu preservar o agendamento.");
    }
    return record;
  }

  function peek(action = null) {
    let record = null;
    try { record = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || "null"); } catch (_error) { clear(); }
    if (!record || record.version !== VERSION || record.expiresAt <= Date.now()) {
      clear();
      return null;
    }
    if (!safeNext(record.next) || (action && record.action !== action)) return null;
    return record;
  }

  function consume(action = null) {
    const record = peek(action);
    if (record) clear();
    return record;
  }

  function nextFromLocation(fallback = null) {
    return safeNext(new URLSearchParams(global.location.search).get("next"), fallback);
  }

  global.bhContinuation = { capture, peek, consume, clear, safeNext, nextFromLocation };
})(window);
