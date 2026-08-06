/**
 * portal.js
 * Busca, filtros e listagem pública de estabelecimentos.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

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
    const servicos = item.servicos.filter(servico => servico.ativo).slice(0, 2)
      .map(servico => `<span>${escapeHTML(servico.nome)}</span>`).join("");
    const imagem = item.capaUrl || item.fotoUrl || "../img/logoblack.png";
    const tipoLabel = item.tipoEstabelecimento === "salao" ? "Salão" : "Barbearia";
    const avaliacao = Number(item.avaliacao || 0);
    return `
      <article class="card barbearia-card portal-business-card">
        <a class="portal-business-cover" href="barbearia.html?id=${item.id}"
          style="background-image:linear-gradient(180deg,rgba(0,0,0,.04),rgba(0,0,0,.64)),url('${escapeHTML(imagem)}')">
          <span class="portal-business-type">${escapeHTML(tipoLabel)}</span>
          ${bhRenderStatus(item)}
        </a>
        <div class="barbearia-info portal-business-info">
          <div class="portal-business-heading">
            <div>
              <h3><a href="barbearia.html?id=${item.id}">${escapeHTML(item.nome)}</a></h3>
              <p><i class="bi bi-geo-alt"></i> ${escapeHTML(item.bairro)}, ${escapeHTML(item.cidade)}</p>
            </div>
            <span class="portal-rating"><i class="bi bi-star-fill"></i> ${avaliacao > 0 ? avaliacao.toFixed(1) : "Novo"}</span>
          </div>
          <div class="portal-service-preview">${servicos || "<span>Consulte os serviços</span>"}</div>
          <div class="portal-business-footer">
            <span class="portal-agenda-state"><i class="bi ${item.aceitaAgendamento ? "bi-calendar2-check" : "bi-chat-dots"}"></i> ${item.aceitaAgendamento ? "Agenda online" : "Contato direto"}</span>
            <a class="btn btn-primary btn-small" href="${item.aceitaAgendamento ? `agendamento.html?barbearia=${item.id}` : `barbearia.html?id=${item.id}`}">${item.aceitaAgendamento ? "Agendar" : "Ver perfil"}</a>
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
    document.querySelector("[data-portal-search-clear]")?.addEventListener("click", () => {
      const pesquisa = document.getElementById("pesquisa");
      if (!pesquisa) return;
      pesquisa.value = "";
      pesquisa.dispatchEvent(new Event("input", { bubbles: true }));
      pesquisa.focus();
    });
  } catch (erro) {
    if (grid) grid.innerHTML = `<div class="card empty full-grid"><span class="big">⚠️</span><h3>Não foi possível carregar o portal</h3><p>${escapeHTML(bhErroMensagem(erro))}</p></div>`;
  }
});
