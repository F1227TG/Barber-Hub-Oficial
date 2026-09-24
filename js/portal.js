/**
 * portal.js — Barber Hub 1.11
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
  cidade: "",
  bairro: "",
  estado: "",
  latitude: null,
  longitude: null,
  raioKm: null,
  servico: "",
  precoMin: null,
  precoMax: null,
  avaliacaoMin: null,
  offset: 0,
  total: 0,
  hasMore: false,
  items: [],
  operatedIds: new Set(),
  loading: false
};

function bhMarketplaceLista(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function bhMarketplaceLerUrl() {
  const params = new URLSearchParams(location.search);
  const enumValue = (key, allowed, fallback) => allowed.includes(params.get(key)) ? params.get(key) : fallback;
  bhMarketplaceState.busca = String(params.get("q") || "").slice(0, 120);
  bhMarketplaceState.tipo = enumValue("tipo", ["todos", "barbearia", "salao"], "todos");
  bhMarketplaceState.status = enumValue("status", ["todos", "aberta", "fechada"], "todos");
  bhMarketplaceState.agenda = enumValue("agenda", ["todos", "sim", "nao"], "todos");
  bhMarketplaceState.cidade = String(params.get("cidade") || "").slice(0, 120);
  bhMarketplaceState.bairro = String(params.get("bairro") || "").slice(0, 120);
  bhMarketplaceState.estado = String(params.get("uf") || "").slice(0, 2).toUpperCase();
  bhMarketplaceState.servico = String(params.get("servico") || "").slice(0, 120);
  const numeric = (key, min, max) => { const raw = params.get(key); const value = raw === null || raw === "" ? null : Number(raw); return Number.isFinite(value) && value >= min && value <= max ? value : null; };
  bhMarketplaceState.precoMin = numeric("preco_min", 0, 1_000_000);
  bhMarketplaceState.precoMax = numeric("preco_max", 0, 1_000_000);
  bhMarketplaceState.avaliacaoMin = numeric("avaliacao", 0, 5);
}

function bhMarketplaceAtualizarUrl() {
  const params = new URLSearchParams();
  const set = (key, value, fallback = "") => { if (value !== null && value !== undefined && value !== fallback && value !== "") params.set(key, String(value)); };
  set("q", bhMarketplaceState.busca); set("tipo", bhMarketplaceState.tipo, "todos"); set("status", bhMarketplaceState.status, "todos"); set("agenda", bhMarketplaceState.agenda, "todos");
  set("cidade", bhMarketplaceState.cidade); set("bairro", bhMarketplaceState.bairro); set("uf", bhMarketplaceState.estado); set("servico", bhMarketplaceState.servico);
  set("preco_min", bhMarketplaceState.precoMin); set("preco_max", bhMarketplaceState.precoMax); set("avaliacao", bhMarketplaceState.avaliacaoMin);
  const query = params.toString();
  history.replaceState(history.state, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}

function bhMarketplaceFiltrosAtivos() {
  return [
    bhMarketplaceState.tipo !== "todos",
    bhMarketplaceState.status !== "todos",
    bhMarketplaceState.agenda !== "todos",
    Boolean(bhMarketplaceState.cidade || bhMarketplaceState.bairro || bhMarketplaceState.estado),
    Boolean(bhMarketplaceState.servico || bhMarketplaceState.precoMin !== null || bhMarketplaceState.precoMax !== null || bhMarketplaceState.avaliacaoMin !== null),
    bhMarketplaceState.latitude !== null
  ].filter(Boolean).length;
}

function bhMarketplaceAgendaBoolean() {
  return bhMarketplaceState.agenda === "sim" ? true : bhMarketplaceState.agenda === "nao" ? false : null;
}

function bhMarketplaceCard(item, { destaque = false } = {}) {
  const status = item.aberto_agora === undefined
    ? bhCalcularStatus(item)
    : { aberta:Boolean(item.aberto_agora), classe:item.aberto_agora ? "aberto" : "fechado", texto:item.aberto_agora ? "Aberto agora" : "Fechado agora" };
  const imagem = item.capaUrl || item.fotoUrl || "../img/placeholders/barbearia-01.webp";
  const tipo = item.tipoEstabelecimento === "salao" ? "Salão" : "Barbearia";
  const avaliacao = Number(item.avaliacao || 0);
  const servicosAtivos = bhMarketplaceLista(item?.servicos).filter(servico => servico?.ativo && servico?.publico);
  const visiveis = servicosAtivos.slice(0, 2);
  const restante = Math.max(servicosAtivos.length - visiveis.length, 0);
  const servicos = [
    ...visiveis.map(servico => `<span>${escapeHTML(servico.nome)}</span>`),
    ...(restante ? [`<span>+${restante}</span>`] : [])
  ].join("") || "<span>Ver serviços</span>";
  const detalheUrl = `barbearia.html?id=${encodeURIComponent(item.id)}`;
  const agendarUrl = `${detalheUrl}&agendar=1`;
  const proprio = bhMarketplaceState.operatedIds.has(String(item.id));

  return `<article class="marketplace-card" data-marketplace-card>
    <a class="marketplace-card-hitarea" href="${detalheUrl}" aria-label="Abrir perfil de ${escapeHTML(item.nome)}"></a>
    <div class="marketplace-card-image" style="background-image:url('${escapeHTML(imagem)}')" aria-hidden="true">
      <span class="marketplace-type">${escapeHTML(tipo)}</span>
    </div>
    <div class="marketplace-card-body">
      ${destaque || item.destaque ? `<span class="marketplace-sponsored"><i class="bi bi-stars"></i> Destaque Barber Hub</span>` : ""}
      <div class="marketplace-card-title">
        <h3>${escapeHTML(item.nome)}</h3>
        <span class="marketplace-rating"><i class="bi bi-star-fill"></i> ${avaliacao > 0 ? avaliacao.toFixed(1) : "Novo"}</span>
      </div>
      <p class="marketplace-location"><i class="bi bi-geo-alt"></i> ${escapeHTML([item.bairro, item.cidade].filter(Boolean).join(", "))}${item.distancia_km !== null && item.distancia_km !== undefined ? `<strong class="distance110">${Number(item.distancia_km).toFixed(1).replace(".", ",")} km</strong>` : ""}</p>
      <div class="marketplace-services">${servicos}</div>
      <div class="marketplace-card-bottom">
        <span class="marketplace-status ${status.classe}"><i class="bi ${status.aberta ? "bi-circle-fill" : "bi-moon"}"></i> ${escapeHTML(status.texto)}</span>
        <div class="marketplace-card-actions">
          ${proprio
            ? `<a class="btn btn-primary btn-small" href="painel.html#agenda">Ver agenda</a>`
            : item.aceitaAgendamento
              ? `<a class="btn btn-primary btn-small" href="${agendarUrl}">Agendar</a>`
              : ""}
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
  document.querySelector("[data-near-me]")?.classList.toggle("ativo", bhMarketplaceState.latitude !== null);
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
  bhMarketplaceRenderDestaques();
  bhMarketplaceAtualizarControles();
}

async function bhMarketplaceCarregar({ reset = false } = {}) {
  if (bhMarketplaceState.loading) return;
  const grid = document.getElementById("gridBarbearias");
  bhMarketplaceState.loading = true;
  if (reset) {
    bhMarketplaceState.offset = 0;
    bhMarketplaceState.items = [];
    bhMarketplaceRenderDestaques();
    if (grid) grid.innerHTML = `<div class="marketplace-loading"><i class="bi bi-arrow-repeat spin"></i> Buscando os melhores resultados...</div>`;
  }
  const more = document.getElementById("carregarMaisMarketplace");
  bhSetButtonLoading(more, true, "Carregando...");
  try {
    bhMarketplaceAtualizarUrl();
    const result = await bhBuscarMarketplaceRegional({
      busca:bhMarketplaceState.busca,
      tipo:bhMarketplaceState.tipo,
      status:bhMarketplaceState.status,
      cidade:bhMarketplaceState.cidade,
      bairro:bhMarketplaceState.bairro,
      estado:bhMarketplaceState.estado,
      agenda:bhMarketplaceAgendaBoolean(),
      latitude:bhMarketplaceState.latitude,
      longitude:bhMarketplaceState.longitude,
      raioKm:bhMarketplaceState.raioKm,
      servico:bhMarketplaceState.servico,
      precoMin:bhMarketplaceState.precoMin,
      precoMax:bhMarketplaceState.precoMax,
      avaliacaoMin:bhMarketplaceState.avaliacaoMin,
      offset:bhMarketplaceState.offset,
      limit:BH_MARKETPLACE_PAGE_SIZE
    });
    const novos = bhMarketplaceLista(result?.items);
    const append = !reset && bhMarketplaceState.offset > 0;
    bhMarketplaceState.items = append ? [...bhMarketplaceState.items, ...novos] : novos;
    bhMarketplaceState.total = Number(result.total || 0);
    bhMarketplaceState.hasMore = Boolean(result.has_more);
    bhMarketplaceState.offset += novos.length;
    bhMarketplaceRender({ append: false });
  } catch (erro) {
    if (grid) grid.innerHTML = `<div class="marketplace-empty"><i class="bi bi-exclamation-triangle big"></i><h3>Não foi possível carregar os locais</h3><p>${escapeHTML(bhErroMensagem(erro))}</p><button class="btn btn-outline btn-small" data-marketplace-retry type="button"><i class="bi bi-arrow-clockwise"></i> Tentar novamente</button></div>`;
  } finally {
    bhMarketplaceState.loading = false;
    bhSetButtonLoading(more, false);
  }
}

function bhMarketplaceRenderDestaques() {
  const section = document.getElementById("secDestaquesMarketplace");
  const grid = document.getElementById("gridDestaquesMarketplace");
  if (!grid || !section) return;
  const limite = matchMedia("(max-width:700px)").matches ? 5 : 6;
  const items = bhMarketplaceState.items.filter(item => item?.destaque).slice(0, limite);
  section.hidden = !items.length;
  grid.innerHTML = items.map(item => bhMarketplaceCard(item, { destaque: true })).join("");
}

function bhMarketplaceAbrirFiltros() {
  const modal = document.getElementById("filtrosMarketplace");
  if (!modal) return;
  document.getElementById("filtroTipo").value = bhMarketplaceState.tipo;
  document.getElementById("filtroStatus").value = bhMarketplaceState.status;
  document.getElementById("filtroAgendamento").value = bhMarketplaceState.agenda;
  document.getElementById("filtroCidade").value = bhMarketplaceState.cidade;
  document.getElementById("filtroBairro").value = bhMarketplaceState.bairro;
  document.getElementById("filtroEstado").value = bhMarketplaceState.estado;
  document.getElementById("filtroRaio").value = bhMarketplaceState.raioKm || "";
  document.getElementById("filtroServico").value = bhMarketplaceState.servico;
  document.getElementById("filtroPrecoMin").value = bhMarketplaceState.precoMin ?? "";
  document.getElementById("filtroPrecoMax").value = bhMarketplaceState.precoMax ?? "";
  document.getElementById("filtroAvaliacao").value = bhMarketplaceState.avaliacaoMin ?? "";
  modal.classList.add("ativo");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("marketplace-filters-open");
  document.body.style.overflow = "hidden";
  [...document.body.children].forEach(element => {
    if (element === modal || ["SCRIPT", "STYLE", "LINK"].includes(element.tagName) || element.hasAttribute("inert")) return;
    element.setAttribute("inert", ""); element.dataset.marketplaceInert111 = "1";
  });
  history.pushState({ ...(history.state || {}), bhMarketplaceFilters111:true }, "", location.href);
  modal.dataset.historyEntry = "1";
  requestAnimationFrame(() => modal.querySelector("[data-fechar-filtros]")?.focus());
}

function bhMarketplaceFecharFiltros({ fromHistory = false } = {}) {
  const modal = document.getElementById("filtrosMarketplace");
  if (!modal?.classList.contains("ativo")) return;
  const trigger = document.getElementById("abrirFiltrosMarketplace");
  modal.classList.remove("ativo");
  document.body.classList.remove("marketplace-filters-open");
  trigger?.focus?.({ preventScroll:true });
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  document.querySelectorAll('[data-marketplace-inert111="1"]').forEach(element => { element.removeAttribute("inert"); delete element.dataset.marketplaceInert111; });
  if (!fromHistory && modal.dataset.historyEntry === "1") { modal.dataset.historyEntry = "0"; history.back(); setTimeout(bhMarketplaceAtualizarUrl, 80); }
  else modal.dataset.historyEntry = "0";
}

function bhMarketplacePrenderFoco(event) {
  if (event.key !== "Tab") return;
  const dialog = document.querySelector("#filtrosMarketplace.ativo .marketplace-filter-dialog");
  if (!dialog) return;
  const focusable = [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(item => !item.hidden && item.getClientRects().length);
  if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
  const first = focusable[0]; const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function bhMarketplaceAplicarFiltros() {
  bhMarketplaceState.tipo = document.getElementById("filtroTipo")?.value || "todos";
  bhMarketplaceState.status = document.getElementById("filtroStatus")?.value || "todos";
  bhMarketplaceState.agenda = document.getElementById("filtroAgendamento")?.value || "todos";
  bhMarketplaceState.cidade = document.getElementById("filtroCidade")?.value.trim() || "";
  bhMarketplaceState.bairro = document.getElementById("filtroBairro")?.value.trim() || "";
  bhMarketplaceState.estado = document.getElementById("filtroEstado")?.value.trim().toUpperCase() || "";
  bhMarketplaceState.raioKm = bhMarketplaceState.latitude !== null ? (Number(document.getElementById("filtroRaio")?.value) || null) : null;
  bhMarketplaceState.servico = document.getElementById("filtroServico")?.value.trim() || "";
  const minPrice = document.getElementById("filtroPrecoMin")?.value;
  const maxPrice = document.getElementById("filtroPrecoMax")?.value;
  bhMarketplaceState.precoMin = minPrice === "" ? null : Number(minPrice);
  bhMarketplaceState.precoMax = maxPrice === "" ? null : Number(maxPrice);
  bhMarketplaceState.avaliacaoMin = document.getElementById("filtroAvaliacao")?.value === "" ? null : Number(document.getElementById("filtroAvaliacao").value);
  if (bhMarketplaceState.precoMin !== null && bhMarketplaceState.precoMax !== null && bhMarketplaceState.precoMin > bhMarketplaceState.precoMax) {
    mostrarToast("aviso", "Revise os preços", "O preço mínimo não pode ser maior que o máximo.");
    return;
  }
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

function bhMarketplacePertoDeMim(button) {
  if (bhMarketplaceState.latitude !== null) {
    bhMarketplaceState.latitude = null;
    bhMarketplaceState.longitude = null;
    bhMarketplaceState.raioKm = null;
    bhMarketplaceAtualizarControles();
    bhMarketplaceCarregar({ reset:true });
    return;
  }
  if (!navigator.geolocation) {
    mostrarToast("aviso", "Localização indisponível", "Busque por cidade ou bairro nos filtros.");
    return;
  }
  bhSetButtonLoading(button, true, "Localizando...");
  navigator.geolocation.getCurrentPosition(position => {
    bhMarketplaceState.latitude = Number(position.coords.latitude.toFixed(6));
    bhMarketplaceState.longitude = Number(position.coords.longitude.toFixed(6));
    bhMarketplaceState.raioKm = 25;
    bhSetButtonLoading(button, false);
    bhMarketplaceAtualizarControles();
    bhMarketplaceCarregar({ reset:true });
  }, error => {
    bhSetButtonLoading(button, false);
    const mensagens = {
      1: "Permita o acesso à localização no navegador ou pesquise por cidade e bairro nos filtros.",
      2: "Não conseguimos identificar sua localização agora. Você ainda pode pesquisar por cidade ou bairro.",
      3: "A localização demorou mais que o esperado. Tente novamente ou use os filtros de cidade e bairro."
    };
    mostrarToast("aviso", "Localização não ativada", mensagens[Number(error?.code)] || "Não foi possível usar sua localização agora. Pesquise por cidade ou bairro nos filtros.");
  }, { enableHighAccuracy:false, timeout:10_000, maximumAge:300_000 });
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("portal");
  bhMarketplaceLerUrl();
  try {
    const perfil = await bhGetPerfil();
    if (perfil?.tipo === "barbeiro" && typeof bhListarMeusEstabelecimentosOperados === "function") {
      bhMarketplaceState.operatedIds = new Set((await bhListarMeusEstabelecimentosOperados()).map(String));
    }
  } catch {
    bhMarketplaceState.operatedIds = new Set();
  }
  const search = document.getElementById("pesquisa");
  if (search) search.value = bhMarketplaceState.busca || search.value;
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
    document.getElementById("filtroTipo").value = "todos";
    document.getElementById("filtroStatus").value = "todos";
    document.getElementById("filtroAgendamento").value = "todos";
    document.getElementById("filtroCidade").value = "";
    document.getElementById("filtroBairro").value = "";
    document.getElementById("filtroEstado").value = "";
    document.getElementById("filtroRaio").value = "";
    document.getElementById("filtroServico").value = "";
    document.getElementById("filtroPrecoMin").value = "";
    document.getElementById("filtroPrecoMax").value = "";
    document.getElementById("filtroAvaliacao").value = "";
    bhMarketplaceState.latitude = null;
    bhMarketplaceState.longitude = null;
    bhMarketplaceAplicarFiltros();
  });
  document.querySelectorAll("[data-quick-filter]").forEach(button => button.addEventListener("click", () => bhMarketplaceAlternarRapido(button.dataset.quickFilter)));
  document.querySelector("[data-near-me]")?.addEventListener("click", event => bhMarketplacePertoDeMim(event.currentTarget));
  document.getElementById("carregarMaisMarketplace")?.addEventListener("click", () => bhMarketplaceCarregar());
  document.getElementById("gridBarbearias")?.addEventListener("click", event => { if (event.target.closest("[data-marketplace-retry]")) bhMarketplaceCarregar({ reset:true }); });
  document.addEventListener("keydown", event => {
    if (!document.getElementById("filtrosMarketplace")?.classList.contains("ativo")) return;
    if (event.key === "Escape") { event.preventDefault(); bhMarketplaceFecharFiltros(); return; }
    bhMarketplacePrenderFoco(event);
  });
  window.addEventListener("popstate", () => {
    if (document.getElementById("filtrosMarketplace")?.classList.contains("ativo")) bhMarketplaceFecharFiltros({ fromHistory:true });
  });

  bhMarketplaceCarregar({ reset: true });
});
