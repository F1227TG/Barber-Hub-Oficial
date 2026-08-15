/**
 * booking-modal.js — Barber Hub 1.6
 * --------------------------------------------------------------------------
 * Agendamento reutilizável em janela modal. Mantém a lógica de negócio fora
 * da página visual: múltiplos serviços, profissional por cartão/radio, data,
 * disponibilidade real e criação pela API Python.
 * --------------------------------------------------------------------------
 */

(function createBookingModal(global) {
  "use strict";

  const state = {
    establishment: null,
    services: new Set(),
    professionalId: null,
    date: "",
    slot: null,
    step: 1,
    trigger: null,
    loading: false
  };

  function ensureModal() {
    let modal = document.getElementById("bookingModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "bookingModal";
    modal.className = "booking-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="booking-modal-backdrop" data-booking-close></div>
      <section class="booking-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="bookingModalTitle">
        <header class="booking-modal-header">
          <div><strong id="bookingModalTitle">Agendar horário</strong><small id="bookingModalBusiness">Barber Hub</small></div>
          <button class="booking-modal-close" type="button" data-booking-close aria-label="Fechar"><i class="bi bi-x-lg"></i></button>
        </header>
        <div class="booking-modal-body">
          <div class="booking-modal-progress" aria-label="Progresso do agendamento">
            <span class="booking-progress-step" data-progress="1"></span><span class="booking-progress-step" data-progress="2"></span><span class="booking-progress-step" data-progress="3"></span><span class="booking-progress-step" data-progress="4"></span>
          </div>
          <section class="booking-modal-panel" data-booking-panel="1"><h3>Escolha os serviços</h3><p>Você pode combinar mais de um serviço no mesmo horário.</p><div class="booking-service-list" id="bookingModalServices"></div></section>
          <section class="booking-modal-panel" data-booking-panel="2"><h3>Quem vai te atender?</h3><p>Escolha um profissional disponível na equipe.</p><div class="booking-professional-list" id="bookingModalProfessionals"></div></section>
          <section class="booking-modal-panel" data-booking-panel="3"><h3>Escolha a data e o horário</h3><p>A duração total dos serviços já é considerada para evitar conflitos.</p><div class="booking-date-row"><div class="campo"><label for="bookingModalDate">Data</label><input id="bookingModalDate" type="date"></div><div class="booking-modal-slots"><label>Horários disponíveis</label><div id="bookingModalSlots"><div class="empty compact">Escolha uma data.</div></div></div></div></section>
          <section class="booking-modal-panel" data-booking-panel="4"><h3>Revise antes de confirmar</h3><p>Se estiver tudo certo, envie a solicitação para o estabelecimento.</p><div class="booking-review" id="bookingModalReview"></div><details class="booking-note" style="margin-top:14px"><summary><i class="bi bi-chat-left-text"></i> Observação <span>Opcional</span></summary><div class="campo"><label for="bookingModalNote">Mensagem para o profissional</label><textarea id="bookingModalNote" maxlength="800" placeholder="Ex.: preferência de acabamento"></textarea></div></details></section>
        </div>
        <footer class="booking-modal-footer">
          <div class="booking-modal-total"><span id="bookingModalDuration">0 min</span><strong id="bookingModalPrice">R$ 0,00</strong></div>
          <div class="booking-modal-nav"><button class="btn btn-outline" type="button" id="bookingModalBack">Voltar</button><button class="btn btn-primary" type="button" id="bookingModalNext">Continuar</button></div>
        </footer>
      </section>`;
    document.body.appendChild(modal);

    modal.querySelectorAll("[data-booking-close]").forEach(item => item.addEventListener("click", close));
    modal.querySelector("#bookingModalBack").addEventListener("click", () => setStep(state.step - 1));
    modal.querySelector("#bookingModalNext").addEventListener("click", next);
    modal.querySelector("#bookingModalDate").addEventListener("change", event => {
      state.date = event.target.value;
      state.slot = null;
      renderSlots();
    });
    modal.addEventListener("click", event => {
      const service = event.target.closest("[data-booking-service]");
      if (service) toggleService(service.dataset.bookingService);
      const slot = event.target.closest("[data-booking-slot]");
      if (slot && !slot.disabled) {
        state.slot = slot.dataset.bookingSlot;
        modal.querySelectorAll("[data-booking-slot]").forEach(item => item.classList.toggle("ativo", item === slot));
        renderFooter();
      }
    });
    modal.addEventListener("change", event => {
      const radio = event.target.closest("input[name='booking-professional']");
      if (radio) {
        state.professionalId = radio.value;
        state.slot = null;
        renderFooter();
      }
    });
    return modal;
  }

  function totals() {
    const selected = (state.establishment?.servicos || []).filter(item => state.services.has(item.id));
    return selected.reduce((acc, item) => ({
      duration: acc.duration + Number(item.duracao_min || 0),
      price: acc.price + Number(item.preco || 0)
    }), { duration: 0, price: 0 });
  }

  function selectedServices() {
    return (state.establishment?.servicos || []).filter(item => state.services.has(item.id));
  }

  function renderFooter() {
    const modal = ensureModal();
    const t = totals();
    modal.querySelector("#bookingModalDuration").textContent = t.duration ? `${t.duration} min` : "0 min";
    modal.querySelector("#bookingModalPrice").textContent = bhMoeda(t.price);
    modal.querySelector("#bookingModalBack").hidden = state.step === 1;
    const nextButton = modal.querySelector("#bookingModalNext");
    nextButton.textContent = state.step === 4 ? "Confirmar agendamento" : "Continuar";
    nextButton.disabled = state.loading || !canContinue();
  }

  function canContinue() {
    if (state.step === 1) return state.services.size > 0;
    if (state.step === 2) return Boolean(state.professionalId);
    if (state.step === 3) return Boolean(state.date && state.slot);
    return true;
  }

  function renderServices() {
    const container = ensureModal().querySelector("#bookingModalServices");
    const items = (state.establishment?.servicos || []).filter(item => item.ativo && item.publico);
    container.innerHTML = items.length ? items.map(item => {
      const active = state.services.has(item.id);
      return `<button class="booking-service-choice${active ? " ativo" : ""}" type="button" data-booking-service="${item.id}" aria-pressed="${active}">
        <span class="booking-choice-indicator"><i class="bi bi-check-lg"></i></span>
        <span><strong>${escapeHTML(item.nome)}</strong><small>${Number(item.duracao_min || 0)} min · ${escapeHTML(item.categoria || "Serviço")}</small></span>
        <b>${bhMoeda(item.preco)}</b>
      </button>`;
    }).join("") : `<div class="empty compact">Nenhum serviço disponível para agendamento.</div>`;
  }

  function toggleService(id) {
    if (state.services.has(id)) state.services.delete(id); else state.services.add(id);
    state.slot = null;
    renderServices();
    renderFooter();
  }

  function renderProfessionals() {
    const container = ensureModal().querySelector("#bookingModalProfessionals");
    const selectedIds = [...state.services];
    const items = (state.establishment?.barbeiros || []).filter(item => {
      if (!item.ativo || !item.aceitaAgendamento) return false;
      // Regra do produto: sem vínculos cadastrados = profissional atende todos os
      // serviços. Quando há vínculos, ele precisa atender TODOS os escolhidos.
      const skills = item.servicosIds || [];
      return !skills.length || selectedIds.every(id => skills.includes(id));
    });
    if (!items.some(item => item.id === state.professionalId)) state.professionalId = null;
    container.innerHTML = items.length ? items.map(item => {
      const initials = item.avatar || item.nome.split(" ").map(part => part[0]).join("").slice(0,2).toUpperCase();
      const avatar = item.avatar_url
        ? `<span class="booking-professional-avatar"><img src="${escapeHTML(item.avatar_url)}" alt="Foto de ${escapeHTML(item.nome)}"></span>`
        : `<span class="booking-professional-avatar">${escapeHTML(initials)}</span>`;
      return `<label class="booking-professional-choice">
        <input type="radio" name="booking-professional" value="${item.id}" ${state.professionalId === item.id ? "checked" : ""}>
        ${avatar}
        <span><strong>${escapeHTML(item.nome)}</strong><small>${escapeHTML(item.especialidade || "Profissional")}</small></span>
        <span class="booking-radio-dot" aria-hidden="true"></span>
      </label>`;
    }).join("") : `<div class="empty compact">Nenhum profissional disponível atende a combinação de serviços escolhida.</div>`;
  }

  async function renderSlots() {
    const container = ensureModal().querySelector("#bookingModalSlots");
    if (!state.date || !state.professionalId || !state.services.size) {
      container.innerHTML = `<div class="empty compact">Escolha data, serviços e profissional.</div>`;
      return;
    }
    container.innerHTML = `<div class="loading-inline"><i class="bi bi-arrow-repeat spin"></i> Consultando agenda...</div>`;
    try {
      const occupied = await bhObterHorariosOcupados(state.professionalId, state.date);
      const slots = bhSlotsComDisponibilidade(state.establishment, state.date, totals().duration || 30, occupied);
      if (!slots.length) {
        container.innerHTML = `<div class="empty compact"><strong>Sem horários nesta data.</strong><p>Tente outro dia ou profissional.</p></div>`;
        state.slot = null;
        renderFooter();
        return;
      }
      container.innerHTML = `<div class="slot-grid">${slots.map(item => `<button type="button" class="slot ${item.disponivel ? "" : "ocupado"}" data-booking-slot="${item.horario}" ${item.disponivel ? "" : "disabled"}>${item.horario}</button>`).join("")}</div>`;
    } catch (error) {
      container.innerHTML = `<div class="empty compact">${escapeHTML(bhErroMensagem(error))}</div>`;
    }
  }

  function renderReview() {
    const professional = (state.establishment?.barbeiros || []).find(item => item.id === state.professionalId);
    const items = selectedServices();
    const container = ensureModal().querySelector("#bookingModalReview");
    container.innerHTML = `
      <div class="booking-review-card"><span>Serviços</span><strong>${escapeHTML(items.map(item => item.nome).join(" + "))}</strong></div>
      <div class="booking-review-card"><span>Profissional</span><strong>${escapeHTML(professional?.nome || "—")}</strong></div>
      <div class="booking-review-card"><span>Data e horário</span><strong>${escapeHTML(state.date ? `${bhFormatarData(state.date)} às ${state.slot}` : "—")}</strong></div>
      <div class="booking-review-card"><span>Total estimado</span><strong>${totals().duration} min · ${bhMoeda(totals().price)}</strong></div>`;
  }

  function setStep(step) {
    state.step = Math.min(Math.max(step, 1), 4);
    const modal = ensureModal();
    modal.querySelectorAll("[data-booking-panel]").forEach(panel => panel.classList.toggle("ativo", Number(panel.dataset.bookingPanel) === state.step));
    modal.querySelectorAll("[data-progress]").forEach(progress => progress.classList.toggle("ativo", Number(progress.dataset.progress) <= state.step));
    if (state.step === 2) renderProfessionals();
    if (state.step === 3) {
      const date = modal.querySelector("#bookingModalDate");
      date.min = bhHojeISO();
      if (state.date) date.value = state.date;
      renderSlots();
    }
    if (state.step === 4) renderReview();
    renderFooter();
  }

  async function next() {
    if (!canContinue() || state.loading) return;
    if (state.step < 4) { setStep(state.step + 1); return; }
    await confirm();
  }

  async function confirm() {
    const profile = await bhGetPerfil();
    if (!profile) {
      mostrarToast("aviso", "Entre para confirmar", "Os serviços e o profissional escolhidos serão mantidos após o login.");
      const params = new URLSearchParams(location.search);
      params.set("id", state.establishment.id);
      params.set("agendar", "1");
      if (state.services.size) params.set("servicos", [...state.services].join(","));
      if (state.professionalId) params.set("profissional", state.professionalId);
      const nextUrl = encodeURIComponent(`${location.pathname}?${params.toString()}`);
      setTimeout(() => { location.href = `${bhUrl("html/login.html")}?next=${nextUrl}`; }, 550);
      return;
    }
    state.loading = true;
    renderFooter();
    const button = ensureModal().querySelector("#bookingModalNext");
    bhSetButtonLoading(button, true, "Confirmando...");
    try {
      const result = await bhCriarAgendamento({
        estabelecimentoId: state.establishment.id,
        profissionalId: state.professionalId,
        servicosIds: [...state.services],
        data: state.date,
        hora: state.slot,
        observacao: ensureModal().querySelector("#bookingModalNote").value.trim()
      });
      mostrarToast("sucesso", "Agendamento enviado", "O estabelecimento recebeu sua solicitação.");
      close();
      setTimeout(() => { location.href = bhUrl("html/cliente.html"); }, 750);
      return result;
    } catch (error) {
      mostrarToast("erro", "Não foi possível agendar", bhErroMensagem(error));
      state.step = 3;
      setStep(3);
    } finally {
      state.loading = false;
      bhSetButtonLoading(button, false);
      renderFooter();
    }
  }

  async function open(establishmentId, options = {}) {
    if (!establishmentId) return;
    const modal = ensureModal();
    state.trigger = options.trigger || document.activeElement;
    state.services = new Set((options.services || []).filter(Boolean));
    state.professionalId = options.professional || null;
    state.date = "";
    state.slot = null;
    state.step = 1;
    state.loading = true;
    modal.classList.add("ativo");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    modal.querySelector("#bookingModalBusiness").textContent = "Carregando estabelecimento...";
    modal.querySelector("#bookingModalServices").innerHTML = `<div class="loading-inline"><i class="bi bi-arrow-repeat spin"></i> Carregando serviços...</div>`;
    try {
      state.establishment = await bhObterEstabelecimento(establishmentId);
      if (!state.establishment) throw new Error("Estabelecimento não encontrado.");
      if (!state.establishment.aceitaAgendamento) throw new Error("Este estabelecimento não está recebendo agendamentos online no momento.");
      modal.querySelector("#bookingModalBusiness").textContent = state.establishment.nome;
      const validServices = new Set((state.establishment.servicos || []).map(item => item.id));
      state.services = new Set([...state.services].filter(id => validServices.has(id)));
      renderServices();
      setStep(1);
      modal.querySelector("[data-booking-panel='1'] button")?.focus();
    } catch (error) {
      mostrarToast("erro", "Agenda indisponível", bhErroMensagem(error));
      close();
    } finally {
      state.loading = false;
      renderFooter();
    }
  }

  function close() {
    const modal = document.getElementById("bookingModal");
    if (!modal) return;
    modal.classList.remove("ativo");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    state.trigger?.focus?.();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-booking-open]");
    if (!button) return;
    event.preventDefault();
    const services = String(button.dataset.bookingServices || "").split(",").filter(Boolean);
    open(button.dataset.bookingOpen, { services, professional: button.dataset.bookingProfessional || null, trigger: button });
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && document.getElementById("bookingModal")?.classList.contains("ativo")) close(); });
  document.addEventListener("DOMContentLoaded", () => {
    ensureModal();
    const params = new URLSearchParams(location.search);
    const id = params.get("id") || params.get("barbearia");
    if (params.get("agendar") === "1" && id) {
      const services = (params.get("servicos") || params.get("servico") || "").split(",").filter(Boolean);
      setTimeout(() => open(id, { services, professional: params.get("profissional") }), 450);
    }
  });

  global.bhBookingModal = { open, close };
})(window);
