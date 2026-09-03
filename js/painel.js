/**
 * painel.js
 * Painel profissional: agenda, serviços, equipe, página, status e relatórios.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

let bhPainelPerfil = null;
let bhPainelEstabelecimento = null;
let bhPainelAgendamentos = [];
let bhPainelPortfolio = [];
let bhPainelAvaliacoes = [];
let bhPainelPlanoResumo = null;
let bhPainelPermissoes = null;
let bhPortfolioFiltro = "todas";
let bhPortfolioArquivos = [];
let bhPortfolioSubmitStatus = "rascunho";


function bhSincronizarControlesPainel() {
  if (!bhPainelEstabelecimento) return;
  const modo = document.getElementById("configStatus")?.value || bhPainelEstabelecimento.statusManual || "automatico";
  const agenda = document.getElementById("configAgenda")?.value || (bhPainelEstabelecimento.aceitaAgendamento ? "sim" : "nao");
  document.querySelectorAll("[data-status-mode],[data-status-quick]").forEach(botao => botao.classList.toggle("ativo", (botao.dataset.statusMode || botao.dataset.statusQuick) === modo));
  document.querySelectorAll("[data-agenda-mode]").forEach(botao => botao.classList.toggle("ativo", botao.dataset.agendaMode === agenda));
  const status = bhCalcularStatus(bhPainelEstabelecimento);
  const texto = document.getElementById("quickStatusTexto");
  const detalhe = document.getElementById("quickStatusDetalhe");
  const lateral = document.getElementById("sidebarStatusTexto");
  if (texto) texto.textContent = status.texto;
  if (detalhe) detalhe.textContent = status.detalhe;
  if (lateral) lateral.textContent = status.texto;
}

function bhMotivoStatusRapido(modo) {
  if (modo === "automatico") return null;
  const automatico = bhCalcularStatus({ ...bhPainelEstabelecimento, statusManual: "automatico", motivoStatus: null });
  if (modo === "aberto") return automatico.aberta ? "Aberto manualmente pelo estabelecimento." : "Aberto antecipadamente pelo estabelecimento.";
  return automatico.aberta ? "Fechado mais cedo pelo estabelecimento." : "Fechado temporariamente pelo estabelecimento.";
}

async function bhAplicarStatusRapido(modo, botao) {
  if (!bhPainelEstabelecimento || !["automatico", "aberto", "fechado"].includes(modo)) return;
  document.querySelectorAll("[data-status-quick]").forEach(item => item.disabled = true);
  bhSetButtonLoading(botao, true, "Atualizando...");
  try {
    await bhAtualizarEstabelecimento(bhPainelEstabelecimento.id, { status_manual: modo, motivo_status: bhMotivoStatusRapido(modo) });
    mostrarToast("sucesso", "Status atualizado", modo === "automatico" ? "O catálogo voltou a seguir os horários cadastrados." : modo === "aberto" ? "O estabelecimento aparece como aberto antecipadamente." : "O estabelecimento aparece como fechado mais cedo.");
    await bhRecarregarPainel();
  } catch (erro) {
    mostrarToast("erro", "Não foi possível alterar o status", bhErroMensagem(erro));
  } finally {
    bhSetButtonLoading(botao, false);
    document.querySelectorAll("[data-status-quick]").forEach(item => item.disabled = false);
  }
}

function bhPlanoPermite(chave) {
  if (!chave) return true;
  return Boolean(bhPainelPlanoResumo?.entitlements?.[chave]);
}

function bhNomeBeneficioPlano(chave) {
  return ({
    permite_agenda: "Agenda online",
    permite_clientes: "Carteira de clientes",
    permite_promocoes: "Promoções",
    permite_relatorios: "Relatórios",
    permite_relatorios_avancados: "Relatórios avançados",
    permite_exportacao: "Exportação CSV",
    permite_agenda_avancada: "Agenda profissional 2.0",
    permite_crm: "CRM 2.0",
    permite_financeiro: "Financeiro operacional",
    permite_comissoes: "Comissões automáticas",
    permite_equipe_acesso: "Acesso individual da equipe",
    permite_lista_espera: "Lista de espera",
    permite_recorrencia: "Agendamentos recorrentes",
    permite_fidelidade: "Programa de fidelidade",
    permite_cupons: "Cupons",
    permite_campanhas: "Campanhas segmentadas",
    permite_lembretes: "Lembretes automáticos",
    permite_oportunidades: "Central de Oportunidades",
    permite_insights: "Insights operacionais",
    permite_metas: "Metas",
    permite_permissoes_granulares: "Permissões granulares"
  })[chave] || "Este recurso";
}

function bhAtivarSecaoPainel(id) {
  const secaoAlvo = document.getElementById(id);
  const permissionMap = {
    secAgenda:["agenda"], secClientes:["crm"], secFinanceiro:["financeiro"],
    secRelacionamento:["retencao","campanhas"], secCrescimento:["crescimento","metas"],
    secBarbeiros:["equipe"], secFerramentas:["configuracoes", "financeiro"], secConfig:["configuracoes"]
  };
  const requiredPermissions = permissionMap[id];
  if (bhPainelPermissoes && requiredPermissions && !requiredPermissions.some(key => bhPainelPermissoes[key])) {
    mostrarToast("aviso", "Acesso restrito", "O proprietário desativou este recurso para sua função.");
    return false;
  }
  const recurso = secaoAlvo?.dataset.planSection;
  if (recurso && !bhPlanoPermite(recurso)) {
    mostrarToast("aviso", `${bhNomeBeneficioPlano(recurso)} não está no plano atual`, "Abra Planos para conhecer o próximo nível e os benefícios herdados.");
    return false;
  }
  document.querySelectorAll(".panel-section").forEach(secao => secao.classList.toggle("ativo", secao.id === id));
  document.querySelectorAll("[data-panel]").forEach(botao => {
    botao.classList.toggle("btn-primary", botao.dataset.panel === id);
    botao.classList.toggle("btn-dark", botao.dataset.panel !== id);
  });
  history.replaceState(null, "", `#${id.replace("sec", "").toLowerCase()}`);
  document.dispatchEvent(new CustomEvent("bh:painel-section-change", { detail: { id } }));
  return true;
}

function bhAplicarEntitlementsPainel() {
  const ent = bhPainelPlanoResumo?.entitlements || {};
  document.querySelectorAll("[data-plan-feature]").forEach(botao => {
    const liberado = Boolean(ent[botao.dataset.planFeature]);
    botao.classList.toggle("plan-locked", !liberado);
    botao.setAttribute("aria-disabled", String(!liberado));
    if (!liberado) botao.title = `${bhNomeBeneficioPlano(botao.dataset.planFeature)} — faça upgrade para liberar`;
    else botao.removeAttribute("title");
    let cadeado = botao.querySelector(".plan-lock-icon");
    if (!liberado && !cadeado) {
      cadeado = document.createElement("i");
      cadeado.className = "bi bi-lock-fill plan-lock-icon";
      cadeado.setAttribute("aria-hidden", "true");
      botao.appendChild(cadeado);
    } else if (liberado && cadeado) cadeado.remove();
  });

  const agendaLiberada = Boolean(ent.permite_agenda);
  document.querySelectorAll("[data-agenda-mode]").forEach(botao => {
    botao.disabled = !agendaLiberada;
    if (!agendaLiberada) botao.title = "Agenda online disponível a partir do Essencial";
  });
  const agendaSelect = document.getElementById("configAgenda");
  if (agendaSelect && !agendaLiberada) agendaSelect.value = "nao";

  const ativos = (bhPainelEstabelecimento?.barbeiros || []).filter(item => item.ativo).length;
  const limiteProfissionais = Number(ent.limite_profissionais || 1);
  const submitEquipe = document.querySelector("#formBarbeiro button[type='submit']");
  if (submitEquipe) {
    const atingiu = ativos >= limiteProfissionais;
    submitEquipe.disabled = atingiu;
    submitEquipe.innerHTML = atingiu
      ? `<i class="bi bi-lock-fill"></i> Limite do plano (${ativos}/${limiteProfissionais})`
      : `<i class="bi bi-person-plus"></i> Adicionar profissional`;
  }

  const limiteTexto = document.getElementById("portfolioLimiteTexto");
  if (limiteTexto) limiteTexto.textContent = `/ ${Number(ent.limite_publicacoes || 10)} publicações`;
  const advanced = document.getElementById("relatoriosAvancados");
  if (advanced) advanced.hidden = !Boolean(ent.permite_relatorios_avancados);
  const exportar = document.getElementById("exportarRelatorioCsv");
  if (exportar) exportar.hidden = !Boolean(ent.permite_exportacao);
  const nivel = document.getElementById("relatorioNivelPlano");
  if (nivel) nivel.textContent = ent.permite_relatorios_avancados ? "Relatórios avançados ativos" : "Relatórios essenciais";
  bhAplicarPermissoesEquipePainel();
}

function bhAplicarPermissoesEquipePainel() {
  if (!bhPainelPermissoes) return;
  const capabilityBySection = {
    secAgenda: ["agenda"],
    secClientes: ["crm"],
    secFinanceiro: ["financeiro"],
    secRelacionamento: ["retencao", "campanhas"],
    secCrescimento: ["crescimento", "metas"],
    secBarbeiros: ["equipe"],
    secFerramentas: ["configuracoes", "financeiro"],
    secConfig: ["configuracoes"]
  };
  document.querySelectorAll("[data-panel]").forEach(button => {
    const capabilities = capabilityBySection[button.dataset.panel];
    if (!capabilities) return;
    const allowed = capabilities.some(capability => Boolean(bhPainelPermissoes[capability]));
    button.hidden = !allowed;
    button.setAttribute("aria-hidden", String(!allowed));
  });
  const active = document.querySelector(".panel-section.ativo");
  const activeCapabilities = capabilityBySection[active?.id];
  if (activeCapabilities && !activeCapabilities.some(capability => Boolean(bhPainelPermissoes[capability]))) bhAtivarSecaoPainel("secDashboard");
  document.querySelectorAll('[data-retention-action="campanha"]').forEach(button => { button.hidden = !bhPainelPermissoes.campanhas; });
  document.querySelectorAll('[data-growth-action="meta"]').forEach(button => { button.hidden = !bhPainelPermissoes.metas; });
}

function bhRenderPlanoPainel() {
  const resumo = bhPainelPlanoResumo;
  if (!resumo) return;
  const ent = resumo.entitlements || {};
  const nome = document.getElementById("painelPlanoNome");
  const descricao = document.getElementById("painelPlanoDescricao");
  const recursos = document.getElementById("painelPlanoRecursos");
  if (nome) nome.textContent = ent.plano_nome || "Perfil gratuito";
  if (descricao) {
    const status = ent.assinatura_status || resumo.assinatura?.status || "ativa";
    descricao.textContent = status === "teste"
      ? "Período de teste ativo. Os benefícios abaixo já estão liberados para o estabelecimento."
      : `Assinatura ${status}. Benefícios cumulativos liberados automaticamente pelo plano.`;
  }
  if (recursos) recursos.innerHTML = (ent.recursos || []).slice(0, 8).map(recurso => `<span><i class="bi bi-check2-circle"></i>${escapeHTML(recurso)}</span>`).join("");
  const equipe = document.getElementById("painelPlanoEquipe");
  const portfolio = document.getElementById("painelPlanoPortfolio");
  const agenda = document.getElementById("painelPlanoAgenda");
  if (equipe) equipe.textContent = `${resumo.uso.profissionais}/${ent.limite_profissionais || 1}`;
  if (portfolio) portfolio.textContent = `${resumo.uso.publicacoes}/${ent.limite_publicacoes || 10}`;
  if (agenda) agenda.textContent = ent.permite_agenda ? (resumo.uso.aceitaAgendamento ? "Ativa" : "Disponível") : "Bloqueada";
  bhAplicarEntitlementsPainel();
}


function bhRenderKpisPainel() {
  const hoje = new Date();
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - hoje.getDay());
  inicioSemana.setHours(0, 0, 0, 0);
  const semana = bhPainelAgendamentos.filter(item => new Date(`${item.data}T00:00:00`) >= inicioSemana && !["cancelado", "recusado"].includes(item.status));
  const faturamento = semana.filter(item => item.status === "concluido").reduce((soma, item) => soma + Number(item.valor || 0), 0);
  const status = bhCalcularStatus(bhPainelEstabelecimento);
  document.getElementById("kpiSemana").textContent = semana.length;
  document.getElementById("kpiFaturamento").textContent = bhMoeda(faturamento);
  document.getElementById("kpiServicos").textContent = bhPainelEstabelecimento.servicos.filter(item => item.ativo).length;
  document.getElementById("kpiStatus").textContent = status.texto;
  const hojeIso = bhHojeISO();
  const agendaHoje = bhPainelAgendamentos.filter(item => item.data === hojeIso && !["cancelado", "recusado"].includes(item.status));
  const pendentes = bhPainelAgendamentos.filter(item => item.status === "pendente");
  const equipeAtiva = bhPainelEstabelecimento.barbeiros.filter(item => item.ativo).length;
  const avaliacoesPublicadas = bhPainelAvaliacoes.filter(item => item.status === "publicada");
  const notaMedia = avaliacoesPublicadas.length ? avaliacoesPublicadas.reduce((soma,item) => soma + Number(item.nota || 0), 0) / avaliacoesPublicadas.length : null;
  if (document.getElementById("painelHoje")) document.getElementById("painelHoje").textContent = agendaHoje.length;
  if (document.getElementById("painelPendentes")) document.getElementById("painelPendentes").textContent = pendentes.length;
  if (document.getElementById("painelEquipeAtiva")) document.getElementById("painelEquipeAtiva").textContent = equipeAtiva;
  if (document.getElementById("painelNotaMedia")) document.getElementById("painelNotaMedia").textContent = notaMedia === null ? "—" : notaMedia.toFixed(1).replace(".", ",");
  const agora = new Date();
  const proximo = bhPainelAgendamentos
    .filter(item => ["pendente","confirmado"].includes(item.status) && new Date(`${item.data}T${bhHoraCurta(item.hora_inicio)}`) >= agora)
    .sort((a,b) => new Date(`${a.data}T${bhHoraCurta(a.hora_inicio)}`) - new Date(`${b.data}T${bhHoraCurta(b.hora_inicio)}`))[0];
  const tituloProximo = document.getElementById("painelProximoTitulo");
  const detalheProximo = document.getElementById("painelProximoDetalhe");
  if (tituloProximo && detalheProximo) {
    tituloProximo.textContent = proximo ? `Próximo: ${proximo.cliente_nome} às ${bhHoraCurta(proximo.hora_inicio)}` : "Agenda livre no momento";
    detalheProximo.textContent = proximo ? `${bhFormatarData(proximo.data)} · ${bhAgendamentoServicosTexto(proximo)} · ${proximo.profissionais?.nome || "Profissional"}` : "Use os atalhos para ajustar serviços, equipe ou publicar um trabalho.";
  }
  const recomendacao = bhRecomendacaoPainel(bhPainelAgendamentos, bhPainelEstabelecimento.servicos);
  document.getElementById("iaPainel").innerHTML = `<h3><i class="bi bi-stars"></i> ${escapeHTML(recomendacao.titulo)}</h3><p>${escapeHTML(recomendacao.texto)}</p>`;
}

function bhRenderAgendaPainel() {
  const tbody = document.getElementById("tbodyAgendamentos");
  if (!bhPainelAgendamentos.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty compact">Nenhum agendamento recebido.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = bhPainelAgendamentos.map(item => `
    <tr>
      <td><strong>${escapeHTML(item.cliente_nome)}</strong><br><small>${escapeHTML(item.cliente_telefone || item.cliente_email)}</small></td>
      <td>${bhFormatarData(item.data)}</td>
      <td>${bhHoraCurta(item.hora_inicio)}</td>
      <td>${escapeHTML(bhAgendamentoServicosTexto(item))}</td>
      <td>${escapeHTML(item.profissionais?.nome || "Profissional")}</td>
      <td><span class="status ${item.status}">${escapeHTML(item.status)}</span></td>
      <td><div class="table-actions">
        ${item.status === "pendente" ? `<button class="icon-btn success" data-agenda-status="confirmado" data-id="${item.id}" title="Confirmar"><i class="bi bi-check-lg"></i></button><button class="icon-btn danger" data-agenda-status="recusado" data-id="${item.id}" title="Recusar"><i class="bi bi-x-lg"></i></button>` : ""}
        ${item.status === "confirmado" ? `<button class="icon-btn success" data-agenda-status="concluido" data-id="${item.id}" title="Concluir"><i class="bi bi-check2-all"></i></button><button class="icon-btn danger" data-agenda-status="cancelado" data-id="${item.id}" title="Cancelar"><i class="bi bi-calendar-x"></i></button>` : ""}
      </div></td>
    </tr>`).join("");
}

function bhRenderServicosPainel() {
  const lista = document.getElementById("listaServicosPainel");
  const itens = bhPainelEstabelecimento.servicos.filter(item => item.ativo || item.publico);
  lista.innerHTML = itens.length ? itens.map(item => `
    <div class="simple-item">
      <div><strong>${escapeHTML(item.nome)}</strong><span>${bhMoeda(item.preco)} • ${item.duracao_min} min • ${item.ativo ? "Ativo" : "Inativo"}</span></div>
      <div class="item-actions">
        <button class="icon-btn" data-servico-toggle="${item.id}" data-ativo="${item.ativo}" title="Ativar/inativar"><i class="bi ${item.ativo ? "bi-toggle-on" : "bi-toggle-off"}"></i></button>
        <button class="icon-btn danger" data-servico-delete="${item.id}" title="Excluir"><i class="bi bi-trash"></i></button>
      </div>
    </div>`).join("") : `<div class="empty compact">Cadastre seu primeiro serviço.</div>`;
}

function bhRenderProfissionaisPainel() {
  const lista = document.getElementById("listaBarbeirosPainel");
  const itens = bhPainelEstabelecimento.barbeiros.filter(item => item.ativo || item.aceita_agendamento);
  lista.innerHTML = itens.length ? itens.map(item => `
    <div class="simple-item">
      <div style="display:flex;align-items:center;gap:12px">${item.avatar_url ? `<img class="avatar-image" src="${escapeHTML(item.avatar_url)}" alt="Foto de ${escapeHTML(item.nome)}">` : `<div class="avatar">${escapeHTML(item.avatar)}</div>`}<div><strong>${escapeHTML(item.nome)}</strong><span>${escapeHTML(item.especialidade || "Profissional")} • ${item.ativo ? "Ativo" : "Inativo"}</span></div></div>
      <div class="item-actions">
        <button class="icon-btn" data-profissional-toggle="${item.id}" data-ativo="${item.ativo}" title="Ativar/inativar"><i class="bi ${item.ativo ? "bi-toggle-on" : "bi-toggle-off"}"></i></button>
        ${item.user_id ? "" : `<button class="icon-btn danger" data-profissional-delete="${item.id}" title="Excluir"><i class="bi bi-trash"></i></button>`}
      </div>
    </div>`).join("") : `<div class="empty compact">Nenhum profissional cadastrado.</div>`;
}

function bhClientesDerivados() {
  const mapa = new Map();
  const validos = bhPainelAgendamentos.filter(item => !["cancelado","recusado"].includes(item.status));
  validos.forEach(item => {
    const chave = item.cliente_id || item.cliente_email || item.cliente_nome;
    if (!chave) return;
    const atual = mapa.get(chave) || {
      id: chave, nome: item.cliente_nome || "Cliente", email: item.cliente_email || "", telefone: item.cliente_telefone || "",
      visitas: 0, concluidas: 0, valor: 0, ultima: null, proxima: null
    };
    atual.visitas += 1;
    if (item.status === "concluido") {
      atual.concluidas += 1;
      atual.valor += Number(item.valor || 0);
    }
    const data = `${item.data}T${bhHoraCurta(item.hora_inicio || "00:00")}`;
    if (!atual.ultima || data > atual.ultima) atual.ultima = data;
    if (["pendente","confirmado"].includes(item.status) && data >= new Date().toISOString().slice(0,16) && (!atual.proxima || data < atual.proxima)) atual.proxima = data;
    mapa.set(chave, atual);
  });
  return [...mapa.values()].sort((a,b) => b.concluidas - a.concluidas || b.valor - a.valor || String(b.ultima).localeCompare(String(a.ultima)));
}

function bhRenderClientesPainel() {
  const lista = document.getElementById("listaClientesPainel");
  if (!lista) return;
  const clientes = bhClientesDerivados();
  const termo = document.getElementById("buscarClientePainel")?.value.trim().toLowerCase() || "";
  const filtrados = clientes.filter(item => !termo || [item.nome,item.email,item.telefone].join(" ").toLowerCase().includes(termo));
  const concluidos = bhPainelAgendamentos.filter(item => item.status === "concluido");
  const recorrentes = clientes.filter(item => item.concluidas >= 2).length;
  const receita = concluidos.reduce((soma,item)=>soma+Number(item.valor||0),0);
  const ticket = concluidos.length ? receita / concluidos.length : 0;
  const kpis = document.getElementById("clientesKpisPainel");
  if (kpis) kpis.innerHTML = `
    <article class="dashboard-detail-card"><span><i class="bi bi-people"></i> Clientes</span><strong>${clientes.length}</strong><small>perfis atendidos na agenda</small></article>
    <article class="dashboard-detail-card"><span><i class="bi bi-arrow-repeat"></i> Recorrentes</span><strong>${recorrentes}</strong><small>com 2+ atendimentos concluídos</small></article>
    <article class="dashboard-detail-card"><span><i class="bi bi-receipt"></i> Ticket médio</span><strong>${bhMoeda(ticket)}</strong><small>sobre atendimentos concluídos</small></article>`;
  const resumo = document.getElementById("clientesResumoPainel");
  if (resumo) resumo.textContent = clientes.length ? `${recorrentes} recorrente${recorrentes===1?"":"s"} · ${concluidos.length} atendimento${concluidos.length===1?"":"s"} concluído${concluidos.length===1?"":"s"}` : "Sem histórico ainda";
  lista.innerHTML = filtrados.length ? filtrados.map(item => `
    <article class="client-row-card">
      <div class="client-row-main"><div class="avatar">${escapeHTML(item.nome.slice(0,2).toUpperCase())}</div><div><strong>${escapeHTML(item.nome)}</strong><span>${escapeHTML(item.email || item.telefone || "Contato não informado")}</span></div></div>
      <div class="client-row-metrics"><span><b>${item.concluidas}</b> concluídos</span><span><b>${bhMoeda(item.valor)}</b> movimentado</span><span><b>${item.ultima ? new Date(item.ultima).toLocaleDateString("pt-BR") : "—"}</b> última atividade</span></div>
    </article>`).join("") : `<div class="empty compact">Nenhum cliente encontrado.</div>`;
}

function bhLimparFormPromocao() {
  const form = document.getElementById("formPromocao");
  if (!form) return;
  form.reset();
  document.getElementById("promocaoId").value = "";
  document.getElementById("promocaoAtiva").checked = true;
  document.getElementById("cancelarEdicaoPromocao").hidden = true;
}

function bhRenderPromocoesPainel() {
  const lista = document.getElementById("listaPromocoesPainel");
  if (!lista) return;
  const itens = [...(bhPainelEstabelecimento?.promocoes || [])].sort((a,b) => Number(b.ativo)-Number(a.ativo) || String(b.created_at).localeCompare(String(a.created_at)));
  lista.innerHTML = itens.length ? itens.map(item => `
    <article class="promotion-manage-card ${item.ativo ? "active" : "inactive"}">
      <div><div class="card-meta"><span class="status ${item.ativo ? "concluido" : "cancelado"}">${item.ativo ? "Ativa" : "Inativa"}</span>${item.desconto_percentual != null ? `<span class="badge">${Number(item.desconto_percentual).toLocaleString("pt-BR")}% OFF</span>` : ""}</div><strong>${escapeHTML(item.titulo)}</strong><p>${escapeHTML(item.descricao)}</p><small>${item.codigo ? `Código: ${escapeHTML(item.codigo)} · ` : ""}${item.termina_em ? `até ${bhFormatarData(item.termina_em)}` : "sem data final"}</small></div>
      <div class="item-actions"><button class="icon-btn" data-promocao-editar="${item.id}" title="Editar"><i class="bi bi-pencil"></i></button><button class="icon-btn ${item.ativo ? "danger" : "success"}" data-promocao-toggle="${item.id}" data-ativo="${item.ativo}" title="${item.ativo ? "Desativar" : "Ativar"}"><i class="bi ${item.ativo ? "bi-pause-circle" : "bi-play-circle"}"></i></button></div>
    </article>`).join("") : `<div class="empty compact"><i class="bi bi-megaphone big"></i><p>Nenhuma promoção cadastrada.</p></div>`;
}

function bhEditarPromocao(id) {
  const item = (bhPainelEstabelecimento?.promocoes || []).find(p => p.id === id);
  if (!item) return;
  document.getElementById("promocaoId").value = item.id;
  document.getElementById("promocaoTitulo").value = item.titulo || "";
  document.getElementById("promocaoDescricao").value = item.descricao || "";
  document.getElementById("promocaoCodigo").value = item.codigo || "";
  document.getElementById("promocaoDesconto").value = item.desconto_percentual ?? "";
  document.getElementById("promocaoInicio").value = item.inicia_em || "";
  document.getElementById("promocaoFim").value = item.termina_em || "";
  document.getElementById("promocaoAtiva").checked = Boolean(item.ativo);
  document.getElementById("cancelarEdicaoPromocao").hidden = false;
  document.getElementById("formPromocao").scrollIntoView({ behavior: "smooth", block: "start" });
}

function bhExportarRelatorioCsv() {
  if (!bhPlanoPermite("permite_exportacao")) {
    mostrarToast("aviso", "Exportação não liberada", "A exportação CSV está disponível a partir do plano Profissional.");
    return;
  }
  const linhas = [["Data","Hora","Cliente","Serviços","Profissional","Status","Valor"]];
  bhPainelAgendamentos.forEach(item => linhas.push([item.data,bhHoraCurta(item.hora_inicio),item.cliente_nome||"",bhAgendamentoServicosTexto(item),item.profissionais?.nome||"",item.status||"",Number(item.valor||0).toFixed(2)]));
  const csv = "\ufeff" + linhas.map(linha => linha.map(valor => `"${String(valor).replaceAll('"','""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = `barber-hub-relatorio-${bhHojeISO()}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

function bhRenderRelatoriosPainel() {
  const analise = bhAnalisarAgendamentos(bhPainelAgendamentos);
  const renderBarras = (objeto, alvo, formatador = valor => String(valor)) => {
    const elemento = document.getElementById(alvo);
    if (!elemento) return;
    const entradas = Object.entries(objeto).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = Math.max(...entradas.map(item => item[1]), 1);
    elemento.innerHTML = entradas.length ? entradas.map(([nome, valor]) => `
      <div class="bar-row"><span>${escapeHTML(nome)}</span><div class="bar-bg"><div class="bar-fill" style="width:${(valor / max) * 100}%"></div></div><strong>${escapeHTML(formatador(valor))}</strong></div>
    `).join("") : `<div class="empty compact">Ainda não há dados suficientes.</div>`;
  };
  renderBarras(analise.contagemServicos, "chartServicos");
  renderBarras(analise.contagemHoras, "chartHorarios");

  if (bhPlanoPermite("permite_relatorios_avancados")) {
    const profissionais = {};
    const receitaServicos = {};
    bhPainelAgendamentos.filter(item => item.status === "concluido").forEach(item => {
      const pro = item.profissionais?.nome || "Profissional";
      profissionais[pro] = (profissionais[pro] || 0) + 1;
      bhAgendamentoServicos(item).forEach(servico => { receitaServicos[servico.nome] = (receitaServicos[servico.nome] || 0) + Number(servico.preco || 0); });
    });
    renderBarras(profissionais, "chartProfissionais");
    renderBarras(receitaServicos, "chartReceitaServicos", valor => bhMoeda(valor));
  }
}


function bhRenderConfiguracoesPainel() {
  const b = bhPainelEstabelecimento;
  document.getElementById("configNome").value = b.nome || "";
  document.getElementById("configTelefone").value = b.telefone || "";
  document.getElementById("configWhatsapp").value = b.whatsapp || "";
  document.getElementById("configInstagram").value = b.instagram || "";
  document.getElementById("configTiktok").value = b.tiktok || "";
  document.getElementById("configEndereco").value = b.endereco || "";
  document.getElementById("configDescricao").value = b.descricao || "";
  document.getElementById("configStatus").value = b.statusManual || "automatico";
  document.getElementById("configMotivoStatus").value = b.motivoStatus || "";
  document.getElementById("configAgenda").value = b.aceitaAgendamento ? "sim" : "nao";
  bhSincronizarControlesPainel();
  document.getElementById("configFotoPreview").src = b.fotoUrl || "../img/logomarcaTRANSPARENTE.png";
  document.getElementById("configCapaPreview").src = b.capaUrl || "../img/backgrounds/barbearia-hero-default.webp";

  document.querySelectorAll(".horario-config-painel").forEach(row => {
    const dia = Number(row.dataset.dia);
    const chave = BH_DIAS[dia];
    const horario = b.horarios[chave];
    const check = row.querySelector("[data-horario-aberto]");
    const abre = row.querySelector("[data-horario-abre]");
    const fecha = row.querySelector("[data-horario-fecha]");
    check.checked = Boolean(horario);
    abre.value = horario?.abre || "08:00";
    fecha.value = horario?.fecha || "18:00";
    abre.disabled = !horario;
    fecha.disabled = !horario;
    row.classList.toggle("fechado", !horario);
  });

  const dias = document.getElementById("diasFechadosPainel");
  dias.innerHTML = b.diasFechados.length ? b.diasFechados.map(item => `
    <div class="simple-item"><div><strong>${bhFormatarData(item.data)}</strong><span>${escapeHTML(item.motivo || "Data bloqueada")}</span></div><button class="icon-btn danger" data-bloqueio-delete="${item.id}"><i class="bi bi-trash"></i></button></div>
  `).join("") : `<div class="empty compact">Nenhuma data bloqueada.</div>`;
}

function bhRenderAvaliacoesPainel() {
  const lista = document.getElementById("listaAvaliacoesPainel");
  const resumo = document.getElementById("painelRatingResumo");
  if (!lista || !resumo) return;
  const publicadas = bhPainelAvaliacoes.filter(item => item.status === "publicada");
  const verificadas = publicadas.filter(item => item.verificada || item.origem === "agendamento");
  const comunidade = publicadas.filter(item => !(item.verificada || item.origem === "agendamento"));
  const media = publicadas.length ? publicadas.reduce((total, item) => total + Number(item.nota || 0), 0) / publicadas.length : 0;
  resumo.innerHTML = `<strong>${media.toFixed(1).replace(".", ",")}</strong><span>${publicadas.length} avaliação${publicadas.length === 1 ? "" : "ões"} · ${verificadas.length} verificadas · ${comunidade.length} comunidade</span>`;
  if (!bhPainelAvaliacoes.length) {
    lista.innerHTML = `<div class="empty compact"><i class="bi bi-star big"></i><p>Ainda não há avaliações publicadas.</p></div>`;
    return;
  }
  lista.innerHTML = bhPainelAvaliacoes.map(item => {
    const verificada = Boolean(item.verificada || item.origem === "agendamento");
    const contexto = item.portfolio_publicacoes?.titulo
      ? `<span class="review-context"><i class="bi bi-images"></i> Sobre a publicação: ${escapeHTML(item.portfolio_publicacoes.titulo)}</span>`
      : (item.agendamentos?.agendamento_servicos?.length || item.agendamentos?.servicos?.nome)
        ? `<span class="review-context"><i class="bi bi-scissors"></i> Atendimento: ${escapeHTML(bhAgendamentoServicosTexto(item.agendamentos))}</span>`
        : "";
    return `
    <article class="review-manage-card" data-avaliacao-id="${item.id}">
      <div class="review-manage-head">
        <div><strong>${escapeHTML(item.perfis?.nome || "Cliente")}</strong><span>${"★".repeat(Number(item.nota || 0))}${"☆".repeat(5 - Number(item.nota || 0))}</span></div>
        <div class="review-meta-stack"><span class="review-source-badge ${verificada ? "verified" : "community"}"><i class="bi ${verificada ? "bi-patch-check-fill" : "bi-people-fill"}"></i> ${verificada ? "Verificada" : "Comunidade"}</span><small>${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(item.created_at))}</small></div>
      </div>
      ${contexto}
      <p>${escapeHTML(item.comentario || "Cliente avaliou sem comentário.")}</p>
      <form class="review-reply-form" data-responder-avaliacao="${item.id}">
        <label for="resposta-${item.id}">Resposta pública</label>
        <textarea id="resposta-${item.id}" maxlength="1200" placeholder="Agradeça ou esclareça com respeito.">${escapeHTML(item.resposta_estabelecimento || "")}</textarea>
        <button class="btn btn-outline btn-small" type="submit"><i class="bi bi-reply"></i> Salvar resposta</button>
      </form>
    </article>`;
  }).join("");
}

function bhRenderPaginaPublicaPreview() {
  const link = document.getElementById("linkPaginaPublica");
  const nome = document.getElementById("previewBusinessName");
  if (link) link.href = `${bhUrl("html/barbearia.html")}?id=${bhPainelEstabelecimento.id}`;
  if (nome) nome.textContent = bhPainelEstabelecimento.nome || "Seu estabelecimento";
}


function bhPortfolioItemPorId(id) {
  return bhPainelPortfolio.find(item => item.id === id) || null;
}

function bhPopularCamposPortfolio() {
  const categoria = document.getElementById("portfolioCategoria");
  if (categoria && !categoria.options.length) {
    categoria.innerHTML = `<option value="">Selecione</option>${BH_PORTFOLIO_CATEGORIAS.map(item => `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`).join("")}`;
  }
  const profissional = document.getElementById("portfolioProfissional");
  if (profissional) {
    const atual = profissional.value;
    profissional.innerHTML = `<option value="">Selecione</option>${bhPainelEstabelecimento.barbeiros.filter(item => item.ativo).map(item => `<option value="${item.id}">${escapeHTML(item.nome)}</option>`).join("")}`;
    if ([...profissional.options].some(opt => opt.value === atual)) profissional.value = atual;
  }
  const servico = document.getElementById("portfolioServico");
  if (servico) {
    const atual = servico.value;
    servico.innerHTML = `<option value="">Opcional</option>${bhPainelEstabelecimento.servicos.filter(item => item.ativo).map(item => `<option value="${item.id}">${escapeHTML(item.nome)}</option>`).join("")}`;
    if ([...servico.options].some(opt => opt.value === atual)) servico.value = atual;
  }
}

function bhRenderPreviewPortfolio() {
  const alvo = document.getElementById("portfolioNovasFotos");
  if (!alvo) return;
  alvo.innerHTML = bhPortfolioArquivos.map((file, indice) => `
    <div class="portfolio-preview-item">
      <img src="${URL.createObjectURL(file)}" alt="Prévia ${indice + 1}">
      <span>${indice === 0 ? "Capa" : `Foto ${indice + 1}`}</span>
      <button type="button" class="icon-btn danger" data-remover-preview="${indice}" aria-label="Remover foto"><i class="bi bi-x-lg"></i></button>
    </div>`).join("");
}

function bhRenderFotosExistentesPortfolio(publicacao) {
  const bloco = document.getElementById("portfolioFotosExistentes");
  const grid = document.getElementById("portfolioExistentesGrid");
  if (!bloco || !grid) return;
  bloco.hidden = !publicacao?.midias?.length;
  const midias = publicacao?.midias || [];
  grid.innerHTML = midias.map((item, indice) => `
    <div class="portfolio-preview-item portfolio-existing-item">
      <img src="${escapeHTML(item.public_url)}" alt="${escapeHTML(item.texto_alternativo || publicacao.titulo)}">
      <span>${item.ordem === publicacao.capa_ordem ? "Capa" : item.tipo === "antes" ? "Antes" : item.tipo === "depois" ? "Depois" : `Foto ${item.ordem}`}</span>
      <div class="portfolio-media-controls">
        <button type="button" class="icon-btn" data-mover-midia="${item.id}" data-direcao="-1" aria-label="Mover foto para a esquerda" ${indice === 0 ? "disabled" : ""}><i class="bi bi-arrow-left"></i></button>
        <button type="button" class="icon-btn" data-definir-capa="${item.id}" aria-label="Definir como capa" ${item.ordem === publicacao.capa_ordem ? "disabled" : ""}><i class="bi bi-image"></i></button>
        <button type="button" class="icon-btn" data-mover-midia="${item.id}" data-direcao="1" aria-label="Mover foto para a direita" ${indice === midias.length - 1 ? "disabled" : ""}><i class="bi bi-arrow-right"></i></button>
        <button type="button" class="icon-btn danger" data-remover-midia="${item.id}" aria-label="Excluir foto"><i class="bi bi-trash"></i></button>
      </div>
    </div>`).join("");
}

function bhResetFormPortfolio() {
  const form = document.getElementById("formPortfolio");
  if (!form) return;
  form.reset();
  document.getElementById("portfolioId").value = "";
  document.getElementById("portfolioFormTitulo").textContent = "Nova publicação";
  document.getElementById("cancelarEdicaoPortfolio").hidden = true;
  document.getElementById("portfolioResponsavelLinha").hidden = true;
  document.getElementById("portfolioFotosExistentes").hidden = true;
  document.getElementById("portfolioExistentesGrid").innerHTML = "";
  bhPortfolioArquivos = [];
  bhRenderPreviewPortfolio();
  bhPopularCamposPortfolio();
}

function bhEditarPortfolio(id) {
  const item = bhPortfolioItemPorId(id);
  if (!item) return;
  if (item.status === "ocultada") {
    mostrarToast("aviso", "Publicação em moderação", "Este conteúdo não pode ser editado ou republicado. Você ainda pode excluí-lo definitivamente.");
    return;
  }
  bhAtivarSecaoPainel("secGaleria");
  document.getElementById("portfolioId").value = item.id;
  document.getElementById("portfolioFormTitulo").textContent = "Editar publicação";
  document.getElementById("cancelarEdicaoPortfolio").hidden = false;
  document.getElementById("portfolioTitulo").value = item.titulo || "";
  document.getElementById("portfolioDescricao").value = item.descricao || "";
  document.getElementById("portfolioCategoria").value = item.categoria || "";
  document.getElementById("portfolioProfissional").value = item.profissional_id || "";
  document.getElementById("portfolioServico").value = item.servico_id || "";
  document.getElementById("portfolioData").value = item.data_trabalho || "";
  document.getElementById("portfolioTags").value = (item.tags || []).join(", ");
  document.getElementById("portfolioModo").value = item.modo || "galeria";
  document.getElementById("portfolioDestaque").checked = Boolean(item.destaque);
  document.getElementById("portfolioAutorizacao").checked = Boolean(item.confirmou_autorizacao);
  document.getElementById("portfolioTemMenor").checked = Boolean(item.possui_menor);
  document.getElementById("portfolioResponsavel").checked = Boolean(item.confirmou_responsavel);
  document.getElementById("portfolioResponsavelLinha").hidden = !item.possui_menor;
  bhPortfolioArquivos = [];
  bhRenderPreviewPortfolio();
  bhRenderFotosExistentesPortfolio(item);
  document.getElementById("formPortfolio").scrollIntoView({ behavior: "smooth", block: "start" });
}

function bhRenderPortfolioPainel() {
  bhPopularCamposPortfolio();
  const contagem = document.getElementById("portfolioContagem");
  if (contagem) contagem.textContent = bhPainelPortfolio.filter(item => item.status !== "arquivada").length;
  const lista = document.getElementById("listaPortfolioPainel");
  if (!lista) return;
  const itens = bhPortfolioFiltro === "todas" ? bhPainelPortfolio : bhPainelPortfolio.filter(item => item.status === bhPortfolioFiltro);
  if (!itens.length) {
    lista.innerHTML = `<div class="empty compact">Nenhuma publicação nesta categoria.</div>`;
    return;
  }
  lista.innerHTML = itens.map(item => {
    const capa = item.midias.find(m => m.ordem === item.capa_ordem) || item.midias[0];
    return `<article class="portfolio-admin-card">
      <div class="portfolio-admin-cover">${capa ? `<img src="${escapeHTML(capa.public_url)}" alt="${escapeHTML(item.titulo)}">` : `<div class="empty compact">Sem foto</div>`}${item.destaque ? `<span class="featured-label"><i class="bi bi-pin-angle-fill"></i> Destaque</span>` : ""}</div>
      <div class="portfolio-admin-body">
        <div class="card-meta"><span class="status ${item.status}">${escapeHTML(item.status)}</span><span class="badge">${escapeHTML(item.categoria)}</span></div>
        <h3>${escapeHTML(item.titulo)}</h3>
        <p>${escapeHTML(item.descricao || "Sem descrição")}</p>
        <div class="portfolio-card-stats"><span><i class="bi bi-images"></i> ${item.midias.length}/5</span><span><i class="bi bi-heart-fill"></i> ${item.curtidas_count || 0}</span><span><i class="bi bi-person"></i> ${escapeHTML(item.profissional?.nome || "Profissional")}</span></div>
        <div class="portfolio-admin-actions">
          ${item.status === "ocultada" ? `<span class="moderation-lock"><i class="bi bi-shield-lock"></i> Bloqueada para republicação</span>` : `
            <button class="icon-btn" data-portfolio-editar="${item.id}" title="Editar"><i class="bi bi-pencil"></i></button>
            <button class="icon-btn" data-portfolio-status-toggle="${item.id}" data-status-atual="${item.status}" title="${item.status === "publicada" ? "Arquivar" : "Publicar"}"><i class="bi ${item.status === "publicada" ? "bi-archive" : "bi-send"}"></i></button>
            <button class="icon-btn" data-portfolio-destaque="${item.id}" data-destaque-atual="${item.destaque}" title="Destacar"><i class="bi ${item.destaque ? "bi-pin-angle-fill" : "bi-pin-angle"}"></i></button>
          `}
          <button class="icon-btn danger" data-portfolio-excluir="${item.id}" title="Excluir definitivamente"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </article>`;
  }).join("");
}

function bhDadosFormPortfolio(status) {
  const tags = document.getElementById("portfolioTags").value.split(",").map(item => item.trim()).filter(Boolean);
  if (tags.length > 5) throw new Error("Use no máximo 5 tags.");
  const possuiMenor = document.getElementById("portfolioTemMenor").checked;
  const confirmouAutorizacao = document.getElementById("portfolioAutorizacao").checked;
  const confirmouResponsavel = document.getElementById("portfolioResponsavel").checked;
  if (status === "publicada" && !confirmouAutorizacao) throw new Error("Confirme a autorização para publicar as imagens.");
  if (status === "publicada" && possuiMenor && !confirmouResponsavel) throw new Error("Confirme a autorização do responsável legal.");
  return {
    titulo: document.getElementById("portfolioTitulo").value.trim(),
    descricao: document.getElementById("portfolioDescricao").value.trim(),
    categoria: document.getElementById("portfolioCategoria").value,
    profissional_id: document.getElementById("portfolioProfissional").value,
    servico_id: document.getElementById("portfolioServico").value || null,
    data_trabalho: document.getElementById("portfolioData").value || null,
    tags,
    modo: document.getElementById("portfolioModo").value,
    destaque: document.getElementById("portfolioDestaque").checked,
    confirmou_autorizacao: confirmouAutorizacao,
    possui_menor: possuiMenor,
    confirmou_responsavel: possuiMenor ? confirmouResponsavel : false,
    status
  };
}

async function bhRecarregarPainel() {
  bhPainelEstabelecimento = await bhObterMeuEstabelecimento();
  if (!bhPainelEstabelecimento) {
    location.href = bhUrl("html/cadastro-barbearia.html");
    return;
  }
  [bhPainelAgendamentos, bhPainelPortfolio, bhPainelAvaliacoes, bhPainelPlanoResumo, bhPainelPermissoes] = await Promise.all([
    bhListarAgendamentosEstabelecimento(bhPainelEstabelecimento.id),
    bhListarMeuPortfolio(bhPainelEstabelecimento.id),
    bhListarAvaliacoesMeuEstabelecimento(bhPainelEstabelecimento.id).catch(erro => { console.warn("Avaliações ainda não disponíveis.", erro); return []; }),
    bhObterResumoAssinaturaBarbeiro().catch(erro => { console.warn("Plano indisponível.", erro); return null; }),
    window.bhBackendApi?.teamPermissions(bhPainelEstabelecimento.id).catch(erro => { console.warn("Permissões da equipe indisponíveis.", erro); return null; }) || null
  ]);
  document.getElementById("painelUserNome").textContent = bhPainelPerfil.nome;
  document.getElementById("painelUserTipo").textContent = bhPainelPerfil.tipo === "admin" ? "Administrador" : "Proprietário";
  document.getElementById("nomeBarbeariaPainel").textContent = bhPainelEstabelecimento.nome;
  bhRenderKpisPainel();
  bhRenderAgendaPainel();
  bhRenderServicosPainel();
  bhRenderProfissionaisPainel();
  bhRenderPlanoPainel();
  bhRenderClientesPainel();
  bhRenderPromocoesPainel();
  bhRenderRelatoriosPainel();
  bhRenderConfiguracoesPainel();
  bhRenderPaginaPublicaPreview();
  bhRenderPortfolioPainel();
  bhRenderAvaliacoesPainel();
  // Configuração e listas podem reconstruir controles; reaplica locks/limites
  // no fim para que um downgrade não deixe um controle visualmente ativo.
  bhAplicarEntitlementsPainel();
  const ativa = document.querySelector(".panel-section.ativo");
  const recursoAtivo = ativa?.dataset.planSection;
  if (recursoAtivo && !bhPlanoPermite(recursoAtivo)) bhAtivarSecaoPainel("secDashboard");
  document.dispatchEvent(new CustomEvent("bh:painel-context-ready", {
    detail: { establishmentId: bhPainelEstabelecimento.id }
  }));
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("painel");
  bhPainelPerfil = await bhRequireAuth(["barbeiro", "admin"]);
  if (!bhPainelPerfil) return;
  if (bhPainelPerfil.tipo === "barbeiro" && !bhPainelPerfil.onboarding_concluido) {
    location.href = bhUrl("html/cadastro-barbearia.html");
    return;
  }

  try {
    await bhRecarregarPainel();
  } catch (erro) {
    mostrarToast("erro", "Falha ao carregar painel", bhErroMensagem(erro));
    return;
  }

  document.querySelectorAll("[data-panel]").forEach(botao => botao.addEventListener("click", () => bhAtivarSecaoPainel(botao.dataset.panel)));
  const hash = location.hash.replace("#", "");
  const mapaHash = { agenda: "secAgenda", clientes: "secClientes", financeiro: "secFinanceiro", relacionamento: "secRelacionamento", crescimento: "secCrescimento", promocoes: "secPromocoes", servicos: "secServicos", equipe: "secBarbeiros", relatorios: "secRelatorios", galeria: "secGaleria", avaliacoes: "secAvaliacoes", ferramentas: "secFerramentas", configuracoes: "secConfig", pagina: "secPagina" };
  if (mapaHash[hash]) bhAtivarSecaoPainel(mapaHash[hash]);

  document.querySelectorAll("[data-horario-aberto]").forEach(check => check.addEventListener("change", () => {
    const row = check.closest(".horario-config-painel");
    row.querySelectorAll("input[type='time']").forEach(input => { input.disabled = !check.checked; });
    row.classList.toggle("fechado", !check.checked);
  }));


  document.querySelectorAll("[data-status-mode]").forEach(botao => botao.addEventListener("click", () => {
    const modo = botao.dataset.statusMode;
    document.getElementById("configStatus").value = modo;
    const motivo = document.getElementById("configMotivoStatus");
    if (modo === "automatico") motivo.value = "";
    else if (!motivo.value.trim()) motivo.value = bhMotivoStatusRapido(modo) || "";
    document.querySelectorAll("[data-status-mode]").forEach(item => item.classList.toggle("ativo", item.dataset.statusMode === modo));
  }));

  document.querySelectorAll("[data-agenda-mode]").forEach(botao => botao.addEventListener("click", () => {
    const modo = botao.dataset.agendaMode;
    document.getElementById("configAgenda").value = modo;
    document.querySelectorAll("[data-agenda-mode]").forEach(item => item.classList.toggle("ativo", item.dataset.agendaMode === modo));
  }));

  document.querySelectorAll("[data-status-quick]").forEach(botao => botao.addEventListener("click", () => bhAplicarStatusRapido(botao.dataset.statusQuick, botao)));

  document.getElementById("tbodyAgendamentos").addEventListener("click", async evento => {
    const botao = evento.target.closest("[data-agenda-status]");
    if (!botao) return;
    try {
      await bhAtualizarStatusAgendamento(botao.dataset.id, botao.dataset.agendaStatus);
      mostrarToast("sucesso", "Agenda atualizada", `Status alterado para ${botao.dataset.agendaStatus}.`);
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Falha ao atualizar", bhErroMensagem(erro)); }
  });

  document.getElementById("formServico").addEventListener("submit", async evento => {
    evento.preventDefault();
    const form = evento.currentTarget;
    const botao = form.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Salvando...");
    let salvo = false;
    try {
      await bhCriarServico(bhPainelEstabelecimento.id, {
        nome: document.getElementById("servNome").value.trim(),
        categoria: document.getElementById("servCategoria").value.trim(),
        preco: Number(document.getElementById("servPreco").value),
        duracao_min: Number(document.getElementById("servDuracao").value),
        descricao: document.getElementById("servDescricao").value.trim(),
        ativo: true,
        publico: true
      });
      salvo = true;
      form.reset();
      mostrarToast("sucesso", "Serviço adicionado", "O serviço foi salvo corretamente.");
    } catch (erro) {
      mostrarToast("erro", "Falha ao salvar serviço", bhErroMensagem(erro));
    } finally { bhSetButtonLoading(botao, false); }
    if (salvo) {
      try { await bhRecarregarPainel(); }
      catch (erro) {
        console.warn("Serviço salvo, mas a atualização visual falhou.", erro);
        mostrarToast("aviso", "Serviço salvo", "Atualize a página caso ele ainda não apareça na lista.");
      }
    }
  });

  document.getElementById("listaServicosPainel").addEventListener("click", async evento => {
    const toggle = evento.target.closest("[data-servico-toggle]");
    const excluir = evento.target.closest("[data-servico-delete]");
    try {
      if (toggle) await bhAtualizarServico(toggle.dataset.servicoToggle, { ativo: toggle.dataset.ativo !== "true" });
      if (excluir && await bhConfirmar({ titulo: "Excluir serviço", mensagem: "O serviço será removido da página e da agenda. Agendamentos antigos continuarão preservados.", confirmarTexto: "Excluir serviço", perigo: true, trigger: excluir })) await bhExcluirServico(excluir.dataset.servicoDelete);
      if (toggle || excluir) await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Ação não concluída", bhErroMensagem(erro)); }
  });

  document.getElementById("formBarbeiro").addEventListener("submit", async evento => {
    evento.preventDefault();
    const form = evento.currentTarget;
    const botao = form.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Salvando...");
    try {
      const avatarFile = window.bhArquivoImagem?.(document.getElementById("barbAvatar")) || document.getElementById("barbAvatar")?.files?.[0];
      const avatarUrl = avatarFile ? await bhUploadImagem(avatarFile, "profissionais") : null;
      await bhCriarProfissional(bhPainelEstabelecimento.id, {
        nome: document.getElementById("barbNome").value.trim(),
        especialidade: document.getElementById("barbEspecialidade").value.trim(),
        telefone: document.getElementById("barbTelefone").value.trim() || null,
        email: document.getElementById("barbEmail").value.trim() || null,
        avatar_url: avatarUrl,
        ativo: true,
        aceita_agendamento: document.getElementById("barbAgenda").checked
      });
      form.reset();
      document.getElementById("barbAgenda").checked = true;
      mostrarToast("sucesso", "Profissional adicionado", "A equipe já aparece na página pública.");
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Falha ao salvar profissional", bhErroMensagem(erro)); }
    finally { bhSetButtonLoading(botao, false); }
  });

  document.getElementById("listaBarbeirosPainel").addEventListener("click", async evento => {
    const toggle = evento.target.closest("[data-profissional-toggle]");
    const excluir = evento.target.closest("[data-profissional-delete]");
    try {
      if (toggle) await bhAtualizarProfissional(toggle.dataset.profissionalToggle, { ativo: toggle.dataset.ativo !== "true" });
      if (excluir && await bhConfirmar({ titulo: "Excluir profissional", mensagem: "O profissional será removido da equipe e deixará de aparecer para novos agendamentos.", confirmarTexto: "Excluir profissional", perigo: true, trigger: excluir })) await bhExcluirProfissional(excluir.dataset.profissionalDelete);
      if (toggle || excluir) await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Ação não concluída", bhErroMensagem(erro)); }
  });


  document.getElementById("exportarRelatorioCsv")?.addEventListener("click", bhExportarRelatorioCsv);

  document.getElementById("cancelarEdicaoPromocao")?.addEventListener("click", bhLimparFormPromocao);
  document.getElementById("formPromocao")?.addEventListener("submit", async evento => {
    evento.preventDefault();
    if (!bhPlanoPermite("permite_promocoes")) {
      mostrarToast("aviso", "Promoções não liberadas", "Esse benefício está disponível a partir do plano Essencial.");
      return;
    }
    const botao = evento.currentTarget.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Salvando...");
    try {
      const id = document.getElementById("promocaoId").value;
      const dados = {
        titulo: document.getElementById("promocaoTitulo").value.trim(),
        descricao: document.getElementById("promocaoDescricao").value.trim(),
        codigo: document.getElementById("promocaoCodigo").value.trim() || null,
        desconto_percentual: document.getElementById("promocaoDesconto").value ? Number(document.getElementById("promocaoDesconto").value) : null,
        inicia_em: document.getElementById("promocaoInicio").value || null,
        termina_em: document.getElementById("promocaoFim").value || null,
        ativo: document.getElementById("promocaoAtiva").checked
      };
      if (id) await bhAtualizarPromocao(id, dados);
      else await bhCriarPromocao({ estabelecimento_id: bhPainelEstabelecimento.id, ...dados });
      bhLimparFormPromocao();
      mostrarToast("sucesso", id ? "Promoção atualizada" : "Promoção criada", "A página pública reflete a alteração automaticamente.");
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Não foi possível salvar a promoção", bhErroMensagem(erro)); }
    finally { bhSetButtonLoading(botao, false); }
  });

  document.getElementById("listaPromocoesPainel")?.addEventListener("click", async evento => {
    const editar = evento.target.closest("[data-promocao-editar]");
    const toggle = evento.target.closest("[data-promocao-toggle]");
    if (editar) return bhEditarPromocao(editar.dataset.promocaoEditar);
    if (!toggle) return;
    try {
      const ativar = toggle.dataset.ativo !== "true";
      await bhAtualizarPromocao(toggle.dataset.promocaoToggle, { ativo: ativar });
      mostrarToast("sucesso", ativar ? "Promoção ativada" : "Promoção pausada", "A página pública foi atualizada.");
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Ação não concluída", bhErroMensagem(erro)); }
  });

  document.getElementById("portfolioFotos").addEventListener("change", evento => {
    const arquivos = window.bhArquivosImagem?.(evento.target) || [...(evento.target.files || [])];
    const editando = bhPortfolioItemPorId(document.getElementById("portfolioId").value);
    const existentes = editando?.midias?.length || 0;
    if (arquivos.some(file => file.size > BH_PORTFOLIO_MAX_ORIGINAL)) {
      mostrarToast("erro", "Imagem muito grande", "Cada arquivo original deve ter no máximo 8 MB.");
      evento.target.value = "";
      return;
    }
    if (existentes + arquivos.length > BH_PORTFOLIO_MAX_FOTOS) {
      mostrarToast("erro", "Limite de fotos", `Você pode adicionar somente ${BH_PORTFOLIO_MAX_FOTOS - existentes} nova(s) foto(s).`);
      evento.target.value = "";
      return;
    }
    bhPortfolioArquivos = arquivos;
    bhRenderPreviewPortfolio();
  });

  document.getElementById("portfolioNovasFotos").addEventListener("click", evento => {
    const botao = evento.target.closest("[data-remover-preview]");
    if (!botao) return;
    bhPortfolioArquivos.splice(Number(botao.dataset.removerPreview), 1);
    document.getElementById("portfolioFotos").value = "";
    bhRenderPreviewPortfolio();
  });

  document.getElementById("portfolioTemMenor").addEventListener("change", evento => {
    document.getElementById("portfolioResponsavelLinha").hidden = !evento.target.checked;
    if (!evento.target.checked) document.getElementById("portfolioResponsavel").checked = false;
  });
  document.getElementById("cancelarEdicaoPortfolio").addEventListener("click", bhResetFormPortfolio);
  document.querySelectorAll("[data-portfolio-filtro]").forEach(botao => botao.addEventListener("click", () => {
    bhPortfolioFiltro = botao.dataset.portfolioFiltro;
    document.querySelectorAll("[data-portfolio-filtro]").forEach(item => item.classList.toggle("ativo", item === botao));
    bhRenderPortfolioPainel();
  }));

  document.getElementById("formPortfolio").addEventListener("click", evento => {
    const submit = evento.target.closest("button[type='submit'][data-portfolio-status]");
    if (submit) bhPortfolioSubmitStatus = submit.dataset.portfolioStatus;
  });

  document.getElementById("formPortfolio").addEventListener("submit", async evento => {
    evento.preventDefault();
    const status = evento.submitter?.dataset.portfolioStatus || bhPortfolioSubmitStatus || "rascunho";
    const botao = evento.submitter || evento.currentTarget.querySelector(`[data-portfolio-status="${status}"]`);
    bhSetButtonLoading(botao, true, status === "publicada" ? "Publicando..." : "Salvando...");
    const id = document.getElementById("portfolioId").value;
    const estadoAnterior = id ? bhPortfolioItemPorId(id)?.status : null;
    try {
      const limitePortfolio = Number(bhPainelPlanoResumo?.entitlements?.limite_publicacoes || 10);
      const portfolioEmUso = bhPainelPortfolio.filter(item => item.status !== "arquivada").length;
      if (!id && portfolioEmUso >= limitePortfolio) {
        throw new Error(`Seu plano permite até ${limitePortfolio} publicações. Faça upgrade para ampliar o portfólio.`);
      }
      const dados = bhDadosFormPortfolio(status);
      if (!id) {
        await bhCriarPublicacaoPortfolio(bhPainelEstabelecimento.id, dados, bhPortfolioArquivos);
      } else {
        const atual = bhPortfolioItemPorId(id);
        if (!atual) throw new Error("Publicação não encontrada.");
        if (!atual.midias.length && !bhPortfolioArquivos.length) throw new Error("Adicione pelo menos uma foto.");
        // Mantém a publicação em rascunho durante novos uploads e publica somente ao final.
        await bhAtualizarPublicacaoPortfolio(id, { ...dados, status: "rascunho" });
        if (bhPortfolioArquivos.length) await bhAdicionarFotosPortfolio({ ...atual, status: "rascunho", modo: dados.modo }, bhPortfolioArquivos);
        await bhSincronizarTiposMidiaPortfolio(id, atual.capa_ordem);
        await bhAtualizarPublicacaoPortfolio(id, { status, destaque: dados.destaque, modo: dados.modo });
      }
      mostrarToast("sucesso", status === "publicada" ? "Trabalho publicado" : "Rascunho salvo", "A galeria foi atualizada.");
      bhResetFormPortfolio();
      await bhRecarregarPainel();
    } catch (erro) {
      if (id && estadoAnterior && estadoAnterior !== "rascunho") {
        try { await bhAtualizarPublicacaoPortfolio(id, { status: estadoAnterior }); }
        catch (erroRestauracao) { console.warn("Não foi possível restaurar o estado anterior da publicação.", erroRestauracao); }
      }
      mostrarToast("erro", "Não foi possível salvar", bhErroMensagem(erro));
    } finally { bhSetButtonLoading(botao, false); }
  });

  document.getElementById("portfolioExistentesGrid").addEventListener("click", async evento => {
    const remover = evento.target.closest("[data-remover-midia]");
    const mover = evento.target.closest("[data-mover-midia]");
    const capa = evento.target.closest("[data-definir-capa]");
    if (!remover && !mover && !capa) return;
    const publicacao = bhPortfolioItemPorId(document.getElementById("portfolioId").value);
    if (!publicacao) return;
    try {
      if (remover) {
        const midia = publicacao.midias.find(item => item.id === remover.dataset.removerMidia);
        if (!midia || !await bhConfirmar({ titulo: "Excluir foto", mensagem: "A imagem será removida permanentemente do portfólio e do armazenamento.", confirmarTexto: "Excluir foto", perigo: true, trigger: remover })) return;
        await bhRemoverMidiaPortfolio(midia, publicacao);
        mostrarToast("sucesso", "Foto removida", "O arquivo também foi removido do armazenamento.");
      }
      if (mover) {
        const ordenadas = [...publicacao.midias];
        const atual = ordenadas.findIndex(item => item.id === mover.dataset.moverMidia);
        const destino = atual + Number(mover.dataset.direcao);
        if (atual < 0 || destino < 0 || destino >= ordenadas.length) return;
        [ordenadas[atual], ordenadas[destino]] = [ordenadas[destino], ordenadas[atual]];
        const capaAtual = publicacao.midias.find(item => item.ordem === publicacao.capa_ordem)?.id || ordenadas[0].id;
        await bhReordenarMidiasPortfolio(publicacao.id, ordenadas, capaAtual);
      }
      if (capa) {
        await bhReordenarMidiasPortfolio(publicacao.id, publicacao.midias, capa.dataset.definirCapa);
        mostrarToast("sucesso", "Capa atualizada", "A nova capa já será usada na galeria.");
      }
      await bhRecarregarPainel();
      const atualizada = bhPortfolioItemPorId(publicacao.id);
      if (atualizada) bhEditarPortfolio(atualizada.id); else bhResetFormPortfolio();
    } catch (erro) { mostrarToast("erro", "Não foi possível atualizar as fotos", bhErroMensagem(erro)); }
  });

  document.getElementById("listaPortfolioPainel").addEventListener("click", async evento => {
    const editar = evento.target.closest("[data-portfolio-editar]");
    const status = evento.target.closest("[data-portfolio-status-toggle]");
    const destaque = evento.target.closest("[data-portfolio-destaque]");
    const excluir = evento.target.closest("[data-portfolio-excluir]");
    if (editar) return bhEditarPortfolio(editar.dataset.portfolioEditar);
    try {
      if (status) {
        const proximo = status.dataset.statusAtual === "publicada" ? "arquivada" : "publicada";
        await bhAtualizarPublicacaoPortfolio(status.dataset.portfolioStatusToggle, { status: proximo });
        mostrarToast("sucesso", proximo === "publicada" ? "Publicação visível" : "Publicação arquivada", "A página pública foi atualizada.");
      }
      if (destaque) {
        await bhAtualizarPublicacaoPortfolio(destaque.dataset.portfolioDestaque, { destaque: destaque.dataset.destaqueAtual !== "true" });
      }
      if (excluir) {
        const item = bhPortfolioItemPorId(excluir.dataset.portfolioExcluir);
        if (!item || !await bhConfirmar({ titulo: "Excluir publicação", mensagem: "A publicação, as fotos e suas interações serão excluídas permanentemente.", confirmarTexto: "Excluir publicação", perigo: true, trigger: excluir })) return;
        await bhExcluirPublicacaoPortfolio(item);
        mostrarToast("sucesso", "Publicação excluída", "As fotos foram removidas do Storage.");
      }
      if (status || destaque || excluir) await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Ação não concluída", bhErroMensagem(erro)); }
  });

  document.getElementById("listaAvaliacoesPainel")?.addEventListener("submit", async evento => {
    const form = evento.target.closest("[data-responder-avaliacao]");
    if (!form) return;
    evento.preventDefault();
    const botao = form.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Salvando...");
    try {
      await bhResponderAvaliacao(form.dataset.responderAvaliacao, form.querySelector("textarea").value);
      mostrarToast("sucesso", "Resposta publicada", "O cliente receberá uma notificação.");
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Não foi possível responder", bhErroMensagem(erro)); }
    finally { bhSetButtonLoading(botao, false); }
  });

  document.getElementById("formConfig").addEventListener("submit", async evento => {
    evento.preventDefault();
    const botao = evento.currentTarget.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Atualizando...");
    try {
      const foto = window.bhArquivoImagem?.(document.getElementById("configFoto")) || document.getElementById("configFoto").files?.[0];
      const capa = window.bhArquivoImagem?.(document.getElementById("configCapa")) || document.getElementById("configCapa").files?.[0];
      const [fotoUrl, capaUrl] = await Promise.all([
        foto ? bhUploadImagem(foto, "estabelecimento/foto") : Promise.resolve(bhPainelEstabelecimento.fotoUrl),
        capa ? bhUploadImagem(capa, "estabelecimento/capa") : Promise.resolve(bhPainelEstabelecimento.capaUrl)
      ]);
      if (document.getElementById("configAgenda").value === "sim" && !bhPlanoPermite("permite_agenda")) {
        throw new Error("A agenda online está disponível a partir do plano Essencial.");
      }
      await bhAtualizarEstabelecimento(bhPainelEstabelecimento.id, {
        nome: document.getElementById("configNome").value.trim(),
        telefone: document.getElementById("configTelefone").value.trim(),
        whatsapp: bhNormalizarWhatsApp(document.getElementById("configWhatsapp").value),
        instagram: document.getElementById("configInstagram").value.trim(),
        tiktok: document.getElementById("configTiktok").value.trim(),
        endereco: document.getElementById("configEndereco").value.trim(),
        descricao: document.getElementById("configDescricao").value.trim(),
        status_manual: document.getElementById("configStatus").value,
        motivo_status: document.getElementById("configMotivoStatus").value.trim() || null,
        aceita_agendamento: document.getElementById("configAgenda").value === "sim",
        foto_url: fotoUrl,
        capa_url: capaUrl
      });
      mostrarToast("sucesso", "Configurações salvas", "Sua página pública foi atualizada.");
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Falha ao salvar", bhErroMensagem(erro)); }
    finally { bhSetButtonLoading(botao, false); }
  });

  document.getElementById("formHorarios").addEventListener("submit", async evento => {
    evento.preventDefault();
    if (window.bhOperacao110?.saveOpeningPeriods) {
      await window.bhOperacao110.saveOpeningPeriods(evento.currentTarget);
      return;
    }
    const horarios = [...document.querySelectorAll(".horario-config-painel")].map(row => ({
      dia_semana: Number(row.dataset.dia),
      aberto: row.querySelector("[data-horario-aberto]").checked,
      abre: row.querySelector("[data-horario-abre]").value,
      fecha: row.querySelector("[data-horario-fecha]").value
    }));
    try {
      await bhSalvarHorarios(bhPainelEstabelecimento.id, horarios);
      mostrarToast("sucesso", "Horários atualizados", "O status automático já usa os novos horários.");
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Falha ao salvar horários", bhErroMensagem(erro)); }
  });

  document.getElementById("formFechado").addEventListener("submit", async evento => {
    evento.preventDefault();
    const form = evento.currentTarget;
    try {
      await bhAdicionarDiaBloqueado(bhPainelEstabelecimento.id, document.getElementById("fechadoData").value, document.getElementById("fechadoMotivo").value.trim());
      form.reset();
      mostrarToast("sucesso", "Data bloqueada", "Não será possível agendar nesse dia.");
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Falha ao bloquear data", bhErroMensagem(erro)); }
  });

  document.getElementById("diasFechadosPainel").addEventListener("click", async evento => {
    const botao = evento.target.closest("[data-bloqueio-delete]");
    if (!botao) return;
    try {
      await bhExcluirDiaBloqueado(botao.dataset.bloqueioDelete);
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Falha ao remover bloqueio", bhErroMensagem(erro)); }
  });

  document.getElementById("configFoto").addEventListener("change", evento => {
    if (evento.target.files?.[0]) document.getElementById("configFotoPreview").src = URL.createObjectURL(evento.target.files[0]);
  });
  document.getElementById("configCapa").addEventListener("change", evento => {
    if (evento.target.files?.[0]) document.getElementById("configCapaPreview").src = URL.createObjectURL(evento.target.files[0]);
  });
});

window.addEventListener("hashchange", () => {
  const mapa = { agenda: "secAgenda", clientes: "secClientes", financeiro: "secFinanceiro", relacionamento: "secRelacionamento", crescimento: "secCrescimento", promocoes: "secPromocoes", servicos: "secServicos", equipe: "secBarbeiros", relatorios: "secRelatorios", galeria: "secGaleria", avaliacoes: "secAvaliacoes", ferramentas: "secFerramentas", configuracoes: "secConfig", pagina: "secPagina" };
  const alvo = mapa[location.hash.replace("#", "")];
  if (alvo) bhAtivarSecaoPainel(alvo);
});

function bhAssinarPainelTempoReal(){if(!window.supabaseClient||!bhPainelEstabelecimento)return;window.supabaseClient.channel(`painel-${bhPainelEstabelecimento.id}`).on('postgres_changes',{event:'*',schema:'public',table:'agendamentos',filter:`estabelecimento_id=eq.${bhPainelEstabelecimento.id}`},async()=>{await bhRecarregarPainel();mostrarToast('info','Agenda atualizada','Uma alteração chegou em tempo real.')}).on('postgres_changes',{event:'*',schema:'public',table:'assinaturas',filter:`estabelecimento_id=eq.${bhPainelEstabelecimento.id}`},async()=>{await bhRecarregarPainel();mostrarToast('sucesso','Plano atualizado','Os benefícios da assinatura foram atualizados sem precisar sair da conta.')}).subscribe()}
document.addEventListener('DOMContentLoaded',()=>setTimeout(bhAssinarPainelTempoReal,1800));
