/**
 * Barber Hub 1.9 — camada de interface para Agenda 2.0, CRM, financeiro e equipe.
 * Os dados sensíveis passam pela API própria; este arquivo cuida apenas da experiência.
 */
(function barberHubOperacao19(global) {
  "use strict";

  const state = {
    agendaView: "dia",
    agendaDate: "",
    agendaProfessional: "",
    schedule: { appointments: [], blocks: [] },
    crmSegment: "",
    crmClients: [],
    crmSelected: null,
    crmCursor: null,
    crmHasMore: false,
    finance: { summary: {}, entries: [], commissions: [], offset: 0, hasMore: false },
    ready: false,
    initializing: false,
    eventsBound: false,
    crmRequest: 0
  };

  const $ = selector => document.querySelector(selector);
  const safe = value => global.escapeHTML(String(value ?? ""));
  const api = () => global.bhBackendApi;
  const establishment = () => global.bhPainelEstabelecimento || (typeof bhPainelEstabelecimento !== "undefined" ? bhPainelEstabelecimento : null);
  const professionals = () => establishment()?.barbeiros?.filter(item => item.ativo) || [];
  const services = () => establishment()?.servicos?.filter(item => item.ativo) || [];
  const entitlement = key => typeof global.bhPlanoPermite === "function" ? global.bhPlanoPermite(key) : (typeof bhPlanoPermite === "function" && bhPlanoPermite(key));
  const money = value => typeof global.bhMoeda === "function" ? global.bhMoeda(Number(value || 0)) : Number(value || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

  function localIso(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(iso, amount) {
    const date = new Date(`${iso}T12:00:00`);
    date.setDate(date.getDate() + amount);
    return localIso(date);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const raw = String(iso);
    const date = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
    if (Number.isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat("pt-BR", { day:"2-digit", month:"short", year:"numeric" }).format(date).replace(" de ", " ");
  }

  function formatTime(value) {
    if (!value) return "—";
    if (/^\d{2}:\d{2}/.test(String(value))) return String(value).slice(0, 5);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
  }

  function formatDateTime(value) {
    if (!value) return "Nunca";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("pt-BR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
  }

  function initials(name) {
    return String(name || "Cliente").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  }

  function errorMessage(error) {
    return typeof global.bhErroMensagem === "function" ? global.bhErroMensagem(error) : (error?.message || "Não foi possível carregar os dados.");
  }

  function toast(type, title, message) {
    if (typeof global.mostrarToast === "function") global.mostrarToast(type, title, message);
  }

  function stateHtml(icon, title, detail, type = "") {
    return `<div class="operation-state ${safe(type)}"><i class="bi ${safe(icon)}"></i><strong>${safe(title)}</strong><small>${safe(detail)}</small></div>`;
  }

  function loadingHtml(title = "Carregando") {
    return `<div class="operation-state loading"><span class="state-spinner"></span><strong>${safe(title)}</strong><small>Isso deve levar apenas alguns segundos.</small></div>`;
  }

  function featureState(key, title, detail) {
    if (entitlement(key)) return false;
    return stateHtml("bi-lock", title, detail);
  }

  function professionalOptions(selected = "", includeAll = false) {
    return `${includeAll ? `<option value="">Toda a equipe</option>` : `<option value="">Selecione</option>`}${professionals().map(item => `<option value="${safe(item.id)}" ${String(item.id) === String(selected) ? "selected" : ""}>${safe(item.nome)}</option>`).join("")}`;
  }

  function serviceOptions() {
    return services().map(item => `<option value="${safe(item.id)}">${safe(item.nome)} · ${money(item.preco)} · ${Number(item.duracao_min || 0)} min</option>`).join("");
  }

  function populateFilters() {
    const select = $("#agendaProfissionalFiltro19");
    if (select) select.innerHTML = professionalOptions(state.agendaProfessional, true);
  }

  function schedulePeriod() {
    const anchor = state.agendaDate || localIso();
    if (state.agendaView !== "semana") return { start:anchor, end:anchor };
    const day = new Date(`${anchor}T12:00:00`).getDay();
    const start = addDays(anchor, -((day + 6) % 7));
    return { start, end:addDays(start, 6) };
  }

  function appointmentStart(item) {
    return item.inicio_previsto || `${item.data}T${String(item.hora_inicio || "00:00").slice(0, 5)}:00`;
  }

  function appointmentServices(item) {
    const items = item.agendamento_servicos || [];
    return items.length ? items.map(service => service.nome_snapshot).filter(Boolean).join(" + ") : "Serviço não informado";
  }

  function statusLabel(status) {
    return ({ pendente:"Pendente", confirmado:"Confirmado", concluido:"Concluído", recusado:"Recusado", cancelado:"Cancelado", faltou:"Faltou" })[status] || status;
  }

  function renderAgendaKpis() {
    const items = state.schedule.appointments || [];
    const valid = items.filter(item => !["cancelado", "recusado"].includes(item.status));
    const pending = items.filter(item => item.status === "pendente").length;
    const confirmed = items.filter(item => item.status === "confirmado").length;
    const expected = valid.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const occupancy = Math.min(100, Math.round((valid.length / Math.max(1, professionals().length * (state.agendaView === "semana" ? 42 : 8))) * 100));
    $("#agendaKpis19").innerHTML = `
      <article class="operation-kpi"><span><i class="bi bi-calendar-check"></i> Atendimentos</span><strong>${valid.length}</strong><small>${state.agendaView === "semana" ? "no período de sete dias" : "na data selecionada"}</small></article>
      <article class="operation-kpi"><span><i class="bi bi-hourglass-split"></i> A confirmar</span><strong>${pending}</strong><small>${confirmed} já confirmados</small></article>
      <article class="operation-kpi"><span><i class="bi bi-cash-coin"></i> Receita prevista</span><strong>${money(expected)}</strong><small>sem cancelados ou recusados</small></article>
      <article class="operation-kpi"><span><i class="bi bi-speedometer2"></i> Ocupação estimada</span><strong>${occupancy}%</strong><small>capacidade operacional do período</small></article>`;
  }

  function scheduleActions(item) {
    if (["cancelado", "recusado", "concluido", "faltou"].includes(item.status)) return "";
    return `<div class="schedule-actions">
      ${item.status === "pendente" ? `<button class="icon-btn success" data-operation-confirm="${safe(item.id)}" title="Confirmar pelo estabelecimento" type="button"><i class="bi bi-check-lg"></i></button>` : ""}
      <button class="icon-btn" data-operation-reschedule="${safe(item.id)}" title="Reagendar" type="button"><i class="bi bi-calendar2-range"></i></button>
      ${entitlement("permite_recorrencia") && !item.recorrencia_id ? `<button class="icon-btn" data-operation-recurrence="${safe(item.id)}" title="Criar recorrência" type="button"><i class="bi bi-arrow-repeat"></i></button>` : ""}
      ${item.status === "confirmado" ? `<button class="icon-btn danger" data-operation-noshow="${safe(item.id)}" title="Registrar falta" type="button"><i class="bi bi-person-x"></i></button>` : ""}
    </div>`;
  }

  function renderAgenda() {
    renderAgendaKpis();
    const appointments = state.schedule.appointments || [];
    const blocks = state.schedule.blocks || [];
    const days = [];
    const { start, end } = schedulePeriod();
    for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
    if (!appointments.length && !blocks.length) {
      $("#agendaTimeline19").innerHTML = stateHtml("bi-calendar2-plus", "Agenda livre", "Nenhum atendimento ou bloqueio encontrado neste período.");
    } else {
      $("#agendaTimeline19").innerHTML = days.map(day => {
        const dayAppointments = appointments.filter(item => item.data === day);
        const dayBlocks = blocks.filter(item => localIso(new Date(item.inicio)) === day);
        const rows = [
          ...dayAppointments.map(item => ({ type:"appointment", start:appointmentStart(item), item })),
          ...dayBlocks.map(item => ({ type:"block", start:item.inicio, item }))
        ].sort((a, b) => new Date(a.start) - new Date(b.start));
        return `<section class="day-group"><header class="day-label"><strong>${safe(formatDate(day))}</strong><span>${rows.length} ${rows.length === 1 ? "evento" : "eventos"}</span></header>${rows.length ? rows.map(row => {
          if (row.type === "block") return `<article class="schedule-block-item"><div class="schedule-time"><strong>${safe(formatTime(row.item.inicio))}</strong><small>${safe(formatTime(row.item.fim))}</small></div><div class="schedule-copy"><strong><i class="bi bi-slash-circle"></i> ${safe(row.item.motivo || "Horário bloqueado")}</strong><span>${safe(row.item.tipo)} · ${row.item.profissional_id ? "profissional específico" : "toda a equipe"}</span></div><button class="icon-btn danger" data-operation-delete-block="${safe(row.item.id)}" title="Remover bloqueio" type="button"><i class="bi bi-trash"></i></button></article>`;
          const item = row.item;
          return `<article class="schedule-item"><div class="schedule-time"><strong>${safe(formatTime(item.hora_inicio || item.inicio_previsto))}</strong><small>${safe(formatTime(item.hora_fim || item.fim_previsto))}</small></div><div class="schedule-copy"><strong>${safe(item.cliente_nome)}</strong><span>${safe(appointmentServices(item))} · ${safe(item.profissionais?.nome || "Profissional")} · <b class="status ${safe(item.status)}">${safe(statusLabel(item.status))}</b></span></div>${scheduleActions(item)}</article>`;
        }).join("") : `<div class="operation-state compact"><i class="bi bi-calendar-minus"></i><strong>Sem eventos</strong></div>`}</section>`;
      }).join("");
    }
    const upcoming = appointments.filter(item => ["pendente", "confirmado"].includes(item.status)).sort((a, b) => new Date(appointmentStart(a)) - new Date(appointmentStart(b))).slice(0, 3);
    $("#agendaSide19").innerHTML = `<div class="rail-card"><span>Período</span><strong>${safe(formatDate(start))}${end !== start ? ` — ${safe(formatDate(end))}` : ""}</strong><small>${appointments.length} atendimentos · ${blocks.length} bloqueios</small></div>${upcoming.map(item => `<div class="rail-card"><span>Próximo</span><strong>${safe(formatTime(item.hora_inicio))} · ${safe(item.cliente_nome)}</strong><small>${safe(item.profissionais?.nome || "Profissional")} · ${safe(appointmentServices(item))}</small></div>`).join("") || `<div class="rail-card"><span>Próximos</span><strong>Nenhuma pendência</strong><small>O período está organizado.</small></div>`}`;
  }

  async function loadAgenda() {
    const target = $("#agendaTimeline19");
    if (!target || !establishment()) return;
    const locked = featureState("permite_agenda_avancada", "Agenda 2.0 disponível no Essencial", "O plano atual continua com os recursos básicos; faça upgrade para liberar encaixes, bloqueios e visão semanal.");
    if (locked) {
      target.innerHTML = locked;
      $("#agendaSide19").innerHTML = stateHtml("bi-stars", "Organize a operação", "Agenda avançada, CRM e financeiro começam no Essencial.", "compact");
      $("#agendaKpis19").innerHTML = "";
      return;
    }
    target.innerHTML = loadingHtml("Organizando sua agenda");
    try {
      const period = schedulePeriod();
      state.schedule = await api().scheduleRange({ establishmentId:establishment().id, ...period, professionalId:state.agendaProfessional || null });
      renderAgenda();
    } catch (error) {
      target.innerHTML = stateHtml("bi-exclamation-triangle", "Não foi possível carregar a agenda", `${errorMessage(error)} Tente atualizar esta área.`, "error");
      $("#agendaKpis19").innerHTML = "";
    }
  }

  function openAgendaComposer(kind, appointment = null) {
    if (!entitlement("permite_agenda_avancada")) return toast("aviso", "Recurso do Essencial", "Agenda avançada está bloqueada no plano atual.");
    const host = $("#agendaComposer19");
    host.hidden = false;
    if (kind === "encaixe") host.innerHTML = `<div class="composer-header"><div><strong>Novo encaixe</strong><small>Inclua um atendimento presencial sem refazer o fluxo do cliente.</small></div><button class="icon-btn" data-composer-close type="button"><i class="bi bi-x-lg"></i></button></div><form class="composer-grid" id="formWalkIn19"><label class="campo span-2"><span>Cliente</span><input name="cliente_nome" minlength="2" required></label><label class="campo"><span>Telefone</span><input name="cliente_telefone" inputmode="tel"></label><label class="campo"><span>E-mail (opcional)</span><input name="cliente_email" type="email"></label><label class="campo"><span>Data</span><input name="data" type="date" value="${safe(state.agendaDate)}" required></label><label class="campo"><span>Hora</span><input name="hora_inicio" type="time" required></label><label class="campo span-2"><span>Profissional</span><select name="profissional_id" required>${professionalOptions(state.agendaProfessional)}</select></label><label class="campo span-2"><span>Serviços</span><select name="servicos_ids" multiple size="4" required>${serviceOptions()}</select><small>Use Ctrl/Cmd para selecionar mais de um.</small></label><label class="campo span-2"><span>Observação</span><textarea name="observacao" maxlength="800"></textarea></label><div class="composer-actions"><button class="btn btn-dark" data-composer-close type="button">Cancelar</button><button class="btn btn-primary" type="submit"><i class="bi bi-plus-lg"></i> Criar encaixe</button></div></form>`;
    if (kind === "bloqueio") host.innerHTML = `<div class="composer-header"><div><strong>Bloquear horário</strong><small>Reserve uma pausa ou marque uma indisponibilidade sem apagar horários.</small></div><button class="icon-btn" data-composer-close type="button"><i class="bi bi-x-lg"></i></button></div><form class="composer-grid" id="formBlock19"><label class="campo span-2"><span>Profissional</span><select name="profissional_id">${professionalOptions("", true)}</select></label><label class="campo"><span>Tipo</span><select name="tipo"><option value="bloqueio">Bloqueio</option><option value="pausa">Pausa</option><option value="indisponibilidade">Indisponibilidade</option></select></label><label class="campo"><span>Motivo</span><input name="motivo" maxlength="300"></label><label class="campo span-2"><span>Início</span><input name="inicio" type="datetime-local" required></label><label class="campo span-2"><span>Fim</span><input name="fim" type="datetime-local" required></label><div class="composer-actions"><button class="btn btn-dark" data-composer-close type="button">Cancelar</button><button class="btn btn-primary" type="submit"><i class="bi bi-slash-circle"></i> Salvar bloqueio</button></div></form>`;
    if (kind === "reagendar" && appointment) host.innerHTML = `<div class="composer-header"><div><strong>Reagendar ${safe(appointment.cliente_nome)}</strong><small>O histórico da mudança será preservado.</small></div><button class="icon-btn" data-composer-close type="button"><i class="bi bi-x-lg"></i></button></div><form class="composer-grid" id="formReschedule19" data-id="${safe(appointment.id)}"><label class="campo"><span>Nova data</span><input name="data" type="date" value="${safe(appointment.data)}" required></label><label class="campo"><span>Novo horário</span><input name="hora_inicio" type="time" value="${safe(formatTime(appointment.hora_inicio))}" required></label><label class="campo span-2"><span>Profissional</span><select name="profissional_id" required>${professionalOptions(appointment.profissional_id)}</select></label><div class="composer-actions"><button class="btn btn-dark" data-composer-close type="button">Cancelar</button><button class="btn btn-primary" type="submit"><i class="bi bi-calendar2-range"></i> Confirmar reagendamento</button></div></form>`;
    if (kind === "recorrencia" && appointment) host.innerHTML = `<div class="composer-header"><div><strong>Repetir atendimento de ${safe(appointment.cliente_nome)}</strong><small>Todos os horários são validados em uma única transação; se houver conflito, nada será criado.</small></div><button class="icon-btn" data-composer-close type="button"><i class="bi bi-x-lg"></i></button></div><form class="composer-grid" id="formRecurrence193" data-id="${safe(appointment.id)}"><label class="campo span-2"><span>Frequência</span><select name="frequencia"><option value="semanal">Toda semana</option><option value="quinzenal">A cada 15 dias</option><option value="mensal">Todo mês</option></select></label><label class="campo span-2"><span>Total de ocorrências</span><input name="total_ocorrencias" type="number" min="2" max="24" value="4" required><small>Inclui o atendimento atual.</small></label><div class="composer-actions"><button class="btn btn-dark" data-composer-close type="button">Cancelar</button><button class="btn btn-primary" type="submit"><i class="bi bi-arrow-repeat"></i> Criar série</button></div></form>`;
    host.scrollIntoView({ behavior:"smooth", block:"nearest" });
  }

  async function mutate(button, callback, successTitle) {
    const original = button?.innerHTML;
    if (button) { button.disabled = true; button.innerHTML = `<span class="state-spinner" style="width:18px;height:18px;margin:0"></span>`; }
    try {
      await callback();
      toast("sucesso", successTitle, "A operação foi registrada com segurança.");
      if (typeof global.bhRecarregarPainel === "function") await global.bhRecarregarPainel();
      else if (typeof bhRecarregarPainel === "function") await bhRecarregarPainel();
      await loadAgenda();
    } catch (error) {
      toast("erro", "Não foi possível concluir", errorMessage(error));
    } finally {
      if (button) { button.disabled = false; button.innerHTML = original; }
    }
  }

  function crmKpis(items) {
    const recurrent = items.filter(item => item.segmento === "recorrente").length;
    const inactive = items.filter(item => ["inativo", "em_risco"].includes(item.segmento)).length;
    const total = items.reduce((sum, item) => sum + Number(item.gasto_total || 0), 0);
    $("#clientesKpisPainel").innerHTML = `<article class="operation-kpi"><span><i class="bi bi-people"></i> Carteira visível</span><strong>${items.length}</strong><small>clientes neste filtro</small></article><article class="operation-kpi"><span><i class="bi bi-arrow-repeat"></i> Recorrentes</span><strong>${recurrent}</strong><small>relacionamento ativo</small></article><article class="operation-kpi"><span><i class="bi bi-person-exclamation"></i> Pedem atenção</span><strong>${inactive}</strong><small>em risco ou inativos</small></article><article class="operation-kpi"><span><i class="bi bi-receipt"></i> Valor movimentado</span><strong>${money(total)}</strong><small>pela carteira exibida</small></article>`;
  }

  function renderCrmRoster() {
    const host = $("#listaClientesPainel");
    crmKpis(state.crmClients);
    const feedback = $("#crmBuscaFeedback19");
    if (feedback) {
      const query = $("#buscarClientePainel")?.value.trim() || "";
      feedback.textContent = query
        ? `${state.crmClients.length} resultado${state.crmClients.length === 1 ? "" : "s"} para “${query}”.`
        : `${state.crmClients.length} cliente${state.crmClients.length === 1 ? "" : "s"} neste segmento.`;
    }
    if (!state.crmClients.length) return host.innerHTML = stateHtml("bi-person-plus", "Nenhum cliente neste segmento", "A carteira será alimentada pelos atendimentos da agenda.");
    host.innerHTML = state.crmClients.map(item => `<button class="crm-client ${String(state.crmSelected) === String(item.id) ? "ativo" : ""}" data-crm-client="${safe(item.id)}" type="button"><span class="crm-avatar">${safe(initials(item.nome))}</span><span class="crm-client-copy"><strong>${safe(item.nome)}</strong><span>${safe(item.telefone || item.email || "Sem contato informado")} · ${safe((item.segmento || "novo").replace("_", " "))}</span></span><span class="crm-client-meta"><strong>${Number(item.visitas_concluidas || 0)} visitas</strong><small>${money(item.gasto_total)}</small></span></button>`).join("") + (state.crmHasMore ? `<button class="btn btn-dark btn-small crm-more110" data-crm-more type="button"><i class="bi bi-chevron-down"></i> Carregar mais clientes</button>` : "");
  }

  async function loadCrm(append = false) {
    const host = $("#listaClientesPainel");
    if (!host || !establishment()) return;
    const locked = featureState("permite_crm", "CRM disponível no Essencial", "Histórico persistente, preferências e anotações são liberados a partir do plano Essencial.");
    if (locked) { host.innerHTML = locked; $("#clientesKpisPainel").innerHTML = ""; return; }
    const requestId = ++state.crmRequest;
    const query = $("#buscarClientePainel")?.value.trim() || "";
    const feedback = $("#crmBuscaFeedback19");
    const clearButton = $("#limparBuscaCliente19");
    if (clearButton) clearButton.hidden = !query;
    if (feedback) feedback.textContent = query ? `Buscando “${query}”…` : "Atualizando a carteira…";
    host.setAttribute("aria-busy", "true");
    if (!append) host.innerHTML = loadingHtml(query ? "Buscando clientes" : "Montando a carteira");
    try {
      const cursor = append ? state.crmCursor : null;
      const clients = await api().listCrmClients({ establishmentId:establishment().id, query, segment:state.crmSegment, cursorLast:cursor?.last || null, cursorId:cursor?.id || null, limit:40 });
      if (requestId !== state.crmRequest) return;
      state.crmClients = append ? [...state.crmClients, ...clients] : clients;
      const last = state.crmClients[state.crmClients.length - 1];
      state.crmCursor = last ? { last:last.ultima_visita_em, id:last.id } : null;
      state.crmHasMore = clients.length === 40;
      renderCrmRoster();
    } catch (error) {
      if (requestId !== state.crmRequest) return;
      host.innerHTML = stateHtml("bi-exclamation-triangle", "Não foi possível carregar os clientes", `${errorMessage(error)} Tente atualizar esta área.`, "error");
      $("#clientesKpisPainel").innerHTML = "";
      if (feedback) feedback.textContent = "Não foi possível concluir a busca. Tente novamente.";
    } finally {
      if (requestId === state.crmRequest) host.removeAttribute("aria-busy");
    }
  }

  function renderCrmDetail(client) {
    const host = $("#crmDetalhe19");
    const notes = client.notes || [];
    host.innerHTML = `<div class="crm-profile-header"><span class="crm-avatar">${safe(initials(client.nome))}</span><div><strong>${safe(client.nome)}</strong><span>${safe(client.telefone || client.email || "Contato não informado")} · ${safe((client.segmento || "novo").replace("_", " "))}</span></div></div><div class="crm-profile-kpis"><div class="crm-mini-kpi"><span>Visitas</span><strong>${Number(client.visitas_concluidas || 0)}</strong></div><div class="crm-mini-kpi"><span>Gasto</span><strong>${money(client.gasto_total)}</strong></div><div class="crm-mini-kpi"><span>Faltas</span><strong>${Number(client.faltas || 0)}</strong></div></div><form id="formCrmProfile19" data-id="${safe(client.id)}"><div class="crm-profile-section"><h4>Preferências e contexto</h4><label class="campo"><span>Preferências de atendimento</span><textarea name="preferencias" maxlength="2000" placeholder="Ex.: máquina 1 nas laterais, prefere atendimento com Lucas...">${safe(client.preferencias || "")}</textarea></label><label class="campo"><span>Tags separadas por vírgula</span><input name="tags" value="${safe((client.tags || []).join(", "))}" placeholder="VIP, barba, quinzenal"></label><label class="check-line"><input name="permite_whatsapp" type="checkbox" ${client.permite_whatsapp ? "checked" : ""}><span>Cliente permite contato operacional por WhatsApp</span></label><button class="btn btn-outline btn-small full" type="submit">Salvar ficha</button></div></form><div class="crm-profile-section"><h4>Nova anotação interna</h4><form id="formCrmNote19" data-id="${safe(client.id)}"><label class="campo"><textarea name="conteudo" minlength="2" maxlength="2000" placeholder="Somente a equipe autorizada verá esta nota." required></textarea></label><button class="btn btn-dark btn-small full" type="submit"><i class="bi bi-journal-plus"></i> Adicionar nota</button></form></div><div class="crm-profile-section"><h4>Anotações recentes</h4>${notes.length ? notes.map(note => `<div class="crm-note"><p>${safe(note.conteudo)}</p><span>${safe(formatDateTime(note.created_at))}</span></div>`).join("") : `<p class="muted">Nenhuma anotação interna.</p>`}</div>`;
    const tagsField = host.querySelector('[name="tags"]')?.closest(".campo");
    tagsField?.insertAdjacentHTML("afterend", `<label class="campo"><span>Data de nascimento <small>(opcional)</small></span><input name="data_nascimento" type="date" value="${safe(client.data_nascimento || "")}"><small>Usada somente para campanhas de aniversário autorizadas.</small></label><label class="check-line"><input name="permite_email_marketing" type="checkbox" ${client.permite_email_marketing ? "checked" : ""}><span>Cliente autorizou campanhas por e-mail</span></label>`);
  }

  async function openCrmDetail(id) {
    state.crmSelected = id;
    renderCrmRoster();
    $("#crmDetalhe19").innerHTML = loadingHtml("Abrindo a ficha");
    try {
      renderCrmDetail(await api().getCrmClient(id));
    } catch (error) {
      $("#crmDetalhe19").innerHTML = stateHtml("bi-exclamation-triangle", "Ficha indisponível", errorMessage(error), "error");
    }
  }

  function renderFinance() {
    const summary = state.finance.summary || {};
    const realized = summary.entradas_realizadas ?? summary.receitas_realizadas ?? summary.realizado ?? 0;
    const expenses = summary.despesas_realizadas ?? 0;
    const estimated = summary.resultado_estimado ?? (Number(realized) - Number(expenses));
    const appointments = summary.atendimentos_concluidos ?? summary.atendimentos ?? 0;
    $("#financeKpis19").innerHTML = `<article class="operation-kpi"><span><i class="bi bi-check2-circle"></i> Receita realizada</span><strong>${money(realized)}</strong><small>${Number(appointments)} atendimentos concluídos</small></article><article class="operation-kpi"><span><i class="bi bi-receipt-cutoff"></i> Gastos realizados</span><strong>${money(expenses)}</strong><small>saídas registradas no período</small></article><article class="operation-kpi"><span><i class="bi bi-calculator"></i> Resultado estimado</span><strong>${money(estimated)}</strong><small>receitas menos gastos e ajustes</small></article><article class="operation-kpi"><span><i class="bi bi-receipt"></i> Ticket médio</span><strong>${money(summary.ticket_medio)}</strong><small>por atendimento realizado</small></article>`;
    const entries = state.finance.entries || [];
    $("#financeLancamentos19").innerHTML = entries.length ? entries.map(item => `<article class="ledger-entry ${safe(item.natureza)}"><span class="ledger-icon"><i class="bi ${item.natureza === "debito" ? "bi-arrow-down-left" : "bi-arrow-up-right"}"></i></span><span class="ledger-copy"><strong>${safe(item.descricao)}</strong><span>${safe(formatDate(item.competencia))} · ${safe(item.origem)} · ${safe(item.status)}</span></span><strong class="ledger-value">${item.natureza === "debito" ? "−" : "+"}${money(item.valor_liquido)}${Number(item.comissao_valor || 0) ? `<small>Comissão ${money(item.comissao_valor)}</small>` : ""}</strong></article>`).join("") : stateHtml("bi-receipt", "Nenhuma movimentação", "Conclua atendimentos ou adicione um ajuste neste período.");
    const commissions = state.finance.commissions || [];
    $("#financeComissoes19").innerHTML = entitlement("permite_comissoes") ? (commissions.length ? commissions.map(item => `<article class="commission-item"><span class="ledger-icon"><i class="bi bi-percent"></i></span><span class="ledger-copy"><strong>${safe(item.tipo === "percentual" ? `${item.valor}%` : money(item.valor))}</strong><span>${item.profissional_id ? "Profissional específico" : item.servico_id ? "Serviço específico" : "Regra padrão"} · ${item.ativo ? "ativa" : "inativa"}</span></span><button class="icon-btn" data-commission-toggle="${safe(item.id)}" data-active="${String(Boolean(item.ativo))}" title="Ativar ou inativar" type="button"><i class="bi ${item.ativo ? "bi-toggle-on" : "bi-toggle-off"}"></i></button></article>`).join("") : stateHtml("bi-percent", "Sem regras", "Crie uma regra padrão ou por profissional.", "compact")) : stateHtml("bi-lock", "Comissões no Profissional", "Faça upgrade para calcular comissões automaticamente.", "compact");
    $("#financePeriodoLabel19").textContent = `${formatDate(summary.inicio)} — ${formatDate(summary.fim)}`;
    const more = $("#financeMore110");
    if (more) more.hidden = !state.finance.hasMore;
  }

  async function loadFinance(append = false) {
    const host = $("#financeLancamentos19");
    if (!host || !establishment()) return;
    const locked = featureState("permite_financeiro", "Financeiro disponível no Essencial", "Receita, ticket e fechamento são liberados no plano Essencial.");
    if (locked) { host.innerHTML = locked; $("#financeKpis19").innerHTML = ""; return; }
    if (!append) host.innerHTML = loadingHtml("Calculando o período");
    try {
      const params = { establishmentId:establishment().id, start:$("#financeInicio19").value, end:$("#financeFim19").value };
      if (append) {
        const page = await api().financeEntries({ ...params, offset:state.finance.offset, limit:40 });
        state.finance.entries.push(...(page.items || []));
        state.finance.offset += (page.items || []).length;
        state.finance.hasMore = Boolean(page.has_more);
      } else {
        const [summary, page, commissions] = await Promise.all([
          api().financeSummary(params),
          api().financeEntries({ ...params, offset:0, limit:40 }),
          entitlement("permite_comissoes") ? api().commissionRules(establishment().id) : Promise.resolve([])
        ]);
        state.finance = { summary, entries:page.items || [], commissions, offset:(page.items || []).length, hasMore:Boolean(page.has_more) };
      }
      renderFinance();
    } catch (error) {
      host.innerHTML = stateHtml("bi-exclamation-triangle", "Não foi possível carregar o financeiro", `${errorMessage(error)} Tente atualizar esta área.`, "error");
      $("#financeKpis19").innerHTML = "";
    }
  }

  function setFinancePreset(preset) {
    document.querySelectorAll("[data-finance-preset]").forEach(button => button.classList.toggle("ativo", button.dataset.financePreset === preset));
    if (preset === "custom") { $("#financeInicio19")?.focus(); return; }
    const end = new Date();
    const start = new Date(end);
    if (preset === "week") {
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    }
    if (preset === "month") start.setDate(1);
    $("#financeInicio19").value = localIso(start);
    $("#financeFim19").value = localIso(end);
    loadFinance();
  }

  function openFinanceComposer(kind) {
    const host = $("#financeComposer19");
    host.hidden = false;
    const close = `<button class="icon-btn" data-composer-close type="button"><i class="bi bi-x-lg"></i></button>`;
    if (kind === "ajuste") host.innerHTML = `<div class="composer-header"><div><strong>Novo ajuste financeiro</strong><small>Registre uma entrada ou saída que não veio de um atendimento.</small></div>${close}</div><form class="composer-grid" id="formFinanceAdjust19"><label class="campo"><span>Data</span><input name="competencia" type="date" value="${safe(localIso())}" required></label><label class="campo"><span>Natureza</span><select name="natureza"><option value="credito">Entrada</option><option value="debito">Saída</option></select></label><label class="campo"><span>Valor</span><input name="valor" type="number" min="0.01" step="0.01" required></label><label class="campo"><span>Descrição</span><input name="descricao" minlength="2" maxlength="180" required></label><label class="campo span-4"><span>Motivo para auditoria</span><textarea name="motivo" minlength="3" maxlength="500" required></textarea></label><div class="composer-actions"><button class="btn btn-dark" data-composer-close type="button">Cancelar</button><button class="btn btn-primary" type="submit">Registrar ajuste</button></div></form>`;
    if (kind === "fechamento") host.innerHTML = `<div class="composer-header"><div><strong>Fechar o dia</strong><small>Cria ou revisa o resumo diário com rastreabilidade.</small></div>${close}</div><form class="composer-grid" id="formFinanceClose19"><label class="campo"><span>Data</span><input name="data" type="date" max="${safe(localIso())}" value="${safe(localIso())}" required></label><label class="campo span-2"><span>Observação</span><input name="observacao" maxlength="800" placeholder="Opcional"></label><div class="composer-actions"><button class="btn btn-dark" data-composer-close type="button">Cancelar</button><button class="btn btn-primary" type="submit"><i class="bi bi-lock"></i> Confirmar fechamento</button></div></form>`;
    if (kind === "comissao") {
      if (!entitlement("permite_comissoes")) return toast("aviso", "Recurso do Profissional", "Comissões automáticas estão bloqueadas no plano atual.");
      host.innerHTML = `<div class="composer-header"><div><strong>Nova regra de comissão</strong><small>A regra específica tem prioridade sobre a regra padrão.</small></div>${close}</div><form class="composer-grid" id="formCommission19"><label class="campo span-2"><span>Profissional (opcional)</span><select name="profissional_id">${professionalOptions("", true)}</select></label><label class="campo"><span>Tipo</span><select name="tipo"><option value="percentual">Percentual</option><option value="fixo">Valor fixo</option></select></label><label class="campo"><span>Valor</span><input name="valor" type="number" min="0" step="0.01" required></label><div class="composer-actions"><button class="btn btn-dark" data-composer-close type="button">Cancelar</button><button class="btn btn-primary" type="submit">Criar regra</button></div></form>`;
    }
    host.scrollIntoView({ behavior:"smooth", block:"nearest" });
  }

  async function loadTeam() {
    const host = $("#teamAcessos19");
    if (!host || !establishment()) return;
    const locked = featureState("permite_equipe_acesso", "Acesso individual no Profissional", "O cadastro público da equipe continua disponível; contas e papéis operacionais começam no plano Profissional.");
    if (locked) return host.innerHTML = locked;
    host.innerHTML = loadingHtml("Carregando acessos");
    try {
      const members = await api().teamMembers(establishment().id);
      host.innerHTML = members.length ? members.map(item => {
        const profile = Array.isArray(item.perfis) ? item.perfis[0] : item.perfis;
        const professional = Array.isArray(item.profissionais) ? item.profissionais[0] : item.profissionais;
        return `<article class="team-access-item"><span class="crm-avatar">${safe(initials(profile?.nome || professional?.nome))}</span><span><strong>${safe(profile?.nome || professional?.nome || profile?.email || "Membro")}</strong><span>${safe(profile?.email || "Conta vinculada")} · ${safe(item.papel)} · ${safe(item.status)}</span></span><div class="team-access-actions">${entitlement("permite_permissoes_granulares") ? `<button class="icon-btn" data-team-permissions="${safe(item.id)}" title="Configurar permissões" type="button"><i class="bi bi-shield-lock"></i></button>` : ""}<button class="icon-btn ${item.status === "ativo" ? "danger" : "success"}" data-team-toggle="${safe(item.id)}" data-status="${safe(item.status)}" title="${item.status === "ativo" ? "Suspender" : "Reativar"}" type="button"><i class="bi ${item.status === "ativo" ? "bi-pause" : "bi-play"}"></i></button></div></article>`;
      }).join("") : stateHtml("bi-person-plus", "Nenhuma conta vinculada", "Convide uma conta já cadastrada no Barber Hub.", "compact");
    } catch (error) {
      host.innerHTML = stateHtml("bi-exclamation-triangle", "Acessos indisponíveis", errorMessage(error), "error");
    }
  }

  function openTeamComposer() {
    if (!entitlement("permite_equipe_acesso")) return toast("aviso", "Recurso do Profissional", "Acesso individual da equipe está bloqueado no plano atual.");
    const host = $("#teamComposer19");
    host.hidden = false;
    host.innerHTML = `<div class="composer-header"><div><strong>Vincular conta existente</strong><small>A pessoa precisa ter uma conta cadastrada no Barber Hub.</small></div><button class="icon-btn" data-composer-close type="button"><i class="bi bi-x-lg"></i></button></div><form class="composer-grid" id="formTeamLink19"><label class="campo span-2"><span>E-mail da conta</span><input name="email" type="email" required></label><label class="campo"><span>Papel</span><select name="papel"><option value="profissional">Profissional</option><option value="recepcao">Recepção</option><option value="gerente">Gerente</option></select></label><label class="campo"><span>Cadastro profissional (opcional)</span><select name="profissional_id">${professionalOptions("", true)}</select></label><div class="composer-actions"><button class="btn btn-dark" data-composer-close type="button">Cancelar</button><button class="btn btn-primary" type="submit">Vincular acesso</button></div></form>`;
  }

  async function submitForm(form) {
    const data = new FormData(form);
    const button = form.querySelector("button[type='submit']");
    const close = () => { const host = form.closest(".operation-composer"); if (host) { host.hidden = true; host.innerHTML = ""; } };
    await mutate(button, async () => {
      if (form.id === "formWalkIn19") await api().createWalkIn({ estabelecimento_id:establishment().id, profissional_id:data.get("profissional_id"), servicos_ids:data.getAll("servicos_ids"), cliente_nome:data.get("cliente_nome"), cliente_email:data.get("cliente_email") || null, cliente_telefone:data.get("cliente_telefone") || null, data:data.get("data"), hora_inicio:data.get("hora_inicio"), observacao:data.get("observacao") || null });
      if (form.id === "formBlock19") await api().createScheduleBlock({ estabelecimento_id:establishment().id, profissional_id:data.get("profissional_id") || null, inicio:new Date(data.get("inicio")).toISOString(), fim:new Date(data.get("fim")).toISOString(), tipo:data.get("tipo"), motivo:data.get("motivo") || null });
      if (form.id === "formReschedule19") await api().rescheduleAppointment(form.dataset.id, { profissional_id:data.get("profissional_id"), data:data.get("data"), hora_inicio:data.get("hora_inicio") });
      if (form.id === "formRecurrence193") await api().createRecurrence(form.dataset.id, { frequencia:data.get("frequencia"), total_ocorrencias:Number(data.get("total_ocorrencias")) });
      if (form.id === "formFinanceAdjust19") await api().createFinancialAdjustment({ estabelecimento_id:establishment().id, competencia:data.get("competencia"), natureza:data.get("natureza"), valor:Number(data.get("valor")), descricao:data.get("descricao"), motivo:data.get("motivo") });
      if (form.id === "formFinanceClose19") await api().closeFinancialDay({ estabelecimento_id:establishment().id, data:data.get("data"), observacao:data.get("observacao") || null });
      if (form.id === "formCommission19") await api().createCommissionRule({ estabelecimento_id:establishment().id, profissional_id:data.get("profissional_id") || null, servico_id:null, tipo:data.get("tipo"), valor:Number(data.get("valor")), ativo:true });
      if (form.id === "formTeamLink19") await api().linkTeamMember({ estabelecimento_id:establishment().id, email:data.get("email"), papel:data.get("papel"), profissional_id:data.get("profissional_id") || null });
      close();
    }, "Operação concluída");
    if (form.id.startsWith("formFinance") || form.id === "formCommission19") await loadFinance();
    if (form.id === "formRecurrence193") global.bhRetention193?.loadRetention?.();
    if (form.id === "formTeamLink19") await loadTeam();
  }

  async function handleClick(event) {
    const action = event.target.closest("[data-agenda-action],[data-finance-action],[data-team-action],[data-composer-close],[data-operation-reschedule],[data-operation-recurrence],[data-operation-confirm],[data-operation-noshow],[data-operation-delete-block],[data-crm-client],[data-crm-more],[data-commission-toggle],[data-team-toggle]");
    if (!action) return;
    if (action.dataset.composerClose !== undefined) { const host = action.closest(".operation-composer"); host.hidden = true; host.innerHTML = ""; return; }
    if (action.dataset.agendaAction) return openAgendaComposer(action.dataset.agendaAction);
    if (action.dataset.financeAction) return openFinanceComposer(action.dataset.financeAction);
    if (action.dataset.teamAction) return openTeamComposer();
    if (action.dataset.crmClient) return openCrmDetail(action.dataset.crmClient);
    if (action.dataset.crmMore !== undefined) return loadCrm(true);
    if (action.dataset.operationReschedule) return openAgendaComposer("reagendar", state.schedule.appointments.find(item => String(item.id) === action.dataset.operationReschedule));
    if (action.dataset.operationRecurrence) return openAgendaComposer("recorrencia", state.schedule.appointments.find(item => String(item.id) === action.dataset.operationRecurrence));
    if (action.dataset.operationConfirm) return mutate(action, () => api().confirmAppointment(action.dataset.operationConfirm, "estabelecimento", "confirmada"), "Atendimento confirmado");
    if (action.dataset.operationNoshow && global.confirm("Registrar que o cliente faltou a este atendimento?")) return mutate(action, () => api().markNoShow(action.dataset.operationNoshow), "Falta registrada");
    if (action.dataset.operationDeleteBlock && global.confirm("Remover este bloqueio da agenda?")) return mutate(action, () => api().deleteScheduleBlock(action.dataset.operationDeleteBlock), "Bloqueio removido");
    if (action.dataset.commissionToggle) { await api().updateCommissionRule(action.dataset.commissionToggle, { ativo:action.dataset.active !== "true" }).then(loadFinance).catch(error => toast("erro", "Falha ao alterar comissão", errorMessage(error))); return; }
    if (action.dataset.teamToggle) { await api().updateTeamMember(action.dataset.teamToggle, { status:action.dataset.status === "ativo" ? "suspenso" : "ativo" }).then(loadTeam).catch(error => toast("erro", "Falha ao alterar acesso", errorMessage(error))); }
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (["formWalkIn19", "formBlock19", "formReschedule19", "formRecurrence193", "formFinanceAdjust19", "formFinanceClose19", "formCommission19", "formTeamLink19"].includes(form.id)) { event.preventDefault(); await submitForm(form); return; }
    if (form.id === "formCrmProfile19") {
      event.preventDefault();
      const data = new FormData(form);
      try {
        await api().updateCrmClient(form.dataset.id, {
          preferencias:data.get("preferencias") || null,
          tags:String(data.get("tags") || "").split(",").map(item => item.trim()).filter(Boolean),
          permite_whatsapp:data.get("permite_whatsapp") === "on",
          permite_email_marketing:data.get("permite_email_marketing") === "on",
          data_nascimento:data.get("data_nascimento") || null
        });
        toast("sucesso", "Ficha atualizada", "Preferências e permissões foram salvas.");
        await openCrmDetail(form.dataset.id);
      } catch (error) { toast("erro", "Falha ao salvar ficha", errorMessage(error)); }
    }
    if (form.id === "formCrmNote19") {
      event.preventDefault();
      const data = new FormData(form);
      try { await api().addCrmNote(form.dataset.id, data.get("conteudo")); toast("sucesso", "Anotação salva", "A nota ficará visível somente para a equipe autorizada."); await openCrmDetail(form.dataset.id); } catch (error) { toast("erro", "Falha ao salvar anotação", errorMessage(error)); }
    }
  }

  let searchTimer = null;
  function bindEvents() {
    if (state.eventsBound) return;
    state.eventsBound = true;
    document.addEventListener("click", handleClick);
    document.addEventListener("submit", handleSubmit);
    $("#agendaDataReferencia19")?.addEventListener("change", event => { state.agendaDate = event.target.value; loadAgenda(); });
    $("#agendaProfissionalFiltro19")?.addEventListener("change", event => { state.agendaProfessional = event.target.value; loadAgenda(); });
    $("#agendaAtualizar19")?.addEventListener("click", loadAgenda);
    document.querySelectorAll("[data-agenda-view]").forEach(button => button.addEventListener("click", () => { state.agendaView = button.dataset.agendaView; document.querySelectorAll("[data-agenda-view]").forEach(item => item.classList.toggle("ativo", item === button)); loadAgenda(); }));
    $("#buscarClientePainel")?.addEventListener("input", event => {
      clearTimeout(searchTimer);
      const clearButton = $("#limparBuscaCliente19");
      if (clearButton) clearButton.hidden = !event.target.value;
      searchTimer = setTimeout(loadCrm, 380);
    });
    $("#buscarClientePainel")?.addEventListener("keydown", event => {
      if (event.key !== "Escape" || !event.currentTarget.value) return;
      event.preventDefault();
      event.currentTarget.value = "";
      clearTimeout(searchTimer);
      loadCrm();
    });
    $("#limparBuscaCliente19")?.addEventListener("click", () => {
      const input = $("#buscarClientePainel");
      if (!input) return;
      input.value = "";
      input.focus();
      clearTimeout(searchTimer);
      loadCrm();
    });
    document.querySelectorAll("[data-crm-segment]").forEach(button => button.addEventListener("click", () => { state.crmSegment = button.dataset.crmSegment; document.querySelectorAll("[data-crm-segment]").forEach(item => item.classList.toggle("ativo", item === button)); loadCrm(); }));
    $("#financeAtualizar19")?.addEventListener("click", () => loadFinance());
    $("#financeMore110")?.addEventListener("click", () => loadFinance(true));
    document.querySelectorAll("[data-finance-preset]").forEach(button => button.addEventListener("click", () => setFinancePreset(button.dataset.financePreset)));
    ["#financeInicio19", "#financeFim19"].forEach(selector => $(selector)?.addEventListener("change", () => document.querySelectorAll("[data-finance-preset]").forEach(button => button.classList.toggle("ativo", button.dataset.financePreset === "custom"))));
    document.addEventListener("bh:painel-section-change", event => {
      if (state.ready) refreshSection(event.detail?.id);
      else init();
    });
    document.addEventListener("bh:painel-context-ready", () => {
      populateFilters();
      if (!state.ready) init();
    });
  }

  function refreshSection(id) {
    if (!state.ready) return;
    if (id === "secAgenda") loadAgenda();
    if (id === "secClientes") loadCrm();
    if (id === "secFinanceiro") loadFinance();
    if (id === "secBarbeiros") loadTeam();
  }

  async function waitForContext() {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      if (establishment() && api()) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }

  async function init() {
    if (state.ready || state.initializing) return;
    state.initializing = true;
    bindEvents();
    if (!await waitForContext()) {
      state.initializing = false;
      const retry = `${stateHtml("bi-wifi-off", "Não conseguimos iniciar esta área", "Verifique sua conexão e toque em tentar novamente.", "error").replace("</div>", '<button class="btn btn-outline btn-small" data-operation-retry type="button"><i class="bi bi-arrow-clockwise"></i> Tentar novamente</button></div>')}`;
      ["#agendaTimeline19", "#listaClientesPainel", "#financeLancamentos19"].forEach(selector => { const host = $(selector); if (host) host.innerHTML = retry; });
      return;
    }
    state.agendaDate = localIso();
    $("#agendaDataReferencia19").value = state.agendaDate;
    const start = new Date(); start.setDate(1);
    $("#financeInicio19").value = localIso(start);
    $("#financeFim19").value = localIso();
    populateFilters();
    state.ready = true;
    state.initializing = false;
    const active = $(".panel-section.ativo")?.id;
    refreshSection(active);
    loadTeam();
  }

  global.bhOperacao19 = {
    init,
    loadAgenda,
    loadCrm,
    loadFinance,
    loadTeam,
    professionalOptions,
    refreshVisible:() => refreshSection($(".panel-section.ativo")?.id)
  };
  document.addEventListener("click", event => {
    if (!event.target.closest("[data-operation-retry]")) return;
    state.ready = false;
    state.initializing = false;
    init();
  });
  document.addEventListener("DOMContentLoaded", init);
})(window);
