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

    const liveServerLocal = ["localhost", "127.0.0.1", "::1"].includes(location.hostname)
      && ["5500", "5501", "5502"].includes(location.port);
    if (liveServerLocal || location.protocol === "file:") {
      const error = new Error("Backend próprio indisponível neste servidor local; usando fallback de desenvolvimento.");
      error.code = "BACKEND_NOT_CONFIGURED";
      error.status = 503;
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
    scheduleRange: ({ establishmentId, start, end, professionalId = null }) => {
      const params = new URLSearchParams({ establishment_id: establishmentId, start, end });
      if (professionalId) params.set("professional_id", professionalId);
      return request(`schedule/range?${params.toString()}`, { auth: true });
    },
    createWalkIn: data => request("schedule/walk-ins", { method: "POST", auth: true, body: data }),
    createScheduleBlock: data => request("schedule/blocks", { method: "POST", auth: true, body: data }),
    deleteScheduleBlock: blockId => request(`schedule/blocks/${encodeURIComponent(blockId)}`, { method: "DELETE", auth: true }),
    rescheduleAppointment: (appointmentId, data) => request(`appointments/${encodeURIComponent(appointmentId)}/reschedule`, { method: "PATCH", auth: true, body: data }),
    confirmAppointment: (appointmentId, origem, confirmacao) => request(`appointments/${encodeURIComponent(appointmentId)}/confirmation`, { method: "PATCH", auth: true, body: { origem, confirmacao } }),
    markNoShow: appointmentId => request(`appointments/${encodeURIComponent(appointmentId)}/no-show`, { method: "PATCH", auth: true }),
    listWaitlist: (establishmentId = null) => request(`retention/waitlist${establishmentId ? `?establishment_id=${encodeURIComponent(establishmentId)}` : ""}`, { auth: true }),
    joinWaitlist: data => request("retention/waitlist", { method: "POST", auth: true, body: data }),
    updateWaitlist: (itemId, status) => request(`retention/waitlist/${encodeURIComponent(itemId)}`, { method: "PATCH", auth: true, body: { status } }),
    createRecurrence: (appointmentId, data) => request(`appointments/${encodeURIComponent(appointmentId)}/recurrence`, { method: "POST", auth: true, body: data }),
    listRecurrences: (establishmentId = null) => request(`retention/recurrences${establishmentId ? `?establishment_id=${encodeURIComponent(establishmentId)}` : ""}`, { auth: true }),
    loyaltyOverview: establishmentId => request(`retention/loyalty?establishment_id=${encodeURIComponent(establishmentId)}`, { auth: true }),
    clientLoyalty: () => request("client/loyalty", { auth: true }),
    saveLoyaltyProgram: data => request("retention/loyalty/program", { method: "PUT", auth: true, body: data }),
    createLoyaltyReward: data => request("retention/loyalty/rewards", { method: "POST", auth: true, body: data }),
    updateLoyaltyReward: (rewardId, data) => request(`retention/loyalty/rewards/${encodeURIComponent(rewardId)}`, { method: "PATCH", auth: true, body: data }),
    redeemLoyaltyReward: (rewardId, clientId) => request(`retention/loyalty/rewards/${encodeURIComponent(rewardId)}/redeem`, { method: "POST", auth: true, body: { cliente_id:clientId } }),
    listCoupons: establishmentId => request(`retention/coupons?establishment_id=${encodeURIComponent(establishmentId)}`, { auth: true }),
    createCoupon: data => request("retention/coupons", { method: "POST", auth: true, body: data }),
    updateCoupon: (couponId, data) => request(`retention/coupons/${encodeURIComponent(couponId)}`, { method: "PATCH", auth: true, body: data }),
    listCampaigns: establishmentId => request(`retention/campaigns?establishment_id=${encodeURIComponent(establishmentId)}`, { auth: true }),
    createCampaign: data => request("retention/campaigns", { method: "POST", auth: true, body: data }),
    teamPermissions: establishmentId => request(`team/permissions?establishment_id=${encodeURIComponent(establishmentId)}`, { auth: true }),
    updateTeamPermissions: (memberId, permissions) => request(`team/members/${encodeURIComponent(memberId)}/permissions`, { method: "PATCH", auth: true, body: { permissoes:permissions } }),
    growthInsights: ({ establishmentId, start, end }) => request(`growth/insights?${new URLSearchParams({ establishment_id:establishmentId, start, end }).toString()}`, { auth: true }),
    growthOpportunities: establishmentId => request(`growth/opportunities?establishment_id=${encodeURIComponent(establishmentId)}`, { auth: true }),
    updateGrowthOpportunity: (opportunityId, status) => request(`growth/opportunities/${encodeURIComponent(opportunityId)}`, { method: "PATCH", auth: true, body: { status } }),
    growthGoals: establishmentId => request(`growth/goals?establishment_id=${encodeURIComponent(establishmentId)}`, { auth: true }),
    createGrowthGoal: data => request("growth/goals", { method: "POST", auth: true, body: data }),
    updateGrowthGoal: (goalId, data) => request(`growth/goals/${encodeURIComponent(goalId)}`, { method: "PATCH", auth: true, body: data }),
    listCrmClients: ({ establishmentId, query = "", segment = "", cursorLast = null, cursorId = null, limit = 30 }) => {
      const params = new URLSearchParams({ establishment_id: establishmentId, limit: String(limit) });
      if (query) params.set("q", query);
      if (segment) params.set("segment", segment);
      if (cursorLast) params.set("cursor_last", cursorLast);
      if (cursorId) params.set("cursor_id", cursorId);
      return request(`crm/clients?${params.toString()}`, { auth: true });
    },
    getCrmClient: clientId => request(`crm/clients/${encodeURIComponent(clientId)}`, { auth: true }),
    updateCrmClient: (clientId, data) => request(`crm/clients/${encodeURIComponent(clientId)}`, { method: "PATCH", auth: true, body: data }),
    addCrmNote: (clientId, conteudo) => request(`crm/clients/${encodeURIComponent(clientId)}/notes`, { method: "POST", auth: true, body: { conteudo } }),
    financeSummary: ({ establishmentId, start, end }) => {
      const params = new URLSearchParams({ establishment_id: establishmentId, start, end });
      return request(`finance/summary?${params.toString()}`, { auth: true });
    },
    financeEntries: ({ establishmentId, start, end, limit = 100 }) => {
      const params = new URLSearchParams({ establishment_id: establishmentId, start, end, limit: String(limit) });
      return request(`finance/entries?${params.toString()}`, { auth: true });
    },
    createFinancialAdjustment: data => request("finance/adjustments", { method: "POST", auth: true, body: data }),
    closeFinancialDay: data => request("finance/closings", { method: "POST", auth: true, body: data }),
    commissionRules: establishmentId => request(`finance/commission-rules?establishment_id=${encodeURIComponent(establishmentId)}`, { auth: true }),
    createCommissionRule: data => request("finance/commission-rules", { method: "POST", auth: true, body: data }),
    updateCommissionRule: (ruleId, data) => request(`finance/commission-rules/${encodeURIComponent(ruleId)}`, { method: "PATCH", auth: true, body: data }),
    teamMembers: establishmentId => request(`team/members?establishment_id=${encodeURIComponent(establishmentId)}`, { auth: true }),
    linkTeamMember: data => request("team/members", { method: "POST", auth: true, body: data }),
    updateTeamMember: (memberId, data) => request(`team/members/${encodeURIComponent(memberId)}`, { method: "PATCH", auth: true, body: data }),
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
