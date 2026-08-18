/** Administração funcional das assinaturas Barber Hub 1.8. */
let bhSubscriptionData = null;
let bhSubscriptionAdmin = null;
let bhSubscriptionSelected = null;

function bhSubscriptionIndex() {
  const perfis = new Map((bhSubscriptionData?.profiles || []).map(item => [item.id, item]));
  const assinaturas = new Map((bhSubscriptionData?.subscriptions || []).map(item => [item.estabelecimento_id, item]));
  return { perfis, assinaturas };
}

function bhSubscriptionPlanLabel(subscription) {
  return subscription?.planos?.nome || "Perfil gratuito";
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
  const fim = new Date(`${subscription.periodo_atual_fim}T23:59:59`);
  return Number.isFinite(fim.getTime()) && fim.getTime() >= Date.now();
}

function bhSubscriptionEffectivePlan(subscription) {
  if (bhSubscriptionIsEffective(subscription)) return subscription?.planos || null;
  return (bhSubscriptionData?.plans || []).find(plan => plan.slug === "gratuito") || null;
}

function bhSubscriptionAgendaEffective(establishment, subscription) {
  const plan = bhSubscriptionEffectivePlan(subscription);
  return Boolean(establishment?.aceita_agendamento && plan?.permite_agenda);
}

function bhRenderSubscriptionKpis() {
  const { assinaturas } = bhSubscriptionIndex();
  const estabelecimentos = bhSubscriptionData.establishments || [];
  const pagos = estabelecimentos.filter(item => Number(bhSubscriptionEffectivePlan(assinaturas.get(item.id))?.ordenacao || 1) > 1).length;
  const testes = estabelecimentos.filter(item => bhSubscriptionStatus(assinaturas.get(item.id)) === "teste" && bhSubscriptionIsEffective(assinaturas.get(item.id))).length;
  const agenda = estabelecimentos.filter(item => bhSubscriptionAgendaEffective(item, assinaturas.get(item.id))).length;
  document.getElementById("subKpiEstabelecimentos").textContent = estabelecimentos.length;
  document.getElementById("subKpiPagos").textContent = pagos;
  document.getElementById("subKpiTeste").textContent = testes;
  document.getElementById("subKpiAgenda").textContent = agenda;
}

function bhRenderSubscriptionCatalog() {
  const alvo = document.getElementById("adminPlanCatalog");
  const plans = bhSubscriptionData?.plans || [];
  alvo.innerHTML = plans.map((plan, index) => {
    const recursos = Array.isArray(plan.recursos) ? plan.recursos : [];
    const inherited = plans.slice(0, index + 1).flatMap(item => Array.isArray(item.recursos) ? item.recursos : []);
    const unique = [...new Set(inherited)];
    return `<article class="subscription-plan-mini ${plan.destaque ? "recommended" : ""}">
      <div><span>${escapeHTML(plan.nome)}</span><strong>${plan.preco_mensal ? bhMoeda(plan.preco_mensal)+"/mês" : "Grátis"}</strong></div>
      <small>${unique.length} benefício${unique.length===1?"":"s"} cumulativo${unique.length===1?"":"s"}</small>
      <div class="subscription-plan-chips">${recursos.slice(0,4).map(item=>`<span>${escapeHTML(item)}</span>`).join("")}</div>
    </article>`;
  }).join("");
}

function bhRenderSubscriptionFilters() {
  const select = document.getElementById("filtroAdminPlano");
  const atual = select.value;
  select.innerHTML = `<option value="todos">Todos os planos</option>` + (bhSubscriptionData?.plans || []).map(plan => `<option value="${escapeHTML(plan.slug)}">${escapeHTML(plan.nome)}</option>`).join("");
  if ([...select.options].some(opt => opt.value === atual)) select.value = atual;
  const planoEditor = document.getElementById("assinaturaPlano");
  planoEditor.innerHTML = (bhSubscriptionData?.plans || []).map(plan => `<option value="${escapeHTML(plan.slug)}">${escapeHTML(plan.nome)}${plan.preco_mensal ? ` · ${bhMoeda(plan.preco_mensal)}/mês` : " · grátis"}</option>`).join("");
}

function bhRenderSubscriptionTable() {
  const { perfis, assinaturas } = bhSubscriptionIndex();
  const termo = document.getElementById("buscarAdminAssinaturas")?.value.trim().toLowerCase() || "";
  const plano = document.getElementById("filtroAdminPlano")?.value || "todos";
  const status = document.getElementById("filtroAdminAssinaturaStatus")?.value || "todos";
  const itens = (bhSubscriptionData?.establishments || []).filter(item => {
    const perfil = perfis.get(item.owner_id) || {};
    const assinatura = assinaturas.get(item.id);
    const texto = [item.nome,item.cidade,item.estado,perfil.nome,perfil.email].join(" ").toLowerCase();
    const slug = assinatura?.planos?.slug || "gratuito";
    const st = bhSubscriptionStatus(assinatura);
    return (!termo || texto.includes(termo)) && (plano === "todos" || slug === plano) && (status === "todos" || st === status);
  });
  const tbody = document.getElementById("tbodyAdminAssinaturas");
  tbody.innerHTML = itens.length ? itens.map(item => {
    const perfil = perfis.get(item.owner_id) || {};
    const assinatura = assinaturas.get(item.id);
    const slug = assinatura?.planos?.slug || "gratuito";
    const st = bhSubscriptionStatus(assinatura);
    const efetivo = bhSubscriptionEffectivePlan(assinatura);
    const agendaEfetiva = bhSubscriptionAgendaEffective(item, assinatura);
    return `<tr>
      <td><div class="admin-entity"><div class="admin-entity-avatar"><i class="bi bi-shop"></i></div><div><strong>${escapeHTML(item.nome)}</strong><span>${escapeHTML([item.cidade,item.estado].filter(Boolean).join(" - "))}</span></div></div></td>
      <td><strong>${escapeHTML(perfil.nome || "Proprietário")}</strong><br><small>${escapeHTML(perfil.email || "")}</small></td>
      <td><span class="subscription-plan-badge plan-${escapeHTML(slug)}">${escapeHTML(bhSubscriptionPlanLabel(assinatura))}</span>${efetivo?.slug && efetivo.slug !== slug ? `<small class="subscription-effective-note">Efetivo: ${escapeHTML(efetivo.nome)}</small>` : ""}</td>
      <td><span class="status ${["ativa","teste"].includes(st)?"concluido":["pausada","atrasada"].includes(st)?"pendente":"cancelado"}">${escapeHTML(st)}</span></td>
      <td>${escapeHTML(bhSubscriptionPeriod(assinatura))}</td>
      <td><span class="status ${agendaEfetiva?"aberta":"fechada"}">${agendaEfetiva?"Ativa":"Desativada"}</span></td>
      <td><button class="btn btn-outline btn-small" data-manage-subscription="${item.id}" type="button"><i class="bi bi-sliders"></i> Gerenciar</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="7"><div class="empty compact">Nenhuma assinatura encontrada neste filtro.</div></td></tr>`;
}

function bhSelectSubscription(establishmentId) {
  const { perfis, assinaturas } = bhSubscriptionIndex();
  const establishment = (bhSubscriptionData?.establishments || []).find(item => item.id === establishmentId);
  if (!establishment) return;
  const perfil = perfis.get(establishment.owner_id) || {};
  const assinatura = assinaturas.get(establishment.id);
  bhSubscriptionSelected = establishment;
  document.getElementById("assinaturaEstabelecimentoId").value = establishment.id;
  document.getElementById("subscriptionEditorTitle").textContent = establishment.nome;
  document.getElementById("subscriptionEditorSubtitle").textContent = `${perfil.nome || "Proprietário"}${perfil.email ? ` · ${perfil.email}` : ""}`;
  document.getElementById("assinaturaPlano").value = assinatura?.planos?.slug || "gratuito";
  document.getElementById("assinaturaStatus").value = assinatura?.status || "ativa";
  document.getElementById("assinaturaPeriodoFim").value = assinatura?.periodo_atual_fim || "";
  document.getElementById("assinaturaObservacoes").value = assinatura?.observacoes || "";
  document.getElementById("salvarAssinaturaAdmin").disabled = false;
  document.getElementById("subscriptionEditor").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function bhReloadSubscriptions() {
  bhSubscriptionData = await bhAdminListarAssinaturas();
  bhRenderSubscriptionKpis();
  bhRenderSubscriptionCatalog();
  bhRenderSubscriptionFilters();
  bhRenderSubscriptionTable();
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("admin-assinaturas");
  bhSubscriptionAdmin = await bhRequireAuth(["admin"]);
  if (!bhSubscriptionAdmin) return;
  try { await bhReloadSubscriptions(); }
  catch (erro) { mostrarToast("erro", "Falha ao carregar assinaturas", bhErroMensagem(erro)); return; }

  ["buscarAdminAssinaturas","filtroAdminPlano","filtroAdminAssinaturaStatus"].forEach(id => document.getElementById(id)?.addEventListener(id.startsWith("buscar")?"input":"change", bhRenderSubscriptionTable));
  document.getElementById("tbodyAdminAssinaturas").addEventListener("click", evento => {
    const botao = evento.target.closest("[data-manage-subscription]");
    if (botao) bhSelectSubscription(botao.dataset.manageSubscription);
  });
  document.getElementById("formAdminAssinatura").addEventListener("submit", async evento => {
    evento.preventDefault();
    const id = document.getElementById("assinaturaEstabelecimentoId").value;
    if (!id) return;
    const botao = document.getElementById("salvarAssinaturaAdmin");
    const plano = document.getElementById("assinaturaPlano").value;
    const status = document.getElementById("assinaturaStatus").value;
    const nomePlano = (bhSubscriptionData.plans || []).find(item => item.slug === plano)?.nome || plano;
    const confirmado = await bhConfirmar({ titulo: "Aplicar assinatura", mensagem: `O estabelecimento ${bhSubscriptionSelected?.nome || "selecionado"} passará para ${nomePlano} (${status}). Os benefícios e limites serão recalculados imediatamente.`, confirmarTexto: "Aplicar plano", trigger: botao });
    if (!confirmado) return;
    bhSetButtonLoading(botao, true, "Aplicando...");
    try {
      await bhAdminAtribuirPlano(id, { plano_slug: plano, status, periodo_fim: document.getElementById("assinaturaPeriodoFim").value || null, observacoes: document.getElementById("assinaturaObservacoes").value.trim() || null });
      mostrarToast("sucesso", "Assinatura atualizada", `${nomePlano} foi aplicado. O painel do estabelecimento recebe os novos benefícios em tempo real.`);
      await bhReloadSubscriptions();
      bhSelectSubscription(id);
    } catch (erro) { mostrarToast("erro", "Não foi possível alterar o plano", bhErroMensagem(erro)); }
    finally { bhSetButtonLoading(botao, false); }
  });
});
