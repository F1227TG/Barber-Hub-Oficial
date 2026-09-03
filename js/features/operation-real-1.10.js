/** Barber Hub 1.10 — operação real, importação, avisos e auditoria. */
(function operationReady110(global) {
  "use strict";

  const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const FEATURE_LABELS = {
    "operacao.multiplos_periodos": "Múltiplos períodos",
    "operacao.atendimento_manual": "Atendimento avulso",
    "financeiro.despesas": "Gastos e resultado",
    "marketplace.regional": "Busca por região",
    "perfil.biblioteca_capas": "Biblioteca de capas",
    "dados.importacao": "Importação assistida",
    "notificacoes.web_push": "Avisos no dispositivo",
    "operacao.auditoria": "Histórico operacional"
  };
  const FEATURE_KEYS = Object.keys(FEATURE_LABELS);
  const state = { periods: [], auditOffset: 0, auditHasMore: false, importOffset: 0, importHasMore: false, importId: null, ready: false, loading: false };
  const $ = selector => document.querySelector(selector);
  const safe = value => global.escapeHTML?.(String(value ?? "")) ?? String(value ?? "");
  const api = () => global.bhBackendApi;
  const establishment = () => global.bhPainelEstabelecimento || (typeof bhPainelEstabelecimento !== "undefined" ? bhPainelEstabelecimento : null);
  const toast = (type, title, message) => global.mostrarToast?.(type, title, message);
  const errorMessage = error => global.bhErroMensagem?.(error) || error?.message || "Não foi possível concluir.";
  const time = value => String(value || "").slice(0, 5);
  const today = () => global.bhHojeISO?.() || new Date().toISOString().slice(0, 10);
  const key = prefix => `${prefix}.${Date.now()}.${global.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;

  function errorState(title, detail, retry = "") {
    return `<div class="operation-state error"><i class="bi bi-exclamation-triangle"></i><strong>${safe(title)}</strong><small>${safe(detail)}</small>${retry ? `<button class="btn btn-outline btn-small" type="button" ${retry}><i class="bi bi-arrow-clockwise"></i> Tentar novamente</button>` : ""}</div>`;
  }

  function fallbackPeriods() {
    const rows = establishment()?.horariosRows || [];
    return rows.flatMap(row => {
      if (!row.aberto || !row.abre || !row.fecha) return [];
      const first = { dia_semana:Number(row.dia_semana), abre:time(row.abre), fecha:time(row.intervalo_inicio || row.fecha), fecha_dia_seguinte:false, ordem:1, ativo:true };
      const second = row.intervalo_inicio && row.intervalo_fim
        ? [{ dia_semana:Number(row.dia_semana), abre:time(row.intervalo_fim), fecha:time(row.fecha), fecha_dia_seguinte:false, ordem:2, ativo:true }]
        : [];
      return [first, ...second];
    });
  }

  function periodsForDay(day) {
    return state.periods.filter(item => Number(item.dia_semana) === day && item.ativo !== false)
      .sort((a, b) => Number(a.ordem) - Number(b.ordem));
  }

  function periodRow(day, item = {}) {
    return `<div class="opening-period110" data-period-day="${day}">
      <label><span>Abre</span><input data-period-open type="time" value="${safe(time(item.abre) || "08:00")}" required></label>
      <span class="period-separator">até</span>
      <label><span>Fecha</span><input data-period-close type="time" value="${safe(time(item.fecha) || "12:00")}" required></label>
      <label class="period-next-day"><input data-period-next type="checkbox" ${item.fecha_dia_seguinte ? "checked" : ""}><span>dia seguinte</span></label>
      <button class="icon-btn danger" data-period-remove type="button" aria-label="Remover período"><i class="bi bi-trash3"></i></button>
    </div>`;
  }

  function renderPeriods() {
    const host = $("#openingPeriods110");
    if (!host) return;
    host.innerHTML = DAYS.map((label, day) => {
      const periods = periodsForDay(day);
      return `<section class="opening-day110" data-opening-day="${day}"><header><div><strong>${label}</strong><small data-period-count>${periods.length ? `${periods.length} período${periods.length > 1 ? "s" : ""}` : "Fechado"}</small></div><div class="opening-day-actions110"><button class="btn btn-dark btn-small" data-period-copy="${day}" type="button"><i class="bi bi-copy"></i> Copiar</button><button class="btn btn-outline btn-small" data-period-add="${day}" type="button"><i class="bi bi-plus-lg"></i> Período</button></div></header><div class="period-copy110" data-period-copy-panel hidden></div><div class="opening-day-periods110">${periods.map(item => periodRow(day, item)).join("") || `<div class="opening-closed110">Sem atendimento neste dia.</div>`}</div></section>`;
    }).join("");
  }

  function updateDaySummary(daySection) {
    if (!daySection) return;
    const count = daySection.querySelectorAll("[data-period-day]").length;
    const label = daySection.querySelector("[data-period-count]");
    if (label) label.textContent = count ? `${count} período${count > 1 ? "s" : ""}` : "Fechado";
  }

  function openPeriodCopy(day) {
    const section = document.querySelector(`[data-opening-day="${day}"]`);
    const panel = section?.querySelector("[data-period-copy-panel]");
    if (!panel) return;
    if (!panel.hidden) { panel.hidden = true; panel.innerHTML = ""; return; }
    panel.innerHTML = `<strong>Copiar ${DAYS[day].toLowerCase()} para:</strong><div>${DAYS.map((label, index) => index === day ? "" : `<label><input type="checkbox" value="${index}"><span>${label}</span></label>`).join("")}</div><button class="btn btn-primary btn-small" data-period-copy-apply="${day}" type="button">Aplicar cópia</button>`;
    panel.hidden = false;
  }

  function applyPeriodCopy(day, button) {
    const source = document.querySelector(`[data-opening-day="${day}"]`);
    const sourceRows = [...source.querySelectorAll("[data-period-day]")].map(row => ({
      abre:row.querySelector("[data-period-open]").value,
      fecha:row.querySelector("[data-period-close]").value,
      fecha_dia_seguinte:row.querySelector("[data-period-next]").checked
    }));
    const targets = [...button.closest("[data-period-copy-panel]").querySelectorAll("input:checked")].map(input => Number(input.value));
    if (!targets.length) return toast("aviso", "Escolha os dias", "Marque pelo menos um dia para receber estes períodos.");
    targets.forEach(target => {
      const targetSection = document.querySelector(`[data-opening-day="${target}"]`);
      targetSection.querySelector(".opening-day-periods110").innerHTML = sourceRows.map(item => periodRow(target, item)).join("") || `<div class="opening-closed110">Sem atendimento neste dia.</div>`;
      updateDaySummary(targetSection);
    });
    button.closest("[data-period-copy-panel]").hidden = true;
    toast("sucesso", "Horários copiados", "Revise os dias e salve para concluir.");
  }

  async function loadPeriods() {
    if (!$("#openingPeriods110") || !establishment()) return;
    try {
      const result = await api().openingPeriods(establishment().id);
      state.periods = result?.items || [];
    } catch (error) {
      state.periods = fallbackPeriods();
      if (!global.bhBackendPodeUsarFallback?.(error)) toast("aviso", "Horários temporariamente indisponíveis", "Mostramos a configuração atual. Tente salvar novamente quando a conexão voltar.");
    }
    renderPeriods();
  }

  function collectPeriods() {
    const periods = [];
    DAYS.forEach((_label, day) => {
      const rows = [...document.querySelectorAll(`[data-opening-day="${day}"] [data-period-day]`)];
      rows.forEach((row, index) => {
        const abre = row.querySelector("[data-period-open]").value;
        const fecha = row.querySelector("[data-period-close]").value;
        const overnight = row.querySelector("[data-period-next]").checked;
        if (!abre || !fecha) throw new Error(`Revise os horários de ${DAYS[day]}.`);
        if (!overnight && abre >= fecha) throw new Error(`Em ${DAYS[day]}, o fechamento precisa ser depois da abertura ou marcado para o dia seguinte.`);
        periods.push({ dia_semana:day, abre, fecha, fecha_dia_seguinte:overnight, ordem:index + 1, ativo:true });
      });
      const sorted = periods.filter(item => item.dia_semana === day && !item.fecha_dia_seguinte).sort((a, b) => a.abre.localeCompare(b.abre));
      sorted.forEach((item, index) => {
        const previous = sorted[index - 1];
        if (previous && item.abre < previous.fecha) throw new Error(`Existem períodos sobrepostos em ${DAYS[day]}.`);
      });
    });
    return periods;
  }

  async function saveOpeningPeriods(form) {
    const button = form.querySelector("button[type='submit']");
    global.bhSetButtonLoading?.(button, true, "Salvando...");
    try {
      const periods = collectPeriods();
      const result = await api().replaceOpeningPeriods(establishment().id, periods);
      state.periods = result?.items || periods;
      renderPeriods();
      toast("sucesso", "Horários atualizados", "Agenda, status automático e página pública já usam os períodos reais.");
      await global.bhRecarregarPainel?.();
    } catch (error) {
      toast("erro", "Não foi possível salvar", errorMessage(error));
    } finally { global.bhSetButtonLoading?.(button, false); }
  }

  function professionalOptions() {
    return (establishment()?.barbeiros || []).filter(item => item.ativo).map(item => `<option value="${safe(item.id)}">${safe(item.nome)}</option>`).join("");
  }

  function serviceOptions() {
    return (establishment()?.servicos || []).filter(item => item.ativo).map(item => `<option value="${safe(item.id)}" data-price="${Number(item.preco || 0)}">${safe(item.nome)} · ${safe(global.bhMoeda?.(item.preco) || item.preco)}</option>`).join("");
  }

  function localDateTime() {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  function openComposer(kind) {
    const host = $("#operation110Composer");
    if (!host) return;
    host.hidden = false;
    const close = `<button class="icon-btn" data-operation110-close type="button" aria-label="Fechar"><i class="bi bi-x-lg"></i></button>`;
    if (kind === "manual-service") host.innerHTML = `<div class="composer-header"><div><strong>Registrar atendimento já realizado</strong><small>Para balcão, telefone ou WhatsApp. A receita entra no financeiro uma única vez.</small></div>${close}</div><form class="composer-grid" id="formManualService110"><label class="campo span-2"><span>Profissional</span><select name="profissional_id" required><option value="">Selecione</option>${professionalOptions()}</select></label><label class="campo span-2"><span>Serviço</span><select name="servico_id" required><option value="">Selecione</option>${serviceOptions()}<option value="custom">Outro serviço</option></select></label><label class="campo" data-custom-service hidden><span>Nome do serviço</span><input name="servico_nome" minlength="2" maxlength="140"></label><label class="campo" data-custom-duration hidden><span>Duração</span><input name="duracao_min" type="number" min="5" max="480" step="5" value="30"></label><label class="campo span-2"><span>Cliente (opcional)</span><input name="cliente_nome" maxlength="140" placeholder="Nome para o histórico"></label><label class="campo"><span>Telefone</span><input name="cliente_telefone" inputmode="tel"></label><label class="campo"><span>Origem</span><select name="canal_origem"><option value="balcao">Balcão</option><option value="whatsapp">WhatsApp</option><option value="telefone">Telefone</option><option value="outro">Outro</option></select></label><label class="campo span-2"><span>Data e hora</span><input name="inicio" type="datetime-local" value="${localDateTime()}" required></label><label class="campo"><span>Valor recebido</span><input name="valor" type="number" min="0" max="1000000" step="0.01" required></label><label class="campo"><span>Pagamento</span><select name="forma_pagamento"><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="credito">Crédito</option><option value="debito">Débito</option><option value="outro">Outro</option></select></label><label class="campo span-4"><span>Observação</span><textarea name="observacao" maxlength="800"></textarea></label><div class="composer-actions"><button class="btn btn-dark" data-operation110-close type="button">Cancelar</button><button class="btn btn-primary" type="submit"><i class="bi bi-check2-circle"></i> Registrar atendimento</button></div></form>`;
    if (kind === "expense") host.innerHTML = `<div class="composer-header"><div><strong>Registrar gasto</strong><small>Inclua uma saída real para enxergar o resultado estimado do período.</small></div>${close}</div><form class="composer-grid" id="formExpense110"><label class="campo"><span>Data</span><input name="competencia" type="date" value="${today()}" required></label><label class="campo"><span>Valor</span><input name="valor" type="number" min="0.01" max="1000000" step="0.01" required></label><label class="campo"><span>Categoria</span><input name="categoria" minlength="2" maxlength="80" placeholder="Ex.: materiais" required></label><label class="campo"><span>Pagamento</span><select name="forma_pagamento"><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="credito">Crédito</option><option value="debito">Débito</option><option value="boleto">Boleto</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select></label><label class="campo span-4"><span>Descrição</span><input name="descricao" minlength="2" maxlength="180" required></label><label class="campo span-4"><span>Observação</span><textarea name="observacao" maxlength="500"></textarea></label><div class="composer-actions"><button class="btn btn-dark" data-operation110-close type="button">Cancelar</button><button class="btn btn-primary" type="submit"><i class="bi bi-receipt"></i> Registrar gasto</button></div></form>`;
    host.scrollIntoView({ behavior:"smooth", block:"nearest" });
  }

  async function submitOperation(form) {
    const data = new FormData(form);
    const button = form.querySelector("button[type='submit']");
    global.bhSetButtonLoading?.(button, true, "Registrando...");
    try {
      if (form.id === "formManualService110") {
        const custom = data.get("servico_id") === "custom";
        await api().createManualService({ estabelecimento_id:establishment().id, profissional_id:data.get("profissional_id"), servico_id:custom ? null : data.get("servico_id"), servico_nome:custom ? data.get("servico_nome") : null, duracao_min:custom ? Number(data.get("duracao_min")) : null, cliente_id:null, cliente_nome:data.get("cliente_nome") || null, cliente_email:null, cliente_telefone:data.get("cliente_telefone") || null, inicio:new Date(data.get("inicio")).toISOString(), valor:Number(data.get("valor")), forma_pagamento:data.get("forma_pagamento"), canal_origem:data.get("canal_origem"), observacao:data.get("observacao") || null, chave_idempotencia:key("manual"), concluir:true });
        toast("sucesso", "Atendimento registrado", "Agenda e financeiro foram atualizados juntos.");
      }
      if (form.id === "formExpense110") {
        await api().createExpense({ estabelecimento_id:establishment().id, competencia:data.get("competencia"), valor:Number(data.get("valor")), categoria:data.get("categoria"), descricao:data.get("descricao"), forma_pagamento:data.get("forma_pagamento"), observacao:data.get("observacao") || null, chave_idempotencia:key("expense") });
        toast("sucesso", "Gasto registrado", "O resultado estimado agora considera esta saída.");
      }
      form.closest(".operation-composer").hidden = true;
      form.closest(".operation-composer").innerHTML = "";
      await global.bhRecarregarPainel?.();
      global.bhOperacao19?.refreshVisible?.();
    } catch (error) { toast("erro", "Não foi possível registrar", errorMessage(error)); }
    finally { global.bhSetButtonLoading?.(button, false); }
  }

  function bytesToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary);
  }

  async function previewImport(form) {
    const data = new FormData(form);
    const file = data.get("arquivo");
    if (!(file instanceof File) || !file.size) return;
    if (file.size > 4_000_000) return toast("erro", "Arquivo muito grande", "Use um arquivo de até 4 MB.");
    const button = form.querySelector("button[type='submit']");
    const host = $("#importPreview110");
    global.bhSetButtonLoading?.(button, true, "Conferindo...");
    host.innerHTML = `<div class="operation-state loading"><span class="state-spinner"></span><strong>Analisando sem gravar</strong></div>`;
    try {
      const result = await api().previewImport({ estabelecimento_id:establishment().id, tipo:data.get("tipo"), arquivo_nome:file.name, conteudo_base64:bytesToBase64(await file.arrayBuffer()) });
      state.importId = result.id;
      const samples = result.amostra || [];
      host.innerHTML = `<div class="import-summary110"><span><strong>${Number(result.validas || 0)}</strong> válidas</span><span><strong>${Number(result.rejeitadas || 0)}</strong> rejeitadas</span><span><strong>${Number(result.total || 0)}</strong> total</span></div>${samples.length ? `<div class="import-samples110">${samples.slice(0, 8).map(item => `<article class="${item.status === "rejeitada" ? "invalid" : ""}"><strong>Linha ${Number(item.numero_linha || item.linha || 0)}</strong><span>${safe(Object.values(item.dados || {}).filter(Boolean).slice(0, 3).join(" · "))}</span>${item.erros?.length ? `<small>${safe(item.erros.join(" "))}</small>` : ""}</article>`).join("")}</div>` : ""}<p>Nada foi gravado ainda. Registros repetidos serão ignorados e os existentes não serão sobrescritos.</p><button class="btn btn-primary" data-import-commit110 type="button" ${Number(result.validas || 0) ? "" : "disabled"}><i class="bi bi-check2"></i> Confirmar importação</button>`;
    } catch (error) { host.innerHTML = errorState("Não foi possível ler o arquivo", errorMessage(error)); }
    finally { global.bhSetButtonLoading?.(button, false); }
  }

  async function commitImport(button) {
    if (!state.importId) return;
    global.bhSetButtonLoading?.(button, true, "Importando...");
    try {
      const result = await api().commitImport(state.importId);
      toast("sucesso", "Importação concluída", `${Number(result.importadas || 0)} registros adicionados e ${Number(result.ignoradas || 0)} ignorados.`);
      $("#importPreview110").innerHTML = `<div class="operation-state success"><i class="bi bi-check2-circle"></i><strong>Importação concluída</strong><small>O relatório ficou salvo no histórico.</small></div>`;
      state.importId = null;
      await loadImports(true);
    } catch (error) { toast("erro", "Importação não concluída", errorMessage(error)); }
    finally { global.bhSetButtonLoading?.(button, false); }
  }

  function importStatus(item) {
    const labels = { previa:"Aguardando confirmação", processando:"Processando", concluida:"Concluída", falhou:"Falhou", cancelada:"Cancelada" };
    return labels[item.status] || item.status || "Registrada";
  }

  async function loadImports(reset = true) {
    const host = $("#importHistory110");
    if (!host || !establishment()) return;
    if (reset) { state.importOffset = 0; host.innerHTML = `<div class="operation-state loading compact"><span class="state-spinner"></span><strong>Carregando histórico</strong></div>`; }
    try {
      const result = await api().listImports({ establishmentId:establishment().id, offset:state.importOffset, limit:10 });
      const items = result.items || [];
      const html = items.map(item => `<article><span class="audit110-icon"><i class="bi bi-file-earmark-check"></i></span><span><strong>${safe(item.arquivo_nome)}</strong><small>${safe(item.tipo === "clientes" ? "Clientes" : "Serviços")} · ${safe(importStatus(item))} · ${Number(item.importadas || 0)} adicionados · ${Number(item.ignoradas || 0)} ignorados</small></span><time>${safe(new Date(item.created_at).toLocaleDateString("pt-BR"))}</time></article>`).join("");
      host.innerHTML = reset ? (html || `<div class="operation-state compact"><i class="bi bi-inbox"></i><strong>Nenhuma importação</strong><small>Os relatórios aparecerão aqui.</small></div>`) : host.innerHTML + html;
      state.importOffset += items.length;
      state.importHasMore = Boolean(result.has_more);
      $("#importMore110").hidden = !state.importHasMore;
    } catch (error) { host.innerHTML = errorState("Histórico indisponível", errorMessage(error), "data-import-retry110"); }
  }

  function base64Key(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
  }

  function renderPush(preferences, config) {
    const host = $("#pushPreferences110");
    if (!host) return;
    const choices = [["agendamentos", "Novos agendamentos"], ["confirmacoes", "Confirmações"], ["cancelamentos", "Cancelamentos"], ["lembretes", "Lembretes"], ["lista_espera", "Lista de espera"], ["oportunidades", "Oportunidades"], ["campanhas", "Campanhas"]];
    host.innerHTML = `<form id="formPushPreferences110" class="push-preferences110">${choices.map(([name, label]) => `<label><input name="${name}" type="checkbox" ${preferences?.[name] !== false ? "checked" : ""}><span>${label}</span></label>`).join("")}<fieldset class="quiet-hours110"><legend>Não interromper</legend><label><span>Das</span><input name="horario_silencioso_inicio" type="time" value="${safe(time(preferences?.horario_silencioso_inicio))}"></label><label><span>Até</span><input name="horario_silencioso_fim" type="time" value="${safe(time(preferences?.horario_silencioso_fim))}"></label><small>Deixe os dois horários vazios para receber avisos a qualquer hora.</small></fieldset><button class="btn btn-outline" type="submit">Salvar preferências</button></form><button class="btn btn-primary" data-push-enable110 type="button" ${config?.supported ? "" : "disabled"}><i class="bi bi-bell"></i> Ativar avisos neste dispositivo</button><small>${config?.supported ? "O navegador pedirá sua autorização." : "As preferências internas já funcionam. O envio ao dispositivo será liberado após configurar o serviço de entrega."}</small>`;
  }

  async function loadPush() {
    if (!$("#pushPreferences110") || !establishment()) return;
    try {
      const [preferences, config] = await Promise.all([api().pushPreferences(establishment().id), api().pushConfig()]);
      renderPush(preferences, config);
      $("#pushPreferences110").dataset.vapid = config.vapid_public_key || "";
    } catch (error) { $("#pushPreferences110").innerHTML = errorState("Preferências indisponíveis", errorMessage(error), "data-push-retry110"); }
  }

  async function enablePush(button) {
    const vapid = $("#pushPreferences110")?.dataset.vapid;
    if (!vapid || !("serviceWorker" in navigator) || !("PushManager" in global)) return toast("aviso", "Avisos indisponíveis", "Este navegador ou ambiente ainda não permite avisos no dispositivo.");
    global.bhSetButtonLoading?.(button, true, "Ativando...");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("A permissão não foi concedida no navegador.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:base64Key(vapid) });
      const json = subscription.toJSON();
      await api().subscribePush({ estabelecimento_id:establishment().id, endpoint:json.endpoint, p256dh:json.keys.p256dh, auth:json.keys.auth, expiracao:subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null, user_agent:navigator.userAgent.slice(0, 500) });
      toast("sucesso", "Avisos ativados", "Este dispositivo poderá receber os alertas escolhidos.");
    } catch (error) { toast("erro", "Não foi possível ativar", errorMessage(error)); }
    finally { global.bhSetButtonLoading?.(button, false); }
  }

  async function savePushPreferences(form) {
    const data = new FormData(form);
    const button = form.querySelector("button[type='submit']");
    global.bhSetButtonLoading?.(button, true, "Salvando...");
    try {
      const payload = { estabelecimento_id:establishment().id };
      ["agendamentos", "confirmacoes", "cancelamentos", "lembretes", "lista_espera", "oportunidades", "campanhas"].forEach(name => { payload[name] = data.get(name) === "on"; });
      const quietStart = data.get("horario_silencioso_inicio") || null;
      const quietEnd = data.get("horario_silencioso_fim") || null;
      if (Boolean(quietStart) !== Boolean(quietEnd)) throw new Error("Informe o início e o fim do período sem interrupções.");
      payload.horario_silencioso_inicio = quietStart;
      payload.horario_silencioso_fim = quietEnd;
      await api().updatePushPreferences(payload);
      toast("sucesso", "Preferências salvas", "Você pode mudar essas escolhas quando quiser.");
    } catch (error) { toast("erro", "Não foi possível salvar", errorMessage(error)); }
    finally { global.bhSetButtonLoading?.(button, false); }
  }

  function auditLabel(item) {
    const action = ({ INSERT:"criou", UPDATE:"alterou", DELETE:"removeu" })[item.acao] || String(item.acao || "alterou").toLowerCase();
    const resource = ({ agenda:"a agenda", financeiro:"o financeiro", horarios:"os horários", fechamento:"o fechamento", importacao:"uma importação", configuracao:"as configurações" })[item.recurso] || item.recurso;
    return `${action} ${resource}`;
  }

  async function loadAudit(reset = true) {
    const host = $("#auditList110");
    if (!host || !establishment()) return;
    if (reset) { state.auditOffset = 0; host.innerHTML = `<div class="operation-state loading"><span class="state-spinner"></span><strong>Carregando histórico</strong></div>`; }
    try {
      const result = await api().operationalAudit({ establishmentId:establishment().id, resource:$("#auditResource110")?.value || "", offset:state.auditOffset, limit:30 });
      const html = (result.items || []).map(item => { const profile = Array.isArray(item.perfis) ? item.perfis[0] : item.perfis; return `<article><span class="audit110-icon"><i class="bi bi-clock-history"></i></span><span><strong>${safe(auditLabel(item))}</strong><small>${safe(profile?.nome || "Ação autorizada")} · ${safe(new Date(item.created_at).toLocaleString("pt-BR"))}${item.motivo ? ` · ${safe(item.motivo)}` : ""}</small></span></article>`; }).join("");
      host.innerHTML = reset ? (html || `<div class="operation-state"><i class="bi bi-check2-circle"></i><strong>Nenhuma alteração neste filtro</strong></div>`) : host.innerHTML + html;
      state.auditOffset += (result.items || []).length;
      state.auditHasMore = Boolean(result.has_more);
      $("#auditMore110").hidden = !state.auditHasMore;
    } catch (error) { host.innerHTML = errorState("Histórico indisponível", errorMessage(error), "data-audit-retry110"); }
  }

  async function loadFeatures() {
    const host = $("#featureStatus110");
    if (!host || !establishment()) return;
    try {
      const result = await api().evaluateFeatures(FEATURE_KEYS, establishment().id);
      host.innerHTML = FEATURE_KEYS.map(item => `<article><i class="bi ${result[item] ? "bi-check2-circle" : "bi-hourglass-split"}"></i><span><strong>${safe(FEATURE_LABELS[item])}</strong><small>${result[item] ? "Disponível para esta conta" : "Liberação controlada"}</small></span></article>`).join("");
    } catch (error) { host.innerHTML = errorState("Disponibilidade não carregada", errorMessage(error)); }
  }

  async function loadCoverLibrary() {
    const host = $("#coverLibrary110");
    if (!host) return;
    host.hidden = false;
    host.innerHTML = `<div class="operation-state loading"><span class="state-spinner"></span><strong>Carregando opções</strong></div>`;
    try {
      const items = await api().coverLibrary();
      host.innerHTML = items.map(item => `<button type="button" data-cover110="${safe(item.url)}" aria-label="Usar ${safe(item.nome)}"><img src="..${safe(item.url)}" alt="${safe(item.texto_alternativo)}"><span><strong>${safe(item.nome)}</strong><small>${safe(item.estilo)}</small></span></button>`).join("");
    } catch (error) { host.innerHTML = errorState("Biblioteca indisponível", errorMessage(error)); }
  }

  async function chooseCover(button) {
    try {
      await api().updateEstablishment(establishment().id, { capa_url:button.dataset.cover110 });
      toast("sucesso", "Capa atualizada", "A imagem já aparece na página pública.");
      $("#coverLibrary110").hidden = true;
      await global.bhRecarregarPainel?.();
    } catch (error) { toast("erro", "Não foi possível trocar a capa", errorMessage(error)); }
  }

  function fillLocation() {
    const form = $("#formLocation110");
    const item = establishment();
    if (!form || !item) return;
    const values = { logradouro:item.endereco, numero:item.numero, complemento:item.complemento, bairro:item.bairro, cidade:item.cidade, estado:item.estado, cep:item.cep, latitude:item.latitude, longitude:item.longitude };
    Object.entries(values).forEach(([name, value]) => { if (form.elements[name]) form.elements[name].value = value ?? ""; });
    updateLocationFeedback();
  }

  function updateLocationFeedback() {
    const form = $("#formLocation110");
    const feedback = $("#locationFeedback110");
    if (!form || !feedback) return;
    feedback.textContent = form.elements.latitude.value && form.elements.longitude.value ? "Posição definida. A busca por proximidade e a rota ficarão disponíveis." : "Endereço salvo sem posição exata; a busca por cidade e bairro continua funcionando.";
  }

  function useCurrentLocation(button) {
    if (!navigator.geolocation) return toast("aviso", "Localização indisponível", "Este navegador não oferece localização.");
    global.bhSetButtonLoading?.(button, true, "Localizando...");
    navigator.geolocation.getCurrentPosition(position => {
      const form = $("#formLocation110");
      form.elements.latitude.value = position.coords.latitude.toFixed(6);
      form.elements.longitude.value = position.coords.longitude.toFixed(6);
      updateLocationFeedback();
      global.bhSetButtonLoading?.(button, false);
    }, error => { toast("erro", "Posição não obtida", error.message); global.bhSetButtonLoading?.(button, false); }, { enableHighAccuracy:true, timeout:10_000, maximumAge:60_000 });
  }

  async function saveLocation(form) {
    const data = new FormData(form);
    const button = form.querySelector("button[type='submit']");
    global.bhSetButtonLoading?.(button, true, "Salvando...");
    try {
      await api().updateEstablishmentLocation(establishment().id, { logradouro:data.get("logradouro"), numero:data.get("numero") || null, complemento:data.get("complemento") || null, bairro:data.get("bairro"), cidade:data.get("cidade"), estado:String(data.get("estado")).toUpperCase(), cep:data.get("cep"), pais:"BR", latitude:data.get("latitude") ? Number(data.get("latitude")) : null, longitude:data.get("longitude") ? Number(data.get("longitude")) : null, precisao_localizacao:data.get("latitude") ? "manual" : "endereco", codigo_municipio_ibge:null, raio_atendimento_km:null });
      toast("sucesso", "Localização atualizada", "Clientes já podem encontrar o estabelecimento pela região.");
      await global.bhRecarregarPainel?.();
    } catch (error) { toast("erro", "Não foi possível salvar", errorMessage(error)); }
    finally { global.bhSetButtonLoading?.(button, false); }
  }

  function bind() {
    document.addEventListener("click", event => {
      const target = event.target.closest("[data-operation110],[data-operation110-close],[data-period-add],[data-period-remove],[data-period-copy],[data-period-copy-apply],[data-import-commit110],[data-import-retry110],[data-push-enable110],[data-push-retry110],[data-audit-retry110],[data-cover110]");
      if (!target) return;
      if (target.dataset.operation110) openComposer(target.dataset.operation110);
      if (target.dataset.operation110Close !== undefined) { const host = target.closest(".operation-composer"); host.hidden = true; host.innerHTML = ""; }
      if (target.dataset.periodAdd !== undefined) {
        const day = Number(target.dataset.periodAdd); const container = target.closest("[data-opening-day]").querySelector(".opening-day-periods110");
        if (container.querySelectorAll("[data-period-day]").length >= 8) return toast("aviso", "Limite do dia", "Use no máximo oito períodos em um dia.");
        container.querySelector(".opening-closed110")?.remove(); container.insertAdjacentHTML("beforeend", periodRow(day)); updateDaySummary(target.closest("[data-opening-day]"));
      }
      if (target.dataset.periodRemove !== undefined) { const day = target.closest("[data-opening-day]"); target.closest("[data-period-day]").remove(); if (!day.querySelector("[data-period-day]")) day.querySelector(".opening-day-periods110").innerHTML = `<div class="opening-closed110">Sem atendimento neste dia.</div>`; updateDaySummary(day); }
      if (target.dataset.periodCopy !== undefined) openPeriodCopy(Number(target.dataset.periodCopy));
      if (target.dataset.periodCopyApply !== undefined) applyPeriodCopy(Number(target.dataset.periodCopyApply), target);
      if (target.dataset.importCommit110 !== undefined) commitImport(target);
      if (target.dataset.importRetry110 !== undefined) loadImports(true);
      if (target.dataset.pushEnable110 !== undefined) enablePush(target);
      if (target.dataset.pushRetry110 !== undefined) loadPush();
      if (target.dataset.auditRetry110 !== undefined) loadAudit(true);
      if (target.dataset.cover110) chooseCover(target);
    });
    document.addEventListener("change", event => {
      if (event.target.matches("#formManualService110 [name='servico_id']")) {
        const form = event.target.form; const custom = event.target.value === "custom";
        form.querySelector("[data-custom-service]").hidden = !custom;
        form.querySelector("[data-custom-duration]").hidden = !custom;
        form.elements.servico_nome.required = custom;
        form.elements.duracao_min.required = custom;
        const option = event.target.selectedOptions[0]; if (!custom && option?.dataset.price) form.elements.valor.value = option.dataset.price;
      }
    });
    document.addEventListener("submit", event => {
      if (["formManualService110", "formExpense110"].includes(event.target.id)) { event.preventDefault(); submitOperation(event.target); }
      if (event.target.id === "formImport110") { event.preventDefault(); previewImport(event.target); }
      if (event.target.id === "formPushPreferences110") { event.preventDefault(); savePushPreferences(event.target); }
      if (event.target.id === "formLocation110") { event.preventDefault(); saveLocation(event.target); }
    });
    $("#openCoverLibrary110")?.addEventListener("click", loadCoverLibrary);
    $("#useCurrentLocation110")?.addEventListener("click", event => useCurrentLocation(event.currentTarget));
    $("#auditRefresh110")?.addEventListener("click", () => loadAudit(true));
    $("#auditResource110")?.addEventListener("change", () => loadAudit(true));
    $("#auditMore110")?.addEventListener("click", () => loadAudit(false));
    $("#importRefresh110")?.addEventListener("click", () => loadImports(true));
    $("#importMore110")?.addEventListener("click", () => loadImports(false));
    document.addEventListener("bh:painel-section-change", event => { if (event.detail?.id === "secFerramentas") Promise.all([loadPush(), loadAudit(true), loadFeatures(), loadImports(true)]); if (event.detail?.id === "secConfig") { loadPeriods(); fillLocation(); } });
    document.addEventListener("bh:painel-context-ready", () => { fillLocation(); if (!state.ready) init(); });
  }

  async function waitForContext() {
    for (let attempt = 0; attempt < 150; attempt += 1) { if (establishment() && api()) return true; await new Promise(resolve => setTimeout(resolve, 100)); }
    return false;
  }

  async function init() {
    if (state.ready || state.loading) return;
    state.loading = true;
    if (!await waitForContext()) { state.loading = false; return; }
    state.ready = true; state.loading = false;
    fillLocation();
    await loadPeriods();
    if ($(".panel-section.ativo")?.id === "secFerramentas") await Promise.all([loadPush(), loadAudit(true), loadFeatures(), loadImports(true)]);
  }

  global.bhOperacao110 = { init, loadPeriods, saveOpeningPeriods, loadAudit, loadPush, loadImports };
  document.addEventListener("DOMContentLoaded", () => { bind(); init(); });
})(window);
