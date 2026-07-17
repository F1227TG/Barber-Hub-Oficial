let bhPainelPerfil = null;
let bhPainelEstabelecimento = null;
let bhPainelAgendamentos = [];
let bhPainelPortfolio = [];
let bhPortfolioFiltro = "todas";
let bhPortfolioArquivos = [];
let bhPortfolioSubmitStatus = "rascunho";

function bhAtivarSecaoPainel(id) {
  document.querySelectorAll(".panel-section").forEach(secao => secao.classList.toggle("ativo", secao.id === id));
  document.querySelectorAll("[data-panel]").forEach(botao => {
    botao.classList.toggle("btn-primary", botao.dataset.panel === id);
    botao.classList.toggle("btn-dark", botao.dataset.panel !== id);
  });
  history.replaceState(null, "", `#${id.replace("sec", "").toLowerCase()}`);
}

function bhRenderKpisPainel() {
  const hoje = new Date();
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - hoje.getDay());
  inicioSemana.setHours(0, 0, 0, 0);
  const semana = bhPainelAgendamentos.filter(item => new Date(`${item.data}T00:00:00`) >= inicioSemana && !["cancelado", "recusado"].includes(item.status));
  const faturamento = semana.filter(item => item.status === "concluido").reduce((soma, item) => soma + Number(item.valor || 0), 0);
  const status = bhCalcularStatus(bhPainelEstabelecimento);
  document.getElementById("kpiSemana").textContent = semana.length;
  document.getElementById("kpiFaturamento").textContent = bhMoeda(faturamento);
  document.getElementById("kpiServicos").textContent = bhPainelEstabelecimento.servicos.filter(item => item.ativo).length;
  document.getElementById("kpiStatus").textContent = status.texto;
  const recomendacao = bhRecomendacaoPainel(bhPainelAgendamentos, bhPainelEstabelecimento.servicos);
  document.getElementById("iaPainel").innerHTML = `<h3><i class="bi bi-stars"></i> ${escapeHTML(recomendacao.titulo)}</h3><p>${escapeHTML(recomendacao.texto)}</p>`;
}

function bhRenderAgendaPainel() {
  const tbody = document.getElementById("tbodyAgendamentos");
  if (!bhPainelAgendamentos.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty compact">Nenhum agendamento recebido.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = bhPainelAgendamentos.map(item => `
    <tr>
      <td><strong>${escapeHTML(item.cliente_nome)}</strong><br><small>${escapeHTML(item.cliente_telefone || item.cliente_email)}</small></td>
      <td>${bhFormatarData(item.data)}</td>
      <td>${bhHoraCurta(item.hora_inicio)}</td>
      <td>${escapeHTML(item.servicos?.nome || "Serviço")}</td>
      <td>${escapeHTML(item.profissionais?.nome || "Profissional")}</td>
      <td><span class="status ${item.status}">${escapeHTML(item.status)}</span></td>
      <td><div class="table-actions">
        ${item.status === "pendente" ? `<button class="icon-btn success" data-agenda-status="confirmado" data-id="${item.id}" title="Confirmar"><i class="bi bi-check-lg"></i></button><button class="icon-btn danger" data-agenda-status="recusado" data-id="${item.id}" title="Recusar"><i class="bi bi-x-lg"></i></button>` : ""}
        ${item.status === "confirmado" ? `<button class="icon-btn success" data-agenda-status="concluido" data-id="${item.id}" title="Concluir"><i class="bi bi-check2-all"></i></button><button class="icon-btn danger" data-agenda-status="cancelado" data-id="${item.id}" title="Cancelar"><i class="bi bi-calendar-x"></i></button>` : ""}
      </div></td>
    </tr>`).join("");
}

function bhRenderServicosPainel() {
  const lista = document.getElementById("listaServicosPainel");
  const itens = bhPainelEstabelecimento.servicos;
  lista.innerHTML = itens.length ? itens.map(item => `
    <div class="simple-item">
      <div><strong>${escapeHTML(item.nome)}</strong><span>${bhMoeda(item.preco)} • ${item.duracao_min} min • ${item.ativo ? "Ativo" : "Inativo"}</span></div>
      <div class="item-actions">
        <button class="icon-btn" data-servico-toggle="${item.id}" data-ativo="${item.ativo}" title="Ativar/inativar"><i class="bi ${item.ativo ? "bi-toggle-on" : "bi-toggle-off"}"></i></button>
        <button class="icon-btn danger" data-servico-delete="${item.id}" title="Excluir"><i class="bi bi-trash"></i></button>
      </div>
    </div>`).join("") : `<div class="empty compact">Cadastre seu primeiro serviço.</div>`;
}

function bhRenderProfissionaisPainel() {
  const lista = document.getElementById("listaBarbeirosPainel");
  const itens = bhPainelEstabelecimento.barbeiros;
  lista.innerHTML = itens.length ? itens.map(item => `
    <div class="simple-item">
      <div style="display:flex;align-items:center;gap:12px"><div class="avatar">${escapeHTML(item.avatar)}</div><div><strong>${escapeHTML(item.nome)}</strong><span>${escapeHTML(item.especialidade || "Profissional")} • ${item.ativo ? "Ativo" : "Inativo"}</span></div></div>
      <div class="item-actions">
        <button class="icon-btn" data-profissional-toggle="${item.id}" data-ativo="${item.ativo}" title="Ativar/inativar"><i class="bi ${item.ativo ? "bi-toggle-on" : "bi-toggle-off"}"></i></button>
        ${item.user_id ? "" : `<button class="icon-btn danger" data-profissional-delete="${item.id}" title="Excluir"><i class="bi bi-trash"></i></button>`}
      </div>
    </div>`).join("") : `<div class="empty compact">Nenhum profissional cadastrado.</div>`;
}

function bhRenderRelatoriosPainel() {
  const analise = bhAnalisarAgendamentos(bhPainelAgendamentos);
  const renderBarras = (objeto, alvo) => {
    const entradas = Object.entries(objeto).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = Math.max(...entradas.map(item => item[1]), 1);
    document.getElementById(alvo).innerHTML = entradas.length ? entradas.map(([nome, valor]) => `
      <div class="bar-row"><span>${escapeHTML(nome)}</span><div class="bar-bg"><div class="bar-fill" style="width:${(valor / max) * 100}%"></div></div><strong>${valor}</strong></div>
    `).join("") : `<div class="empty compact">Ainda não há dados suficientes.</div>`;
  };
  renderBarras(analise.contagemServicos, "chartServicos");
  renderBarras(analise.contagemHoras, "chartHorarios");
}

function bhRenderConfiguracoesPainel() {
  const b = bhPainelEstabelecimento;
  document.getElementById("configNome").value = b.nome || "";
  document.getElementById("configTelefone").value = b.telefone || "";
  document.getElementById("configWhatsapp").value = b.whatsapp || "";
  document.getElementById("configInstagram").value = b.instagram || "";
  document.getElementById("configEndereco").value = b.endereco || "";
  document.getElementById("configDescricao").value = b.descricao || "";
  document.getElementById("configStatus").value = b.statusManual || "automatico";
  document.getElementById("configMotivoStatus").value = b.motivoStatus || "";
  document.getElementById("configAgenda").value = b.aceitaAgendamento ? "sim" : "nao";
  document.getElementById("configFotoPreview").src = b.fotoUrl || "../img/logomarcaTRANSPARENTE.png";
  document.getElementById("configCapaPreview").src = b.capaUrl || "../img/logoblack.png";

  document.querySelectorAll(".horario-config-painel").forEach(row => {
    const dia = Number(row.dataset.dia);
    const chave = BH_DIAS[dia];
    const horario = b.horarios[chave];
    const check = row.querySelector("[data-horario-aberto]");
    const abre = row.querySelector("[data-horario-abre]");
    const fecha = row.querySelector("[data-horario-fecha]");
    check.checked = Boolean(horario);
    abre.value = horario?.abre || "08:00";
    fecha.value = horario?.fecha || "18:00";
    abre.disabled = !horario;
    fecha.disabled = !horario;
    row.classList.toggle("fechado", !horario);
  });

  const dias = document.getElementById("diasFechadosPainel");
  dias.innerHTML = b.diasFechados.length ? b.diasFechados.map(item => `
    <div class="simple-item"><div><strong>${bhFormatarData(item.data)}</strong><span>${escapeHTML(item.motivo || "Data bloqueada")}</span></div><button class="icon-btn danger" data-bloqueio-delete="${item.id}"><i class="bi bi-trash"></i></button></div>
  `).join("") : `<div class="empty compact">Nenhuma data bloqueada.</div>`;
}

function bhRenderPaginaPublicaPreview() {
  const link = document.getElementById("linkPaginaPublica");
  const nome = document.getElementById("previewBusinessName");
  if (link) link.href = `barbearia.html?id=${bhPainelEstabelecimento.id}`;
  if (nome) nome.textContent = bhPainelEstabelecimento.nome || "Seu estabelecimento";
}


function bhPortfolioItemPorId(id) {
  return bhPainelPortfolio.find(item => item.id === id) || null;
}

function bhPopularCamposPortfolio() {
  const categoria = document.getElementById("portfolioCategoria");
  if (categoria && !categoria.options.length) {
    categoria.innerHTML = `<option value="">Selecione</option>${BH_PORTFOLIO_CATEGORIAS.map(item => `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`).join("")}`;
  }
  const profissional = document.getElementById("portfolioProfissional");
  if (profissional) {
    const atual = profissional.value;
    profissional.innerHTML = `<option value="">Selecione</option>${bhPainelEstabelecimento.barbeiros.filter(item => item.ativo).map(item => `<option value="${item.id}">${escapeHTML(item.nome)}</option>`).join("")}`;
    if ([...profissional.options].some(opt => opt.value === atual)) profissional.value = atual;
  }
  const servico = document.getElementById("portfolioServico");
  if (servico) {
    const atual = servico.value;
    servico.innerHTML = `<option value="">Opcional</option>${bhPainelEstabelecimento.servicos.filter(item => item.ativo).map(item => `<option value="${item.id}">${escapeHTML(item.nome)}</option>`).join("")}`;
    if ([...servico.options].some(opt => opt.value === atual)) servico.value = atual;
  }
}

function bhRenderPreviewPortfolio() {
  const alvo = document.getElementById("portfolioNovasFotos");
  if (!alvo) return;
  alvo.innerHTML = bhPortfolioArquivos.map((file, indice) => `
    <div class="portfolio-preview-item">
      <img src="${URL.createObjectURL(file)}" alt="Prévia ${indice + 1}">
      <span>${indice === 0 ? "Capa" : `Foto ${indice + 1}`}</span>
      <button type="button" class="icon-btn danger" data-remover-preview="${indice}" aria-label="Remover foto"><i class="bi bi-x-lg"></i></button>
    </div>`).join("");
}

function bhRenderFotosExistentesPortfolio(publicacao) {
  const bloco = document.getElementById("portfolioFotosExistentes");
  const grid = document.getElementById("portfolioExistentesGrid");
  if (!bloco || !grid) return;
  bloco.hidden = !publicacao?.midias?.length;
  const midias = publicacao?.midias || [];
  grid.innerHTML = midias.map((item, indice) => `
    <div class="portfolio-preview-item portfolio-existing-item">
      <img src="${escapeHTML(item.public_url)}" alt="${escapeHTML(item.texto_alternativo || publicacao.titulo)}">
      <span>${item.ordem === publicacao.capa_ordem ? "Capa" : item.tipo === "antes" ? "Antes" : item.tipo === "depois" ? "Depois" : `Foto ${item.ordem}`}</span>
      <div class="portfolio-media-controls">
        <button type="button" class="icon-btn" data-mover-midia="${item.id}" data-direcao="-1" aria-label="Mover foto para a esquerda" ${indice === 0 ? "disabled" : ""}><i class="bi bi-arrow-left"></i></button>
        <button type="button" class="icon-btn" data-definir-capa="${item.id}" aria-label="Definir como capa" ${item.ordem === publicacao.capa_ordem ? "disabled" : ""}><i class="bi bi-image"></i></button>
        <button type="button" class="icon-btn" data-mover-midia="${item.id}" data-direcao="1" aria-label="Mover foto para a direita" ${indice === midias.length - 1 ? "disabled" : ""}><i class="bi bi-arrow-right"></i></button>
        <button type="button" class="icon-btn danger" data-remover-midia="${item.id}" aria-label="Excluir foto"><i class="bi bi-trash"></i></button>
      </div>
    </div>`).join("");
}

function bhResetFormPortfolio() {
  const form = document.getElementById("formPortfolio");
  if (!form) return;
  form.reset();
  document.getElementById("portfolioId").value = "";
  document.getElementById("portfolioFormTitulo").textContent = "Nova publicação";
  document.getElementById("cancelarEdicaoPortfolio").hidden = true;
  document.getElementById("portfolioResponsavelLinha").hidden = true;
  document.getElementById("portfolioFotosExistentes").hidden = true;
  document.getElementById("portfolioExistentesGrid").innerHTML = "";
  bhPortfolioArquivos = [];
  bhRenderPreviewPortfolio();
  bhPopularCamposPortfolio();
}

function bhEditarPortfolio(id) {
  const item = bhPortfolioItemPorId(id);
  if (!item) return;
  if (item.status === "ocultada") {
    mostrarToast("aviso", "Publicação em moderação", "Este conteúdo não pode ser editado ou republicado. Você ainda pode excluí-lo definitivamente.");
    return;
  }
  bhAtivarSecaoPainel("secGaleria");
  document.getElementById("portfolioId").value = item.id;
  document.getElementById("portfolioFormTitulo").textContent = "Editar publicação";
  document.getElementById("cancelarEdicaoPortfolio").hidden = false;
  document.getElementById("portfolioTitulo").value = item.titulo || "";
  document.getElementById("portfolioDescricao").value = item.descricao || "";
  document.getElementById("portfolioCategoria").value = item.categoria || "";
  document.getElementById("portfolioProfissional").value = item.profissional_id || "";
  document.getElementById("portfolioServico").value = item.servico_id || "";
  document.getElementById("portfolioData").value = item.data_trabalho || "";
  document.getElementById("portfolioTags").value = (item.tags || []).join(", ");
  document.getElementById("portfolioModo").value = item.modo || "galeria";
  document.getElementById("portfolioDestaque").checked = Boolean(item.destaque);
  document.getElementById("portfolioAutorizacao").checked = Boolean(item.confirmou_autorizacao);
  document.getElementById("portfolioTemMenor").checked = Boolean(item.possui_menor);
  document.getElementById("portfolioResponsavel").checked = Boolean(item.confirmou_responsavel);
  document.getElementById("portfolioResponsavelLinha").hidden = !item.possui_menor;
  bhPortfolioArquivos = [];
  bhRenderPreviewPortfolio();
  bhRenderFotosExistentesPortfolio(item);
  document.getElementById("formPortfolio").scrollIntoView({ behavior: "smooth", block: "start" });
}

function bhRenderPortfolioPainel() {
  bhPopularCamposPortfolio();
  const contagem = document.getElementById("portfolioContagem");
  if (contagem) contagem.textContent = bhPainelPortfolio.length;
  const lista = document.getElementById("listaPortfolioPainel");
  if (!lista) return;
  const itens = bhPortfolioFiltro === "todas" ? bhPainelPortfolio : bhPainelPortfolio.filter(item => item.status === bhPortfolioFiltro);
  if (!itens.length) {
    lista.innerHTML = `<div class="empty compact">Nenhuma publicação nesta categoria.</div>`;
    return;
  }
  lista.innerHTML = itens.map(item => {
    const capa = item.midias.find(m => m.ordem === item.capa_ordem) || item.midias[0];
    return `<article class="portfolio-admin-card">
      <div class="portfolio-admin-cover">${capa ? `<img src="${escapeHTML(capa.public_url)}" alt="${escapeHTML(item.titulo)}">` : `<div class="empty compact">Sem foto</div>`}${item.destaque ? `<span class="featured-label"><i class="bi bi-pin-angle-fill"></i> Destaque</span>` : ""}</div>
      <div class="portfolio-admin-body">
        <div class="card-meta"><span class="status ${item.status}">${escapeHTML(item.status)}</span><span class="badge">${escapeHTML(item.categoria)}</span></div>
        <h3>${escapeHTML(item.titulo)}</h3>
        <p>${escapeHTML(item.descricao || "Sem descrição")}</p>
        <div class="portfolio-card-stats"><span><i class="bi bi-images"></i> ${item.midias.length}/5</span><span><i class="bi bi-heart-fill"></i> ${item.curtidas_count || 0}</span><span><i class="bi bi-person"></i> ${escapeHTML(item.profissional?.nome || "Profissional")}</span></div>
        <div class="portfolio-admin-actions">
          ${item.status === "ocultada" ? `<span class="moderation-lock"><i class="bi bi-shield-lock"></i> Bloqueada para republicação</span>` : `
            <button class="icon-btn" data-portfolio-editar="${item.id}" title="Editar"><i class="bi bi-pencil"></i></button>
            <button class="icon-btn" data-portfolio-status-toggle="${item.id}" data-status-atual="${item.status}" title="${item.status === "publicada" ? "Arquivar" : "Publicar"}"><i class="bi ${item.status === "publicada" ? "bi-archive" : "bi-send"}"></i></button>
            <button class="icon-btn" data-portfolio-destaque="${item.id}" data-destaque-atual="${item.destaque}" title="Destacar"><i class="bi ${item.destaque ? "bi-pin-angle-fill" : "bi-pin-angle"}"></i></button>
          `}
          <button class="icon-btn danger" data-portfolio-excluir="${item.id}" title="Excluir definitivamente"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </article>`;
  }).join("");
}

function bhDadosFormPortfolio(status) {
  const tags = document.getElementById("portfolioTags").value.split(",").map(item => item.trim()).filter(Boolean);
  if (tags.length > 5) throw new Error("Use no máximo 5 tags.");
  const possuiMenor = document.getElementById("portfolioTemMenor").checked;
  const confirmouAutorizacao = document.getElementById("portfolioAutorizacao").checked;
  const confirmouResponsavel = document.getElementById("portfolioResponsavel").checked;
  if (status === "publicada" && !confirmouAutorizacao) throw new Error("Confirme a autorização para publicar as imagens.");
  if (status === "publicada" && possuiMenor && !confirmouResponsavel) throw new Error("Confirme a autorização do responsável legal.");
  return {
    titulo: document.getElementById("portfolioTitulo").value.trim(),
    descricao: document.getElementById("portfolioDescricao").value.trim(),
    categoria: document.getElementById("portfolioCategoria").value,
    profissional_id: document.getElementById("portfolioProfissional").value,
    servico_id: document.getElementById("portfolioServico").value || null,
    data_trabalho: document.getElementById("portfolioData").value || null,
    tags,
    modo: document.getElementById("portfolioModo").value,
    destaque: document.getElementById("portfolioDestaque").checked,
    confirmou_autorizacao: confirmouAutorizacao,
    possui_menor: possuiMenor,
    confirmou_responsavel: possuiMenor ? confirmouResponsavel : false,
    status
  };
}

async function bhRecarregarPainel() {
  bhPainelEstabelecimento = await bhObterMeuEstabelecimento();
  if (!bhPainelEstabelecimento) {
    location.href = "cadastro-barbearia.html";
    return;
  }
  [bhPainelAgendamentos, bhPainelPortfolio] = await Promise.all([
    bhListarAgendamentosEstabelecimento(bhPainelEstabelecimento.id),
    bhListarMeuPortfolio(bhPainelEstabelecimento.id)
  ]);
  document.getElementById("painelUserNome").textContent = bhPainelPerfil.nome;
  document.getElementById("painelUserTipo").textContent = bhPainelPerfil.tipo === "admin" ? "Administrador" : "Proprietário";
  document.getElementById("nomeBarbeariaPainel").textContent = bhPainelEstabelecimento.nome;
  bhRenderKpisPainel();
  bhRenderAgendaPainel();
  bhRenderServicosPainel();
  bhRenderProfissionaisPainel();
  bhRenderRelatoriosPainel();
  bhRenderConfiguracoesPainel();
  bhRenderPaginaPublicaPreview();
  bhRenderPortfolioPainel();
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("painel");
  bhPainelPerfil = await bhRequireAuth(["barbeiro", "admin"]);
  if (!bhPainelPerfil) return;
  if (bhPainelPerfil.tipo === "barbeiro" && !bhPainelPerfil.onboarding_concluido) {
    location.href = "cadastro-barbearia.html";
    return;
  }

  try {
    await bhRecarregarPainel();
  } catch (erro) {
    mostrarToast("erro", "Falha ao carregar painel", bhErroMensagem(erro));
    return;
  }

  document.querySelectorAll("[data-panel]").forEach(botao => botao.addEventListener("click", () => bhAtivarSecaoPainel(botao.dataset.panel)));
  const hash = location.hash.replace("#", "");
  const mapaHash = { agenda: "secAgenda", servicos: "secServicos", equipe: "secBarbeiros", relatorios: "secRelatorios", galeria: "secGaleria", configuracoes: "secConfig", pagina: "secPagina" };
  if (mapaHash[hash]) bhAtivarSecaoPainel(mapaHash[hash]);

  document.querySelectorAll("[data-horario-aberto]").forEach(check => check.addEventListener("change", () => {
    const row = check.closest(".horario-config-painel");
    row.querySelectorAll("input[type='time']").forEach(input => { input.disabled = !check.checked; });
    row.classList.toggle("fechado", !check.checked);
  }));

  document.getElementById("tbodyAgendamentos").addEventListener("click", async evento => {
    const botao = evento.target.closest("[data-agenda-status]");
    if (!botao) return;
    try {
      await bhAtualizarStatusAgendamento(botao.dataset.id, botao.dataset.agendaStatus);
      mostrarToast("sucesso", "Agenda atualizada", `Status alterado para ${botao.dataset.agendaStatus}.`);
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Falha ao atualizar", bhErroMensagem(erro)); }
  });

  document.getElementById("formServico").addEventListener("submit", async evento => {
    evento.preventDefault();
    const botao = evento.currentTarget.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Salvando...");
    let salvo = false;
    try {
      await bhCriarServico(bhPainelEstabelecimento.id, {
        nome: document.getElementById("servNome").value.trim(),
        categoria: document.getElementById("servCategoria").value.trim(),
        preco: Number(document.getElementById("servPreco").value),
        duracao_min: Number(document.getElementById("servDuracao").value),
        descricao: document.getElementById("servDescricao").value.trim(),
        ativo: true,
        publico: true
      });
      salvo = true;
      evento.currentTarget.reset();
      mostrarToast("sucesso", "Serviço adicionado", "O serviço foi salvo corretamente.");
    } catch (erro) {
      mostrarToast("erro", "Falha ao salvar serviço", bhErroMensagem(erro));
    } finally { bhSetButtonLoading(botao, false); }
    if (salvo) {
      try { await bhRecarregarPainel(); }
      catch (erro) {
        console.warn("Serviço salvo, mas a atualização visual falhou.", erro);
        mostrarToast("aviso", "Serviço salvo", "Atualize a página caso ele ainda não apareça na lista.");
      }
    }
  });

  document.getElementById("listaServicosPainel").addEventListener("click", async evento => {
    const toggle = evento.target.closest("[data-servico-toggle]");
    const excluir = evento.target.closest("[data-servico-delete]");
    try {
      if (toggle) await bhAtualizarServico(toggle.dataset.servicoToggle, { ativo: toggle.dataset.ativo !== "true" });
      if (excluir && confirm("Excluir este serviço? Agendamentos antigos continuarão preservados.")) await bhExcluirServico(excluir.dataset.servicoDelete);
      if (toggle || excluir) await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Ação não concluída", bhErroMensagem(erro)); }
  });

  document.getElementById("formBarbeiro").addEventListener("submit", async evento => {
    evento.preventDefault();
    const botao = evento.currentTarget.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Salvando...");
    try {
      await bhCriarProfissional(bhPainelEstabelecimento.id, {
        nome: document.getElementById("barbNome").value.trim(),
        especialidade: document.getElementById("barbEspecialidade").value.trim(),
        telefone: document.getElementById("barbTelefone").value.trim() || null,
        email: document.getElementById("barbEmail").value.trim() || null,
        ativo: true,
        aceita_agendamento: document.getElementById("barbAgenda").checked
      });
      evento.currentTarget.reset();
      document.getElementById("barbAgenda").checked = true;
      mostrarToast("sucesso", "Profissional adicionado", "A equipe já aparece na página pública.");
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Falha ao salvar profissional", bhErroMensagem(erro)); }
    finally { bhSetButtonLoading(botao, false); }
  });

  document.getElementById("listaBarbeirosPainel").addEventListener("click", async evento => {
    const toggle = evento.target.closest("[data-profissional-toggle]");
    const excluir = evento.target.closest("[data-profissional-delete]");
    try {
      if (toggle) await bhAtualizarProfissional(toggle.dataset.profissionalToggle, { ativo: toggle.dataset.ativo !== "true" });
      if (excluir && confirm("Excluir este profissional?")) await bhExcluirProfissional(excluir.dataset.profissionalDelete);
      if (toggle || excluir) await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Ação não concluída", bhErroMensagem(erro)); }
  });


  document.getElementById("portfolioFotos").addEventListener("change", evento => {
    const arquivos = [...(evento.target.files || [])];
    const editando = bhPortfolioItemPorId(document.getElementById("portfolioId").value);
    const existentes = editando?.midias?.length || 0;
    if (arquivos.some(file => file.size > BH_PORTFOLIO_MAX_ORIGINAL)) {
      mostrarToast("erro", "Imagem muito grande", "Cada arquivo original deve ter no máximo 8 MB.");
      evento.target.value = "";
      return;
    }
    if (existentes + arquivos.length > BH_PORTFOLIO_MAX_FOTOS) {
      mostrarToast("erro", "Limite de fotos", `Você pode adicionar somente ${BH_PORTFOLIO_MAX_FOTOS - existentes} nova(s) foto(s).`);
      evento.target.value = "";
      return;
    }
    bhPortfolioArquivos = arquivos;
    bhRenderPreviewPortfolio();
  });

  document.getElementById("portfolioNovasFotos").addEventListener("click", evento => {
    const botao = evento.target.closest("[data-remover-preview]");
    if (!botao) return;
    bhPortfolioArquivos.splice(Number(botao.dataset.removerPreview), 1);
    document.getElementById("portfolioFotos").value = "";
    bhRenderPreviewPortfolio();
  });

  document.getElementById("portfolioTemMenor").addEventListener("change", evento => {
    document.getElementById("portfolioResponsavelLinha").hidden = !evento.target.checked;
    if (!evento.target.checked) document.getElementById("portfolioResponsavel").checked = false;
  });
  document.getElementById("cancelarEdicaoPortfolio").addEventListener("click", bhResetFormPortfolio);
  document.querySelectorAll("[data-portfolio-filtro]").forEach(botao => botao.addEventListener("click", () => {
    bhPortfolioFiltro = botao.dataset.portfolioFiltro;
    document.querySelectorAll("[data-portfolio-filtro]").forEach(item => item.classList.toggle("ativo", item === botao));
    bhRenderPortfolioPainel();
  }));

  document.getElementById("formPortfolio").addEventListener("click", evento => {
    const submit = evento.target.closest("button[type='submit'][data-portfolio-status]");
    if (submit) bhPortfolioSubmitStatus = submit.dataset.portfolioStatus;
  });

  document.getElementById("formPortfolio").addEventListener("submit", async evento => {
    evento.preventDefault();
    const status = evento.submitter?.dataset.portfolioStatus || bhPortfolioSubmitStatus || "rascunho";
    const botao = evento.submitter || evento.currentTarget.querySelector(`[data-portfolio-status="${status}"]`);
    bhSetButtonLoading(botao, true, status === "publicada" ? "Publicando..." : "Salvando...");
    const id = document.getElementById("portfolioId").value;
    const estadoAnterior = id ? bhPortfolioItemPorId(id)?.status : null;
    try {
      const dados = bhDadosFormPortfolio(status);
      if (!id) {
        await bhCriarPublicacaoPortfolio(bhPainelEstabelecimento.id, dados, bhPortfolioArquivos);
      } else {
        const atual = bhPortfolioItemPorId(id);
        if (!atual) throw new Error("Publicação não encontrada.");
        if (!atual.midias.length && !bhPortfolioArquivos.length) throw new Error("Adicione pelo menos uma foto.");
        // Mantém a publicação em rascunho durante novos uploads e publica somente ao final.
        await bhAtualizarPublicacaoPortfolio(id, { ...dados, status: "rascunho" });
        if (bhPortfolioArquivos.length) await bhAdicionarFotosPortfolio({ ...atual, status: "rascunho", modo: dados.modo }, bhPortfolioArquivos);
        await bhSincronizarTiposMidiaPortfolio(id, atual.capa_ordem);
        await bhAtualizarPublicacaoPortfolio(id, { status, destaque: dados.destaque, modo: dados.modo });
      }
      mostrarToast("sucesso", status === "publicada" ? "Trabalho publicado" : "Rascunho salvo", "A galeria foi atualizada.");
      bhResetFormPortfolio();
      await bhRecarregarPainel();
    } catch (erro) {
      if (id && estadoAnterior && estadoAnterior !== "rascunho") {
        try { await bhAtualizarPublicacaoPortfolio(id, { status: estadoAnterior }); }
        catch (erroRestauracao) { console.warn("Não foi possível restaurar o estado anterior da publicação.", erroRestauracao); }
      }
      mostrarToast("erro", "Não foi possível salvar", bhErroMensagem(erro));
    } finally { bhSetButtonLoading(botao, false); }
  });

  document.getElementById("portfolioExistentesGrid").addEventListener("click", async evento => {
    const remover = evento.target.closest("[data-remover-midia]");
    const mover = evento.target.closest("[data-mover-midia]");
    const capa = evento.target.closest("[data-definir-capa]");
    if (!remover && !mover && !capa) return;
    const publicacao = bhPortfolioItemPorId(document.getElementById("portfolioId").value);
    if (!publicacao) return;
    try {
      if (remover) {
        const midia = publicacao.midias.find(item => item.id === remover.dataset.removerMidia);
        if (!midia || !confirm("Excluir esta foto permanentemente?")) return;
        await bhRemoverMidiaPortfolio(midia, publicacao);
        mostrarToast("sucesso", "Foto removida", "O arquivo também foi removido do armazenamento.");
      }
      if (mover) {
        const ordenadas = [...publicacao.midias];
        const atual = ordenadas.findIndex(item => item.id === mover.dataset.moverMidia);
        const destino = atual + Number(mover.dataset.direcao);
        if (atual < 0 || destino < 0 || destino >= ordenadas.length) return;
        [ordenadas[atual], ordenadas[destino]] = [ordenadas[destino], ordenadas[atual]];
        const capaAtual = publicacao.midias.find(item => item.ordem === publicacao.capa_ordem)?.id || ordenadas[0].id;
        await bhReordenarMidiasPortfolio(publicacao.id, ordenadas, capaAtual);
      }
      if (capa) {
        await bhReordenarMidiasPortfolio(publicacao.id, publicacao.midias, capa.dataset.definirCapa);
        mostrarToast("sucesso", "Capa atualizada", "A nova capa já será usada na galeria.");
      }
      await bhRecarregarPainel();
      const atualizada = bhPortfolioItemPorId(publicacao.id);
      if (atualizada) bhEditarPortfolio(atualizada.id); else bhResetFormPortfolio();
    } catch (erro) { mostrarToast("erro", "Não foi possível atualizar as fotos", bhErroMensagem(erro)); }
  });

  document.getElementById("listaPortfolioPainel").addEventListener("click", async evento => {
    const editar = evento.target.closest("[data-portfolio-editar]");
    const status = evento.target.closest("[data-portfolio-status-toggle]");
    const destaque = evento.target.closest("[data-portfolio-destaque]");
    const excluir = evento.target.closest("[data-portfolio-excluir]");
    if (editar) return bhEditarPortfolio(editar.dataset.portfolioEditar);
    try {
      if (status) {
        const proximo = status.dataset.statusAtual === "publicada" ? "arquivada" : "publicada";
        await bhAtualizarPublicacaoPortfolio(status.dataset.portfolioStatusToggle, { status: proximo });
        mostrarToast("sucesso", proximo === "publicada" ? "Publicação visível" : "Publicação arquivada", "A página pública foi atualizada.");
      }
      if (destaque) {
        await bhAtualizarPublicacaoPortfolio(destaque.dataset.portfolioDestaque, { destaque: destaque.dataset.destaqueAtual !== "true" });
      }
      if (excluir) {
        const item = bhPortfolioItemPorId(excluir.dataset.portfolioExcluir);
        if (!item || !confirm("Esta ação excluirá permanentemente a publicação, as fotos e suas interações. Deseja continuar?")) return;
        await bhExcluirPublicacaoPortfolio(item);
        mostrarToast("sucesso", "Publicação excluída", "As fotos foram removidas do Storage.");
      }
      if (status || destaque || excluir) await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Ação não concluída", bhErroMensagem(erro)); }
  });

  document.getElementById("formConfig").addEventListener("submit", async evento => {
    evento.preventDefault();
    const botao = evento.currentTarget.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Atualizando...");
    try {
      const foto = document.getElementById("configFoto").files?.[0];
      const capa = document.getElementById("configCapa").files?.[0];
      const [fotoUrl, capaUrl] = await Promise.all([
        foto ? bhUploadImagem(foto, "estabelecimento/foto") : Promise.resolve(bhPainelEstabelecimento.fotoUrl),
        capa ? bhUploadImagem(capa, "estabelecimento/capa") : Promise.resolve(bhPainelEstabelecimento.capaUrl)
      ]);
      await bhAtualizarEstabelecimento(bhPainelEstabelecimento.id, {
        nome: document.getElementById("configNome").value.trim(),
        telefone: document.getElementById("configTelefone").value.trim(),
        whatsapp: bhNormalizarWhatsApp(document.getElementById("configWhatsapp").value),
        instagram: document.getElementById("configInstagram").value.trim(),
        endereco: document.getElementById("configEndereco").value.trim(),
        descricao: document.getElementById("configDescricao").value.trim(),
        status_manual: document.getElementById("configStatus").value,
        motivo_status: document.getElementById("configMotivoStatus").value.trim() || null,
        aceita_agendamento: document.getElementById("configAgenda").value === "sim",
        foto_url: fotoUrl,
        capa_url: capaUrl
      });
      mostrarToast("sucesso", "Configurações salvas", "Sua página pública foi atualizada.");
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Falha ao salvar", bhErroMensagem(erro)); }
    finally { bhSetButtonLoading(botao, false); }
  });

  document.getElementById("formHorarios").addEventListener("submit", async evento => {
    evento.preventDefault();
    const horarios = [...document.querySelectorAll(".horario-config-painel")].map(row => ({
      dia_semana: Number(row.dataset.dia),
      aberto: row.querySelector("[data-horario-aberto]").checked,
      abre: row.querySelector("[data-horario-abre]").value,
      fecha: row.querySelector("[data-horario-fecha]").value
    }));
    try {
      await bhSalvarHorarios(bhPainelEstabelecimento.id, horarios);
      mostrarToast("sucesso", "Horários atualizados", "O status automático já usa os novos horários.");
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Falha ao salvar horários", bhErroMensagem(erro)); }
  });

  document.getElementById("formFechado").addEventListener("submit", async evento => {
    evento.preventDefault();
    try {
      await bhAdicionarDiaBloqueado(bhPainelEstabelecimento.id, document.getElementById("fechadoData").value, document.getElementById("fechadoMotivo").value.trim());
      evento.currentTarget.reset();
      mostrarToast("sucesso", "Data bloqueada", "Não será possível agendar nesse dia.");
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Falha ao bloquear data", bhErroMensagem(erro)); }
  });

  document.getElementById("diasFechadosPainel").addEventListener("click", async evento => {
    const botao = evento.target.closest("[data-bloqueio-delete]");
    if (!botao) return;
    try {
      await bhExcluirDiaBloqueado(botao.dataset.bloqueioDelete);
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Falha ao remover bloqueio", bhErroMensagem(erro)); }
  });

  document.getElementById("configFoto").addEventListener("change", evento => {
    if (evento.target.files?.[0]) document.getElementById("configFotoPreview").src = URL.createObjectURL(evento.target.files[0]);
  });
  document.getElementById("configCapa").addEventListener("change", evento => {
    if (evento.target.files?.[0]) document.getElementById("configCapaPreview").src = URL.createObjectURL(evento.target.files[0]);
  });
});

window.addEventListener("hashchange", () => {
  const mapa = { agenda: "secAgenda", servicos: "secServicos", equipe: "secBarbeiros", relatorios: "secRelatorios", galeria: "secGaleria", configuracoes: "secConfig", pagina: "secPagina" };
  const alvo = mapa[location.hash.replace("#", "")];
  if (alvo) bhAtivarSecaoPainel(alvo);
});

function bhAssinarPainelTempoReal(){if(!window.supabaseClient||!bhPainelEstabelecimento)return;window.supabaseClient.channel(`painel-${bhPainelEstabelecimento.id}`).on('postgres_changes',{event:'*',schema:'public',table:'agendamentos',filter:`estabelecimento_id=eq.${bhPainelEstabelecimento.id}`},async()=>{await bhRecarregarPainel();mostrarToast('info','Agenda atualizada','Uma alteração chegou em tempo real.')}).subscribe()}
document.addEventListener('DOMContentLoaded',()=>setTimeout(bhAssinarPainelTempoReal,1800));
