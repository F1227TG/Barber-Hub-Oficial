/**
 * portal.js — Barber Hub 1.6
 * --------------------------------------------------------------------------
 * Marketplace paginado com FTS no backend, filtros compactos e carregamento
 * incremental. Não carrega o catálogo inteiro no navegador.
 * --------------------------------------------------------------------------
 */

const BH_MARKETPLACE_PAGE_SIZE = matchMedia("(max-width: 700px)").matches ? 12 : 24;
const bhMarketplaceState = {
  busca: "",
  tipo: "todos",
  status: "todos",
  agenda: "todos",
  offset: 0,
  total: 0,
  hasMore: false,
  items: [],
  loading: false
};

function bhMarketplaceFiltrosAtivos() {
  return [
    bhMarketplaceState.tipo !== "todos",
    bhMarketplaceState.status !== "todos",
    bhMarketplaceState.agenda !== "todos"
  ].filter(Boolean).length;
}

function bhMarketplaceAgendaBoolean() {
  return bhMarketplaceState.agenda === "sim" ? true : bhMarketplaceState.agenda === "nao" ? false : null;
}

function bhMarketplaceCard(item, { destaque = false } = {}) {
  const status = bhCalcularStatus(item);
  const imagem = item.capaUrl || item.fotoUrl || "../img/logoblack.png";
  const tipo = item.tipoEstabelecimento === "salao" ? "Salão" : "Barbearia";
  const avaliacao = Number(item.avaliacao || 0);
  const servicosAtivos = (item.servicos || []).filter(servico => servico.ativo && servico.publico);
  const visiveis = servicosAtivos.slice(0, 2);
  const restante = Math.max(servicosAtivos.length - visiveis.length, 0);
  const servicos = [
    ...visiveis.map(servico => `<span>${escapeHTML(servico.nome)}</span>`),
    ...(restante ? [`<span>+${restante}</span>`] : [])
  ].join("") || "<span>Ver serviços</span>";
  const detalheUrl = `barbearia.html?id=${encodeURIComponent(item.id)}`;
  const agendarUrl = `${detalheUrl}&agendar=1`;

  return `<article class="marketplace-card">
    <a class="marketplace-card-image" href="${detalheUrl}" style="background-image:url('${escapeHTML(imagem)}')" aria-label="Abrir ${escapeHTML(item.nome)}">
      <span class="marketplace-type">${escapeHTML(tipo)}</span>
    </a>
    <div class="marketplace-card-body">
      ${destaque || item.destaque ? `<span class="marketplace-sponsored"><i class="bi bi-stars"></i> Destaque Barber Hub</span>` : ""}
      <div class="marketplace-card-title">
        <h3><a href="${detalheUrl}">${escapeHTML(item.nome)}</a></h3>
        <span class="marketplace-rating"><i class="bi bi-star-fill"></i> ${avaliacao > 0 ? avaliacao.toFixed(1) : "Novo"}</span>
      </div>
      <p class="marketplace-location"><i class="bi bi-geo-alt"></i> ${escapeHTML([item.bairro, item.cidade].filter(Boolean).join(", "))}</p>
      <div class="marketplace-services">${servicos}</div>
      <div class="marketplace-card-bottom">
        <span class="marketplace-status ${status.classe}"><i class="bi ${status.aberta ? "bi-circle-fill" : "bi-moon"}"></i> ${escapeHTML(status.texto)}</span>
        <div class="marketplace-card-actions">
          <a class="btn btn-outline btn-small" href="${detalheUrl}">Ver local</a>
          ${item.aceitaAgendamento ? `<a class="btn btn-primary btn-small" href="${agendarUrl}">Agendar</a>` : ""}
        </div>
      </div>
    </div>
  </article>`;
}

function bhMarketplaceAtualizarControles() {
  const count = document.getElementById("contadorFiltrosMarketplace");
  if (count) count.textContent = bhMarketplaceFiltrosAtivos() || "";
  document.querySelector('[data-quick-filter="aberta"]')?.classList.toggle("ativo", bhMarketplaceState.status === "aberta");
  document.querySelector('[data-quick-filter="agenda"]')?.classList.toggle("ativo", bhMarketplaceState.agenda === "sim");
  document.querySelector('[data-quick-filter="barbearia"]')?.classList.toggle("ativo", bhMarketplaceState.tipo === "barbearia");
  const resumo = document.getElementById("resumoPortal");
  if (resumo) resumo.innerHTML = `<strong>${bhMarketplaceState.total}</strong> resultado${bhMarketplaceState.total === 1 ? "" : "s"}`;
  const titulo = document.getElementById("tituloResultadosMarketplace");
  if (titulo) titulo.textContent = bhMarketplaceState.busca ? `Resultados para “${bhMarketplaceState.busca}”` : "Locais disponíveis";
  const more = document.getElementById("carregarMaisMarketplace");
  if (more) more.hidden = !bhMarketplaceState.hasMore;
}

function bhMarketplaceRender({ append = false } = {}) {
  const grid = document.getElementById("gridBarbearias");
  if (!grid) return;
  if (!bhMarketplaceState.items.length) {
    grid.innerHTML = `<div class="marketplace-empty"><i class="bi bi-search big"></i><h3>Nenhum local encontrado</h3><p>Tente outro termo ou remova algum filtro.</p></div>`;
  } else {
    const html = bhMarketplaceState.items.map(item => bhMarketplaceCard(item)).join("");
    if (append) grid.insertAdjacentHTML("beforeend", html);
    else grid.innerHTML = html;
  }
  bhMarketplaceAtualizarControles();
}

async function bhMarketplaceCarregar({ reset = false } = {}) {
  if (bhMarketplaceState.loading) return;
  const grid = document.getElementById("gridBarbearias");
  bhMarketplaceState.loading = true;
  if (reset) {
    bhMarketplaceState.offset = 0;
    bhMarketplaceState.items = [];
    if (grid) grid.innerHTML = `<div class="marketplace-loading"><i class="bi bi-arrow-repeat spin"></i> Buscando os melhores resultados...</div>`;
  }
  const more = document.getElementById("carregarMaisMarketplace");
  bhSetButtonLoading(more, true, "Carregando...");
  try {
    const result = await bhBuscarMarketplace({
      busca: bhMarketplaceState.busca,
      tipo: bhMarketplaceState.tipo,
      agenda: bhMarketplaceAgendaBoolean(),
      status: bhMarketplaceState.status,
      offset: bhMarketplaceState.offset,
      limit: BH_MARKETPLACE_PAGE_SIZE
    });
    const novos = result.items || [];
    const append = !reset && bhMarketplaceState.offset > 0;
    bhMarketplaceState.items = append ? [...bhMarketplaceState.items, ...novos] : novos;
    bhMarketplaceState.total = Number(result.total || 0);
    bhMarketplaceState.hasMore = Boolean(result.has_more);
    bhMarketplaceState.offset += novos.length;
    bhMarketplaceRender({ append: false });
  } catch (erro) {
    if (grid) grid.innerHTML = `<div class="marketplace-empty"><i class="bi bi-exclamation-triangle big"></i><h3>Não foi possível carregar o marketplace</h3><p>${escapeHTML(bhErroMensagem(erro))}</p></div>`;
  } finally {
    bhMarketplaceState.loading = false;
    bhSetButtonLoading(more, false);
  }
}

async function bhMarketplaceCarregarDestaques() {
  const section = document.getElementById("secDestaquesMarketplace");
  const grid = document.getElementById("gridDestaquesMarketplace");
  if (!grid || !section) return;
  try {
    const items = await bhBuscarDestaquesMarketplace(matchMedia("(max-width:700px)").matches ? 5 : 6);
    if (!items.length) { section.hidden = true; return; }
    grid.innerHTML = items.map(item => bhMarketplaceCard(item, { destaque: true })).join("");
  } catch (erro) {
    section.hidden = true;
  }
}

function bhMarketplaceAbrirFiltros() {
  const modal = document.getElementById("filtrosMarketplace");
  if (!modal) return;
  document.getElementById("filtroTipo").value = bhMarketplaceState.tipo;
  document.getElementById("filtroStatus").value = bhMarketplaceState.status;
  document.getElementById("filtroAgendamento").value = bhMarketplaceState.agenda;
  modal.classList.add("ativo");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function bhMarketplaceFecharFiltros() {
  const modal = document.getElementById("filtrosMarketplace");
  if (!modal) return;
  modal.classList.remove("ativo");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function bhMarketplaceAplicarFiltros() {
  bhMarketplaceState.tipo = document.getElementById("filtroTipo")?.value || "todos";
  bhMarketplaceState.status = document.getElementById("filtroStatus")?.value || "todos";
  bhMarketplaceState.agenda = document.getElementById("filtroAgendamento")?.value || "todos";
  bhMarketplaceFecharFiltros();
  bhMarketplaceCarregar({ reset: true });
}

function bhMarketplaceAlternarRapido(tipo) {
  if (tipo === "aberta") bhMarketplaceState.status = bhMarketplaceState.status === "aberta" ? "todos" : "aberta";
  if (tipo === "agenda") bhMarketplaceState.agenda = bhMarketplaceState.agenda === "sim" ? "todos" : "sim";
  if (tipo === "barbearia") bhMarketplaceState.tipo = bhMarketplaceState.tipo === "barbearia" ? "todos" : "barbearia";
  bhMarketplaceAtualizarControles();
  bhMarketplaceCarregar({ reset: true });
}

document.addEventListener("DOMContentLoaded", () => {
  marcarMenuAtivo("portal");
  const search = document.getElementById("pesquisa");
  search?.addEventListener("input", bhDebounce(() => {
    bhMarketplaceState.busca = search.value.trim();
    bhMarketplaceCarregar({ reset: true });
  }, 320));
  document.querySelector("[data-portal-search-clear]")?.addEventListener("click", () => {
    if (!search) return;
    search.value = "";
    bhMarketplaceState.busca = "";
    bhMarketplaceCarregar({ reset: true });
    search.focus();
  });
  document.getElementById("abrirFiltrosMarketplace")?.addEventListener("click", bhMarketplaceAbrirFiltros);
  document.querySelectorAll("[data-fechar-filtros]").forEach(item => item.addEventListener("click", bhMarketplaceFecharFiltros));
  document.getElementById("aplicarFiltrosMarketplace")?.addEventListener("click", bhMarketplaceAplicarFiltros);
  document.getElementById("limparFiltrosMarketplace")?.addEventListener("click", () => {
    bhMarketplaceState.tipo = "todos";
    bhMarketplaceState.status = "todos";
    bhMarketplaceState.agenda = "todos";
    bhMarketplaceAplicarFiltros();
  });
  document.querySelectorAll("[data-quick-filter]").forEach(button => button.addEventListener("click", () => bhMarketplaceAlternarRapido(button.dataset.quickFilter)));
  document.getElementById("carregarMaisMarketplace")?.addEventListener("click", () => bhMarketplaceCarregar());
  document.addEventListener("keydown", event => { if (event.key === "Escape") bhMarketplaceFecharFiltros(); });

  bhMarketplaceCarregarDestaques();
  bhMarketplaceCarregar({ reset: true });
});
