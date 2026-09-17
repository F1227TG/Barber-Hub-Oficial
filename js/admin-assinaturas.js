/** Administração segura e responsiva das assinaturas — Barber Hub 1.11. */
let bhSubscriptionData = { plans:[], establishments:[], profiles:[], subscriptions:[] };
let bhSubscriptionAdmin = null;
let bhSubscriptionSelected = null;
let bhSubscriptionAttempt = { fingerprint:"", key:"" };

function bhSubscriptionList(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function bhSubscriptionNormalize(payload) {
  return {
    plans:bhSubscriptionList(payload?.plans),
    establishments:bhSubscriptionList(payload?.establishments),
    profiles:bhSubscriptionList(payload?.profiles),
    subscriptions:bhSubscriptionList(payload?.subscriptions)
  };
}

function bhSubscriptionIndex() {
  const perfis = new Map(bhSubscriptionData.profiles.map(item => [item?.id, item]));
  const assinaturas = new Map(bhSubscriptionData.subscriptions.map(item => [item?.estabelecimento_id, item]));
  return { perfis, assinaturas };
}

function bhSubscriptionPlanLabel(subscription) {
  return subscription?.planos?.nome || "Gratuito";
}

function bhSubscriptionCommercialState(plan) {
  const state = plan?.estado_comercial || "desenvolvimento";
  return ({ desenvolvimento:"Em desenvolvimento", ativo:"Ativo comercialmente", pausado:"Pausado" })[state] || state;
}

function bhSubscriptionStatus(subscription) {
  return subscription?.status || "ativa";
}

function bhSubscriptionPeriod(subscription) {
  if (!subscription) return "Sem prazo";
  if (subscription.status === "teste" && subscription.teste_termina_em) return `Teste até ${bhFormatarData(subscription.teste_termina_em)}`;
  if (subscription.periodo_atual_fim) return `Até ${bhFormatarData(subscription.periodo_atual_fim)}`;
  return "Sem prazo";
}

function bhSubscriptionIsEffective(subscription) {
  if (!subscription || !["ativa", "teste"].includes(subscription.status)) return false;
  if (!subscription.periodo_atual_fim) return true;
  const fim = new Date(`${String(subscription.periodo_atual_fim).slice(0,10)}T23:59:59`);
  return Number.isFinite(fim.getTime()) && fim.getTime() >= Date.now();
}

function bhSubscriptionEffectivePlan(subscription) {
  if (bhSubscriptionIsEffective(subscription)) {
    const slug = subscription?.planos?.slug;
    return bhSubscriptionData.plans.find(plan => plan.slug === slug) || subscription?.planos || null;
  }
  return bhSubscriptionData.plans.find(plan => plan.slug === "gratuito") || null;
}

function bhSubscriptionAgendaEffective(establishment, subscription) {
  const plan = bhSubscriptionEffectivePlan(subscription);
  return Boolean(establishment?.aceita_agendamento && plan?.permite_agenda);
}

function bhRenderSubscriptionKpis() {
  const { assinaturas } = bhSubscriptionIndex();
  const estabelecimentos = bhSubscriptionData.establishments;
  const pagos = estabelecimentos.filter(item => Number(bhSubscriptionEffectivePlan(assinaturas.get(item.id))?.ordenacao || 1) > 1).length;
  const testes = estabelecimentos.filter(item => bhSubscriptionStatus(assinaturas.get(item.id)) === "teste" && bhSubscriptionIsEffective(assinaturas.get(item.id))).length;
  const agenda = estabelecimentos.filter(item => bhSubscriptionAgendaEffective(item, assinaturas.get(item.id))).length;
  const values = {
    subKpiEstabelecimentos:estabelecimentos.length,
    subKpiPagos:pagos,
    subKpiTeste:testes,
    subKpiAgenda:agenda
  };
  Object.entries(values).forEach(([id,value]) => { const target=document.getElementById(id); if (target) target.textContent=String(value); });
}

function bhRenderSubscriptionCatalog() {
  const target = document.getElementById("adminPlanCatalog");
  if (!target) return;
  target.innerHTML = bhSubscriptionData.plans.map((plan, index) => {
    const own = bhSubscriptionList(plan?.recursos);
    const inherited = bhSubscriptionData.plans.slice(0, index + 1).flatMap(item => bhSubscriptionList(item?.recursos));
    const unique = [...new Set(inherited)];
    return `<article class="subscription-plan-mini ${plan?.destaque ? "recommended" : ""}">
      <div><span>${escapeHTML(plan?.nome || plan?.slug || "Plano")}</span><strong>${Number(plan?.preco_mensal || 0) > 0 ? `${bhMoeda(plan.preco_mensal)}/mês` : "Grátis"}</strong></div>
      <small>${bhSubscriptionCommercialState(plan)} · ${unique.length} benefício${unique.length===1?"":"s"} cumulativo${unique.length===1?"":"s"}</small>
      <div class="subscription-plan-chips">${own.slice(0,4).map(item=>`<span>${escapeHTML(item)}</span>`).join("")}</div>
    </article>`;
  }).join("") || `<div class="empty compact">Nenhum plano ativo foi encontrado.</div>`;
}

function bhRenderSubscriptionFilters() {
  const planFilter = document.getElementById("filtroAdminPlano");
  const planEditor = document.getElementById("assinaturaPlano");
  const establishmentEditor = document.getElementById("assinaturaEstabelecimento");
  const { perfis } = bhSubscriptionIndex();
  if (planFilter) {
    const previous = planFilter.value;
    planFilter.innerHTML = `<option value="todos">Todos os planos</option>` + bhSubscriptionData.plans.map(plan => `<option value="${escapeHTML(plan.slug)}">${escapeHTML(plan.nome)}</option>`).join("");
    if ([...planFilter.options].some(option => option.value === previous)) planFilter.value = previous;
  }
  if (planEditor) {
    planEditor.innerHTML = bhSubscriptionData.plans.map(plan => `<option value="${escapeHTML(plan.slug)}">${escapeHTML(plan.nome)} · ${escapeHTML(bhSubscriptionCommercialState(plan))}</option>`).join("");
  }
  if (establishmentEditor) {
    const previous = bhSubscriptionSelected?.id || establishmentEditor.value;
    const options = [...bhSubscriptionData.establishments].sort((a,b) => String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR"));
    establishmentEditor.innerHTML = `<option value="">Selecione um estabelecimento</option>` + options.map(item => {
      const owner = perfis.get(item.owner_id);
      const detail = owner?.nome ? ` — ${owner.nome}` : "";
      return `<option value="${escapeHTML(item.id)}">${escapeHTML(item.nome || "Sem nome")}${escapeHTML(detail)}</option>`;
    }).join("");
    if ([...establishmentEditor.options].some(option => option.value === previous)) establishmentEditor.value = previous;
  }
}

function bhSubscriptionFilteredItems() {
  const { perfis, assinaturas } = bhSubscriptionIndex();
  const term = document.getElementById("buscarAdminAssinaturas")?.value.trim().toLowerCase() || "";
  const plan = document.getElementById("filtroAdminPlano")?.value || "todos";
  const status = document.getElementById("filtroAdminAssinaturaStatus")?.value || "todos";
  return bhSubscriptionData.establishments.filter(item => {
    const profile = perfis.get(item.owner_id) || {};
    const subscription = assinaturas.get(item.id);
    const searchable = [item.nome,item.cidade,item.estado,profile.nome,profile.email].filter(Boolean).join(" ").toLowerCase();
    const slug = subscription?.planos?.slug || "gratuito";
    const currentStatus = bhSubscriptionStatus(subscription);
    return (!term || searchable.includes(term)) && (plan === "todos" || slug === plan) && (status === "todos" || currentStatus === status);
  });
}

function bhSubscriptionStatusClass(status) {
  return ["ativa","teste"].includes(status) ? "concluido" : ["pausada","atrasada"].includes(status) ? "pendente" : "cancelado";
}

function bhSubscriptionMobileCard(item, profile, subscription) {
  const slug = subscription?.planos?.slug || "gratuito";
  const status = bhSubscriptionStatus(subscription);
  const agenda = bhSubscriptionAgendaEffective(item, subscription);
  return `<article class="subscription-account-card">
    <header><div class="admin-entity-avatar"><i class="bi bi-shop"></i></div><div><strong>${escapeHTML(item?.nome || "Estabelecimento")}</strong><span>${escapeHTML([item?.cidade,item?.estado].filter(Boolean).join(" - ") || "Localização não informada")}</span></div></header>
    <dl><div><dt>Proprietário</dt><dd>${escapeHTML(profile?.nome || "Não informado")}</dd></div><div><dt>Plano</dt><dd><span class="subscription-plan-badge plan-${escapeHTML(slug)}">${escapeHTML(bhSubscriptionPlanLabel(subscription))}</span></dd></div><div><dt>Status</dt><dd><span class="status ${bhSubscriptionStatusClass(status)}">${escapeHTML(status)}</span></dd></div><div><dt>Validade</dt><dd>${escapeHTML(bhSubscriptionPeriod(subscription))}</dd></div><div><dt>Agenda</dt><dd>${agenda ? "Ativa" : "Desativada"}</dd></div></dl>
    <button class="btn btn-outline full" data-manage-subscription="${escapeHTML(item.id)}" type="button"><i class="bi bi-sliders"></i> Gerenciar assinatura</button>
  </article>`;
}

function bhRenderSubscriptionTable() {
  const { perfis, assinaturas } = bhSubscriptionIndex();
  const items = bhSubscriptionFilteredItems();
  const tbody = document.getElementById("tbodyAdminAssinaturas");
  const mobile = document.getElementById("adminSubscriptionCards");
  const count = document.getElementById("adminAssinaturasResultado");
  if (count) count.textContent = `${items.length} de ${bhSubscriptionData.establishments.length} estabelecimento${bhSubscriptionData.establishments.length===1?"":"s"}`;
  if (mobile) mobile.innerHTML = items.length ? items.map(item => bhSubscriptionMobileCard(item, perfis.get(item.owner_id) || {}, assinaturas.get(item.id))).join("") : `<div class="empty compact">Nenhuma assinatura encontrada neste filtro.</div>`;
  if (!tbody) return;
  tbody.innerHTML = items.length ? items.map(item => {
    const profile = perfis.get(item.owner_id) || {};
    const subscription = assinaturas.get(item.id);
    const slug = subscription?.planos?.slug || "gratuito";
    const status = bhSubscriptionStatus(subscription);
    const effective = bhSubscriptionEffectivePlan(subscription);
    const agenda = bhSubscriptionAgendaEffective(item, subscription);
    return `<tr>
      <td><div class="admin-entity"><div class="admin-entity-avatar"><i class="bi bi-shop"></i></div><div><strong>${escapeHTML(item?.nome || "Estabelecimento")}</strong><span>${escapeHTML([item?.cidade,item?.estado].filter(Boolean).join(" - "))}</span></div></div></td>
      <td><strong>${escapeHTML(profile?.nome || "Não informado")}</strong><br><small>${escapeHTML(profile?.email || "")}</small></td>
      <td><span class="subscription-plan-badge plan-${escapeHTML(slug)}">${escapeHTML(bhSubscriptionPlanLabel(subscription))}</span>${effective?.slug && effective.slug !== slug ? `<small class="subscription-effective-note">Efetivo: ${escapeHTML(effective.nome)}</small>` : ""}</td>
      <td><span class="status ${bhSubscriptionStatusClass(status)}">${escapeHTML(status)}</span></td>
      <td>${escapeHTML(bhSubscriptionPeriod(subscription))}</td>
      <td><span class="status ${agenda?"aberta":"fechada"}">${agenda?"Ativa":"Desativada"}</span></td>
      <td><button class="btn btn-outline btn-small" data-manage-subscription="${escapeHTML(item.id)}" type="button"><i class="bi bi-sliders"></i> Gerenciar</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="7"><div class="empty compact">Nenhuma assinatura encontrada neste filtro.</div></td></tr>`;
}

function bhSubscriptionUpdateHelp() {
  const status = document.getElementById("assinaturaStatus")?.value || "ativa";
  const help = document.getElementById("assinaturaStatusAjuda");
  const messages = {
    ativa:"Ativa libera os benefícios até a validade informada.",
    teste:"Teste libera temporariamente o plano; sem data, serão usados 90 dias.",
    pausada:"Pausada mantém os dados, mas volta aos benefícios gratuitos.",
    atrasada:"Atrasada preserva os dados e suspende os benefícios pagos.",
    cancelada:"Cancelada preserva o histórico e encerra os benefícios pagos.",
    expirada:"Expirada mantém o histórico e volta ao plano efetivo gratuito."
  };
  if (help) help.textContent = messages[status] || "Revise o status antes de aplicar.";
  const count = document.getElementById("assinaturaObservacoesContador");
  if (count) count.textContent = String(document.getElementById("assinaturaObservacoes")?.value.length || 0);
}

function bhSubscriptionUpdateSummary() {
  const summary = document.getElementById("subscriptionCurrentSummary");
  const save = document.getElementById("salvarAssinaturaAdmin");
  const cancel = document.getElementById("cancelarEdicaoAssinatura");
  if (!bhSubscriptionSelected) {
    if (summary) summary.hidden = true;
    if (save) save.disabled = true;
    if (cancel) cancel.disabled = true;
    return;
  }
  const { assinaturas } = bhSubscriptionIndex();
  const current = assinaturas.get(bhSubscriptionSelected.id);
  const selectedPlan = bhSubscriptionData.plans.find(plan => plan.slug === document.getElementById("assinaturaPlano")?.value);
  const status = document.getElementById("assinaturaStatus")?.value || "ativa";
  const period = document.getElementById("assinaturaPeriodoFim")?.value;
  const currentOrder = Number(current?.planos?.ordenacao || 1);
  const nextOrder = Number(selectedPlan?.ordenacao || 1);
  const direction = !["ativa","teste"].includes(status) ? "Benefícios pagos ficarão suspensos." : nextOrder > currentOrder ? "O plano será ampliado." : nextOrder < currentOrder ? "Os limites serão reduzidos sem apagar o histórico." : "O nível será mantido com o novo status ou validade.";
  if (summary) {
    summary.hidden = false;
    summary.innerHTML = `<div><span>Atual</span><strong>${escapeHTML(bhSubscriptionPlanLabel(current))} · ${escapeHTML(bhSubscriptionStatus(current))}</strong></div><i class="bi bi-arrow-right"></i><div><span>Após salvar</span><strong>${escapeHTML(selectedPlan?.nome || "Plano")} · ${escapeHTML(status)}</strong><small>${period ? `até ${escapeHTML(bhFormatarData(period))}` : "sem prazo definido"}</small></div><p>${escapeHTML(direction)}</p>`;
  }
  if (save) save.disabled = !selectedPlan;
  if (cancel) cancel.disabled = false;
  bhSubscriptionUpdateHelp();
}

function bhSelectSubscription(establishmentId, { scroll = true } = {}) {
  const { perfis, assinaturas } = bhSubscriptionIndex();
  const establishment = bhSubscriptionData.establishments.find(item => item.id === establishmentId);
  if (!establishment) return;
  const profile = perfis.get(establishment.owner_id) || {};
  const subscription = assinaturas.get(establishment.id);
  bhSubscriptionSelected = establishment;
  document.getElementById("assinaturaEstabelecimentoId").value = establishment.id;
  document.getElementById("assinaturaEstabelecimento").value = establishment.id;
  document.getElementById("subscriptionEditorTitle").textContent = establishment.nome || "Estabelecimento";
  document.getElementById("subscriptionEditorSubtitle").textContent = `${profile.nome || "Proprietário não informado"}${profile.email ? ` · ${profile.email}` : ""}`;
  document.getElementById("assinaturaPlano").value = subscription?.planos?.slug || "gratuito";
  document.getElementById("assinaturaStatus").value = subscription?.status || "ativa";
  document.getElementById("assinaturaPeriodoFim").value = String(subscription?.periodo_atual_fim || "").slice(0,10);
  document.getElementById("assinaturaObservacoes").value = subscription?.observacoes || "";
  bhSubscriptionAttempt = { fingerprint:"", key:"" };
  bhSubscriptionUpdateSummary();
  if (scroll) document.getElementById("subscriptionEditor")?.scrollIntoView({ behavior:"smooth", block:"center" });
}

function bhResetSubscriptionEditor() {
  bhSubscriptionSelected = null;
  bhSubscriptionAttempt = { fingerprint:"", key:"" };
  document.getElementById("formAdminAssinatura")?.reset();
  const hidden = document.getElementById("assinaturaEstabelecimentoId");
  if (hidden) hidden.value = "";
  const title = document.getElementById("subscriptionEditorTitle");
  const subtitle = document.getElementById("subscriptionEditorSubtitle");
  if (title) title.textContent = "Selecione um estabelecimento";
  if (subtitle) subtitle.textContent = "Escolha diretamente abaixo ou use Gerenciar na lista.";
  bhSubscriptionUpdateHelp();
  bhSubscriptionUpdateSummary();
}

function bhSubscriptionPayload() {
  return {
    plano_slug:document.getElementById("assinaturaPlano")?.value || "",
    status:document.getElementById("assinaturaStatus")?.value || "ativa",
    periodo_fim:document.getElementById("assinaturaPeriodoFim")?.value || null,
    observacoes:document.getElementById("assinaturaObservacoes")?.value.trim() || null
  };
}

function bhSubscriptionOperationKey(payload) {
  const fingerprint = JSON.stringify(payload);
  if (bhSubscriptionAttempt.fingerprint !== fingerprint) {
    const random = window.crypto?.randomUUID?.() || `admin-sub-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    bhSubscriptionAttempt = { fingerprint, key:random };
  }
  return bhSubscriptionAttempt.key;
}

function bhSubscriptionValidate(payload) {
  if (!bhSubscriptionSelected?.id) return "Selecione um estabelecimento.";
  if (!bhSubscriptionData.plans.some(plan => plan.slug === payload.plano_slug)) return "Selecione um plano ativo.";
  if (payload.periodo_fim && ["ativa","teste"].includes(payload.status)) {
    const today = new Date();
    const localToday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    if (payload.periodo_fim < localToday) return "A validade de uma assinatura ativa ou em teste não pode estar no passado.";
  }
  return null;
}

async function bhReloadSubscriptions({ announce = false } = {}) {
  const button = document.getElementById("recarregarAssinaturasAdmin");
  const selectedId = bhSubscriptionSelected?.id;
  document.querySelector(".subscription-workspace")?.setAttribute("aria-busy", "true");
  bhSetButtonLoading(button, true, "Atualizando...");
  try {
    bhSubscriptionData = bhSubscriptionNormalize(await bhAdminListarAssinaturas());
    bhRenderSubscriptionKpis();
    bhRenderSubscriptionCatalog();
    bhRenderSubscriptionFilters();
    bhRenderSubscriptionTable();
    if (selectedId && bhSubscriptionData.establishments.some(item => item.id === selectedId)) bhSelectSubscription(selectedId, { scroll:false });
    else if (selectedId) bhResetSubscriptionEditor();
    if (announce) mostrarToast("sucesso", "Dados atualizados", "As assinaturas foram recarregadas.");
  } finally {
    document.querySelector(".subscription-workspace")?.removeAttribute("aria-busy");
    bhSetButtonLoading(button, false);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("admin-assinaturas");
  bhSubscriptionAdmin = await bhRequireAuth(["admin"]);
  if (!bhSubscriptionAdmin) return;

  try {
    await bhReloadSubscriptions();
  } catch (error) {
    mostrarToast("erro", "Falha ao carregar assinaturas", bhErroMensagem(error));
    const target = document.getElementById("adminSubscriptionCards");
    if (target) target.innerHTML = `<div class="empty compact"><p>Não foi possível carregar as assinaturas.</p><button class="btn btn-outline btn-small" data-subscription-retry type="button">Tentar novamente</button></div>`;
  }

  ["buscarAdminAssinaturas","filtroAdminPlano","filtroAdminAssinaturaStatus"].forEach(id => {
    const element = document.getElementById(id);
    element?.addEventListener(id.startsWith("buscar") ? "input" : "change", bhRenderSubscriptionTable);
  });

  document.addEventListener("click", event => {
    const manage = event.target.closest("[data-manage-subscription]");
    if (manage) bhSelectSubscription(manage.dataset.manageSubscription);
    if (event.target.closest("[data-subscription-retry]")) bhReloadSubscriptions().catch(error => mostrarToast("erro", "Ainda não foi possível carregar", bhErroMensagem(error)));
  });

  document.getElementById("assinaturaEstabelecimento")?.addEventListener("change", event => {
    if (event.target.value) bhSelectSubscription(event.target.value, { scroll:false });
    else bhResetSubscriptionEditor();
  });

  ["assinaturaPlano","assinaturaStatus","assinaturaPeriodoFim","assinaturaObservacoes"].forEach(id => {
    document.getElementById(id)?.addEventListener(id === "assinaturaObservacoes" ? "input" : "change", bhSubscriptionUpdateSummary);
  });

  document.querySelectorAll("[data-subscription-days]").forEach(button => button.addEventListener("click", () => {
    const input = document.getElementById("assinaturaPeriodoFim");
    if (!input) return;
    if (button.dataset.subscriptionDays === "clear") input.value = "";
    else {
      const date = new Date();
      date.setDate(date.getDate() + Number(button.dataset.subscriptionDays));
      input.value = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    }
    input.dispatchEvent(new Event("change", { bubbles:true }));
  }));

  document.getElementById("cancelarEdicaoAssinatura")?.addEventListener("click", bhResetSubscriptionEditor);
  document.getElementById("recarregarAssinaturasAdmin")?.addEventListener("click", () => bhReloadSubscriptions({ announce:true }).catch(error => mostrarToast("erro", "Falha ao atualizar", bhErroMensagem(error))));

  document.getElementById("formAdminAssinatura")?.addEventListener("submit", async event => {
    event.preventDefault();
    const payload = bhSubscriptionPayload();
    const validation = bhSubscriptionValidate(payload);
    if (validation) {
      mostrarToast("aviso", "Revise a assinatura", validation);
      return;
    }
    payload.chave_idempotencia = bhSubscriptionOperationKey(payload);
    const button = document.getElementById("salvarAssinaturaAdmin");
    const plan = bhSubscriptionData.plans.find(item => item.slug === payload.plano_slug);
    const confirmed = await bhConfirmar({
      titulo:"Aplicar assinatura",
      mensagem:`${bhSubscriptionSelected.nome} passará para ${plan?.nome || payload.plano_slug} (${payload.status})${payload.periodo_fim ? ` até ${bhFormatarData(payload.periodo_fim)}` : " sem prazo definido"}. Os benefícios serão recalculados imediatamente.`,
      confirmarTexto:"Aplicar plano",
      trigger:button
    });
    if (!confirmed) return;
    bhSetButtonLoading(button, true, "Aplicando...");
    const selectedId = bhSubscriptionSelected.id;
    try {
      await bhAdminAtribuirPlano(selectedId, payload);
    } catch (error) {
      mostrarToast("erro", "Não foi possível alterar o plano", bhErroMensagem(error));
      return;
    } finally {
      bhSetButtonLoading(button, false);
    }
    mostrarToast("sucesso", "Assinatura atualizada", `${plan?.nome || "O plano"} foi aplicado com segurança.`);
    bhSubscriptionAttempt = { fingerprint:"", key:"" };
    try {
      await bhReloadSubscriptions();
      bhSelectSubscription(selectedId, { scroll:false });
    } catch (error) {
      mostrarToast("aviso", "Plano aplicado", "A mudança foi salva, mas a lista não atualizou. Use Atualizar para conferir os dados.");
    }
  });
});
