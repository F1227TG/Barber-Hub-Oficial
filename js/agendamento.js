/**
 * agendamento.js
 * Fluxo público de escolha de serviço, profissional, data e horário.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

let bhAgendaEstabelecimentos = [];
let bhAgendaAtual = null;
let bhSlotSelecionado = null;

function bhPreencherSelect(select, itens, getValor, getTexto, placeholder) {
  select.innerHTML = `<option value="">${escapeHTML(placeholder)}</option>` + itens.map(item => `<option value="${escapeHTML(getValor(item))}">${escapeHTML(getTexto(item))}</option>`).join("");
}

function bhRenderStatusAgenda() {
  const box = document.getElementById("statusBarbearia");
  if (!bhAgendaAtual) {
    box.innerHTML = `<div class="card"><div class="card-body"><h3>Escolha um estabelecimento</h3><p class="texto-section">O status e as regras de atendimento aparecerão aqui.</p></div></div>`;
    return;
  }
  const status = bhCalcularStatus(bhAgendaAtual);
  box.innerHTML = `<div class="card"><div class="card-body"><div class="card-meta">${bhRenderStatus(bhAgendaAtual)}</div><h3>${escapeHTML(bhAgendaAtual.nome)}</h3><p class="texto-section">${escapeHTML(status.detalhe)}</p><p class="badge">${bhAgendaAtual.aceitaAgendamento ? "Aceita agendamento online" : "Agenda online desativada"}</p></div></div>`;
}

async function bhRenderSlots() {
  const container = document.getElementById("slots");
  const profissionalId = document.getElementById("barbeiro").value;
  const servicoId = document.getElementById("servico").value;
  const data = document.getElementById("data").value;
  bhSlotSelecionado = null;
  if (!bhAgendaAtual || !profissionalId || !servicoId || !data) {
    container.innerHTML = `<p class="texto-section">Selecione serviço, profissional e data.</p>`;
    return;
  }
  const servico = bhAgendaAtual.servicos.find(item => item.id === servicoId);
  try {
    container.innerHTML = `<div class="loading-inline"><i class="bi bi-arrow-repeat spin"></i> Consultando agenda...</div>`;
    const ocupados = await bhObterHorariosOcupados(profissionalId, data);
    const slots = bhSlotsComDisponibilidade(bhAgendaAtual, data, servico?.duracao_min || 30, ocupados);
    if (!slots.length) {
      container.innerHTML = `<div class="empty compact"><strong>Nenhum horário disponível nesta data.</strong><p>Tente outro dia ou confira o funcionamento.</p></div>`;
      document.getElementById("iaAgendamento").innerHTML = `<div class="recommend-card"><h3>Agenda inteligente</h3><p>Escolha outra data para receber uma nova sugestão.</p></div>`;
      return;
    }
    container.innerHTML = `<div class="slot-grid">${slots.map(item => `<button type="button" class="slot ${item.disponivel ? "" : "ocupado"}" data-slot="${item.horario}" ${item.disponivel ? "" : "disabled"}>${item.horario}</button>`).join("")}</div>`;
    container.querySelectorAll("[data-slot]").forEach(botao => botao.addEventListener("click", () => {
      container.querySelectorAll(".slot").forEach(item => item.classList.remove("ativo"));
      botao.classList.add("ativo");
      bhSlotSelecionado = botao.dataset.slot;
    }));
    const sugestao = bhSugerirHorario(slots);
    document.getElementById("iaAgendamento").innerHTML = `<div class="recommend-card"><h3><i class="bi bi-stars"></i> Sugestão inteligente</h3><p>${sugestao ? `O horário <strong>${sugestao.horario}</strong> está livre e costuma ser uma boa opção.` : "Os horários desta data já estão ocupados."}</p></div>`;
  } catch (erro) {
    container.innerHTML = `<div class="empty compact">${escapeHTML(bhErroMensagem(erro))}</div>`;
  }
}

function bhAtualizarEstabelecimentoAgenda() {
  const id = document.getElementById("barbearia").value;
  bhAgendaAtual = bhAgendaEstabelecimentos.find(item => item.id === id) || null;
  const servicos = bhAgendaAtual?.servicos.filter(item => item.ativo && item.publico) || [];
  const profissionais = bhAgendaAtual?.barbeiros.filter(item => item.ativo && item.aceitaAgendamento) || [];
  bhPreencherSelect(document.getElementById("servico"), servicos, item => item.id, item => `${item.nome} — ${bhMoeda(item.preco)} — ${item.duracao_min} min`, "Escolha um serviço");
  bhPreencherSelect(document.getElementById("barbeiro"), profissionais, item => item.id, item => item.nome, "Escolha um profissional");
  bhRenderStatusAgenda();
  bhRenderSlots();
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("agendamento");
  const form = document.getElementById("formAgendamento");
  const dataCampo = document.getElementById("data");
  dataCampo.min = bhHojeISO();

  try {
    const perfil = bhSupabasePronto() ? await bhGetPerfil() : null;
    if (perfil) {
      document.getElementById("nome").value = perfil.nome || "";
      document.getElementById("telefone").value = perfil.telefone || "";
      document.getElementById("email").value = perfil.email || "";
    }
    bhAgendaEstabelecimentos = (await bhListarEstabelecimentos()).filter(item => item.aceitaAgendamento);
    bhPreencherSelect(document.getElementById("barbearia"), bhAgendaEstabelecimentos, item => item.id, item => `${item.nome} — ${item.bairro}, ${item.cidade}`, "Escolha um estabelecimento");
    const parametro = bhQueryParam("barbearia");
    if (parametro && bhAgendaEstabelecimentos.some(item => item.id === parametro)) {
      document.getElementById("barbearia").value = parametro;
    }
    bhAtualizarEstabelecimentoAgenda();
    const servicoParametro = bhQueryParam("servico");
    const profissionalParametro = bhQueryParam("profissional");
    if (servicoParametro && [...document.getElementById("servico").options].some(item => item.value === servicoParametro)) document.getElementById("servico").value = servicoParametro;
    if (profissionalParametro && [...document.getElementById("barbeiro").options].some(item => item.value === profissionalParametro)) document.getElementById("barbeiro").value = profissionalParametro;
    if (servicoParametro || profissionalParametro) bhRenderSlots();
  } catch (erro) {
    mostrarToast("erro", "Falha ao carregar agenda", bhErroMensagem(erro));
  }

  document.getElementById("barbearia").addEventListener("change", bhAtualizarEstabelecimentoAgenda);
  ["servico", "barbeiro", "data"].forEach(id => document.getElementById(id).addEventListener("change", bhRenderSlots));
  const telefone = document.getElementById("telefone");
  telefone.addEventListener("input", () => { telefone.value = bhMascaraTelefone(telefone.value); });

  form.addEventListener("submit", async evento => {
    evento.preventDefault();
    const perfil = await bhGetPerfil();
    if (!perfil) {
      mostrarToast("aviso", "Login necessário", "Crie uma conta ou entre para confirmar o agendamento.");
      const next = encodeURIComponent(`${location.pathname}${location.search}`);
      setTimeout(() => { location.href = `login.html?next=${next}`; }, 800);
      return;
    }
    const estabelecimentoId = document.getElementById("barbearia").value;
    const servicoId = document.getElementById("servico").value;
    const profissionalId = document.getElementById("barbeiro").value;
    const data = dataCampo.value;
    if (!estabelecimentoId || !servicoId || !profissionalId || !data || !bhSlotSelecionado) {
      mostrarToast("erro", "Agendamento incompleto", "Escolha estabelecimento, serviço, profissional, data e horário.");
      return;
    }
    const botao = form.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Confirmando...");
    try {
      await bhCriarAgendamento({
        estabelecimentoId,
        servicoId,
        profissionalId,
        data,
        hora: bhSlotSelecionado,
        observacao: document.getElementById("observacao").value.trim()
      });
      mostrarToast("sucesso", "Agendamento enviado", "O estabelecimento poderá confirmar o atendimento pelo painel.");
      setTimeout(() => { location.href = "cliente.html"; }, 800);
    } catch (erro) {
      mostrarToast("erro", "Não foi possível agendar", bhErroMensagem(erro));
      await bhRenderSlots();
    } finally {
      bhSetButtonLoading(botao, false);
    }
  });
});
