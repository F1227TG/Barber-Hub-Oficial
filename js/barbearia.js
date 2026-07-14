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
            <p><strong><i class="bi bi-star-fill"></i> Avaliação</strong><br><span class="rating">${Number(item.avaliacao || 5).toFixed(1)}</span></p><br>
            <p><strong>Status</strong><br><span class="status ${status.classe}">${status.texto}</span><br><small>${escapeHTML(status.detalhe)}</small></p>
            <div class="divisor"></div>
            <h3>Horários</h3>
            <div class="hours-list">${horarios}</div>
          </div>
        </aside>
        <div class="grid" style="gap:28px">
          <div class="card"><div class="card-body"><h2>Serviços e preços</h2><div class="divisor"></div><div class="service-list">${servicos}</div></div></div>
          <div class="card"><div class="card-body"><h2>Profissionais</h2><div class="divisor"></div><div class="barber-list">${profissionais}</div></div></div>
          <div class="card"><div class="card-body"><h2>Promoções</h2><div class="divisor"></div>${promocoes}</div></div>
        </div>
      </div>
    </section>`;
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("portal");
  const main = document.getElementById("barbeariaDetalhe");
  try {
    const id = bhQueryParam("id") || bhQueryParam("slug");
    if (!id) throw new Error("Estabelecimento não informado.");
    const item = await bhObterEstabelecimento(id);
    if (!item) throw new Error("Estabelecimento não encontrado ou indisponível.");
    bhRenderDetalheEstabelecimento(item);
  } catch (erro) {
    main.innerHTML = `<div class="container section"><div class="card empty"><span class="big">💈</span><h2>Não foi possível abrir esta página</h2><p>${escapeHTML(bhErroMensagem(erro))}</p><a class="btn btn-primary" href="portal.html">Voltar ao portal</a></div></div>`;
  }
});
