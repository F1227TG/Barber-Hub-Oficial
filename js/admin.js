/**
 * admin.js
 * Painel administrativo: métricas, usuários, estabelecimentos, moderação e tickets.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

let bhAdminDados = null;
let bhAdminPerfil = null;

function bhAdminFiltrarTexto(item, termo, campos) {
  if (!termo) return true;
  const texto = campos.map(campo => item[campo] || "").join(" ").toLowerCase();
  return texto.includes(termo.toLowerCase());
}

function bhRenderAdminKpis() {
  const { counts, perfis, estabelecimentos, tickets, agendamentos, denuncias, avaliacoes } = bhAdminDados;
  const ativos = perfis.filter(item => item.ativo).length;
  const visiveis = estabelecimentos.filter(item => item.visivel).length;
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
  document.getElementById("adminUltimaAtualizacao").textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`;
}

function bhRenderAdminEstabelecimentos() {
  const termo = document.getElementById("buscarAdminEstabelecimentos")?.value.trim() || "";
  const filtro = document.getElementById("filtroAdminEstabelecimentos")?.value || "todos";
  const itens = bhAdminDados.estabelecimentos.filter(item => bhAdminFiltrarTexto(item, termo, ["nome","cidade","bairro"]) && (
    filtro === "todos" ||
    (filtro === "visiveis" && item.visivel) ||
    (filtro === "ocultos" && !item.visivel) ||
    (filtro === "verificados" && item.verificado) ||
    (filtro === "destaques" && item.destaque)
  ));
  const tbody = document.getElementById("tbodyAdminEstabelecimentos");
  tbody.innerHTML = itens.length ? itens.map(item => `<tr>
    <td><div class="admin-entity"><div class="admin-entity-avatar"><i class="bi bi-shop"></i></div><div><strong>${escapeHTML(item.nome)}</strong><span>${escapeHTML(item.tipo_estabelecimento)}${item.verificado?` • <b class="verified-text">verificado</b>`:""}</span></div></div></td>
    <td>${escapeHTML([item.bairro,item.cidade,item.estado].filter(Boolean).join(", "))}</td>
    <td><span class="status ${item.aceita_agendamento?"aberta":"fechada"}">${item.aceita_agendamento?"Ativa":"Desativada"}</span></td>
    <td>${Number(item.avaliacao||0)>0?`<span class="rating">${Number(item.avaliacao).toFixed(1)} ★</span>`:"Sem avaliações"}</td>
    <td><div class="admin-state-stack"><span>${item.visivel?"Visível":"Oculto"}</span>${item.destaque?"<small>Destaque no portal</small>":""}</div></td>
    <td><div class="admin-control-group"><a class="icon-btn" href="barbearia.html?id=${item.id}" target="_blank" title="Abrir página"><i class="bi bi-box-arrow-up-right"></i></a><button class="icon-btn ${item.verificado?"success":""}" data-admin-verificar="${item.id}" data-valor="${item.verificado}" title="${item.verificado?"Remover verificação":"Verificar"}"><i class="bi bi-patch-check"></i></button><button class="icon-btn ${item.destaque?"success":""}" data-admin-destaque="${item.id}" data-valor="${item.destaque}" title="${item.destaque?"Remover destaque":"Destacar"}"><i class="bi bi-pin-angle"></i></button><button class="icon-btn ${item.visivel?"danger":"success"}" data-admin-visibilidade="${item.id}" data-valor="${item.visivel}" title="${item.visivel?"Ocultar":"Publicar"}"><i class="bi ${item.visivel?"bi-eye-slash":"bi-eye"}"></i></button></div></td>
  </tr>`).join("") : `<tr><td colspan="6"><div class="empty compact">Nenhum estabelecimento encontrado.</div></td></tr>`;
}

function bhRenderAdminUsuarios() {
  const termo = document.getElementById("buscarAdminUsuarios")?.value.trim() || "";
  const filtro = document.getElementById("filtroAdminUsuarios")?.value || "todos";
  const itens = bhAdminDados.perfis.filter(item => bhAdminFiltrarTexto(item, termo, ["nome","email"]) && (filtro === "todos" || item.tipo === filtro || (filtro === "inativo" && !item.ativo)));
  const tbody = document.getElementById("tbodyAdminUsuarios");
  tbody.innerHTML = itens.length ? itens.map(item => {
    const proprio = item.id === bhAdminPerfil.id;
    return `<tr><td><div class="admin-entity"><div class="admin-user-avatar">${escapeHTML((item.nome||"U").slice(0,1).toUpperCase())}</div><div><strong>${escapeHTML(item.nome)}</strong><span>${escapeHTML(item.email)}</span></div></div></td><td><select data-admin-role="${item.id}" ${proprio?"disabled":""}><option value="cliente" ${item.tipo==="cliente"?"selected":""}>Cliente</option><option value="barbeiro" ${item.tipo==="barbeiro"?"selected":""}>Barbeiro</option><option value="admin" ${item.tipo==="admin"?"selected":""}>Administrador</option></select></td><td><span class="status ${item.ativo?"concluido":"cancelado"}">${item.ativo?"Ativo":"Inativo"}</span></td><td>${new Date(item.created_at).toLocaleDateString("pt-BR")}</td><td><button class="btn ${item.ativo?"btn-danger":"btn-outline"} btn-small" data-admin-ativo="${item.id}" data-valor="${item.ativo}" ${proprio?"disabled title='Sua conta é protegida nesta tela'":""}>${item.ativo?"Desativar":"Ativar"}</button></td></tr>`;
  }).join("") : `<tr><td colspan="5"><div class="empty compact">Nenhum usuário encontrado.</div></td></tr>`;
}

function bhRenderAdminAgendamentos() {
  const filtro = document.getElementById("filtroAdminAgendamentos")?.value || "todos";
  const itens = bhAdminDados.agendamentos.filter(item => filtro === "todos" || item.status === filtro).slice(0,100);
  document.getElementById("tbodyAdminAgendamentos").innerHTML = itens.length ? itens.map(item => `<tr><td><strong>${escapeHTML(item.cliente_nome||"Conta excluída")}</strong><br><small>${escapeHTML(item.cliente_email||"")}</small></td><td>${bhFormatarData(item.data)} às ${bhHoraCurta(item.hora_inicio)}</td><td><span class="status ${item.status}">${escapeHTML(item.status)}</span></td><td>${escapeHTML(item.origem||"web")}</td><td>${bhMoeda(item.valor||0)}</td></tr>`).join("") : `<tr><td colspan="5"><div class="empty compact">Nenhum agendamento neste filtro.</div></td></tr>`;
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
      : item.agendamentos?.servicos?.nome
        ? `<span class="review-context"><i class="bi bi-scissors"></i> Atendimento: ${escapeHTML(item.agendamentos.servicos.nome)}</span>`
        : "";
    return `<article class="admin-review-card"><div class="review-manage-head"><div><strong>${escapeHTML(item.estabelecimentos?.nome||"Estabelecimento")}</strong><span>${"★".repeat(Number(item.nota||0))}${"☆".repeat(5-Number(item.nota||0))}</span></div><div class="review-meta-stack"><span class="review-source-badge ${verificada ? "verified" : "community"}"><i class="bi ${verificada ? "bi-patch-check-fill" : "bi-people-fill"}"></i> ${verificada ? "Verificada" : "Comunidade"}</span><span class="status ${item.status==="publicada"?"concluido":item.status==="ocultada"?"cancelado":"pendente"}">${escapeHTML(item.status.replace("_"," "))}</span></div></div>${contexto}<p>${escapeHTML(item.comentario||"Avaliação sem comentário.")}</p><small>${escapeHTML(item.perfis?.nome||"Conta excluída")} • ${new Date(item.created_at).toLocaleDateString("pt-BR")}</small>${item.resposta_estabelecimento?`<div class="business-reply"><strong>Resposta do estabelecimento</strong><p>${escapeHTML(item.resposta_estabelecimento)}</p></div>`:""}<div class="moderation-actions"><button class="btn btn-outline btn-small" data-admin-avaliacao-status="${item.id}" data-status="publicada"><i class="bi bi-eye"></i> Publicar</button><button class="btn btn-outline btn-small" data-admin-avaliacao-status="${item.id}" data-status="em_analise"><i class="bi bi-search"></i> Analisar</button><button class="btn btn-danger btn-small" data-admin-avaliacao-status="${item.id}" data-status="ocultada"><i class="bi bi-eye-slash"></i> Ocultar</button></div></article>`;
  }).join("") : `<div class="empty full-grid"><i class="bi bi-star big"></i><p>Nenhuma avaliação registrada.</p></div>`;
}

function bhRenderAdminDenuncias() {
  const denuncias = bhAdminDados.denuncias;
  const abertas = denuncias.filter(item => ["aberta","analisando"].includes(item.status));
  document.getElementById("adminDenunciasBadge").textContent = `${abertas.length} pendente${abertas.length===1?"":"s"}`;
  document.getElementById("listaAdminDenuncias").innerHTML = denuncias.length ? denuncias.map(item => { const p=item.portfolio_publicacoes; return `<article class="ticket-admin card moderation-card"><div class="card-body"><div class="section-top compact"><div><span class="badge">${escapeHTML(item.motivo.replaceAll("_"," "))}</span><h3>${escapeHTML(p?.titulo||"Publicação removida")}</h3><p>${escapeHTML(p?.estabelecimentos?.nome||"Estabelecimento")} • denúncia de ${escapeHTML(item.perfis?.nome||"usuário")}</p></div><span class="status ${["resolvida","rejeitada"].includes(item.status)?"concluido":"pendente"}">${escapeHTML(item.status)}</span></div><p class="ticket-message">${escapeHTML(item.detalhes||"Nenhum detalhe adicional informado.")}</p><div class="moderation-actions">${p?`<button class="btn btn-danger btn-small" data-denuncia-ocultar="${item.id}" data-publicacao-id="${p.id}"><i class="bi bi-eye-slash"></i> Ocultar publicação</button>`:""}<button class="btn btn-outline btn-small" data-denuncia-analisar="${item.id}">Em análise</button><button class="btn btn-outline btn-small" data-denuncia-rejeitar="${item.id}">Rejeitar</button></div></div></article>`; }).join("") : `<div class="empty full-grid"><i class="bi bi-shield-check big"></i><h3>Nenhuma denúncia</h3></div>`;
}

function bhRenderAdminTickets() {
  const filtro = document.getElementById("filtroAdminTickets")?.value || "todos";
  const itens = bhAdminDados.tickets.filter(item => filtro === "todos" || item.status === filtro);
  document.getElementById("listaAdminTickets").innerHTML = itens.length ? itens.map(ticket => `<article class="ticket-admin card"><div class="card-body"><div class="section-top compact"><div><span class="badge">${escapeHTML(ticket.prioridade)}</span><h3>${escapeHTML(ticket.assunto)}</h3><p>${escapeHTML(ticket.nome)} • ${escapeHTML(ticket.email)}</p></div><span class="status ${["respondido","fechado"].includes(ticket.status)?"concluido":"pendente"}">${escapeHTML(ticket.status)}</span></div><p class="ticket-message">${escapeHTML(ticket.mensagem)}</p><div class="form-grid" style="margin-top:16px"><div class="campo"><label>Status</label><select data-ticket-status="${ticket.id}"><option value="aberto" ${ticket.status==="aberto"?"selected":""}>Aberto</option><option value="em_atendimento" ${ticket.status==="em_atendimento"?"selected":""}>Em atendimento</option><option value="respondido" ${ticket.status==="respondido"?"selected":""}>Respondido</option><option value="fechado" ${ticket.status==="fechado"?"selected":""}>Fechado</option></select></div><div class="campo"><label>Resposta</label><textarea data-ticket-resposta="${ticket.id}">${escapeHTML(ticket.resposta||"")}</textarea></div></div><button class="btn btn-primary btn-small" data-ticket-salvar="${ticket.id}">Salvar atendimento</button></div></article>`).join("") : `<div class="empty full-grid">Nenhum ticket neste filtro.</div>`;
}

function bhRenderAdmin() { bhRenderAdminKpis(); bhRenderAdminEstabelecimentos(); bhRenderAdminUsuarios(); bhRenderAdminAgendamentos(); bhRenderAdminAvaliacoes(); bhRenderAdminDenuncias(); bhRenderAdminTickets(); }
async function bhRecarregarAdmin() { bhAdminDados = await bhAdminResumo(); bhRenderAdmin(); }
window.bhRecarregarAdmin = bhRecarregarAdmin;

async function bhAdminExecutar(botao, acao) { bhSetButtonLoading(botao,true,"..."); try { await acao(); await bhRecarregarAdmin(); } finally { bhSetButtonLoading(botao,false); } }

document.addEventListener("DOMContentLoaded", async () => {
  bhAdminPerfil = await bhRequireAuth(["admin"]); if (!bhAdminPerfil) return;
  document.getElementById("adminNome").textContent = bhAdminPerfil.nome;
  try { await bhRecarregarAdmin(); } catch (erro) { mostrarToast("erro","Falha ao carregar administração",bhErroMensagem(erro)); return; }
  document.getElementById("adminAtualizar")?.addEventListener("click", async e => { try { await bhAdminExecutar(e.currentTarget, bhRecarregarAdmin); mostrarToast("sucesso","Painel atualizado","Os dados mais recentes foram carregados."); } catch(erro){ mostrarToast("erro","Falha ao atualizar",bhErroMensagem(erro)); } });
  ["buscarAdminEstabelecimentos","filtroAdminEstabelecimentos"].forEach(id=>document.getElementById(id)?.addEventListener(id.startsWith("buscar")?"input":"change",bhRenderAdminEstabelecimentos));
  ["buscarAdminUsuarios","filtroAdminUsuarios"].forEach(id=>document.getElementById(id)?.addEventListener(id.startsWith("buscar")?"input":"change",bhRenderAdminUsuarios));
  document.getElementById("filtroAdminAgendamentos")?.addEventListener("change",bhRenderAdminAgendamentos);
  document.getElementById("filtroAdminTickets")?.addEventListener("change",bhRenderAdminTickets);

  document.body.addEventListener("change", async evento => {
    const role = evento.target.closest("[data-admin-role]"); if (!role) return;
    if (!await bhConfirmar({ titulo: "Alterar permissão", mensagem: `Alterar este usuário para ${role.value}? O acesso ao sistema será atualizado imediatamente.`, confirmarTexto: "Alterar permissão", trigger: role })) { await bhRecarregarAdmin(); return; }
    try { await bhAdminAtualizarPerfil(role.dataset.adminRole,{tipo:role.value}); mostrarToast("sucesso","Perfil atualizado","A permissão foi alterada."); await bhRecarregarAdmin(); } catch(erro){ mostrarToast("erro","Falha ao alterar perfil",bhErroMensagem(erro)); await bhRecarregarAdmin(); }
  });

  document.body.addEventListener("click", async evento => {
    const vis = evento.target.closest("[data-admin-visibilidade]"); const ver = evento.target.closest("[data-admin-verificar]"); const dest = evento.target.closest("[data-admin-destaque]"); const ativo = evento.target.closest("[data-admin-ativo]"); const av = evento.target.closest("[data-admin-avaliacao-status]");
    try {
      if (vis) { await bhAdminAtualizarEstabelecimento(vis.dataset.adminVisibilidade,{visivel:vis.dataset.valor!=="true"}); mostrarToast("sucesso","Visibilidade atualizada","A alteração já está ativa no portal."); await bhRecarregarAdmin(); return; }
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
