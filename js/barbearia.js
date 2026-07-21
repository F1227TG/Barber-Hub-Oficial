/**
 * barbearia.js
 * Página pública do estabelecimento, portfólio, avaliações, redes sociais e favoritos.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

let bhPortfolioPublico = [];
let bhCurtidasPortfolio = new Set();
let bhPerfilPortfolio = null;
let bhEstabelecimentoPortfolio = null;
let bhAvaliacoesPublicas = [];
let bhFavoritoAtual = false;
let bhAlvoAvaliacaoComunidade = { publicacaoId: null };
let bhFiltroPortfolio = { categoria: "todas", profissional: "todos", servico: "todos", modo: "todos", ordem: "recentes" };


function bhUrlRedeSocial(valor, rede) {
  const texto = String(valor || "").trim();
  if (!texto) return null;
  if (/^https?:\/\//i.test(texto)) return texto;
  const usuario = texto.replace(/^@/, "").replace(/^.*(?:instagram\.com|tiktok\.com)\/@?/i, "").replace(/\/$/, "");
  return rede === "tiktok" ? `https://www.tiktok.com/@${usuario}` : `https://www.instagram.com/${usuario}`;
}

function bhRenderRedesSociais(item) {
  const instagram = bhUrlRedeSocial(item.instagram, "instagram");
  const tiktok = bhUrlRedeSocial(item.tiktok, "tiktok");
  if (!instagram && !tiktok) return "";
  return `<div class="business-socials" aria-label="Redes sociais do estabelecimento">
    ${instagram ? `<a href="${escapeHTML(instagram)}" target="_blank" rel="noopener noreferrer" class="social-chip instagram"><i class="bi bi-instagram"></i><span>Instagram</span></a>` : ""}
    ${tiktok ? `<a href="${escapeHTML(tiktok)}" target="_blank" rel="noopener noreferrer" class="social-chip tiktok"><i class="bi bi-tiktok"></i><span>TikTok</span></a>` : ""}
  </div>`;
}

function bhRenderAvaliacoesPublicas() {
  const verificadas = bhAvaliacoesPublicas.filter(item => item.verificada || item.origem === "agendamento").length;
  const comunidade = bhAvaliacoesPublicas.length - verificadas;
  const acao = bhPerfilPortfolio?.tipo === "cliente"
    ? `<button type="button" class="btn btn-primary btn-small" data-avaliar-estabelecimento><i class="bi bi-star"></i> Avaliar estabelecimento</button>`
    : !bhPerfilPortfolio
      ? `<a class="btn btn-outline btn-small" href="login.html?next=${encodeURIComponent(location.pathname + location.search + "#avaliacoes")}"><i class="bi bi-box-arrow-in-right"></i> Entrar para avaliar</a>`
      : "";
  if (!bhAvaliacoesPublicas.length) return `<section class="card reviews-public-card" id="avaliacoes"><div class="card-body"><div class="section-top compact"><div><span class="tag"><i class="bi bi-star"></i> Reputação</span><h2>Ainda sem avaliações</h2><p class="texto-section">Clientes podem avaliar atendimentos verificados ou compartilhar uma experiência realizada fora da agenda online.</p></div><div class="reviews-public-actions">${acao}</div></div></div></section>`;
  const media = bhAvaliacoesPublicas.reduce((soma, item) => soma + Number(item.nota || 0), 0) / bhAvaliacoesPublicas.length;
  return `<section class="card reviews-public-card" id="avaliacoes"><div class="card-body">
    <div class="section-top compact"><div><span class="tag"><i class="bi bi-star"></i> Reputação</span><h2>Experiências compartilhadas</h2><p class="texto-section">Avaliações verificadas vêm de atendimentos concluídos no Barber Hub. Avaliações da comunidade são identificadas separadamente.</p><div class="review-counts"><span class="review-source verified"><i class="bi bi-patch-check-fill"></i> ${verificadas} verificada${verificadas === 1 ? "" : "s"}</span><span class="review-source community"><i class="bi bi-people-fill"></i> ${comunidade} da comunidade</span></div></div><div class="reviews-public-actions"><div class="rating-summary"><strong>${media.toFixed(1).replace(".", ",")}</strong><div><span>${"★".repeat(Math.round(media))}${"☆".repeat(5 - Math.round(media))}</span><small>${bhAvaliacoesPublicas.length} avaliação${bhAvaliacoesPublicas.length === 1 ? "" : "ões"}</small></div></div>${acao}</div></div>
    <div class="reviews-public-list">${bhAvaliacoesPublicas.slice(0, 20).map(item => `<article class="review-public-item">
      <div class="review-public-head"><div class="review-avatar">${escapeHTML((item.perfis?.nome || "C").slice(0,1).toUpperCase())}</div><div><strong>${escapeHTML(item.perfis?.nome || "Cliente")}</strong><span class="review-stars" aria-label="${item.nota} de 5 estrelas">${"★".repeat(Number(item.nota || 0))}${"☆".repeat(5 - Number(item.nota || 0))}</span></div><time>${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(item.created_at))}</time></div>
      <div class="review-meta-row"><span class="review-source ${item.verificada || item.origem === "agendamento" ? "verified" : "community"}"><i class="bi ${item.verificada || item.origem === "agendamento" ? "bi-patch-check-fill" : "bi-people-fill"}"></i> ${item.verificada || item.origem === "agendamento" ? "Atendimento verificado" : "Avaliação da comunidade"}</span>${item.portfolio_publicacoes?.titulo ? `<span class="review-context"><i class="bi bi-image"></i> Sobre: ${escapeHTML(item.portfolio_publicacoes.titulo)}</span>` : ""}</div>
      ${item.comentario ? `<p>${escapeHTML(item.comentario)}</p>` : `<p class="muted">Avaliação sem comentário.</p>`}
      ${item.resposta_estabelecimento ? `<div class="business-reply"><strong><i class="bi bi-reply"></i> Resposta do estabelecimento</strong><p>${escapeHTML(item.resposta_estabelecimento)}</p></div>` : ""}
    </article>`).join("")}</div>
  </div></section>`;
}

function bhFotosPublicacaoPortfolio(item) {
  const midias = item.midias || [];
  if (!midias.length) return `<div class="portfolio-public-empty"><i class="bi bi-image"></i></div>`;
  if (item.modo === "antes_depois" && midias.length >= 2) {
    return `<div class="before-after-grid">
      <button class="portfolio-photo-button" data-portfolio-foto="${midias[0].id}" aria-label="Abrir foto antes"><img src="${escapeHTML(midias[0].public_url)}" alt="${escapeHTML(midias[0].texto_alternativo || `Antes de ${item.titulo}`)}"><span>Antes</span></button>
      <button class="portfolio-photo-button" data-portfolio-foto="${midias[1].id}" aria-label="Abrir foto depois"><img src="${escapeHTML(midias[1].public_url)}" alt="${escapeHTML(midias[1].texto_alternativo || `Depois de ${item.titulo}`)}"><span>Depois</span></button>
    </div>`;
  }
  const capa = midias.find(m => m.ordem === item.capa_ordem) || midias[0];
  return `<button class="portfolio-main-photo" data-portfolio-foto="${capa.id}" aria-label="Abrir fotos de ${escapeHTML(item.titulo)}"><img src="${escapeHTML(capa.public_url)}" alt="${escapeHTML(capa.texto_alternativo || item.titulo)}">${midias.length > 1 ? `<span><i class="bi bi-images"></i> ${midias.length}</span>` : ""}</button>`;
}

function bhPortfolioFiltrado() {
  let itens = [...bhPortfolioPublico];
  if (bhFiltroPortfolio.categoria !== "todas") itens = itens.filter(item => item.categoria === bhFiltroPortfolio.categoria);
  if (bhFiltroPortfolio.profissional !== "todos") itens = itens.filter(item => item.profissional_id === bhFiltroPortfolio.profissional);
  if (bhFiltroPortfolio.servico !== "todos") itens = itens.filter(item => item.servico_id === bhFiltroPortfolio.servico);
  if (bhFiltroPortfolio.modo !== "todos") itens = itens.filter(item => item.modo === bhFiltroPortfolio.modo);
  itens.sort((a, b) => {
    if (a.destaque !== b.destaque) return Number(b.destaque) - Number(a.destaque);
    if (bhFiltroPortfolio.ordem === "curtidos") return Number(b.curtidas_count || 0) - Number(a.curtidas_count || 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });
  return itens;
}

function bhRenderCardsPortfolioPublico() {
  const grid = document.getElementById("portfolioPublicoGrid");
  if (!grid) return;
  const itens = bhPortfolioFiltrado();
  if (!itens.length) {
    grid.innerHTML = `<div class="empty full-grid"><i class="bi bi-images big"></i><h3>Nenhum trabalho encontrado</h3><p>Tente remover algum filtro.</p></div>`;
    return;
  }
  const contaNova = bhPerfilPortfolio && (Date.now() - new Date(bhPerfilPortfolio.created_at).getTime()) < 7 * 86400000;
  const dono = bhPerfilPortfolio?.id === bhEstabelecimentoPortfolio?.ownerId;
  grid.innerHTML = itens.map(item => {
    const curtida = bhCurtidasPortfolio.has(item.id);
    const bloqueada = !bhPerfilPortfolio || contaNova || dono;
    const tituloLike = !bhPerfilPortfolio ? "Entre na sua conta para curtir" : contaNova ? "Curtidas ficam disponíveis após 7 dias de conta" : dono ? "O proprietário não pode curtir o próprio trabalho" : curtida ? "Remover curtida" : "Curtir trabalho";
    return `<article class="portfolio-public-card" data-publicacao-id="${item.id}">
      <div class="portfolio-public-media">${bhFotosPublicacaoPortfolio(item)}${item.destaque ? `<span class="featured-label"><i class="bi bi-pin-angle-fill"></i> Destaque</span>` : ""}</div>
      <div class="portfolio-public-body">
        <div class="card-meta"><span class="badge">${escapeHTML(item.categoria)}</span>${item.modo === "antes_depois" ? `<span class="badge"><i class="bi bi-layout-split"></i> Antes e depois</span>` : ""}</div>
        <h3>${escapeHTML(item.titulo)}</h3>
        ${item.descricao ? `<p>${escapeHTML(item.descricao)}</p>` : ""}
        <div class="portfolio-byline"><span><i class="bi bi-person"></i> ${escapeHTML(item.profissional?.nome || "Profissional")}</span>${item.servico ? `<span><i class="bi bi-scissors"></i> ${escapeHTML(item.servico.nome)}</span>` : ""}</div>
        ${(item.tags || []).length ? `<div class="portfolio-tags">${item.tags.map(tag => `<span>#${escapeHTML(tag)}</span>`).join("")}</div>` : ""}
        <div class="portfolio-public-actions">
          <button class="like-button ${curtida ? "curtida" : ""}" data-portfolio-curtir title="${tituloLike}" ${bloqueada ? "disabled" : ""}><i class="bi ${curtida ? "bi-heart-fill" : "bi-heart"}"></i><span>${item.curtidas_count || 0}</span></button>
          ${bhPerfilPortfolio?.tipo === "cliente" ? `<button class="portfolio-review-button" data-avaliar-publicacao title="Avaliar este trabalho"><i class="bi bi-star"></i><span>Avaliar</span></button>` : !bhPerfilPortfolio ? `<a class="portfolio-review-button" href="login.html?next=${encodeURIComponent(location.pathname + location.search)}" title="Entre para avaliar"><i class="bi bi-star"></i><span>Avaliar</span></a>` : ""}
          ${bhPerfilPortfolio ? `<button class="report-button" data-portfolio-denunciar title="Denunciar publicação"><i class="bi bi-flag"></i></button>` : `<a class="report-button" href="login.html" title="Entre para denunciar"><i class="bi bi-flag"></i></a>`}
          <time datetime="${item.created_at}">${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(item.data_trabalho || item.created_at))}</time>
        </div>
      </div>
    </article>`;
  }).join("");
}

function bhRenderSecaoPortfolioPublico() {
  const categorias = [...new Set(bhPortfolioPublico.map(item => item.categoria))];
  const profissionais = [...new Map(bhPortfolioPublico.filter(item => item.profissional).map(item => [item.profissional.id, item.profissional])).values()];
  const servicos = [...new Map(bhPortfolioPublico.filter(item => item.servico).map(item => [item.servico.id, item.servico])).values()];
  return `<div class="card portfolio-public-section"><div class="card-body">
    <div class="section-top"><div><span class="tag"><i class="bi bi-images"></i> Portfólio</span><h2>Trabalhos realizados</h2><p class="texto-section">Veja resultados publicados pelo estabelecimento.</p></div><strong class="portfolio-total">${bhPortfolioPublico.length} trabalho${bhPortfolioPublico.length === 1 ? "" : "s"}</strong></div>
    ${bhPortfolioPublico.length ? `<div class="portfolio-public-filters">
      <select data-portfolio-public-filter="categoria"><option value="todas">Todas as categorias</option>${categorias.map(item => `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`).join("")}</select>
      <select data-portfolio-public-filter="profissional"><option value="todos">Todos os profissionais</option>${profissionais.map(item => `<option value="${item.id}">${escapeHTML(item.nome)}</option>`).join("")}</select>
      <select data-portfolio-public-filter="servico"><option value="todos">Todos os serviços</option>${servicos.map(item => `<option value="${item.id}">${escapeHTML(item.nome)}</option>`).join("")}</select>
      <select data-portfolio-public-filter="modo"><option value="todos">Todos os formatos</option><option value="galeria">Galeria</option><option value="antes_depois">Antes e depois</option></select>
      <select data-portfolio-public-filter="ordem"><option value="recentes">Mais recentes</option><option value="curtidos">Mais curtidos</option></select>
    </div><div id="portfolioPublicoGrid" class="portfolio-public-grid"></div>` : `<div class="empty compact"><i class="bi bi-images big"></i><p>Este estabelecimento ainda não publicou trabalhos.</p></div>`}
  </div></div>`;
}

function bhAtualizarEstrelasComunidade(nota) {
  document.getElementById("avaliacaoComunidadeNota").value = nota || "";
  document.querySelectorAll("#avaliacaoComunidadeEstrelas [data-nota]").forEach(item => item.classList.toggle("ativo", Number(item.dataset.nota) <= Number(nota || 0)));
}

async function bhAbrirAvaliacaoComunidade(publicacao = null, trigger = null) {
  if (bhPerfilPortfolio?.tipo !== "cliente") {
    location.href = `login.html?next=${encodeURIComponent(location.pathname + location.search + "#avaliacoes")}`;
    return;
  }
  bhAlvoAvaliacaoComunidade = { publicacaoId: publicacao?.id || null };
  document.getElementById("avaliacaoComunidadePublicacaoId").value = publicacao?.id || "";
  document.getElementById("tituloModalAvaliacaoComunidade").textContent = publicacao ? "Avalie este trabalho" : "Avalie este estabelecimento";
  document.getElementById("descricaoAvaliacaoComunidade").textContent = publicacao ? `${publicacao.titulo} • ${bhEstabelecimentoPortfolio.nome}` : bhEstabelecimentoPortfolio.nome;
  document.getElementById("avaliacaoComunidadeComentario").value = "";
  bhAtualizarEstrelasComunidade(0);
  try {
    const existente = await bhBuscarMinhaAvaliacaoComunidade(bhEstabelecimentoPortfolio.id, publicacao?.id || null);
    if (existente) {
      document.getElementById("avaliacaoComunidadeComentario").value = existente.comentario || "";
      bhAtualizarEstrelasComunidade(existente.nota);
    }
  } catch (erro) { console.warn("Não foi possível carregar a avaliação anterior.", erro); }
  bhAbrirModal("modalAvaliacaoComunidade", trigger || document.activeElement);
}

async function bhRecarregarReputacaoPublica() {
  const posicao = window.scrollY;
  bhAvaliacoesPublicas = await bhListarAvaliacoesEstabelecimento(bhEstabelecimentoPortfolio.id);
  bhEstabelecimentoPortfolio.avaliacao = bhAvaliacoesPublicas.length ? bhAvaliacoesPublicas.reduce((soma,item)=>soma+Number(item.nota||0),0)/bhAvaliacoesPublicas.length : 0;
  bhRenderDetalheEstabelecimento(bhEstabelecimentoPortfolio);
  requestAnimationFrame(() => window.scrollTo({ top: posicao, behavior: "instant" }));
}

function bhAbrirLightboxPortfolio(publicacao, midiaId) {
  const midias = publicacao.midias || [];
  let indice = Math.max(0, midias.findIndex(item => item.id === midiaId));
  let modal = document.getElementById("portfolioLightbox");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "portfolioLightbox";
    modal.className = "portfolio-lightbox";
    modal.innerHTML = `<div class="portfolio-lightbox-backdrop" data-lightbox-fechar></div><div class="portfolio-lightbox-dialog"><button class="icon-btn portfolio-lightbox-close" data-lightbox-fechar aria-label="Fechar"><i class="bi bi-x-lg"></i></button><button class="portfolio-lightbox-nav anterior" data-lightbox-anterior aria-label="Foto anterior"><i class="bi bi-chevron-left"></i></button><img id="portfolioLightboxImg" alt=""><button class="portfolio-lightbox-nav proxima" data-lightbox-proxima aria-label="Próxima foto"><i class="bi bi-chevron-right"></i></button><div class="portfolio-lightbox-caption"><strong id="portfolioLightboxTitulo"></strong><span id="portfolioLightboxContador"></span></div></div>`;
    document.body.appendChild(modal);
  }
  const atualizar = () => {
    const midia = midias[indice];
    document.getElementById("portfolioLightboxImg").src = midia.public_url;
    document.getElementById("portfolioLightboxImg").alt = midia.texto_alternativo || publicacao.titulo;
    document.getElementById("portfolioLightboxTitulo").textContent = publicacao.titulo;
    document.getElementById("portfolioLightboxContador").textContent = `${indice + 1} de ${midias.length}`;
  };
  modal.querySelector("[data-lightbox-anterior]").onclick = () => { indice = (indice - 1 + midias.length) % midias.length; atualizar(); };
  modal.querySelector("[data-lightbox-proxima]").onclick = () => { indice = (indice + 1) % midias.length; atualizar(); };
  modal.querySelectorAll("[data-lightbox-fechar]").forEach(btn => btn.onclick = () => modal.classList.remove("ativo"));
  atualizar();
  modal.classList.add("ativo");
}

function bhRenderDetalheEstabelecimento(item) {
  const main = document.getElementById("barbeariaDetalhe");
  const status = bhCalcularStatus(item);
  const horarios = bhHorarioPorDiaLabel(item).map(h => `
    <div class="hours-row"><strong>${escapeHTML(h.dia)}</strong><span>${escapeHTML(h.texto)}</span></div>
  `).join("");
  const servicos = item.servicos.filter(s => s.ativo && s.publico).map(s => `
    <div class="simple-item">
      <div><strong>${escapeHTML(s.nome)}</strong><span>${escapeHTML(s.descricao)} • ${s.duracao_min} min</span></div>
      <div class="price">${bhMoeda(s.preco)}</div>
    </div>
  `).join("") || `<div class="empty">Nenhum serviço publicado.</div>`;
  const profissionais = item.barbeiros.filter(p => p.ativo).map(p => `
    <div class="simple-item">
      <div style="display:flex;align-items:center;gap:12px">
        ${p.avatar_url ? `<img class="avatar-image" src="${escapeHTML(p.avatar_url)}" alt="">` : `<div class="avatar">${escapeHTML(p.avatar)}</div>`}
        <div><strong>${escapeHTML(p.nome)}</strong><span>${escapeHTML(p.especialidade || "Profissional")}</span></div>
      </div>
      <span class="status ${p.aceitaAgendamento ? "aberta" : "fechada"}">${p.aceitaAgendamento ? "Agenda ativa" : "Sem agenda"}</span>
    </div>
  `).join("") || `<div class="empty">Equipe ainda não publicada.</div>`;
  const promocoes = item.promocoes.filter(p => p.ativo).map(p => `<div class="promo"><strong>${escapeHTML(p.titulo)}</strong><p>${escapeHTML(p.descricao)}</p></div>`).join("") || `<p class="texto-section">Nenhuma promoção ativa no momento.</p>`;
  const imagem = item.capaUrl || item.fotoUrl || "../img/logoblack.png";
  const whatsapp = bhNormalizarWhatsApp(item.whatsapp || item.telefone);
  const tipoLabel = item.tipoEstabelecimento === "salao" ? "Salão de beleza" : "Barbearia";

  document.title = `${item.nome} | Barber Hub`;
  main.innerHTML = `
    <section class="page-hero business-hero" style="--business-cover:url('${escapeHTML(imagem)}')">
      <div class="container">
        <div class="breadcrumb">Portal / ${escapeHTML(item.cidade)} / ${escapeHTML(item.nome)}</div>
        <div class="card-meta">${bhRenderStatus(item)} <span class="badge">${tipoLabel}</span></div>
        <h1>${escapeHTML(item.nome)} ${item.verificado ? `<span class="verified-badge" title="Estabelecimento verificado"><i class="bi bi-patch-check-fill"></i> Verificado</span>` : ""}</h1>
        <p>${escapeHTML(item.descricao)}</p>
        <div class="hero-actions">
          ${item.aceitaAgendamento ? `<a href="agendamento.html?barbearia=${item.id}" class="btn btn-primary">Agendar horário</a>` : ""}
          ${whatsapp ? `<a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener" class="btn btn-outline"><i class="bi bi-whatsapp"></i> WhatsApp</a>` : ""}
          ${bhPerfilPortfolio?.tipo === "cliente" ? `<button type="button" class="btn btn-outline favorite-business-btn ${bhFavoritoAtual ? "ativo" : ""}" data-favoritar-estabelecimento><i class="bi ${bhFavoritoAtual ? "bi-heart-fill" : "bi-heart"}"></i> ${bhFavoritoAtual ? "Favoritado" : "Favoritar"}</button>` : !bhPerfilPortfolio ? `<a class="btn btn-outline" href="login.html?next=${encodeURIComponent(location.pathname + location.search)}"><i class="bi bi-heart"></i> Entrar para favoritar</a>` : ""}
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container detail-grid">
        <aside class="detail-panel card">
          <div class="card-body">
            <h2>Informações</h2>
            <div class="divisor"></div>
            <p><strong><i class="bi bi-geo-alt"></i> Endereço</strong><br>${escapeHTML([item.endereco,item.numero,item.bairro,item.cidade,item.estado].filter(Boolean).join(", "))}</p><br>
            <p><strong><i class="bi bi-telephone"></i> Telefone</strong><br>${escapeHTML(item.telefone || "Não informado")}</p><br>
            <p><strong><i class="bi bi-star-fill"></i> Avaliação</strong><br>${Number(item.avaliacao || 0) > 0 ? `<span class="rating">${Number(item.avaliacao).toFixed(1)}</span>` : `<span class="no-rating">Ainda sem avaliações</span>`}</p><br>
            <p><strong>Status</strong><br><span class="status ${status.classe}">${status.texto}</span><br><small>${escapeHTML(status.detalhe)}</small></p>
            ${bhRenderRedesSociais(item)}
            <div class="divisor"></div>
            <h3>Horários</h3>
            <div class="hours-list">${horarios}</div>
          </div>
        </aside>
        <div class="grid" style="gap:28px">
          <div class="card"><div class="card-body"><h2>Serviços e preços</h2><div class="divisor"></div><div class="service-list">${servicos}</div></div></div>
          <div class="card"><div class="card-body"><h2>Profissionais</h2><div class="divisor"></div><div class="barber-list">${profissionais}</div></div></div>
          ${bhRenderSecaoPortfolioPublico()}
          ${bhRenderAvaliacoesPublicas()}
          <div class="card"><div class="card-body"><h2>Promoções</h2><div class="divisor"></div>${promocoes}</div></div>
        </div>
      </div>
    </section>`;
  bhRenderCardsPortfolioPublico();
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("portal");
  const main = document.getElementById("barbeariaDetalhe");
  try {
    const id = bhQueryParam("id") || bhQueryParam("slug");
    if (!id) throw new Error("Estabelecimento não informado.");
    bhEstabelecimentoPortfolio = await bhObterEstabelecimento(id);
    if (!bhEstabelecimentoPortfolio) throw new Error("Estabelecimento não encontrado ou indisponível.");
    [bhPortfolioPublico, bhAvaliacoesPublicas] = await Promise.all([
      bhListarPortfolioPublico(bhEstabelecimentoPortfolio.id),
      bhListarAvaliacoesEstabelecimento(bhEstabelecimentoPortfolio.id).catch(erro => { console.warn("Avaliações ainda não disponíveis.", erro); return []; })
    ]);
    try { bhPerfilPortfolio = await bhGetPerfil(); } catch (_) { bhPerfilPortfolio = null; }
    if (bhPerfilPortfolio?.tipo === "cliente") {
      try { bhFavoritoAtual = await bhEstaFavorito(bhEstabelecimentoPortfolio.id); } catch (_) { bhFavoritoAtual = false; }
    }
    if (bhPerfilPortfolio && bhPortfolioPublico.length) {
      try { bhCurtidasPortfolio = await bhObterCurtidasMinhas(bhPortfolioPublico.map(item => item.id)); } catch (_) { bhCurtidasPortfolio = new Set(); }
    }
    bhRenderDetalheEstabelecimento(bhEstabelecimentoPortfolio);
  } catch (erro) {
    main.innerHTML = `<div class="container section"><div class="card empty"><span class="big">💈</span><h2>Não foi possível abrir esta página</h2><p>${escapeHTML(bhErroMensagem(erro))}</p><a class="btn btn-primary" href="portal.html">Voltar ao portal</a></div></div>`;
    return;
  }

  main.addEventListener("change", evento => {
    const filtro = evento.target.closest("[data-portfolio-public-filter]");
    if (!filtro) return;
    bhFiltroPortfolio[filtro.dataset.portfolioPublicFilter] = filtro.value;
    bhRenderCardsPortfolioPublico();
  });

  main.addEventListener("click", async evento => {
    const favorito = evento.target.closest("[data-favoritar-estabelecimento]");
    if (favorito) {
      try {
        favorito.disabled = true;
        bhFavoritoAtual = await bhAlternarFavorito(bhEstabelecimentoPortfolio.id, bhFavoritoAtual);
        mostrarToast("sucesso", bhFavoritoAtual ? "Adicionado aos favoritos" : "Removido dos favoritos", bhFavoritoAtual ? "Você encontra este estabelecimento rapidamente na sua área." : "O estabelecimento foi removido da sua lista.");
        bhRenderDetalheEstabelecimento(bhEstabelecimentoPortfolio);
      } catch (erro) { mostrarToast("erro", "Não foi possível atualizar favoritos", bhErroMensagem(erro)); favorito.disabled = false; }
      return;
    }
    const avaliarEstabelecimento = evento.target.closest("[data-avaliar-estabelecimento]");
    if (avaliarEstabelecimento) { await bhAbrirAvaliacaoComunidade(null, avaliarEstabelecimento); return; }
    const card = evento.target.closest("[data-publicacao-id]");
    const publicacao = card ? bhPortfolioPublico.find(item => item.id === card.dataset.publicacaoId) : null;
    const avaliarPublicacao = evento.target.closest("[data-avaliar-publicacao]");
    if (avaliarPublicacao && publicacao) { await bhAbrirAvaliacaoComunidade(publicacao, avaliarPublicacao); return; }
    const foto = evento.target.closest("[data-portfolio-foto]");
    if (foto && publicacao) return bhAbrirLightboxPortfolio(publicacao, foto.dataset.portfolioFoto);
    const curtir = evento.target.closest("[data-portfolio-curtir]");
    if (curtir && publicacao) {
      try {
        curtir.disabled = true;
        const ativa = await bhAlternarCurtidaPortfolio(publicacao.id, bhCurtidasPortfolio.has(publicacao.id));
        if (ativa) { bhCurtidasPortfolio.add(publicacao.id); publicacao.curtidas_count = Number(publicacao.curtidas_count || 0) + 1; }
        else { bhCurtidasPortfolio.delete(publicacao.id); publicacao.curtidas_count = Math.max(0, Number(publicacao.curtidas_count || 0) - 1); }
        bhRenderCardsPortfolioPublico();
      } catch (erro) { mostrarToast("erro", "Não foi possível curtir", bhErroMensagem(erro)); curtir.disabled = false; }
    }
    const denunciar = evento.target.closest("[data-portfolio-denunciar]");
    if (denunciar && publicacao) {
      document.getElementById("denunciaPublicacaoId").value = publicacao.id;
      document.getElementById("denunciaMotivo").value = "conteudo_inadequado";
      document.getElementById("denunciaDetalhes").value = "";
      bhAbrirModal("modalDenunciaPublicacao", denunciar);
    }
  });

  document.querySelectorAll("#avaliacaoComunidadeEstrelas [data-nota]").forEach(botao => botao.addEventListener("click", () => bhAtualizarEstrelasComunidade(Number(botao.dataset.nota))));

  document.getElementById("formAvaliacaoComunidade")?.addEventListener("submit", async evento => {
    evento.preventDefault();
    const nota = Number(document.getElementById("avaliacaoComunidadeNota").value);
    if (!nota) { mostrarToast("erro", "Escolha uma nota", "Selecione de 1 a 5 estrelas."); return; }
    const botao = document.querySelector('[form="formAvaliacaoComunidade"][type="submit"]');
    bhSetButtonLoading(botao, true, "Publicando...");
    try {
      await bhCriarOuAtualizarAvaliacaoComunidade({
        estabelecimentoId: bhEstabelecimentoPortfolio.id,
        publicacaoId: document.getElementById("avaliacaoComunidadePublicacaoId").value || null,
        nota,
        comentario: document.getElementById("avaliacaoComunidadeComentario").value
      });
      bhFecharModal("modalAvaliacaoComunidade");
      mostrarToast("sucesso", "Avaliação publicada", bhAlvoAvaliacaoComunidade.publicacaoId ? "Sua opinião sobre o trabalho foi registrada." : "Sua experiência foi compartilhada com a comunidade.");
      await bhRecarregarReputacaoPublica();
    } catch (erro) { mostrarToast("erro", "Não foi possível avaliar", bhErroMensagem(erro)); }
    finally { bhSetButtonLoading(botao, false); }
  });

  document.getElementById("formDenunciaPublicacao")?.addEventListener("submit", async evento => {
    evento.preventDefault();
    const botao = document.querySelector('[form="formDenunciaPublicacao"][type="submit"]');
    bhSetButtonLoading(botao, true, "Enviando...");
    try {
      await bhDenunciarPublicacaoPortfolio(document.getElementById("denunciaPublicacaoId").value, document.getElementById("denunciaMotivo").value, document.getElementById("denunciaDetalhes").value.trim());
      bhFecharModal("modalDenunciaPublicacao");
      mostrarToast("sucesso", "Denúncia recebida", "A equipe poderá analisar esta publicação.");
    } catch (erro) { mostrarToast("erro", "Não foi possível denunciar", bhErroMensagem(erro)); }
    finally { bhSetButtonLoading(botao, false); }
  });
});
