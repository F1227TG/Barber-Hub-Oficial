/**
 * admin.js
 * Painel administrativo: métricas, usuários, estabelecimentos, moderação e tickets.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

let bhAdminDados = null;
let bhAdminPerfil = null;
const bhAdminBuscaTimers = new Map();

function bhAdminFiltrosRecurso(recurso) {
  if (recurso === "perfis") return {
    q: document.getElementById("buscarAdminUsuarios")?.value.trim() || "",
    status: document.getElementById("filtroAdminUsuarios")?.value || "todos"
  };
  if (recurso === "estabelecimentos") return {
    q: document.getElementById("buscarAdminEstabelecimentos")?.value.trim() || "",
    status: document.getElementById("filtroAdminEstabelecimentos")?.value || "todos"
  };
  if (recurso === "agendamentos") return { status: document.getElementById("filtroAdminAgendamentos")?.value || "todos" };
  if (recurso === "tickets") return { status: document.getElementById("filtroAdminTickets")?.value || "todos" };
  return {};
}

function bhAdminAtualizarMais(recurso, anchorId) {
  const anchor = document.getElementById(anchorId);
  if (!anchor) return;
  let botao = document.querySelector(`[data-admin-more="${recurso}"]`);
  if (!botao) {
    botao = document.createElement("button");
    botao.type = "button";
    botao.className = "btn btn-outline admin-more110";
    botao.dataset.adminMore = recurso;
    (anchor.closest(".table-wrap") || anchor).insertAdjacentElement("afterend", botao);
  }
  const pagina = bhAdminDados?.pagination?.[recurso] || {};
  const carregados = bhAdminDados?.[recurso]?.length || 0;
  botao.hidden = !pagina.has_more;
  botao.innerHTML = `<i class="bi bi-plus-circle"></i> Carregar mais <span>${carregados} de ${Number(pagina.total || carregados)}</span>`;
}

function bhAdminRenderizarRecurso(recurso) {
  const renderers = {
    perfis: bhRenderAdminUsuarios,
    estabelecimentos: bhRenderAdminEstabelecimentos,
    agendamentos: bhRenderAdminAgendamentos,
    tickets: bhRenderAdminTickets,
    denuncias: bhRenderAdminDenuncias,
    avaliacoes: bhRenderAdminAvaliacoes
  };
  renderers[recurso]?.();
}

async function bhAdminBuscarRecurso(recurso, append = false) {
  if (!window.bhBackendApi?.adminRecords || !bhAdminDados) return;
  const atual = bhAdminDados[recurso] || [];
  const pagina = await window.bhBackendApi.adminRecords(recurso, {
    ...bhAdminFiltrosRecurso(recurso),
    offset: append ? atual.length : 0,
    limit: 50
  });
  const novos = pagina.items || [];
  bhAdminDados[recurso] = append
    ? [...new Map([...atual, ...novos].map(item => [item.id, item])).values()]
    : novos;
  bhAdminDados.pagination ||= {};
  bhAdminDados.pagination[recurso] = pagina;
  bhAdminRenderizarRecurso(recurso);
}

function bhAdminAgendarBusca(recurso, imediato = false) {
  clearTimeout(bhAdminBuscaTimers.get(recurso));
  const timer = setTimeout(() => bhAdminBuscarRecurso(recurso).catch(erro => {
    mostrarToast("erro", "Busca não concluída", bhErroMensagem(erro));
  }), imediato ? 0 : 350);
  bhAdminBuscaTimers.set(recurso, timer);
}

function bhAdminFiltrarTexto(item, termo, campos) {
  if (!termo) return true;
  const texto = campos.map(campo => item[campo] || "").join(" ").toLowerCase();
  return texto.includes(termo.toLowerCase());
}

function bhRenderAdminKpis() {
  const { counts, perfis, estabelecimentos, tickets, agendamentos, denuncias, avaliacoes } = bhAdminDados;
  const ativos = perfis.filter(item => item.ativo).length;
  const visiveis = estabelecimentos.filter(item => item.visivel && !item.suspenso_pela_moderacao).length;
  const concluidos = agendamentos.filter(item => item.status === "concluido");
  const ticketsPendentes = tickets.filter(item => ["aberto","em_atendimento"].includes(item.status));
  const moderacao = denuncias.filter(item => ["aberta","analisando"].includes(item.status)).length + avaliacoes.filter(item => item.status === "em_analise").length;
  const media = avaliacoes.filter(item => item.status === "publicada");
  const mediaValor = media.length ? media.reduce((soma,item)=>soma+Number(item.nota||0),0)/media.length : 0;
  const receita = concluidos.reduce((soma,item)=>soma+Number(item.valor||0),0);
  const verificados = estabelecimentos.filter(item => item.verificado).length;

  document.getElementById("adminUsuarios").textContent = counts.perfis;
  document.getElementById("adminUsuariosAtivos").textContent = `${ativos} ativo${ativos===1?"":"s"}`;
  document.getElementById("adminEstabelecimentos").textContent = counts.estabelecimentos;
  document.getElementById("adminEstabelecimentosVisiveis").textContent = `${visiveis} visível${visiveis===1?"":"is"}`;
  document.getElementById("adminAgendamentos").textContent = counts.agendamentos;
  document.getElementById("adminAgendamentosConcluidos").textContent = `${concluidos.length} concluído${concluidos.length===1?"":"s"}`;
  document.getElementById("adminTickets").textContent = counts.tickets;
  document.getElementById("adminTicketsPendentes").textContent = `${ticketsPendentes.length} pendente${ticketsPendentes.length===1?"":"s"}`;
  document.getElementById("adminAvaliacoes").textContent = counts.avaliacoes || avaliacoes.length;
  document.getElementById("adminAvaliacaoMedia").textContent = `média ${mediaValor.toFixed(1).replace(".",",")}`;
  document.getElementById("adminModeracao").textContent = moderacao;
  document.getElementById("adminReceita").textContent = bhMoeda(receita);
  document.getElementById("adminVerificacaoResumo").textContent = `${verificados} de ${estabelecimentos.length} estabelecimento${estabelecimentos.length===1?"":"s"} com selo verificado.`;
  document.getElementById("adminResumoTexto").textContent = `${ticketsPendentes.length} ticket(s) pendente(s), ${moderacao} item(ns) em moderação e ${concluidos.length} atendimento(s) concluído(s) na amostra carregada.`;
  const pendencias = ticketsPendentes.length + moderacao;
  const taxaConclusao = agendamentos.length ? Math.round((concluidos.length / agendamentos.length) * 100) : 0;
  const coberturaVerificada = estabelecimentos.length ? Math.round((verificados / estabelecimentos.length) * 100) : 0;
  const agendasAtivas = estabelecimentos.filter(item => item.aceita_agendamento).length;
  const coberturaAgenda = estabelecimentos.length ? Math.round((agendasAtivas / estabelecimentos.length) * 100) : 0;
  if (document.getElementById("adminPendenciasCriticas")) document.getElementById("adminPendenciasCriticas").textContent = pendencias;
  if (document.getElementById("adminPendenciasDetalhe")) document.getElementById("adminPendenciasDetalhe").textContent = `${ticketsPendentes.length} ticket(s) + ${moderacao} moderação(ões)`;
  if (document.getElementById("adminTaxaConclusao")) document.getElementById("adminTaxaConclusao").textContent = `${taxaConclusao}%`;
  if (document.getElementById("adminCoberturaVerificada")) document.getElementById("adminCoberturaVerificada").textContent = `${coberturaVerificada}%`;
  if (document.getElementById("adminAgendaAtiva")) document.getElementById("adminAgendaAtiva").textContent = `${coberturaAgenda}%`;
  document.getElementById("adminUltimaAtualizacao").textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`;
}

function bhRenderAdminEstabelecimentos() {
  const termo = document.getElementById("buscarAdminEstabelecimentos")?.value.trim() || "";
  const filtro = document.getElementById("filtroAdminEstabelecimentos")?.value || "todos";
  const itens = bhAdminDados.estabelecimentos.filter(item => bhAdminFiltrarTexto(item, termo, ["nome","cidade","bairro"]) && (
    filtro === "todos" ||
    (filtro === "visiveis" && item.visivel && !item.suspenso_pela_moderacao) ||
    (filtro === "ocultos" && !item.visivel && !item.suspenso_pela_moderacao) ||
    (filtro === "suspensos" && item.suspenso_pela_moderacao) ||
    (filtro === "verificados" && item.verificado) ||
    (filtro === "destaques" && item.destaque)
  ));
  const tbody = document.getElementById("tbodyAdminEstabelecimentos");
  tbody.innerHTML = itens.length ? itens.map(item => `<tr>
    <td><div class="admin-entity"><div class="admin-entity-avatar"><i class="bi bi-shop"></i></div><div><strong>${escapeHTML(item.nome)}</strong><span>${escapeHTML(item.tipo_estabelecimento)}${item.verificado?` • <b class="verified-text">verificado</b>`:""}</span></div></div></td>
    <td>${escapeHTML([item.bairro,item.cidade,item.estado].filter(Boolean).join(", "))}</td>
    <td><span class="status ${item.aceita_agendamento?"aberta":"fechada"}">${item.aceita_agendamento?"Ativa":"Desativada"}</span></td>
    <td>${Number(item.avaliacao||0)>0?`<span class="rating">${Number(item.avaliacao).toFixed(1)} ★</span>`:"Sem avaliações"}</td>
    <td><div class="admin-state-stack"><span>${item.suspenso_pela_moderacao?"Suspenso":item.visivel?"Visível":"Oculto pelo proprietário"}</span>${item.suspenso_pela_moderacao?`<small>${escapeHTML(item.suspenso_motivo||"Moderação administrativa")}</small>`:item.destaque?"<small>Destaque no portal</small>":""}</div></td>
    <td><div class="admin-control-group"><a class="icon-btn" href="barbearia.html?id=${item.id}" target="_blank" title="Abrir página"><i class="bi bi-box-arrow-up-right"></i></a><button class="icon-btn ${item.verificado?"success":""}" data-admin-verificar="${item.id}" data-valor="${item.verificado}" title="${item.verificado?"Remover verificação":"Verificar"}"><i class="bi bi-patch-check"></i></button><button class="icon-btn ${item.destaque?"success":""}" data-admin-destaque="${item.id}" data-valor="${item.destaque}" title="${item.destaque?"Remover destaque":"Destacar"}"><i class="bi bi-pin-angle"></i></button><button class="icon-btn ${item.suspenso_pela_moderacao?"success":"danger"}" data-admin-suspensao="${item.id}" data-valor="${item.suspenso_pela_moderacao}" title="${item.suspenso_pela_moderacao?"Restaurar publicação":"Suspender pela moderação"}"><i class="bi ${item.suspenso_pela_moderacao?"bi-shield-check":"bi-shield-x"}"></i></button></div></td>
  </tr>`).join("") : `<tr><td colspan="6"><div class="empty compact">Nenhum estabelecimento encontrado.</div></td></tr>`;
  bhAdminAtualizarMais("estabelecimentos", "tbodyAdminEstabelecimentos");
}

function bhRenderAdminUsuarios() {
  const termo = document.getElementById("buscarAdminUsuarios")?.value.trim() || "";
  const filtro = document.getElementById("filtroAdminUsuarios")?.value || "todos";
  const itens = bhAdminDados.perfis.filter(item =>
    bhAdminFiltrarTexto(item, termo, ["nome", "email"]) &&
    (filtro === "todos" || item.tipo === filtro || (filtro === "inativo" && !item.ativo))
  );
  const tbody = document.getElementById("tbodyAdminUsuarios");
  if (!itens.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty compact">Nenhum usuário encontrado.</div></td></tr>`;
    bhAdminAtualizarMais("perfis", "tbodyAdminUsuarios");
    return;
  }

  tbody.innerHTML = itens.map(item => {
    const proprio = item.id === bhAdminPerfil.id;
    return `<tr>
      <td>
        <div class="admin-entity">
          <div class="admin-user-avatar">${escapeHTML((item.nome || "U").slice(0, 1).toUpperCase())}</div>
          <div><strong>${escapeHTML(item.nome)}</strong><span>${escapeHTML(item.email)}</span></div>
        </div>
      </td>
      <td>
        <select data-admin-role="${item.id}" ${proprio ? "disabled" : ""}>
          <option value="cliente" ${item.tipo === "cliente" ? "selected" : ""}>Cliente</option>
          <option value="barbeiro" ${item.tipo === "barbeiro" ? "selected" : ""}>Barbeiro</option>
          <option value="admin" ${item.tipo === "admin" ? "selected" : ""}>Administrador</option>
        </select>
      </td>
      <td><span class="status ${item.ativo ? "concluido" : "cancelado"}">${item.ativo ? "Ativo" : "Inativo"}</span></td>
      <td>${new Date(item.created_at).toLocaleDateString("pt-BR")}</td>
      <td>
        <div class="admin-user-actions">
          <button class="btn btn-outline btn-small" data-admin-password-recovery="${item.id}" data-user-email="${escapeHTML(item.email)}">
            <i class="bi bi-envelope-lock"></i> Redefinir senha
          </button>
          <button class="btn ${item.ativo ? "btn-danger" : "btn-outline"} btn-small"
            data-admin-ativo="${item.id}" data-valor="${item.ativo}"
            ${proprio ? "disabled title='Sua conta é protegida nesta tela'" : ""}>
            ${item.ativo ? "Desativar" : "Ativar"}
          </button>
        </div>
      </td>
    </tr>`;
  }).join("");
  bhAdminAtualizarMais("perfis", "tbodyAdminUsuarios");
}

function bhRenderAdminAgendamentos() {
  const filtro = document.getElementById("filtroAdminAgendamentos")?.value || "todos";
  const itens = bhAdminDados.agendamentos.filter(item => filtro === "todos" || item.status === filtro);
  document.getElementById("tbodyAdminAgendamentos").innerHTML = itens.length ? itens.map(item => `<tr><td><strong>${escapeHTML(item.cliente_nome||"Conta excluída")}</strong><br><small>${escapeHTML(item.cliente_email||"")}</small></td><td>${bhFormatarData(item.data)} às ${bhHoraCurta(item.hora_inicio)}</td><td><span class="status ${item.status}">${escapeHTML(item.status)}</span></td><td>${escapeHTML(item.origem||"web")}</td><td>${bhMoeda(item.valor||0)}</td></tr>`).join("") : `<tr><td colspan="5"><div class="empty compact">Nenhum agendamento neste filtro.</div></td></tr>`;
  bhAdminAtualizarMais("agendamentos", "tbodyAdminAgendamentos");
}

function bhRenderAdminAvaliacoes() {
  const itens = bhAdminDados.avaliacoes;
  const verificadas = itens.filter(item => item.verificada || item.origem === "agendamento").length;
  const comunidade = itens.length - verificadas;
  const badge = document.getElementById("adminAvaliacoesBadge");
  if (badge) badge.textContent = `${itens.length} avaliação${itens.length===1?"":"ões"} · ${verificadas} verificadas · ${comunidade} comunidade`;
  document.getElementById("listaAdminAvaliacoes").innerHTML = itens.length ? itens.map(item => {
    const verificada = Boolean(item.verificada || item.origem === "agendamento");
    const contexto = item.portfolio_publicacoes?.titulo
      ? `<span class="review-context"><i class="bi bi-images"></i> Publicação: ${escapeHTML(item.portfolio_publicacoes.titulo)}</span>`
      : (item.agendamentos?.agendamento_servicos?.length || item.agendamentos?.servicos?.nome)
        ? `<span class="review-context"><i class="bi bi-scissors"></i> Atendimento: ${escapeHTML(bhAgendamentoServicosTexto(item.agendamentos))}</span>`
        : "";
    return `<article class="admin-review-card"><div class="review-manage-head"><div><strong>${escapeHTML(item.estabelecimentos?.nome||"Estabelecimento")}</strong><span>${"★".repeat(Number(item.nota||0))}${"☆".repeat(5-Number(item.nota||0))}</span></div><div class="review-meta-stack"><span class="review-source-badge ${verificada ? "verified" : "community"}"><i class="bi ${verificada ? "bi-patch-check-fill" : "bi-people-fill"}"></i> ${verificada ? "Verificada" : "Comunidade"}</span><span class="status ${item.status==="publicada"?"concluido":item.status==="ocultada"?"cancelado":"pendente"}">${escapeHTML(item.status.replace("_"," "))}</span></div></div>${contexto}<p>${escapeHTML(item.comentario||"Avaliação sem comentário.")}</p><small>${escapeHTML(item.perfis?.nome||"Conta excluída")} • ${new Date(item.created_at).toLocaleDateString("pt-BR")}</small>${item.resposta_estabelecimento?`<div class="business-reply"><strong>Resposta do estabelecimento</strong><p>${escapeHTML(item.resposta_estabelecimento)}</p></div>`:""}<div class="moderation-actions"><button class="btn btn-outline btn-small" data-admin-avaliacao-status="${item.id}" data-status="publicada"><i class="bi bi-eye"></i> Publicar</button><button class="btn btn-outline btn-small" data-admin-avaliacao-status="${item.id}" data-status="em_analise"><i class="bi bi-search"></i> Analisar</button><button class="btn btn-danger btn-small" data-admin-avaliacao-status="${item.id}" data-status="ocultada"><i class="bi bi-eye-slash"></i> Ocultar</button></div></article>`;
  }).join("") : `<div class="empty full-grid"><i class="bi bi-star big"></i><p>Nenhuma avaliação registrada.</p></div>`;
  bhAdminAtualizarMais("avaliacoes", "listaAdminAvaliacoes");
}

function bhRenderAdminDenuncias() {
  const denuncias = bhAdminDados.denuncias;
  const abertas = denuncias.filter(item => ["aberta","analisando"].includes(item.status));
  document.getElementById("adminDenunciasBadge").textContent = `${abertas.length} pendente${abertas.length===1?"":"s"}`;
  document.getElementById("listaAdminDenuncias").innerHTML = denuncias.length ? denuncias.map(item => { const p=item.portfolio_publicacoes; return `<article class="ticket-admin card moderation-card"><div class="card-body"><div class="section-top compact"><div><span class="badge">${escapeHTML(item.motivo.replaceAll("_"," "))}</span><h3>${escapeHTML(p?.titulo||"Publicação removida")}</h3><p>${escapeHTML(p?.estabelecimentos?.nome||"Estabelecimento")} • denúncia de ${escapeHTML(item.perfis?.nome||"usuário")}</p></div><span class="status ${["resolvida","rejeitada"].includes(item.status)?"concluido":"pendente"}">${escapeHTML(item.status)}</span></div><p class="ticket-message">${escapeHTML(item.detalhes||"Nenhum detalhe adicional informado.")}</p><div class="moderation-actions">${p?`<button class="btn btn-danger btn-small" data-denuncia-ocultar="${item.id}" data-publicacao-id="${p.id}"><i class="bi bi-eye-slash"></i> Ocultar publicação</button>`:""}<button class="btn btn-outline btn-small" data-denuncia-analisar="${item.id}">Em análise</button><button class="btn btn-outline btn-small" data-denuncia-rejeitar="${item.id}">Rejeitar</button></div></div></article>`; }).join("") : `<div class="empty full-grid"><i class="bi bi-shield-check big"></i><h3>Nenhuma denúncia</h3></div>`;
  bhAdminAtualizarMais("denuncias", "listaAdminDenuncias");
}

function bhRenderAdminTickets() {
  const filtro = document.getElementById("filtroAdminTickets")?.value || "todos";
  const itens = bhAdminDados.tickets.filter(item => filtro === "todos" || item.status === filtro);
  document.getElementById("listaAdminTickets").innerHTML = itens.length ? itens.map(ticket => `<article class="ticket-admin card"><div class="card-body"><div class="section-top compact"><div><span class="badge">${escapeHTML(ticket.prioridade)}</span><h3>${escapeHTML(ticket.assunto)}</h3><p>${escapeHTML(ticket.nome)} • ${escapeHTML(ticket.email)}</p></div><span class="status ${["respondido","fechado"].includes(ticket.status)?"concluido":"pendente"}">${escapeHTML(ticket.status)}</span></div><p class="ticket-message">${escapeHTML(ticket.mensagem)}</p><div class="form-grid" style="margin-top:16px"><div class="campo"><label>Status</label><select data-ticket-status="${ticket.id}"><option value="aberto" ${ticket.status==="aberto"?"selected":""}>Aberto</option><option value="em_atendimento" ${ticket.status==="em_atendimento"?"selected":""}>Em atendimento</option><option value="respondido" ${ticket.status==="respondido"?"selected":""}>Respondido</option><option value="fechado" ${ticket.status==="fechado"?"selected":""}>Fechado</option></select></div><div class="campo"><label>Resposta</label><textarea data-ticket-resposta="${ticket.id}">${escapeHTML(ticket.resposta||"")}</textarea></div></div><button class="btn btn-primary btn-small" data-ticket-salvar="${ticket.id}">Salvar atendimento</button></div></article>`).join("") : `<div class="empty full-grid">Nenhum ticket neste filtro.</div>`;
  bhAdminAtualizarMais("tickets", "listaAdminTickets");
}

function bhRenderAdmin() { bhRenderAdminKpis(); bhRenderAdminEstabelecimentos(); bhRenderAdminUsuarios(); bhRenderAdminAgendamentos(); bhRenderAdminAvaliacoes(); bhRenderAdminDenuncias(); bhRenderAdminTickets(); }
async function bhRecarregarAdmin() {
  // As listas detalhadas continuam protegidas por RLS no Supabase; os totais
  // globais passam pela API Python, centralizando a visão administrativa.
  const [dados, overview] = await Promise.all([
    bhAdminResumo(),
    window.bhBackendApi?.adminOverview?.().catch(error => { console.warn("[Admin] overview da API indisponível", error); return null; }) || Promise.resolve(null)
  ]);
  if (overview) {
    dados.counts = {
      ...dados.counts,
      perfis: Number(overview.usuarios ?? dados.counts?.perfis ?? 0),
      estabelecimentos: Number(overview.estabelecimentos ?? dados.counts?.estabelecimentos ?? 0),
      agendamentos: Number(overview.agendamentos ?? dados.counts?.agendamentos ?? 0),
      avaliacoes: Number(overview.avaliacoes ?? dados.counts?.avaliacoes ?? 0)
    };
  }
  bhAdminDados = dados;
  bhRenderAdmin();
}
window.bhRecarregarAdmin = bhRecarregarAdmin;

async function bhAdminExecutar(botao, acao) { bhSetButtonLoading(botao,true,"..."); try { await acao(); await bhRecarregarAdmin(); } finally { bhSetButtonLoading(botao,false); } }

document.addEventListener("DOMContentLoaded", async () => {
  bhAdminPerfil = await bhRequireAuth(["admin"]); if (!bhAdminPerfil) return;
  document.getElementById("adminNome").textContent = bhAdminPerfil.nome;
  try { await bhRecarregarAdmin(); } catch (erro) { mostrarToast("erro","Falha ao carregar administração",bhErroMensagem(erro)); return; }
  document.getElementById("adminAtualizar")?.addEventListener("click", async e => { try { await bhAdminExecutar(e.currentTarget, bhRecarregarAdmin); mostrarToast("sucesso","Painel atualizado","Os dados mais recentes foram carregados."); } catch(erro){ mostrarToast("erro","Falha ao atualizar",bhErroMensagem(erro)); } });
  ["buscarAdminEstabelecimentos","filtroAdminEstabelecimentos"].forEach(id=>document.getElementById(id)?.addEventListener(id.startsWith("buscar")?"input":"change",()=>bhAdminAgendarBusca("estabelecimentos",!id.startsWith("buscar"))));
  ["buscarAdminUsuarios","filtroAdminUsuarios"].forEach(id=>document.getElementById(id)?.addEventListener(id.startsWith("buscar")?"input":"change",()=>bhAdminAgendarBusca("perfis",!id.startsWith("buscar"))));
  document.getElementById("filtroAdminAgendamentos")?.addEventListener("change",()=>bhAdminAgendarBusca("agendamentos",true));
  document.getElementById("filtroAdminTickets")?.addEventListener("change",()=>bhAdminAgendarBusca("tickets",true));

  document.body.addEventListener("change", async evento => {
    const role = evento.target.closest("[data-admin-role]"); if (!role) return;
    if (!await bhConfirmar({ titulo: "Alterar permissão", mensagem: `Alterar este usuário para ${role.value}? O acesso ao sistema será atualizado imediatamente.`, confirmarTexto: "Alterar permissão", trigger: role })) { await bhRecarregarAdmin(); return; }
    try { await bhAdminAtualizarPerfil(role.dataset.adminRole,{tipo:role.value}); mostrarToast("sucesso","Perfil atualizado","A permissão foi alterada."); await bhRecarregarAdmin(); } catch(erro){ mostrarToast("erro","Falha ao alterar perfil",bhErroMensagem(erro)); await bhRecarregarAdmin(); }
  });

  document.body.addEventListener("click", async evento => {
    const mais = evento.target.closest("[data-admin-more]");
    if (mais) {
      bhSetButtonLoading(mais, true, "Carregando...");
      try { await bhAdminBuscarRecurso(mais.dataset.adminMore, true); }
      catch (erro) { mostrarToast("erro", "Não foi possível carregar mais", bhErroMensagem(erro)); }
      finally { bhSetButtonLoading(mais, false); }
      return;
    }
    const suspensao = evento.target.closest("[data-admin-suspensao]");
    const ver = evento.target.closest("[data-admin-verificar]");
    const dest = evento.target.closest("[data-admin-destaque]");
    const ativo = evento.target.closest("[data-admin-ativo]");
    const av = evento.target.closest("[data-admin-avaliacao-status]");
    const recovery = evento.target.closest("[data-admin-password-recovery]");
    try {
      if (recovery) {
        if (!window.bhBackendApi) throw new Error("O serviço de recuperação ainda não está disponível neste ambiente.");
        const email = recovery.dataset.userEmail || "esta conta";
        if (!await bhConfirmar({
          titulo: "Enviar redefinição de senha",
          mensagem: `O Barber Hub enviará um link seguro para ${email}. A senha atual não será exibida nem alterada pela administração.`,
          confirmarTexto: "Enviar link",
          trigger: recovery
        })) return;
        bhSetButtonLoading(recovery, true, "Enviando...");
        try {
          const result = await window.bhBackendApi.sendPasswordRecovery(recovery.dataset.adminPasswordRecovery, "Solicitação administrativa pelo painel");
          mostrarToast("sucesso", "Link enviado", `A recuperação foi enviada para ${result.email_masked || email}.`);
        } finally {
          bhSetButtonLoading(recovery, false);
        }
        return;
      }
      if (suspensao) {
        const suspenso = suspensao.dataset.valor === "true";
        if (suspenso && !await bhConfirmar({ titulo: "Restaurar estabelecimento", mensagem: "A suspensão administrativa será removida e a página voltará ao portal.", confirmarTexto: "Restaurar", trigger: suspensao })) return;
        if (!suspenso && !await bhConfirmar({ titulo: "Suspender estabelecimento", mensagem: "A página sairá do marketplace e o proprietário não poderá republicá-la enquanto a suspensão estiver ativa.", confirmarTexto: "Suspender", perigo: true, trigger: suspensao })) return;
        await bhAdminAtualizarEstabelecimento(suspensao.dataset.adminSuspensao, {
          suspenso_pela_moderacao: !suspenso,
          suspenso_motivo: suspenso ? null : "Suspenso pela administração.",
          visivel: suspenso
        });
        mostrarToast("sucesso", suspenso ? "Estabelecimento restaurado" : "Estabelecimento suspenso", "A moderação já está ativa no portal.");
        await bhRecarregarAdmin();
        return;
      }
      if (ver) { await bhAdminAtualizarEstabelecimento(ver.dataset.adminVerificar,{verificado:ver.dataset.valor!=="true"}); mostrarToast("sucesso","Verificação atualizada","O selo foi ajustado."); await bhRecarregarAdmin(); return; }
      if (dest) { await bhAdminAtualizarEstabelecimento(dest.dataset.adminDestaque,{destaque:dest.dataset.valor!=="true"}); mostrarToast("sucesso","Destaque atualizado","A prioridade do portal foi ajustada."); await bhRecarregarAdmin(); return; }
      if (ativo) { if(!await bhConfirmar({ titulo: `${ativo.dataset.valor==="true"?"Desativar":"Ativar"} conta`, mensagem: `${ativo.dataset.valor==="true"?"A pessoa perderá o acesso até que a conta seja reativada.":"A pessoa recuperará o acesso ao sistema."}`, confirmarTexto: ativo.dataset.valor==="true"?"Desativar":"Ativar", perigo: ativo.dataset.valor==="true", trigger: ativo })) return; await bhAdminAtualizarPerfil(ativo.dataset.adminAtivo,{ativo:ativo.dataset.valor!=="true"}); mostrarToast("sucesso","Conta atualizada","O status de acesso foi alterado."); await bhRecarregarAdmin(); return; }
      if (av) { await bhAdminAtualizarAvaliacao(av.dataset.adminAvaliacaoStatus,{status:av.dataset.status,motivo_moderacao:av.dataset.status==="ocultada"?"Ocultada pela administração":null}); mostrarToast("sucesso","Avaliação moderada","O estado público foi atualizado."); await bhRecarregarAdmin(); return; }
      const ticket=evento.target.closest("[data-ticket-salvar]"); if(ticket){const id=ticket.dataset.ticketSalvar; const status=document.querySelector(`[data-ticket-status="${id}"]`).value; const resposta=document.querySelector(`[data-ticket-resposta="${id}"]`).value.trim(); await bhAdminAtualizarTicket(id,{status,resposta:resposta||null}); mostrarToast("sucesso","Ticket atualizado","O usuário poderá visualizar a resposta."); await bhRecarregarAdmin(); return;}
      const ocultar=evento.target.closest("[data-denuncia-ocultar]"); const analisar=evento.target.closest("[data-denuncia-analisar]"); const rejeitar=evento.target.closest("[data-denuncia-rejeitar]");
      if(ocultar){if(!await bhConfirmar({ titulo: "Ocultar publicação", mensagem: "O conteúdo deixará de aparecer no perfil público enquanto a denúncia será marcada como resolvida.", confirmarTexto: "Ocultar publicação", perigo: true, trigger: ocultar }))return;await bhAtualizarPublicacaoPortfolio(ocultar.dataset.publicacaoId,{status:"ocultada"});await bhAdminAtualizarDenunciaPortfolio(ocultar.dataset.denunciaOcultar,{status:"resolvida"});}
      if(analisar)await bhAdminAtualizarDenunciaPortfolio(analisar.dataset.denunciaAnalisar,{status:"analisando"});
      if(rejeitar)await bhAdminAtualizarDenunciaPortfolio(rejeitar.dataset.denunciaRejeitar,{status:"rejeitada"});
      if(ocultar||analisar||rejeitar){mostrarToast("sucesso","Moderação atualizada","O estado foi salvo.");await bhRecarregarAdmin();}
    } catch(erro){mostrarToast("erro","Ação não concluída",bhErroMensagem(erro));}
  });
});

function bhAssinarAdminTempoReal(){if(!window.supabaseClient)return;const atualizar=async()=>{await bhRecarregarAdmin()};window.supabaseClient.channel('admin-live-v13').on('postgres_changes',{event:'*',schema:'public',table:'tickets_suporte'},atualizar).on('postgres_changes',{event:'*',schema:'public',table:'portfolio_denuncias'},atualizar).on('postgres_changes',{event:'*',schema:'public',table:'avaliacoes'},atualizar).on('postgres_changes',{event:'*',schema:'public',table:'estabelecimentos'},atualizar).subscribe()}
document.addEventListener('DOMContentLoaded',()=>setTimeout(bhAssinarAdminTempoReal,1800));

/** Estado dos serviços essenciais exibido somente no painel administrativo. */
async function bhAdminCarregarSaudeApi() {
  const set = (name, text, online = true) => {
    const value = document.getElementById(`adminHealth${name}`);
    const card = value?.closest(".admin-service-health");
    if (value) value.textContent = text;
    card?.classList.toggle("offline", !online);
  };
  try {
    if (!window.bhBackendApi?.adminHealth) throw new Error("Serviço de monitoramento indisponível");
    const started = performance.now();
    const data = await window.bhBackendApi.adminHealth();
    const latency = Math.max(1, Math.round(performance.now() - started));
    set("Api", `Online · ${latency} ms`, data?.api?.status === "online");
    set("Db", data?.database?.status === "online" ? "Online" : "Indisponível", data?.database?.status === "online");
    set("Auth", data?.auth?.status === "online" ? "Online" : "Indisponível", data?.auth?.status === "online");
    const marketplaceOk = data?.marketplace?.status === "online";
    set("Marketplace", marketplaceOk ? "Online" : "Busca indisponível", marketplaceOk);
    const updated = document.getElementById("adminUltimaAtualizacao");
    if (updated) updated.textContent = `Serviços verificados às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date())}`;
    bhAdminRenderRelease110(data);
  } catch (error) {
    set("Api", "Indisponível", false);
    set("Db", "Não confirmado", false);
    set("Auth", "Não confirmado", false);
    set("Marketplace", "Não confirmado", false);
    bhAdminRenderRelease110(null, error);
    console.warn("[Barber Hub Admin] health check failed", error);
  }
}

function bhAdminRenderRelease110(data, error = null) {
  const host = document.getElementById("adminReleaseGrid110");
  if (!host) return;
  if (error || !data?.release) {
    host.innerHTML = `<article class="admin-release-item110 error"><i class="bi bi-exclamation-triangle"></i><div><strong>Verificação indisponível</strong><small>${escapeHTML(bhErroMensagem(error || new Error("Não foi possível consultar a versão.")))}</small></div></article>`;
    return;
  }
  const release = data.release;
  const checks = [
    [true, `Versão ${release.version || "1.10.1"}`, `Serviço principal ${data.api?.version || "ativo"}.`],
    [release.migrations?.["29"], "Operação e horários", "Atualização 29: períodos, atendimentos e financeiro."],
    [release.migrations?.["30"], "Localização e imagens", "Atualização 30: biblioteca, rota e busca regional."],
    [release.migrations?.["31"], "Importação e controle", "Atualização 31: avisos, auditoria e liberações."],
    [release.configuration?.allowed_origins, "Endereços autorizados", "Restringe quais sites podem conversar com o serviço."],
    [release.configuration?.password_redirect, "Recuperação de acesso", "Destino seguro de redefinição configurado."],
    [release.configuration?.captcha, "Proteção contra robôs", "Precisa estar configurada antes do lançamento público."],
    [release.configuration?.device_notifications, "Avisos no dispositivo", "Chave de envio necessária para ativar os avisos externos."],
  ];
  host.innerHTML = checks.map(([ready, title, detail]) => `<article class="admin-release-item110 ${ready ? "ready" : "pending"}"><i class="bi ${ready ? "bi-check2-circle" : "bi-hourglass-split"}"></i><div><strong>${escapeHTML(title)}</strong><small>${escapeHTML(ready ? detail : `${detail} Pendente neste ambiente.`)}</small></div></article>`).join("");
}

document.addEventListener("DOMContentLoaded", () => setTimeout(bhAdminCarregarSaudeApi, 900));
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("adminAtualizar")?.addEventListener("click", () => setTimeout(bhAdminCarregarSaudeApi, 250));
  document.getElementById("adminReleaseRefresh110")?.addEventListener("click", bhAdminCarregarSaudeApi);
});
