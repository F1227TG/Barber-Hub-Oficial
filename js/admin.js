let bhAdminDados = null;

function bhRenderAdmin() {
  const { counts, perfis, estabelecimentos, tickets, agendamentos } = bhAdminDados;
  document.getElementById("adminUsuarios").textContent = counts.perfis;
  document.getElementById("adminEstabelecimentos").textContent = counts.estabelecimentos;
  document.getElementById("adminAgendamentos").textContent = counts.agendamentos;
  document.getElementById("adminTickets").textContent = counts.tickets;

  document.getElementById("tbodyAdminUsuarios").innerHTML = perfis.length ? perfis.map(item => `
    <tr><td>${escapeHTML(item.nome)}</td><td>${escapeHTML(item.email)}</td><td>${escapeHTML(item.tipo)}</td><td>${item.ativo ? "Ativo" : "Inativo"}</td><td>${new Date(item.created_at).toLocaleDateString("pt-BR")}</td></tr>
  `).join("") : `<tr><td colspan="5">Nenhum usuário.</td></tr>`;

  document.getElementById("tbodyAdminEstabelecimentos").innerHTML = estabelecimentos.length ? estabelecimentos.map(item => `
    <tr><td>${escapeHTML(item.nome)}</td><td>${escapeHTML(item.tipo_estabelecimento)}</td><td>${escapeHTML(item.cidade)}</td><td>${item.aceita_agendamento ? "Sim" : "Não"}</td><td>${item.visivel ? "Visível" : "Oculto"}</td><td><button class="btn btn-outline btn-small" data-admin-visibilidade="${item.id}" data-visivel="${item.visivel}">${item.visivel ? "Ocultar" : "Publicar"}</button></td></tr>
  `).join("") : `<tr><td colspan="6">Nenhum estabelecimento.</td></tr>`;

  document.getElementById("listaAdminTickets").innerHTML = tickets.length ? tickets.map(ticket => `
    <article class="ticket-admin card">
      <div class="card-body">
        <div class="section-top compact"><div><span class="badge">${escapeHTML(ticket.prioridade)}</span><h3>${escapeHTML(ticket.assunto)}</h3><p>${escapeHTML(ticket.nome)} • ${escapeHTML(ticket.email)}</p></div><span class="status ${["respondido", "fechado"].includes(ticket.status) ? "concluido" : "pendente"}">${escapeHTML(ticket.status)}</span></div>
        <p class="ticket-message">${escapeHTML(ticket.mensagem)}</p>
        <div class="form-grid" style="margin-top:16px">
          <div class="campo"><label>Status</label><select data-ticket-status="${ticket.id}"><option value="aberto" ${ticket.status === "aberto" ? "selected" : ""}>Aberto</option><option value="em_atendimento" ${ticket.status === "em_atendimento" ? "selected" : ""}>Em atendimento</option><option value="respondido" ${ticket.status === "respondido" ? "selected" : ""}>Respondido</option><option value="fechado" ${ticket.status === "fechado" ? "selected" : ""}>Fechado</option></select></div>
          <div class="campo"><label>Resposta</label><textarea data-ticket-resposta="${ticket.id}">${escapeHTML(ticket.resposta || "")}</textarea></div>
        </div>
        <button class="btn btn-primary btn-small" data-ticket-salvar="${ticket.id}">Salvar atendimento</button>
      </div>
    </article>`).join("") : `<div class="empty">Nenhum ticket aberto.</div>`;

  const concluidos = agendamentos.filter(item => item.status === "concluido").length;
  document.getElementById("adminResumoTexto").textContent = `${concluidos} atendimento(s) concluído(s) e ${tickets.filter(item => item.status === "aberto").length} ticket(s) aguardando análise.`;
}

async function bhRecarregarAdmin() {
  bhAdminDados = await bhAdminResumo();
  bhRenderAdmin();
}

document.addEventListener("DOMContentLoaded", async () => {
  const perfil = await bhRequireAuth(["admin"]);
  if (!perfil) return;
  document.getElementById("adminNome").textContent = perfil.nome;
  try {
    await bhRecarregarAdmin();
  } catch (erro) {
    mostrarToast("erro", "Falha ao carregar administração", bhErroMensagem(erro));
    return;
  }

  document.getElementById("tbodyAdminEstabelecimentos").addEventListener("click", async evento => {
    const botao = evento.target.closest("[data-admin-visibilidade]");
    if (!botao) return;
    try {
      await bhAdminAlternarVisibilidade(botao.dataset.adminVisibilidade, botao.dataset.visivel !== "true");
      mostrarToast("sucesso", "Visibilidade atualizada", "A alteração já está ativa no portal.");
      await bhRecarregarAdmin();
    } catch (erro) { mostrarToast("erro", "Falha ao atualizar", bhErroMensagem(erro)); }
  });

  document.getElementById("listaAdminTickets").addEventListener("click", async evento => {
    const botao = evento.target.closest("[data-ticket-salvar]");
    if (!botao) return;
    const id = botao.dataset.ticketSalvar;
    const status = document.querySelector(`[data-ticket-status="${id}"]`).value;
    const resposta = document.querySelector(`[data-ticket-resposta="${id}"]`).value.trim();
    try {
      await bhAdminAtualizarTicket(id, { status, resposta: resposta || null });
      mostrarToast("sucesso", "Ticket atualizado", "O usuário já pode visualizar a resposta.");
      await bhRecarregarAdmin();
    } catch (erro) { mostrarToast("erro", "Falha ao responder", bhErroMensagem(erro)); }
  });
});

function bhAssinarAdminTempoReal(){if(!window.supabaseClient)return;window.supabaseClient.channel('admin-live').on('postgres_changes',{event:'*',schema:'public',table:'tickets_suporte'},async()=>{await bhRecarregarAdmin();mostrarToast('info','Central atualizada','Chegou uma alteração de suporte.')}).subscribe()}
document.addEventListener('DOMContentLoaded',()=>setTimeout(bhAssinarAdminTempoReal,1800));
