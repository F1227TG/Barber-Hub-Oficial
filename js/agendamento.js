/**
 * agendamento.js
 * --------------------------------------------------------------------------
 * Fluxo objetivo de reserva:
 * estabelecimento → múltiplos serviços → profissional → data/hora → confirmar.
 *
 * Os dados pessoais não são repetidos na tela: a API usa a conta autenticada.
 * A duração e o valor são somados antes da consulta de horários.
 * --------------------------------------------------------------------------
 */

let bhAgendaEstabelecimentos = [];
let bhAgendaAtual = null;
let bhSlotSelecionado = null;
let bhAgendaPerfil = null;
const bhAgendaServicosSelecionados = new Set();

function bhPreencherSelect(select, itens, getValor, getTexto, placeholder) {
  select.innerHTML = `<option value="">${escapeHTML(placeholder)}</option>` + itens
    .map(item => `<option value="${escapeHTML(getValor(item))}">${escapeHTML(getTexto(item))}</option>`)
    .join("");
}

function bhServicosSelecionadosAgenda() {
  if (!bhAgendaAtual) return [];
  return bhAgendaAtual.servicos.filter(item => bhAgendaServicosSelecionados.has(item.id));
}

function bhTotaisAgenda() {
  return bhServicosSelecionadosAgenda().reduce((total, item) => ({
    duracao: total.duracao + Number(item.duracao_min || 0),
    valor: total.valor + Number(item.preco || 0)
  }), { duracao: 0, valor: 0 });
}

function bhRenderStatusAgenda() {
  const box = document.getElementById("statusBarbearia");
  if (!bhAgendaAtual) {
    box.innerHTML = "";
    return;
  }
  const status = bhCalcularStatus(bhAgendaAtual);
  box.innerHTML = `
    <div class="booking-business-inline">
      <div>
        <strong>${escapeHTML(bhAgendaAtual.nome)}</strong>
        <span>${escapeHTML([bhAgendaAtual.bairro, bhAgendaAtual.cidade].filter(Boolean).join(", "))}</span>
      </div>
      <span class="status ${escapeHTML(status.classe)}">${escapeHTML(status.texto)}</span>
    </div>`;
}

function bhRenderServicosAgenda() {
  const container = document.getElementById("servicosSelecao");
  const servicos = bhAgendaAtual?.servicos.filter(item => item.ativo && item.publico) || [];
  if (!bhAgendaAtual) {
    container.innerHTML = `<div class="empty compact">Escolha um estabelecimento para ver os serviços.</div>`;
    return;
  }
  if (!servicos.length) {
    container.innerHTML = `<div class="empty compact"><strong>Nenhum serviço disponível.</strong><p>Este estabelecimento ainda não publicou o catálogo.</p></div>`;
    return;
  }
  container.innerHTML = servicos.map(item => {
    const ativo = bhAgendaServicosSelecionados.has(item.id);
    return `
      <button class="booking-service-option${ativo ? " ativo" : ""}" type="button"
        data-service-id="${item.id}" aria-pressed="${ativo}">
        <span class="booking-service-check"><i class="bi ${ativo ? "bi-check-lg" : "bi-plus-lg"}"></i></span>
        <span class="booking-service-copy">
          <strong>${escapeHTML(item.nome)}</strong>
          <small>${escapeHTML(item.descricao || item.categoria || "Serviço")}</small>
          <span>${Number(item.duracao_min || 0)} min</span>
        </span>
        <b>${bhMoeda(item.preco)}</b>
      </button>`;
  }).join("");

  container.querySelectorAll("[data-service-id]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.serviceId;
      if (bhAgendaServicosSelecionados.has(id)) bhAgendaServicosSelecionados.delete(id);
      else bhAgendaServicosSelecionados.add(id);
      bhSlotSelecionado = null;
      bhRenderServicosAgenda();
      bhRenderResumoAgenda();
      bhRenderSlots();
    });
  });
}

function bhRenderResumoAgenda() {
  const itens = bhServicosSelecionadosAgenda();
  const totais = bhTotaisAgenda();
  const container = document.getElementById("resumoServicosAgenda");
  container.innerHTML = itens.length
    ? itens.map(item => `<div><span>${escapeHTML(item.nome)}</span><strong>${bhMoeda(item.preco)}</strong></div>`).join("")
    : `<p>Nenhum serviço selecionado.</p>`;
  document.getElementById("resumoDuracaoAgenda").textContent = totais.duracao ? `${totais.duracao} min` : "—";
  document.getElementById("resumoValorAgenda").textContent = itens.length ? bhMoeda(totais.valor) : "—";
  document.getElementById("resumoHorarioAgenda").textContent = bhSlotSelecionado || "—";
}

async function bhRenderSlots() {
  const container = document.getElementById("slots");
  const profissionalId = document.getElementById("barbeiro").value;
  const data = document.getElementById("data").value;
  const servicos = bhServicosSelecionadosAgenda();
  const { duracao } = bhTotaisAgenda();
  bhSlotSelecionado = null;
  bhRenderResumoAgenda();

  if (!bhAgendaAtual || !servicos.length || !profissionalId || !data) {
    container.innerHTML = `<p class="texto-section">Selecione serviços, profissional e data.</p>`;
    return;
  }

  try {
    container.innerHTML = `<div class="loading-inline"><i class="bi bi-arrow-repeat spin"></i> Consultando agenda...</div>`;
    const ocupados = await bhObterHorariosOcupados(profissionalId, data);
    const slots = bhSlotsComDisponibilidade(bhAgendaAtual, data, duracao || 30, ocupados);
    if (!slots.length) {
      container.innerHTML = `<div class="empty compact"><strong>Nenhum horário comporta todos os serviços nesta data.</strong><p>Tente outro dia, profissional ou reduza a seleção.</p></div>`;
      document.getElementById("iaAgendamento").innerHTML = `<div class="recommend-card"><h3>Outra possibilidade</h3><p>Escolha uma nova data ou retire um serviço para encontrar mais horários.</p></div>`;
      return;
    }

    container.innerHTML = `<div class="slot-grid">${slots.map(item => `
      <button type="button" class="slot ${item.disponivel ? "" : "ocupado"}"
        data-slot="${item.horario}" ${item.disponivel ? "" : "disabled"}>${item.horario}</button>`).join("")}</div>`;

    container.querySelectorAll("[data-slot]").forEach(button => button.addEventListener("click", () => {
      container.querySelectorAll(".slot").forEach(item => item.classList.remove("ativo"));
      button.classList.add("ativo");
      bhSlotSelecionado = button.dataset.slot;
      bhRenderResumoAgenda();
    }));

    const sugestao = bhSugerirHorario(slots);
    document.getElementById("iaAgendamento").innerHTML = sugestao
      ? `<div class="recommend-card"><h3><i class="bi bi-stars"></i> Horário sugerido</h3><p><strong>${sugestao.horario}</strong> comporta os ${servicos.length} serviço(s) selecionado(s).</p></div>`
      : "";
  } catch (erro) {
    container.innerHTML = `<div class="empty compact">${escapeHTML(bhErroMensagem(erro))}</div>`;
  }
}

function bhAplicarServicosDaUrl() {
  const antigos = bhQueryParam("servico");
  const multiplos = bhQueryParam("servicos");
  const ids = String(multiplos || antigos || "").split(",").map(item => item.trim()).filter(Boolean);
  const permitidos = new Set((bhAgendaAtual?.servicos || []).map(item => item.id));
  ids.filter(id => permitidos.has(id)).forEach(id => bhAgendaServicosSelecionados.add(id));
}

function bhAtualizarEstabelecimentoAgenda({ aplicarUrl = false } = {}) {
  const id = document.getElementById("barbearia").value;
  bhAgendaAtual = bhAgendaEstabelecimentos.find(item => item.id === id) || null;
  bhAgendaServicosSelecionados.clear();
  bhSlotSelecionado = null;
  const profissionais = bhAgendaAtual?.barbeiros.filter(item => item.ativo && item.aceitaAgendamento) || [];
  bhPreencherSelect(document.getElementById("barbeiro"), profissionais, item => item.id, item => item.nome, "Escolha um profissional");
  if (aplicarUrl) bhAplicarServicosDaUrl();
  bhRenderStatusAgenda();
  bhRenderServicosAgenda();
  bhRenderResumoAgenda();
  bhRenderSlots();
}

async function bhConfirmarAgendamento(form) {
  const perfil = await bhGetPerfil();
  if (!perfil) {
    mostrarToast("aviso", "Entre para confirmar", "Seu agendamento está montado. Faça login para finalizar.");
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    setTimeout(() => { location.href = `${bhUrl("html/login.html")}?next=${next}`; }, 700);
    return;
  }

  const estabelecimentoId = document.getElementById("barbearia").value;
  const profissionalId = document.getElementById("barbeiro").value;
  const data = document.getElementById("data").value;
  const servicosIds = [...bhAgendaServicosSelecionados];
  if (!estabelecimentoId || !servicosIds.length || !profissionalId || !data || !bhSlotSelecionado) {
    mostrarToast("erro", "Agendamento incompleto", "Escolha estabelecimento, serviços, profissional, data e horário.");
    return;
  }

  const button = form.querySelector("button[type='submit']");
  bhSetButtonLoading(button, true, "Confirmando...");
  try {
    await bhCriarAgendamento({
      estabelecimentoId,
      profissionalId,
      servicosIds,
      data,
      hora: bhSlotSelecionado,
      observacao: document.getElementById("observacao").value.trim()
    });
    mostrarToast("sucesso", "Agendamento enviado", "O estabelecimento recebeu sua solicitação.");
    setTimeout(() => { location.href = bhUrl("html/cliente.html"); }, 850);
  } catch (erro) {
    mostrarToast("erro", "Não foi possível agendar", bhErroMensagem(erro));
    await bhRenderSlots();
  } finally {
    bhSetButtonLoading(button, false);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("agendamento");
  const form = document.getElementById("formAgendamento");
  const dateField = document.getElementById("data");
  dateField.min = bhHojeISO();

  try {
    bhAgendaPerfil = bhSupabasePronto() ? await bhGetPerfil() : null;
    document.getElementById("bookingLoginNote").hidden = Boolean(bhAgendaPerfil);
    bhAgendaEstabelecimentos = (await bhListarEstabelecimentos()).filter(item => item.aceitaAgendamento);
    bhPreencherSelect(
      document.getElementById("barbearia"),
      bhAgendaEstabelecimentos,
      item => item.id,
      item => `${item.nome} — ${item.bairro}, ${item.cidade}`,
      "Escolha um estabelecimento"
    );

    const estabelecimentoParametro = bhQueryParam("barbearia");
    if (estabelecimentoParametro && bhAgendaEstabelecimentos.some(item => item.id === estabelecimentoParametro)) {
      document.getElementById("barbearia").value = estabelecimentoParametro;
    }
    bhAtualizarEstabelecimentoAgenda({ aplicarUrl: true });

    const profissionalParametro = bhQueryParam("profissional");
    if (profissionalParametro && [...document.getElementById("barbeiro").options].some(item => item.value === profissionalParametro)) {
      document.getElementById("barbeiro").value = profissionalParametro;
    }
    if (profissionalParametro) bhRenderSlots();
  } catch (erro) {
    mostrarToast("erro", "Falha ao carregar agenda", bhErroMensagem(erro));
  }

  document.getElementById("barbearia").addEventListener("change", () => bhAtualizarEstabelecimentoAgenda());
  ["barbeiro", "data"].forEach(id => document.getElementById(id).addEventListener("change", bhRenderSlots));
  form.addEventListener("submit", evento => {
    evento.preventDefault();
    bhConfirmarAgendamento(form);
  });
});
