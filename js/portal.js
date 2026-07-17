let bhPortalTodos = [];

function bhRenderResumoPortal(lista) {
  const box = document.getElementById("resumoPortal");
  if (!box) return;
  const abertas = lista.filter(item => bhCalcularStatus(item).aberta).length;
  const comAgenda = lista.filter(item => item.aceitaAgendamento).length;
  const saloes = lista.filter(item => item.tipoEstabelecimento === "salao").length;
  box.innerHTML = `
    <div class="summary-item"><strong>${lista.length}</strong><span>Estabelecimentos</span></div>
    <div class="summary-item"><strong>${abertas}</strong><span>Abertos agora</span></div>
    <div class="summary-item"><strong>${comAgenda}</strong><span>Com agenda online</span></div>
    <div class="summary-item"><strong>${saloes}</strong><span>Salões em preparação</span></div>
  `;
}

function bhFiltrarPortal() {
  const busca = document.getElementById("pesquisa")?.value.toLowerCase().trim() || "";
  const filtroStatus = document.getElementById("filtroStatus")?.value || "todos";
  const filtroAgenda = document.getElementById("filtroAgendamento")?.value || "todos";
  const filtroTipo = document.getElementById("filtroTipo")?.value || "todos";

  const lista = bhPortalTodos.filter(item => {
    const status = bhCalcularStatus(item);
    const texto = `${item.nome} ${item.cidade} ${item.bairro} ${item.descricao}`.toLowerCase();
    if (busca && !texto.includes(busca)) return false;
    if (filtroStatus === "aberta" && !status.aberta) return false;
    if (filtroStatus === "fechada" && status.aberta) return false;
    if (filtroAgenda === "sim" && !item.aceitaAgendamento) return false;
    if (filtroAgenda === "nao" && item.aceitaAgendamento) return false;
    if (filtroTipo !== "todos" && item.tipoEstabelecimento !== filtroTipo) return false;
    return true;
  });
  bhRenderPortal(lista);
}

function bhRenderPortal(lista) {
  const grid = document.getElementById("gridBarbearias");
  if (!grid) return;
  bhRenderResumoPortal(lista);
  if (!lista.length) {
    grid.innerHTML = `
      <div class="card empty full-grid">
        <span class="big">🔎</span>
        <h3>Nenhum estabelecimento encontrado</h3>
        <p>Altere os filtros ou seja o primeiro profissional a cadastrar seu espaço.</p>
        <a class="btn btn-primary" href="cadastro.html">Cadastrar estabelecimento</a>
      </div>`;
    return;
  }

  grid.innerHTML = lista.map(item => {
    const status = bhCalcularStatus(item);
    const servicos = item.servicos.filter(servico => servico.ativo).slice(0, 3)
      .map(servico => `<span class="badge">${escapeHTML(servico.nome)}</span>`).join("");
    const imagem = item.capaUrl || item.fotoUrl || "../img/logoblack.png";
    const tipoLabel = item.tipoEstabelecimento === "salao" ? "Salão de beleza" : "Barbearia";
    return `
      <article class="card barbearia-card">
        <div class="barbearia-cover" style="background-image:linear-gradient(135deg,rgba(212,175,55,.2),rgba(0,0,0,.45)),url('${escapeHTML(imagem)}')"></div>
        <div class="barbearia-info">
          <div class="card-meta" style="margin-top:0">${bhRenderStatus(item)} <span class="badge">${tipoLabel}</span></div>
          <h3>${escapeHTML(item.nome)}</h3>
          <p>${escapeHTML(item.descricao || "Conheça os serviços disponíveis.")}</p>
          <div class="card-meta">
            <span class="badge"><i class="bi bi-geo-alt"></i> ${escapeHTML(item.bairro)}, ${escapeHTML(item.cidade)}</span>
            <span class="badge"><i class="bi bi-star-fill"></i> ${Number(item.avaliacao || 0) > 0 ? Number(item.avaliacao).toFixed(1) : "Sem avaliações"}</span>
            <span class="badge">${item.aceitaAgendamento ? "Agenda online" : "Atendimento direto"}</span>
          </div>
          <div class="card-meta">${servicos}</div>
          <p><strong>${escapeHTML(status.detalhe)}</strong></p>
          <div class="card-actions">
            <a class="btn btn-primary btn-small" href="barbearia.html?id=${item.id}">Ver página</a>
            <a class="btn btn-outline btn-small" href="agendamento.html?barbearia=${item.id}">${item.aceitaAgendamento ? "Agendar" : "Ver atendimento"}</a>
          </div>
        </div>
      </article>`;
  }).join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("portal");
  const grid = document.getElementById("gridBarbearias");
  try {
    bhPortalTodos = await bhListarEstabelecimentos();
    bhRenderPortal(bhPortalTodos);
    ["pesquisa", "filtroStatus", "filtroAgendamento", "filtroTipo"].forEach(id => {
      document.getElementById(id)?.addEventListener(id === "pesquisa" ? "input" : "change", bhDebounce(bhFiltrarPortal, 120));
    });
  } catch (erro) {
    if (grid) grid.innerHTML = `<div class="card empty full-grid"><span class="big">⚠️</span><h3>Não foi possível carregar o portal</h3><p>${escapeHTML(bhErroMensagem(erro))}</p></div>`;
  }
});
