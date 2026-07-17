let bhPortfolioPublico = [];
let bhCurtidasPortfolio = new Set();
let bhPerfilPortfolio = null;
let bhEstabelecimentoPortfolio = null;
let bhFiltroPortfolio = { categoria: "todas", profissional: "todos", servico: "todos", modo: "todos", ordem: "recentes" };

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
        <h1>${escapeHTML(item.nome)}</h1>
        <p>${escapeHTML(item.descricao)}</p>
        <div class="hero-actions">
          ${item.aceitaAgendamento ? `<a href="agendamento.html?barbearia=${item.id}" class="btn btn-primary">Agendar horário</a>` : ""}
          ${whatsapp ? `<a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener" class="btn btn-outline"><i class="bi bi-whatsapp"></i> WhatsApp</a>` : ""}
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
            <div class="divisor"></div>
            <h3>Horários</h3>
            <div class="hours-list">${horarios}</div>
          </div>
        </aside>
        <div class="grid" style="gap:28px">
          <div class="card"><div class="card-body"><h2>Serviços e preços</h2><div class="divisor"></div><div class="service-list">${servicos}</div></div></div>
          <div class="card"><div class="card-body"><h2>Profissionais</h2><div class="divisor"></div><div class="barber-list">${profissionais}</div></div></div>
          ${bhRenderSecaoPortfolioPublico()}
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
    bhPortfolioPublico = await bhListarPortfolioPublico(bhEstabelecimentoPortfolio.id);
    try { bhPerfilPortfolio = await bhGetPerfil(); } catch (_) { bhPerfilPortfolio = null; }
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
    const card = evento.target.closest("[data-publicacao-id]");
    const publicacao = card ? bhPortfolioPublico.find(item => item.id === card.dataset.publicacaoId) : null;
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
      const motivo = prompt("Informe o motivo: imagem sem autorização, conteúdo inadequado, informação falsa, spam ou outro.", "conteudo_inadequado");
      if (!motivo) return;
      const mapa = { "imagem sem autorização": "imagem_sem_autorizacao", "conteúdo inadequado": "conteudo_inadequado", "conteudo inadequado": "conteudo_inadequado", "informação falsa": "informacao_falsa", "informacao falsa": "informacao_falsa", spam: "spam", outro: "outro" };
      const valor = mapa[motivo.toLowerCase()] || (['imagem_sem_autorizacao','conteudo_inadequado','informacao_falsa','spam','outro'].includes(motivo) ? motivo : 'outro');
      const detalhes = prompt("Descreva brevemente o problema (opcional).", "") || "";
      try { await bhDenunciarPublicacaoPortfolio(publicacao.id, valor, detalhes); mostrarToast("sucesso", "Denúncia recebida", "A equipe poderá analisar esta publicação."); }
      catch (erro) { mostrarToast("erro", "Não foi possível denunciar", bhErroMensagem(erro)); }
    }
  });
});
