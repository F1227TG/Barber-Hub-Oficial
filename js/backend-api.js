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
    searchMarketplace: ({ query = "", tipo = "todos", agenda = null, status = "todos", offset = 0, limit = 24 } = {}) => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (tipo && tipo !== "todos") params.set("tipo", tipo);
      if (agenda !== null && agenda !== undefined) params.set("agenda", String(Boolean(agenda)));
      if (status && status !== "todos") params.set("status", status);
      params.set("offset", String(offset));
      params.set("limit", String(limit));
      return request(`marketplace/search?${params.toString()}`, { auth: false });
    },
    featuredMarketplace: (limit = 6) => request(`marketplace/featured?limit=${encodeURIComponent(limit)}`, { auth: false }),
    createAppointment: data => request("appointments", {
      method: "POST",
      auth: true,
      body: data
    }),
    cancelAppointment: (appointmentId, motivo = "Cancelado pelo cliente") => request(`appointments/${encodeURIComponent(appointmentId)}`, {
      method: "DELETE",
      auth: true,
      body: { motivo }
    }),
    updateAppointmentStatus: (appointmentId, status, motivo = null) => request(`appointments/${encodeURIComponent(appointmentId)}/status`, {
      method: "PATCH",
      auth: true,
      body: { status, motivo }
    }),
    updateEstablishment: (establishmentId, data) => request(`establishments/${encodeURIComponent(establishmentId)}`, {
      method: "PATCH",
      auth: true,
      body: data
    }),
    updateEstablishmentStatus: (establishmentId, status, motivo = null) => request(`establishments/${encodeURIComponent(establishmentId)}/status`, {
      method: "PATCH",
      auth: true,
      body: { status, motivo }
    }),
    getEntitlements: establishmentId => request(`establishments/${encodeURIComponent(establishmentId)}/entitlements`, { auth: true }),
    createService: data => request("services", { method: "POST", auth: true, body: data }),
    updateService: (serviceId, data) => request(`services/${encodeURIComponent(serviceId)}`, { method: "PATCH", auth: true, body: data }),
    deleteService: serviceId => request(`services/${encodeURIComponent(serviceId)}`, { method: "DELETE", auth: true }),
    createProfessional: data => request("professionals", { method: "POST", auth: true, body: data }),
    updateProfessional: (professionalId, data) => request(`professionals/${encodeURIComponent(professionalId)}`, { method: "PATCH", auth: true, body: data }),
    deleteProfessional: professionalId => request(`professionals/${encodeURIComponent(professionalId)}`, { method: "DELETE", auth: true }),
    createPromotion: data => request("promotions", { method: "POST", auth: true, body: data }),
    updatePromotion: (promotionId, data) => request(`promotions/${encodeURIComponent(promotionId)}`, { method: "PATCH", auth: true, body: data }),
    deletePromotion: promotionId => request(`promotions/${encodeURIComponent(promotionId)}`, { method: "DELETE", auth: true }),
    createSupportTicket: data => request("support/tickets", { method: "POST", body: data }),
    listSupportTickets: () => request("support/tickets", { auth: true }),
    deleteAccount: confirmation => request("account", {
      method: "DELETE",
      auth: true,
      body: { confirmacao: confirmation }
    }),
    adminOverview: () => request("admin/overview", { auth: true }),
    adminSubscriptions: () => request("admin/subscriptions", { auth: true }),
    adminAssignSubscription: (establishmentId, data) => request(`admin/establishments/${encodeURIComponent(establishmentId)}/subscription`, { method: "PATCH", auth: true, body: data }),
    sendPasswordRecovery: (userId, motivo = "") => request(
      `admin/users/${encodeURIComponent(userId)}/password-recovery`,
      { method: "POST", auth: true, body: { motivo } }
    ),
    adminHealth: () => request("admin/health", { auth: true }),
    navigationAudit: () => request("admin/navigation-audit", { auth: true })
  };
})(window);
