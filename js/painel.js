let bhPainelPerfil = null;
let bhPainelEstabelecimento = null;
let bhPainelAgendamentos = [];

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

async function bhRecarregarPainel() {
  bhPainelEstabelecimento = await bhObterMeuEstabelecimento();
  if (!bhPainelEstabelecimento) {
    location.href = "cadastro-barbearia.html";
    return;
  }
  bhPainelAgendamentos = await bhListarAgendamentosEstabelecimento(bhPainelEstabelecimento.id);
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
  const mapaHash = { agenda: "secAgenda", servicos: "secServicos", equipe: "secBarbeiros", relatorios: "secRelatorios", configuracoes: "secConfig", pagina: "secPagina" };
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
      evento.currentTarget.reset();
      mostrarToast("sucesso", "Serviço adicionado", "A página pública já foi atualizada.");
      await bhRecarregarPainel();
    } catch (erro) { mostrarToast("erro", "Falha ao salvar serviço", bhErroMensagem(erro)); }
    finally { bhSetButtonLoading(botao, false); }
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

function bhAssinarPainelTempoReal(){if(!window.supabaseClient||!bhPainelEstabelecimento)return;window.supabaseClient.channel(`painel-${bhPainelEstabelecimento.id}`).on('postgres_changes',{event:'*',schema:'public',table:'agendamentos',filter:`estabelecimento_id=eq.${bhPainelEstabelecimento.id}`},async()=>{await bhRecarregarPainel();mostrarToast('info','Agenda atualizada','Uma alteração chegou em tempo real.')}).subscribe()}
document.addEventListener('DOMContentLoaded',()=>setTimeout(bhAssinarPainelTempoReal,1800));
