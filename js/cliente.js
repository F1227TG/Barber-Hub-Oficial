let bhClienteAgendamentos = [];

function bhRenderCliente(perfil) {
  document.getElementById("clienteNome").textContent = perfil.nome;
  document.getElementById("clienteEmail").textContent = perfil.email;
  const futuros = bhClienteAgendamentos.filter(item => {
    const momento = new Date(`${item.data}T${bhHoraCurta(item.hora_inicio)}:00`);
    return momento >= new Date() && !["cancelado", "recusado", "concluido"].includes(item.status);
  });
  const historico = bhClienteAgendamentos.filter(item => !futuros.includes(item));
  document.getElementById("kpiProximos").textContent = futuros.length;
  document.getElementById("kpiHistorico").textContent = historico.length;
  document.getElementById("kpiConcluidos").textContent = bhClienteAgendamentos.filter(item => item.status === "concluido").length;

  const renderTabela = (itens, alvo, vazio) => {
    const tbody = document.getElementById(alvo);
    if (!itens.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty compact">${escapeHTML(vazio)}</div></td></tr>`;
      return;
    }
    tbody.innerHTML = itens.map(item => `
      <tr>
        <td>${escapeHTML(item.estabelecimentos?.nome || "Estabelecimento")}</td>
        <td>${escapeHTML(item.servicos?.nome || "Serviço")}</td>
        <td>${escapeHTML(item.profissionais?.nome || "Profissional")}</td>
        <td>${bhFormatarData(item.data)}</td>
        <td>${bhHoraCurta(item.hora_inicio)}</td>
        <td><span class="status ${item.status}">${escapeHTML(item.status)}</span></td>
        <td>${["pendente", "confirmado"].includes(item.status) ? `<button class="btn btn-danger btn-small" data-cancelar-agendamento="${item.id}">Cancelar</button>` : "—"}</td>
      </tr>`).join("");
  };
  renderTabela(futuros, "tbodyProximos", "Você não possui agendamentos futuros.");
  renderTabela(historico, "tbodyHistorico", "Seu histórico ainda está vazio.");

  const analise = bhAnalisarAgendamentos(bhClienteAgendamentos);
  const texto = analise.servicoMaisUsado
    ? `Você costuma escolher ${analise.servicoMaisUsado[0]}. Em breve, o sistema poderá sugerir combos e promoções personalizadas com base nesse comportamento.`
    : "Depois dos seus primeiros atendimentos, o Barber Hub vai identificar preferências e sugerir serviços e horários melhores.";
  document.getElementById("clienteIA").innerHTML = `<h3><i class="bi bi-stars"></i> Recomendação inteligente</h3><p>${escapeHTML(texto)}</p><a class="btn btn-primary btn-small" href="agendamento.html">Agendar novo horário</a>`;
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("cliente");
  const perfil = await bhRequireAuth(["cliente", "barbeiro", "admin"]);
  if (!perfil) return;
  try {
    bhClienteAgendamentos = await bhListarAgendamentosCliente();
    bhRenderCliente(perfil);
  } catch (erro) {
    mostrarToast("erro", "Falha ao carregar sua área", bhErroMensagem(erro));
  }

  document.body.addEventListener("click", async evento => {
    const botao = evento.target.closest("[data-cancelar-agendamento]");
    if (!botao) return;
    if (!confirm("Deseja cancelar este agendamento?")) return;
    try {
      await bhCancelarAgendamento(botao.dataset.cancelarAgendamento);
      mostrarToast("sucesso", "Agendamento cancelado", "O horário voltou a ficar disponível.");
      bhClienteAgendamentos = await bhListarAgendamentosCliente();
      bhRenderCliente(perfil);
    } catch (erro) {
      mostrarToast("erro", "Não foi possível cancelar", bhErroMensagem(erro));
    }
  });
});

function bhAssinarClienteTempoReal(perfil){if(!window.supabaseClient||!perfil)return;window.supabaseClient.channel(`cliente-${perfil.id}`).on('postgres_changes',{event:'*',schema:'public',table:'agendamentos',filter:`cliente_id=eq.${perfil.id}`},async()=>{bhClienteAgendamentos=await bhListarAgendamentosCliente();bhRenderCliente(perfil);mostrarToast('info','Agendamento atualizado','Seu histórico recebeu uma atualização.')}).subscribe()}
document.addEventListener('DOMContentLoaded',async()=>{setTimeout(async()=>{try{const p=await bhGetPerfil();bhAssinarClienteTempoReal(p)}catch(_){}},1800)});
