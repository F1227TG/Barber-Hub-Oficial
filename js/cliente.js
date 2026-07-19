let bhClienteAgendamentos = [];
let bhClienteFavoritos = [];
let bhClienteAvaliacoes = [];
let bhClientePerfil = null;

function bhAvaliacaoDoAgendamento(id) {
  return bhClienteAvaliacoes.find(item => item.agendamento_id === id) || null;
}

function bhRenderFavoritosCliente() {
  const lista = document.getElementById("listaFavoritosCliente");
  if (!lista) return;
  if (!bhClienteFavoritos.length) {
    lista.innerHTML = `<div class="empty compact full-grid"><i class="bi bi-heart big"></i><h3>Nenhum favorito ainda</h3><p>Abra um estabelecimento no portal e toque em Favoritar.</p></div>`;
    return;
  }
  lista.innerHTML = bhClienteFavoritos.map(item => {
    const imagem = item.capaUrl || item.fotoUrl || "../img/logoblack.png";
    return `<article class="favorite-card">
      <a class="favorite-cover" href="barbearia.html?id=${item.id}" style="--favorite-cover:url('${escapeHTML(imagem)}')"><span class="status ${bhCalcularStatus(item).classe}">${escapeHTML(bhCalcularStatus(item).texto)}</span>${item.verificado ? `<span class="verified-mini"><i class="bi bi-patch-check-fill"></i> Verificado</span>` : ""}</a>
      <div class="favorite-body"><div><h3>${escapeHTML(item.nome)}</h3><p><i class="bi bi-geo-alt"></i> ${escapeHTML([item.bairro,item.cidade].filter(Boolean).join(", "))}</p></div><div class="favorite-actions"><a class="btn btn-primary btn-small" href="agendamento.html?barbearia=${item.id}"><i class="bi bi-calendar2-plus"></i> Agendar</a><button class="icon-btn danger" type="button" data-remover-favorito="${item.id}" title="Remover dos favoritos"><i class="bi bi-heart-fill"></i></button></div></div>
    </article>`;
  }).join("");
}

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
    tbody.innerHTML = itens.map(item => {
      const avaliacao = bhAvaliacaoDoAgendamento(item.id);
      const repetir = `agendamento.html?barbearia=${item.estabelecimento_id}&servico=${item.servico_id}&profissional=${item.profissional_id}`;
      let acoes = "—";
      if (["pendente", "confirmado"].includes(item.status)) {
        acoes = `<button class="btn btn-danger btn-small" data-cancelar-agendamento="${item.id}">Cancelar</button>`;
      } else if (item.status === "concluido") {
        acoes = `<div class="table-actions client-actions"><button class="btn btn-outline btn-small" data-avaliar-agendamento="${item.id}"><i class="bi bi-star${avaliacao ? "-fill" : ""}"></i> ${avaliacao ? "Editar avaliação" : "Avaliar"}</button><a class="btn btn-primary btn-small" href="${repetir}"><i class="bi bi-arrow-repeat"></i> Agendar novamente</a></div>`;
      } else {
        acoes = `<a class="btn btn-outline btn-small" href="${repetir}"><i class="bi bi-arrow-repeat"></i> Repetir</a>`;
      }
      return `<tr>
        <td>${escapeHTML(item.estabelecimentos?.nome || "Estabelecimento")}</td>
        <td>${escapeHTML(item.servicos?.nome || "Serviço")}</td>
        <td>${escapeHTML(item.profissionais?.nome || "Profissional")}</td>
        <td>${bhFormatarData(item.data)}</td>
        <td>${bhHoraCurta(item.hora_inicio)}</td>
        <td><span class="status ${item.status}">${escapeHTML(item.status)}</span></td>
        <td>${acoes}</td>
      </tr>`;
    }).join("");
  };
  renderTabela(futuros, "tbodyProximos", "Você não possui agendamentos futuros.");
  renderTabela(historico, "tbodyHistorico", "Seu histórico ainda está vazio.");
  bhRenderFavoritosCliente();

  const analise = bhAnalisarAgendamentos(bhClienteAgendamentos);
  const texto = analise.servicoMaisUsado
    ? `Você costuma escolher ${analise.servicoMaisUsado[0]}. Use “Agendar novamente” para repetir o serviço e profissional em poucos toques.`
    : "Depois dos seus primeiros atendimentos, o Barber Hub identificará preferências e facilitará seus próximos agendamentos.";
  document.getElementById("clienteIA").innerHTML = `<h3><i class="bi bi-stars"></i> Seu atalho inteligente</h3><p>${escapeHTML(texto)}</p><a class="btn btn-primary btn-small" href="agendamento.html">Agendar novo horário</a>`;
}

function bhAbrirModalAvaliacao(agendamento) {
  const modal = document.getElementById("modalAvaliacao");
  const avaliacao = bhAvaliacaoDoAgendamento(agendamento.id);
  document.getElementById("avaliacaoAgendamentoId").value = agendamento.id;
  document.getElementById("avaliacaoNota").value = avaliacao?.nota || "";
  document.getElementById("avaliacaoComentario").value = avaliacao?.comentario || "";
  document.getElementById("descricaoModalAvaliacao").textContent = `${agendamento.estabelecimentos?.nome || "Estabelecimento"} • ${agendamento.servicos?.nome || "Serviço"} • ${bhFormatarData(agendamento.data)}`;
  document.querySelectorAll("#avaliacaoEstrelas [data-nota]").forEach(botao => botao.classList.toggle("ativo", Number(botao.dataset.nota) <= Number(avaliacao?.nota || 0)));
  modal.classList.add("aberto");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function bhFecharModalAvaliacao() {
  const modal = document.getElementById("modalAvaliacao");
  modal?.classList.remove("aberto");
  modal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

async function bhRecarregarCliente() {
  [bhClienteAgendamentos, bhClienteFavoritos, bhClienteAvaliacoes] = await Promise.all([
    bhListarAgendamentosCliente(),
    bhListarFavoritosCliente().catch(erro => { console.warn("Favoritos indisponíveis.", erro); return []; }),
    bhListarMinhasAvaliacoes().catch(erro => { console.warn("Avaliações ainda não disponíveis.", erro); return []; })
  ]);
  bhRenderCliente(bhClientePerfil);
}

window.bhRecarregarCliente = bhRecarregarCliente;

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("cliente");
  bhClientePerfil = await bhRequireAuth(["cliente", "barbeiro", "admin"]);
  if (!bhClientePerfil) return;
  try { await bhRecarregarCliente(); }
  catch (erro) { mostrarToast("erro", "Falha ao carregar sua área", bhErroMensagem(erro)); }

  document.body.addEventListener("click", async evento => {
    const cancelar = evento.target.closest("[data-cancelar-agendamento]");
    if (cancelar) {
      if (!confirm("Deseja cancelar este agendamento?")) return;
      try { await bhCancelarAgendamento(cancelar.dataset.cancelarAgendamento); mostrarToast("sucesso", "Agendamento cancelado", "O horário voltou a ficar disponível."); await bhRecarregarCliente(); }
      catch (erro) { mostrarToast("erro", "Não foi possível cancelar", bhErroMensagem(erro)); }
      return;
    }
    const removerFavorito = evento.target.closest("[data-remover-favorito]");
    if (removerFavorito) {
      try { await bhAlternarFavorito(removerFavorito.dataset.removerFavorito, true); await bhRecarregarCliente(); mostrarToast("sucesso", "Favorito removido", "Sua lista foi atualizada."); }
      catch (erro) { mostrarToast("erro", "Não foi possível remover", bhErroMensagem(erro)); }
      return;
    }
    const avaliar = evento.target.closest("[data-avaliar-agendamento]");
    if (avaliar) {
      const item = bhClienteAgendamentos.find(ag => ag.id === avaliar.dataset.avaliarAgendamento);
      if (item) bhAbrirModalAvaliacao(item);
      return;
    }
    if (evento.target.closest("[data-fechar-avaliacao]")) bhFecharModalAvaliacao();
  });

  document.querySelectorAll("#avaliacaoEstrelas [data-nota]").forEach(botao => botao.addEventListener("click", () => {
    const nota = Number(botao.dataset.nota);
    document.getElementById("avaliacaoNota").value = nota;
    document.querySelectorAll("#avaliacaoEstrelas [data-nota]").forEach(item => item.classList.toggle("ativo", Number(item.dataset.nota) <= nota));
  }));

  document.getElementById("formAvaliacaoCliente")?.addEventListener("submit", async evento => {
    evento.preventDefault();
    const nota = Number(document.getElementById("avaliacaoNota").value);
    if (!nota) { mostrarToast("erro", "Escolha uma nota", "Selecione de 1 a 5 estrelas."); return; }
    const botao = evento.currentTarget.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Publicando...");
    try {
      await bhCriarOuAtualizarAvaliacao({ agendamentoId: document.getElementById("avaliacaoAgendamentoId").value, nota, comentario: document.getElementById("avaliacaoComentario").value });
      bhFecharModalAvaliacao();
      mostrarToast("sucesso", "Avaliação publicada", "Obrigado por compartilhar uma experiência verificada.");
      await bhRecarregarCliente();
    } catch (erro) { mostrarToast("erro", "Não foi possível avaliar", bhErroMensagem(erro)); }
    finally { bhSetButtonLoading(botao, false); }
  });
});

function bhAssinarClienteTempoReal(perfil){if(!window.supabaseClient||!perfil)return;window.supabaseClient.channel(`cliente-${perfil.id}`).on('postgres_changes',{event:'*',schema:'public',table:'agendamentos',filter:`cliente_id=eq.${perfil.id}`},async()=>{await bhRecarregarCliente();mostrarToast('info','Agendamento atualizado','Seu histórico recebeu uma atualização.')}).on('postgres_changes',{event:'*',schema:'public',table:'avaliacoes',filter:`cliente_id=eq.${perfil.id}`},async()=>{await bhRecarregarCliente()}).subscribe()}
document.addEventListener('DOMContentLoaded',async()=>{setTimeout(async()=>{try{const p=await bhGetPerfil();bhAssinarClienteTempoReal(p)}catch(_){}},1800)});
