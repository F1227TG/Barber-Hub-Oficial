/**
 * cliente.js
 * Área do cliente: agendamentos, histórico, favoritos e avaliações verificadas.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

let bhClienteAgendamentos = [];
let bhClienteFavoritos = [];
let bhClienteAvaliacoes = [];
let bhClienteListaEspera = [];
let bhClienteRecorrencias = [];
let bhClienteFidelidade = [];
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
    const imagem = item.capaUrl || item.fotoUrl || "../img/placeholders/barbearia-02.webp";
    return `<article class="favorite-card">
      <a class="favorite-cover" href="barbearia.html?id=${item.id}" style="--favorite-cover:url('${escapeHTML(imagem)}')"><span class="status ${bhCalcularStatus(item).classe}">${escapeHTML(bhCalcularStatus(item).texto)}</span>${item.verificado ? `<span class="verified-mini"><i class="bi bi-patch-check-fill"></i> Verificado</span>` : ""}</a>
      <div class="favorite-body"><div><h3>${escapeHTML(item.nome)}</h3><p><i class="bi bi-geo-alt"></i> ${escapeHTML([item.bairro,item.cidade].filter(Boolean).join(", "))}</p></div><div class="favorite-actions"><a class="btn btn-primary btn-small" href="barbearia.html?id=${item.id}&agendar=1"><i class="bi bi-calendar2-plus"></i> Agendar</a><button class="icon-btn danger" type="button" data-remover-favorito="${item.id}" title="Remover dos favoritos"><i class="bi bi-heart-fill"></i></button></div></div>
    </article>`;
  }).join("");
}

function bhRelationCliente(value) {
  return Array.isArray(value) ? value[0] : value;
}

function bhRenderRelacionamentoCliente() {
  const waitlist = document.getElementById("clienteListaEspera193");
  const recurrences = document.getElementById("clienteRecorrencias193");
  const loyalty = document.getElementById("clienteFidelidade193");
  if (waitlist) {
    const active = bhClienteListaEspera.filter(item => ["aguardando", "avisado"].includes(item.status));
    waitlist.innerHTML = active.length ? active.map(item => {
      const establishment = bhRelationCliente(item.estabelecimentos);
      const service = bhRelationCliente(item.servicos);
      const professional = bhRelationCliente(item.profissionais);
      return `<article class="client-retention-row"><span class="retention-icon small"><i class="bi bi-hourglass-split"></i></span><div><strong>${escapeHTML(establishment?.nome || "Estabelecimento")}</strong><small>${escapeHTML(service?.nome || "Serviço")} · ${escapeHTML(professional?.nome || "Qualquer profissional")} · ${bhFormatarData(item.data_inicio)} a ${bhFormatarData(item.data_fim)}</small><span class="status ${item.status === "avisado" ? "confirmado" : "pendente"}">${escapeHTML(item.status)}</span></div><button class="icon-btn danger" type="button" data-cancelar-espera="${escapeHTML(item.id)}" title="Sair da lista"><i class="bi bi-x-lg"></i></button></article>`;
    }).join("") : `<div class="empty compact"><i class="bi bi-hourglass"></i><strong>Nenhuma espera ativa</strong><p>Quando um horário estiver lotado, você poderá pedir para ser avisado.</p></div>`;
  }
  if (recurrences) {
    const active = bhClienteRecorrencias.filter(item => item.status === "ativa");
    recurrences.innerHTML = active.length ? active.map(item => `<article class="client-retention-row"><span class="retention-icon small"><i class="bi bi-arrow-repeat"></i></span><div><strong>${escapeHTML(bhRelationCliente(item.estabelecimentos)?.nome || "Estabelecimento")}</strong><small>${escapeHTML(item.frequencia)} · ${Number(item.ocorrencias_criadas || 0)} de ${Number(item.total_ocorrencias || 0)} horários · ${escapeHTML(bhRelationCliente(item.profissionais)?.nome || "Equipe")}</small><span class="status concluido">ativa</span></div></article>`).join("") : `<div class="empty compact"><i class="bi bi-calendar2-week"></i><strong>Nenhuma recorrência ativa</strong><p>Uma barbearia pode transformar seu próximo horário em uma série.</p></div>`;
  }
  if (loyalty) {
    loyalty.innerHTML = bhClienteFidelidade.length ? bhClienteFidelidade.map(item => {
      const program = item.programa || {};
      const balance = item.saldo || {};
      const establishment = bhRelationCliente(program.estabelecimentos);
      const points = Number(balance.pontos || 0);
      const rewards = (item.recompensas || []).filter(reward => reward.estoque === null || Number(reward.estoque) > 0);
      return `<article class="client-loyalty-program"><div><h4>${escapeHTML(establishment?.nome || program.nome || "Programa de fidelidade")}</h4><small>${escapeHTML(program.nome || "Clube de fidelidade")} · ${Number(balance.total_creditado || 0)} pontos acumulados</small></div><b>${points} pts</b><div class="client-loyalty-rewards">${rewards.map(reward => `<button class="btn btn-outline btn-small" type="button" data-resgatar-recompensa="${escapeHTML(reward.id)}" data-pontos="${Number(reward.pontos_necessarios)}" ${points < Number(reward.pontos_necessarios) ? "disabled" : ""}><i class="bi bi-gift"></i> ${escapeHTML(reward.nome)} · ${Number(reward.pontos_necessarios)} pts</button>`).join("") || '<small>Nenhuma recompensa disponível agora.</small>'}</div></article>`;
    }).join("") : `<div class="empty compact"><i class="bi bi-award"></i><strong>Sem pontos por enquanto</strong><p>Programas ativos aparecerão após um atendimento concluído.</p></div>`;
  }
}

function bhRenderCliente(perfil) {
  document.getElementById("clienteNome").textContent = perfil.nome;
  document.getElementById("clienteEmail").textContent = perfil.email;
  const futuros = bhClienteAgendamentos.filter(item => {
    const momento = new Date(`${item.data}T${bhHoraCurta(item.hora_inicio)}:00`);
    return momento >= new Date() && !["cancelado", "recusado", "concluido"].includes(item.status);
  });
  const historico = bhClienteAgendamentos.filter(item => !futuros.includes(item));
  const concluidos = bhClienteAgendamentos.filter(item => item.status === "concluido");
  const finalizados = bhClienteAgendamentos.filter(item => ["concluido", "cancelado", "recusado"].includes(item.status));
  const taxaConclusao = finalizados.length ? Math.round((concluidos.length / finalizados.length) * 100) : 0;
  const ultimo = [...historico].sort((a,b) => new Date(`${b.data}T${bhHoraCurta(b.hora_inicio)}`) - new Date(`${a.data}T${bhHoraCurta(a.hora_inicio)}`))[0];
  document.getElementById("kpiProximos").textContent = futuros.length;
  document.getElementById("kpiHistorico").textContent = historico.length;
  document.getElementById("kpiConcluidos").textContent = concluidos.length;
  if (document.getElementById("clienteFavoritosCount")) document.getElementById("clienteFavoritosCount").textContent = bhClienteFavoritos.length;
  if (document.getElementById("clienteAvaliacoesCount")) document.getElementById("clienteAvaliacoesCount").textContent = bhClienteAvaliacoes.length;
  if (document.getElementById("clienteTaxaConclusao")) document.getElementById("clienteTaxaConclusao").textContent = `${taxaConclusao}%`;
  if (document.getElementById("clienteUltimoAtendimento")) document.getElementById("clienteUltimoAtendimento").textContent = ultimo ? bhFormatarData(ultimo.data, { day: "2-digit", month: "short" }) : "—";
  const proximo = [...futuros].sort((a,b) => new Date(`${a.data}T${bhHoraCurta(a.hora_inicio)}`) - new Date(`${b.data}T${bhHoraCurta(b.hora_inicio)}`))[0];
  const proximoTitulo = document.getElementById("clienteProximoTitulo");
  const proximoDetalhe = document.getElementById("clienteProximoDetalhe");
  const proximoAcao = document.getElementById("clienteProximoAcao");
  if (proximoTitulo && proximoDetalhe && proximoAcao) {
    if (proximo) {
      proximoTitulo.textContent = `${proximo.estabelecimentos?.nome || "Próximo atendimento"} · ${bhHoraCurta(proximo.hora_inicio)}`;
      proximoDetalhe.textContent = `${bhFormatarData(proximo.data)} · ${bhAgendamentoServicosTexto(proximo)} · ${proximo.profissionais?.nome || "Profissional"}`;
      proximoAcao.href = "#proximos";
      proximoAcao.innerHTML = '<i class="bi bi-calendar2-check"></i> Ver meu horário';
    } else {
      proximoTitulo.textContent = "Seu próximo corte começa por uma boa escolha";
      proximoDetalhe.textContent = "Explore locais, veja quem está aberto e agende em poucos toques.";
      proximoAcao.href = bhUrl("html/portal.html");
      proximoAcao.innerHTML = '<i class="bi bi-search"></i> Explorar locais';
    }
  }

  const renderTabela = (itens, alvo, vazio) => {
    const tbody = document.getElementById(alvo);
    if (!itens.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty compact">${escapeHTML(vazio)}</div></td></tr>`;
      return;
    }
    tbody.innerHTML = itens.map(item => {
      const avaliacao = bhAvaliacaoDoAgendamento(item.id);
      const servicosQuery = encodeURIComponent(bhAgendamentoServicoIds(item).join(","));
      const repetir = `barbearia.html?id=${item.estabelecimento_id}&agendar=1&servicos=${servicosQuery}&profissional=${item.profissional_id}`;
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
        <td>${escapeHTML(bhAgendamentoServicosTexto(item))}</td>
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
  bhRenderRelacionamentoCliente();

  const analise = bhAnalisarAgendamentos(bhClienteAgendamentos);
  const texto = analise.servicoMaisUsado
    ? `Você costuma escolher ${analise.servicoMaisUsado[0]}. Use “Agendar novamente” para repetir o serviço e profissional em poucos toques.`
    : "Depois dos seus primeiros atendimentos, o Barber Hub identificará preferências e facilitará seus próximos agendamentos.";
  document.getElementById("clienteIA").innerHTML = `<h3><i class="bi bi-stars"></i> Seu atalho inteligente</h3><p>${escapeHTML(texto)}</p><a class="btn btn-primary btn-small" href="portal.html">Encontrar novo horário</a>`;
}

function bhAbrirModalAvaliacao(agendamento) {
  const modal = document.getElementById("modalAvaliacao");
  const avaliacao = bhAvaliacaoDoAgendamento(agendamento.id);
  document.getElementById("avaliacaoAgendamentoId").value = agendamento.id;
  document.getElementById("avaliacaoNota").value = avaliacao?.nota || "";
  document.getElementById("avaliacaoComentario").value = avaliacao?.comentario || "";
  document.getElementById("descricaoModalAvaliacao").textContent = `${agendamento.estabelecimentos?.nome || "Estabelecimento"} • ${bhAgendamentoServicosTexto(agendamento)} • ${bhFormatarData(agendamento.data)}`;
  document.querySelectorAll("#avaliacaoEstrelas [data-nota]").forEach(botao => botao.classList.toggle("ativo", Number(botao.dataset.nota) <= Number(avaliacao?.nota || 0)));
  bhAbrirModal(modal, document.activeElement);
}

function bhFecharModalAvaliacao() {
  bhFecharModal("modalAvaliacao");
}

async function bhRecarregarCliente() {
  [bhClienteAgendamentos, bhClienteFavoritos, bhClienteAvaliacoes, bhClienteListaEspera, bhClienteRecorrencias, bhClienteFidelidade] = await Promise.all([
    bhListarAgendamentosCliente(),
    bhListarFavoritosCliente().catch(erro => { console.warn("Favoritos indisponíveis.", erro); return []; }),
    bhListarMinhasAvaliacoes().catch(erro => { console.warn("Avaliações ainda não disponíveis.", erro); return []; }),
    window.bhBackendApi?.listWaitlist().catch(erro => { console.warn("Lista de espera ainda não disponível.", erro); return []; }) || [],
    window.bhBackendApi?.listRecurrences().catch(erro => { console.warn("Recorrências ainda não disponíveis.", erro); return []; }) || [],
    window.bhBackendApi?.clientLoyalty().catch(erro => { console.warn("Fidelidade ainda não disponível.", erro); return []; }) || []
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
      if (!await bhConfirmar({ titulo: "Cancelar agendamento", mensagem: "O horário voltará a ficar disponível para outros clientes.", confirmarTexto: "Cancelar agendamento", perigo: true, trigger: cancelar })) return;
      try { await bhCancelarAgendamento(cancelar.dataset.cancelarAgendamento); mostrarToast("sucesso", "Agendamento cancelado", "O horário voltou a ficar disponível."); await bhRecarregarCliente(); }
      catch (erro) { mostrarToast("erro", "Não foi possível cancelar", bhErroMensagem(erro)); }
      return;
    }
    const cancelarEspera = evento.target.closest("[data-cancelar-espera]");
    if (cancelarEspera) {
      if (!await bhConfirmar({ titulo: "Sair da lista de espera", mensagem: "Você deixará de receber avisos sobre essa vaga.", confirmarTexto: "Sair da lista", perigo: true, trigger: cancelarEspera })) return;
      try { await window.bhBackendApi.updateWaitlist(cancelarEspera.dataset.cancelarEspera, "cancelado"); await bhRecarregarCliente(); mostrarToast("sucesso", "Lista atualizada", "Você saiu desta espera."); }
      catch (erro) { mostrarToast("erro", "Não foi possível sair", bhErroMensagem(erro)); }
      return;
    }
    const resgatar = evento.target.closest("[data-resgatar-recompensa]");
    if (resgatar) {
      const points = Number(resgatar.dataset.pontos || 0);
      if (!await bhConfirmar({ titulo: "Resgatar recompensa", mensagem: `Este resgate usará ${points} pontos e não poderá ser desfeito pelo aplicativo.`, confirmarTexto: "Resgatar", trigger: resgatar })) return;
      try {
        bhSetButtonLoading(resgatar, true, "Resgatando...");
        await window.bhBackendApi.redeemLoyaltyReward(resgatar.dataset.resgatarRecompensa, bhClientePerfil.id);
        await bhRecarregarCliente();
        mostrarToast("sucesso", "Recompensa resgatada", "Apresente o resgate ao estabelecimento no atendimento.");
      } catch (erro) {
        mostrarToast("erro", "Não foi possível resgatar", bhErroMensagem(erro));
      } finally {
        bhSetButtonLoading(resgatar, false);
      }
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
    const botao = document.querySelector('[form="formAvaliacaoCliente"][type="submit"]') || evento.currentTarget.querySelector("button[type='submit']");
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
