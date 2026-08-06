/**
 * backend-api.js
 * --------------------------------------------------------------------------
 * Cliente da API própria do Barber Hub em Python/FastAPI.
 *
 * Responsabilidades:
 * - anexar o token da sessão quando uma rota exige autenticação;
 * - padronizar timeouts e mensagens de erro;
 * - impedir que chaves administrativas sejam enviadas ao navegador;
 * - concentrar os endpoints usados pelo site, PWA e futuro app Android.
 * --------------------------------------------------------------------------
 */

(function createBarberHubBackendClient(global) {
  "use strict";

  /** Retorna o access token atual sem armazená-lo em outra variável global. */
  async function sessionToken() {
    if (!global.supabaseClient?.auth) return null;
    const { data } = await global.supabaseClient.auth.getSession();
    return data?.session?.access_token || null;
  }

  /** Executa uma requisição JSON para /api/v1. */
  async function request(path, options = {}) {
    const {
      method = "GET",
      body,
      auth = "optional",
      timeout = 15_000
    } = options;

    const token = auth === false ? null : await sessionToken();
    if (auth === true && !token) {
      const error = new Error("Entre na conta para continuar.");
      error.code = "UNAUTHORIZED";
      error.status = 401;
      throw error;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`/api/v1/${String(path).replace(/^\/+/, "")}`, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) {
        const details = payload?.error?.details;
        const validationMessage = Array.isArray(details)
          ? details.map(item => item?.message || item?.msg).filter(Boolean).join(" ")
          : null;
        const error = new Error(
          validationMessage || payload?.error?.message || "A API não conseguiu concluir a operação."
        );
        error.code = payload?.error?.code || "API_ERROR";
        error.status = response.status;
        error.details = details || null;
        throw error;
      }

      return payload?.data;
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("A API demorou para responder. Tente novamente.");
        timeoutError.code = "API_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  global.bhBackendApi = {
    request,
    health: () => request("health", { auth: false, timeout: 8_000 }),
    catalogSummary: () => request("catalog/summary", { auth: false }),
    createAppointment: data => request("appointments", {
      method: "POST",
      auth: true,
      body: data
    }),
    createSupportTicket: data => request("support/tickets", { method: "POST", body: data }),
    listSupportTickets: () => request("support/tickets", { auth: true }),
    deleteAccount: confirmation => request("account", {
      method: "DELETE",
      auth: true,
      body: { confirmacao: confirmation }
    }),
    adminOverview: () => request("admin/overview", { auth: true }),
    sendPasswordRecovery: (userId, motivo = "") => request(
      `admin/users/${encodeURIComponent(userId)}/password-recovery`,
      { method: "POST", auth: true, body: { motivo } }
    ),
    navigationAudit: () => request("admin/navigation-audit", { auth: true })
  };
})(window);
