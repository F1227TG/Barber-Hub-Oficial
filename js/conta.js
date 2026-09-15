/**
 * conta.js — conta contextual, privacidade e segurança da versão 1.11.
 */

let bhContaPerfil = null;
let bhContaEstabelecimento = null;

function bhContaMenuButton(id, label, icon) {
  return `<button type="button" data-account-panel="${id}"><i class="bi ${icon}"></i><span>${label}</span><i class="bi bi-chevron-right account-menu-arrow"></i></button>`;
}

function bhContaMenuLink(url, label, icon, hash = "") {
  return `<a href="${bhUrl(url)}${hash}"><i class="bi ${icon}"></i><span>${label}</span><i class="bi bi-chevron-right account-menu-arrow"></i></a>`;
}

function bhContaPainel(id, title, subtitle, body) {
  const section = document.createElement("section");
  section.className = "form-card account-hub-panel account-generated-panel";
  section.dataset.accountPanelId = id;
  section.tabIndex = -1;
  section.innerHTML = `<button class="account-sheet-close" type="button" data-account-sheet-close aria-label="Voltar às opções"><i class="bi bi-chevron-left"></i><span>Minha conta</span></button><div class="section-top compact"><div><span class="tag">${escapeHTML(title)}</span><h2>${escapeHTML(title)}</h2><p class="texto-section">${escapeHTML(subtitle)}</p></div></div>${body}`;
  return section;
}

function bhContaAtalhos(perfil, estabelecimento) {
  if (perfil.tipo === "barbeiro") {
    const publicUrl = estabelecimento?.id ? `html/barbearia.html?id=${encodeURIComponent(estabelecimento.id)}` : "html/painel.html#pagina";
    return `
      <a href="${bhUrl("html/painel.html#agenda")}"><i class="bi bi-calendar-week"></i><span><strong>Agenda</strong><small>Hoje, semana e bloqueios</small></span></a>
      <a href="${bhUrl("html/painel.html#clientes")}"><i class="bi bi-people"></i><span><strong>Clientes</strong><small>Carteira e relacionamento</small></span></a>
      <a href="${bhUrl("html/painel.html#financeiro")}"><i class="bi bi-wallet2"></i><span><strong>Financeiro</strong><small>Receita, gastos e comissões</small></span></a>
      <a href="${bhUrl(publicUrl)}"><i class="bi bi-window"></i><span><strong>Página pública</strong><small>Veja como clientes encontram você</small></span></a>`;
  }
  if (perfil.tipo === "admin") {
    return `
      <a href="${bhUrl("html/admin.html")}"><i class="bi bi-shield-check"></i><span><strong>Administração</strong><small>Operação da plataforma</small></span></a>
      <a href="${bhUrl("html/admin-assinaturas.html")}"><i class="bi bi-gem"></i><span><strong>Assinaturas</strong><small>Planos dos estabelecimentos</small></span></a>`;
  }
  return `
    <a href="${bhUrl("html/cliente.html#proximos")}"><i class="bi bi-calendar2-check"></i><span><strong>Meus horários</strong><small>Próximos atendimentos</small></span></a>
    <a href="${bhUrl("html/portal.html")}"><i class="bi bi-calendar2-plus"></i><span><strong>Agendar</strong><small>Encontre um local e um horário</small></span></a>
    <a href="${bhUrl("html/cliente.html#favoritos")}"><i class="bi bi-heart"></i><span><strong>Favoritos</strong><small>Locais salvos</small></span></a>
    <a href="${bhUrl("html/cliente.html#historico")}"><i class="bi bi-clock-history"></i><span><strong>Histórico</strong><small>Atendimentos anteriores</small></span></a>`;
}

function bhContaMenu(perfil, estabelecimento) {
  if (perfil.tipo === "barbeiro") {
    const publicUrl = estabelecimento?.id ? `html/barbearia.html?id=${encodeURIComponent(estabelecimento.id)}` : "html/painel.html#pagina";
    return [
      bhContaMenuButton("resumo", "Resumo", "bi-grid"),
      bhContaMenuButton("perfil", "Perfil pessoal", "bi-person"),
      bhContaMenuButton("negocio", "Meu negócio", "bi-shop-window"),
      bhContaMenuLink("html/painel.html", "Portfólio", "bi-images", "#galeria"),
      bhContaMenuLink("html/painel.html", "Horários", "bi-clock", "#configuracoes"),
      bhContaMenuLink(publicUrl, "Página pública", "bi-window"),
      bhContaMenuButton("plano", "Plano", "bi-gem"),
      bhContaMenuButton("seguranca", "Segurança", "bi-shield-lock"),
      bhContaMenuButton("privacidade", "Privacidade", "bi-shield-check"),
      bhContaMenuButton("suporte", "Suporte", "bi-headset")
    ].join("");
  }
  if (perfil.tipo === "admin") {
    return [
      bhContaMenuButton("resumo", "Resumo", "bi-grid"),
      bhContaMenuButton("perfil", "Perfil", "bi-person"),
      bhContaMenuLink("html/admin.html", "Administração", "bi-shield-check"),
      bhContaMenuLink("html/admin-assinaturas.html", "Assinaturas", "bi-gem"),
      bhContaMenuButton("seguranca", "Segurança", "bi-shield-lock"),
      bhContaMenuButton("privacidade", "Privacidade", "bi-shield-check"),
      bhContaMenuButton("suporte", "Suporte", "bi-headset")
    ].join("");
  }
  return [
    bhContaMenuButton("resumo", "Resumo", "bi-grid"),
    bhContaMenuButton("perfil", "Perfil", "bi-person"),
    bhContaMenuLink("html/cliente.html", "Meus horários", "bi-calendar2-check", "#proximos"),
    bhContaMenuLink("html/cliente.html", "Favoritos", "bi-heart", "#favoritos"),
    bhContaMenuLink("html/cliente.html", "Histórico", "bi-clock-history", "#historico"),
    bhContaMenuButton("seguranca", "Segurança", "bi-shield-lock"),
    bhContaMenuButton("privacidade", "Privacidade", "bi-shield-check"),
    bhContaMenuButton("suporte", "Suporte", "bi-headset")
  ].join("");
}

function bhMontarHubConta(perfil, estabelecimento = null) {
  const container = document.querySelector(".page-conta main > .section > .container");
  if (!container || container.dataset.accountHubReady === "1") return;
  container.dataset.accountHubReady = "1";
  container.classList.remove("narrow-container");
  container.classList.add("account-hub-container");
  const formPerfil = document.getElementById("formConta");
  const formSenha = document.getElementById("formSenhaConta");
  const danger = document.querySelector(".danger-zone");
  if (!formPerfil || !formSenha || !danger) return;

  const verified = Boolean(perfil.authUser?.email_confirmed_at);
  const tipoLabel = perfil.tipo === "barbeiro" ? "Profissional" : perfil.tipo === "admin" ? "Administrador" : "Cliente";
  const layout = document.createElement("div");
  layout.className = "account-hub-layout account-hub-layout111";
  const sidebar = document.createElement("aside");
  sidebar.className = "account-hub-sidebar";
  sidebar.innerHTML = `
    <div class="account-hub-profile"><div class="account-hub-avatar-fallback">${escapeHTML((perfil.nome || "B").trim().slice(0, 1).toUpperCase())}</div><div><span>${escapeHTML(tipoLabel)}</span><strong>${escapeHTML(perfil.nome || "Minha conta")}</strong><small>${escapeHTML(perfil.email || "")}</small></div></div>
    <div class="account-verified111 ${verified ? "is-verified" : ""}"><i class="bi ${verified ? "bi-patch-check-fill" : "bi-envelope-exclamation"}"></i>${verified ? "E-mail verificado" : "Confirme seu e-mail"}</div>
    <nav class="account-hub-menu" aria-label="Opções da conta">${bhContaMenu(perfil, estabelecimento)}</nav>`;

  const workspace = document.createElement("div");
  workspace.className = "account-hub-workspace";
  const summary = bhContaPainel("resumo", "Visão geral", perfil.tipo === "barbeiro" ? "Acesse o que precisa para cuidar do seu negócio." : perfil.tipo === "cliente" ? "Seus próximos passos em poucos toques." : "Atalhos da sua conta administrativa.", `<div class="account-overview111"><div class="account-overview111-profile"><span>${escapeHTML(tipoLabel)}</span><strong>${escapeHTML(perfil.nome || "Minha conta")}</strong><small>${verified ? "Conta verificada e pronta para uso" : "Confirme seu e-mail para reforçar a segurança"}</small></div><div class="account-overview111-actions">${bhContaAtalhos(perfil, estabelecimento)}</div></div>`);
  const privacy = bhContaPainel("privacidade", "Privacidade", "Controle seus dados, sessões e pedido de exclusão.", `
    <div class="account-data-actions111"><button class="btn btn-outline" id="exportAccount111" type="button"><i class="bi bi-download"></i> Baixar meus dados</button><a class="btn btn-outline" href="${bhUrl("html/privacidade.html")}"><i class="bi bi-file-earmark-text"></i> Política de privacidade</a></div>
    <section class="account-sessions111" aria-labelledby="accountSessionsTitle111"><div class="section-top compact"><div><h3 id="accountSessionsTitle111">Acessos conectados</h3><p>Revise onde sua conta está ativa e encerre acessos que não reconhece.</p></div><button class="icon-btn" id="refreshSessions111" type="button" aria-label="Atualizar acessos"><i class="bi bi-arrow-clockwise"></i></button></div><div id="accountSessionsList111" aria-live="polite"><div class="operation-state loading compact"><span class="state-spinner"></span><strong>Carregando acessos</strong></div></div><div class="account-session-actions111"><button class="btn btn-outline btn-small" id="revokeOtherSessions111" type="button">Sair dos outros dispositivos</button><button class="btn btn-danger btn-small" id="revokeAllSessions111" type="button">Sair de todos</button></div></section>
    <section class="account-consents111" aria-labelledby="accountConsentsTitle111"><h3 id="accountConsentsTitle111">Seus consentimentos</h3><div id="accountConsentsList111"><span class="muted">Carregando histórico…</span></div></section>`);
  privacy.appendChild(danger);
  const support = bhContaPainel("suporte", "Suporte", "Encontre respostas ou fale com nossa equipe.", `<div class="account-support111"><a href="${bhUrl("html/contato.html#abrir-ticket")}"><i class="bi bi-chat-dots"></i><span><strong>Abrir atendimento</strong><small>Explique o que aconteceu</small></span></a><a href="${bhUrl("html/contato.html#meus-atendimentos")}"><i class="bi bi-ticket-perforated"></i><span><strong>Meus atendimentos</strong><small>Acompanhe respostas e protocolos</small></span></a><a href="${bhUrl("html/contato.html#support-faq-title")}"><i class="bi bi-question-circle"></i><span><strong>Respostas rápidas</strong><small>Dúvidas mais frequentes</small></span></a></div>`);

  formPerfil.classList.add("account-hub-panel"); formPerfil.dataset.accountPanelId = "perfil";
  formSenha.classList.add("account-hub-panel"); formSenha.dataset.accountPanelId = "seguranca";
  formPerfil.insertAdjacentHTML("afterbegin", '<button class="account-sheet-close" type="button" data-account-sheet-close aria-label="Voltar às opções"><i class="bi bi-chevron-left"></i><span>Minha conta</span></button>');
  formSenha.insertAdjacentHTML("afterbegin", '<button class="account-sheet-close" type="button" data-account-sheet-close aria-label="Voltar às opções"><i class="bi bi-chevron-left"></i><span>Minha conta</span></button>');
  workspace.append(summary, formPerfil, formSenha, privacy, support);
  if (perfil.tipo === "barbeiro") {
    const business = bhContaPainel("negocio", "Meu negócio", "Edite a operação sem misturar dados pessoais e profissionais.", `<div class="account-overview111-actions">${bhContaAtalhos(perfil, estabelecimento)}</div><a class="btn btn-primary" href="${bhUrl("html/painel.html#configuracoes")}"><i class="bi bi-sliders"></i> Abrir configurações do negócio</a>`);
    const plan = bhContaPainel("plano", "Plano", "Consulte seu nível atual e os recursos disponíveis.", `<div id="accountPlanSummary111"><div class="operation-state loading compact"><span class="state-spinner"></span><strong>Carregando plano</strong></div></div><a class="btn btn-primary" href="${bhUrl("html/planos.html")}"><i class="bi bi-gem"></i> Comparar planos</a>`);
    workspace.insertBefore(business, formSenha); workspace.insertBefore(plan, formSenha);
  }
  layout.append(sidebar, workspace); container.appendChild(layout);
  const photo = formPerfil.querySelector(".profile-photo-edit");
  if (photo) sidebar.querySelector(".account-verified111").insertAdjacentElement("afterend", photo);
  const preview = document.getElementById("contaAvatarPreview"); const fallback = sidebar.querySelector(".account-hub-avatar-fallback");
  if (preview && fallback) { fallback.replaceWith(preview); preview.classList.add("account-hub-avatar"); }

  const findPanel = id => [...workspace.querySelectorAll("[data-account-panel-id]")].find(panel => panel.dataset.accountPanelId === id);
  const isMobile = () => matchMedia("(max-width:840px)").matches;
  let sheetReturnFocus = null;
  const setSheetBackground = inactive => {
    [document.querySelector(".header"), document.querySelector(".footer"), document.querySelector(".mobile-app-dock"), sidebar].filter(Boolean).forEach(element => {
      if (inactive) {
        if (!element.hasAttribute("inert")) { element.setAttribute("inert", ""); element.dataset.accountInert111 = "1"; }
      } else if (element.dataset.accountInert111 === "1") {
        element.removeAttribute("inert"); delete element.dataset.accountInert111;
      }
    });
  };
  const trapSheetFocus = event => {
    if (event.key !== "Tab" || !document.body.classList.contains("account-sheet-open111")) return;
    const panel = workspace.querySelector(".account-hub-panel.ativo");
    const focusable = [...panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(item => !item.hidden && item.getClientRects().length);
    if (!focusable.length) { event.preventDefault(); panel.focus(); return; }
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const closeSheet = ({ fromHistory = false } = {}) => {
    if (!document.body.classList.contains("account-sheet-open111")) return;
    document.body.classList.remove("account-sheet-open111");
    setSheetBackground(false);
    workspace.querySelectorAll(".account-hub-panel").forEach(panel => { panel.removeAttribute("role"); panel.removeAttribute("aria-modal"); });
    sheetReturnFocus?.focus?.({ preventScroll:true });
    if (!fromHistory && layout.dataset.accountHistory111 === "1") { layout.dataset.accountHistory111 = "0"; history.back(); }
    else layout.dataset.accountHistory111 = "0";
  };
  const activate = (id, { openSheet = true, pushHistory = true, trigger = null } = {}) => {
    if (!findPanel(id)) return false;
    workspace.querySelectorAll(".account-hub-panel").forEach(panel => {
      const active = panel.dataset.accountPanelId === id;
      panel.classList.toggle("ativo", active); panel.setAttribute("aria-hidden", String(!active));
    });
    sidebar.querySelectorAll("[data-account-panel]").forEach(button => button.classList.toggle("ativo", button.dataset.accountPanel === id));
    window.bhViewState?.setMemory?.("account-panel", id);
    if (isMobile() && openSheet) {
      const wasOpen = document.body.classList.contains("account-sheet-open111");
      sheetReturnFocus = trigger || sheetReturnFocus || document.activeElement;
      document.body.classList.add("account-sheet-open111"); setSheetBackground(true);
      const panel = findPanel(id); panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-hidden", "false");
      if (!wasOpen && pushHistory) { history.pushState({ ...(history.state || {}), bhAccountSheet111:true }, "", location.href); layout.dataset.accountHistory111 = "1"; }
      requestAnimationFrame(() => panel.querySelector("[data-account-sheet-close]")?.focus());
    }
    return true;
  };
  sidebar.querySelectorAll("[data-account-panel]").forEach(button => button.addEventListener("click", () => activate(button.dataset.accountPanel, { trigger:button })));
  workspace.querySelectorAll("[data-account-sheet-close]").forEach(button => button.addEventListener("click", () => closeSheet()));
  document.addEventListener("keydown", event => {
    if (!document.body.classList.contains("account-sheet-open111")) return;
    if (event.key === "Escape") { event.preventDefault(); closeSheet(); return; }
    trapSheetFocus(event);
  });
  window.addEventListener("popstate", () => closeSheet({ fromHistory:true }));
  const hashPanel = location.hash.replace("#", "");
  const initialPanel = hashPanel || window.bhViewState?.getMemory?.("account-panel", "resumo") || "resumo";
  if (!activate(initialPanel, { openSheet:Boolean(hashPanel), pushHistory:Boolean(hashPanel) })) activate("resumo", { openSheet:false, pushHistory:false });
  if (!hashPanel && !window.bhViewState?.isReady?.()) {
    document.addEventListener("bh:view-state-restored", () => {
      const remembered = window.bhViewState?.getMemory?.("account-panel", "resumo") || "resumo";
      activate(remembered, { openSheet:false, pushHistory:false });
    }, { once:true });
  }
}

function bhContaFormatarData(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("pt-BR", { dateStyle:"long", timeStyle:"short" }).format(date) : "data não informada";
}

async function bhCarregarPlanoConta() {
  const host = document.getElementById("accountPlanSummary111");
  if (!host || bhContaPerfil?.tipo !== "barbeiro") return;
  try {
    const summary = await bhObterResumoAssinaturaBarbeiro(); const plan = summary?.plano;
    const status = summary?.assinatura?.status || "gratuita";
    const statusLabel = ({ ativa:"Ativa", teste:"Em teste", atrasada:"Pagamento pendente", pausada:"Pausada", cancelada:"Cancelada", expirada:"Expirada", gratuita:"Gratuita" })[status] || status;
    const periodEnd = summary?.assinatura?.periodo_atual_fim || summary?.assinatura?.teste_termina_em || summary?.entitlements?.assinatura_periodo_fim;
    const periodLabel = periodEnd ? `${status === "teste" ? "Teste" : "Validade"} até ${bhFormatarData(periodEnd)}` : "Sem vencimento definido";
    host.innerHTML = summary ? `<div class="account-plan111"><span>Plano atual</span><strong>${escapeHTML(plan?.nome || "Gratuito")}</strong><small>${escapeHTML(statusLabel)} · ${escapeHTML(periodLabel)}</small><div><b>${Number(summary.uso?.publicacoes || 0)}/${Number(plan?.limite_publicacoes || 10)}</b> publicações · <b>${Number(summary.uso?.profissionais || 0)}/${Number(plan?.limite_profissionais || 1)}</b> profissionais</div></div>` : '<div class="empty compact">Cadastre seu estabelecimento para acompanhar o plano.</div>';
  } catch (_) { host.innerHTML = '<div class="empty compact">Não foi possível consultar o plano agora.</div>'; }
}

function bhConfigurarImpactoExclusaoConta() {
  const host = document.getElementById("accountDeletionImpact111");
  if (!host || !bhContaPerfil) return;
  if (bhContaPerfil.tipo === "barbeiro" && bhContaEstabelecimento) {
    host.innerHTML = `<strong><i class="bi bi-shop"></i> O que acontece com ${escapeHTML(bhContaEstabelecimento.nome || "seu estabelecimento")}</strong><ul><li>A página pública, a agenda e o acesso da equipe serão encerrados ao fim dos sete dias.</li><li>Horários futuros ativos serão cancelados e os clientes receberão um aviso.</li><li>Dados operacionais vinculados ao negócio serão removidos conforme a política aplicável. Exporte seus dados antes de confirmar.</li></ul>`;
    return;
  }
  if (bhContaPerfil.tipo === "barbeiro") {
    host.innerHTML = `<strong><i class="bi bi-person-x"></i> Impacto profissional</strong><p>Seu vínculo de profissional será desativado. Estabelecimentos de outros proprietários continuam ativos, mas você perde o acesso à equipe e à agenda.</p>`;
    return;
  }
  if (bhContaPerfil.tipo === "admin") {
    host.innerHTML = `<strong><i class="bi bi-shield-exclamation"></i> Impacto administrativo</strong><p>Seu acesso administrativo será removido. Por segurança, o último administrador ativo não pode excluir a própria conta.</p>`;
    return;
  }
  host.innerHTML = `<strong><i class="bi bi-person-x"></i> O que será removido</strong><p>Perfil, favoritos, acessos e dados pessoais serão removidos ou anonimizados. Registros necessários para histórico e obrigações legais podem permanecer sem identificar você.</p>`;
}

function bhContaNomeDispositivo(userAgent) {
  const value = String(userAgent || "");
  if (/iphone|ipad/i.test(value)) return "iPhone ou iPad";
  if (/android/i.test(value)) return "Dispositivo Android";
  if (/windows/i.test(value)) return "Computador Windows";
  if (/macintosh|mac os/i.test(value)) return "Mac";
  return "Navegador conectado";
}

async function bhCarregarSessoesConta() {
  const host = document.getElementById("accountSessionsList111");
  if (!host || !window.bhBackendApi?.accountSessions) return;
  try {
    const response = await window.bhBackendApi.accountSessions(); const items = Array.isArray(response) ? response : response?.items || [];
    host.innerHTML = items.length ? items.map(item => `<article class="account-session111 ${item.current ? "is-current" : ""}"><i class="bi bi-${/android|iphone|ipad/i.test(item.user_agent || "") ? "phone" : "display"}"></i><div><strong>${escapeHTML(bhContaNomeDispositivo(item.user_agent))}${item.current ? " · atual" : ""}</strong><span>${escapeHTML(item.ip_masked || "Local não identificado")} · atividade ${bhContaFormatarData(item.updated_at || item.created_at)}</span></div></article>`).join("") : '<div class="empty compact">Nenhum outro acesso ativo.</div>';
    document.getElementById("revokeOtherSessions111").disabled = !response?.can_revoke_others;
  } catch (_) { host.innerHTML = '<div class="empty compact">Não foi possível consultar os acessos agora.</div>'; }
}

async function bhCarregarConsentimentosConta() {
  const host = document.getElementById("accountConsentsList111"); if (!host) return;
  try {
    const items = await window.bhListarMeusConsentimentos?.();
    host.innerHTML = Array.isArray(items) && items.length ? items.map(item => `<div class="account-consent111"><i class="bi ${item.acao === "revogado" ? "bi-x-circle" : "bi-check2-circle"}"></i><span><strong>${escapeHTML(item.documento || item.finalidade || "Consentimento")}</strong><small>${item.acao === "revogado" ? "revogado" : "aceito"} · versão ${escapeHTML(item.versao || "atual")} · ${bhContaFormatarData(item.created_at)}</small></span></div>`).join("") : '<span class="muted">Seus registros de aceite aparecerão aqui.</span>';
  } catch (_) { host.innerHTML = '<span class="muted">Histórico temporariamente indisponível.</span>'; }
}

async function bhCarregarExclusaoConta() {
  const host = document.getElementById("accountDeletionStatus111"); const open = document.getElementById("abrirExclusaoConta");
  if (!host || !window.bhBackendApi?.accountDeletion) return;
  try {
    const data = await window.bhBackendApi.accountDeletion();
    const pending = ["pendente", "agendada", "scheduled"].includes(String(data?.status || "").toLowerCase()) || Boolean(data?.scheduled_for && !data?.cancelled_at && !data?.executed_at);
    host.innerHTML = pending ? `<div class="account-deletion-pending111"><i class="bi bi-hourglass-split"></i><div><strong>Exclusão programada</strong><span>Sua conta está prevista para ${bhContaFormatarData(data.scheduled_for)}.</span></div>${data.can_cancel !== false ? '<button class="btn btn-outline btn-small" id="cancelAccountDeletion111" type="button">Cancelar pedido</button>' : ""}</div>` : "";
    if (open) open.hidden = pending;
  } catch (_) { host.innerHTML = ""; }
}

function bhBaixarDadosConta(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" }); const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `barber-hub-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bhContaExigeIdentidadeRecente(error) {
  return String(error?.code || "").toUpperCase() === "RECENT_AUTH_REQUIRED"
    || /autentica(?:ção|cao) recente|confirme sua identidade|recent.auth/i.test(String(error?.message || ""));
}

async function bhContaReautenticar(password) {
  const email = String(bhContaPerfil?.email || "").trim();
  if (!email || !password) throw new Error("Informe sua senha atual para confirmar a identidade.");
  const client = window.supabaseClient;
  if (!client?.auth?.signInWithPassword) throw new Error("Não foi possível confirmar sua identidade agora. Saia da conta, entre novamente e tente outra vez.");
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.session?.access_token) {
    const invalid = new Error("Senha atual incorreta. Confira e tente novamente.");
    invalid.code = "CURRENT_PASSWORD_INVALID";
    throw invalid;
  }
  return data.session;
}

function bhContaPedirSenhaAtual(title = "Confirmar identidade") {
  let dialog = document.getElementById("accountReauthDialog111");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "accountReauthDialog111";
    dialog.className = "account-reauth-dialog111";
    dialog.innerHTML = `<form method="dialog" data-account-reauth-form data-private-form><header><div><span>Proteção da conta</span><h2 data-account-reauth-title>Confirmar identidade</h2></div><button class="icon-btn" data-account-reauth-close aria-label="Fechar" type="button"><i class="bi bi-x-lg"></i></button></header><p>Digite sua senha atual para continuar com esta ação sensível.</p><label class="campo"><span>Senha atual</span><input autocomplete="current-password" data-no-persist name="password" required type="password"></label><footer><button class="btn btn-outline" value="cancel" type="submit">Cancelar</button><button class="btn btn-primary" value="confirm" type="submit">Confirmar</button></footer></form>`;
    dialog.querySelector("[data-account-reauth-close]").addEventListener("click", () => dialog.close("cancel"));
    document.body.appendChild(dialog);
  }
  dialog.querySelector("[data-account-reauth-title]").textContent = title;
  const input = dialog.querySelector('[name="password"]');
  input.value = "";
  return new Promise(resolve => {
    const finish = () => {
      dialog.removeEventListener("close", finish);
      const confirmed = dialog.returnValue === "confirm";
      const password = confirmed ? input.value : "";
      input.value = "";
      resolve(password || null);
    };
    dialog.addEventListener("close", finish, { once:true });
    dialog.returnValue = "";
    dialog.showModal();
    requestAnimationFrame(() => input.focus());
  });
}

async function bhContaExecutarComIdentidade(action, title) {
  try { return await action(); }
  catch (error) {
    if (!bhContaExigeIdentidadeRecente(error)) throw error;
    const password = await bhContaPedirSenhaAtual(title);
    if (!password) { const cancelled = new Error("A confirmação de identidade foi cancelada."); cancelled.code = "IDENTITY_CANCELLED"; throw cancelled; }
    await bhContaReautenticar(password);
    return action();
  }
}

function bhContaMensagemAcaoProtegida(error) {
  if (error?.code === "IDENTITY_CANCELLED") return null;
  if (bhContaExigeIdentidadeRecente(error)) return "Por segurança, saia da conta, entre novamente e repita esta ação.";
  return bhErroMensagem(error);
}

document.addEventListener("DOMContentLoaded", async () => {
  bhContaPerfil = await bhRequireAuth(["cliente", "barbeiro", "admin"]); if (!bhContaPerfil) return;
  if (bhContaPerfil.tipo === "barbeiro") bhContaEstabelecimento = await bhObterMeuEstabelecimento().catch(() => null);
  document.getElementById("contaNome").value = bhContaPerfil.nome || ""; document.getElementById("contaEmail").value = bhContaPerfil.email || ""; document.getElementById("contaTelefone").value = bhContaPerfil.telefone || "";
  document.getElementById("contaTipo").value = bhContaPerfil.tipo === "barbeiro" ? "Profissional" : bhContaPerfil.tipo === "admin" ? "Administrador" : "Cliente";
  document.getElementById("contaAvatarPreview").src = bhContaPerfil.avatar_url || "../img/logomarcaTRANSPARENTE.png";
  bhMontarHubConta(bhContaPerfil, bhContaEstabelecimento); bhConfigurarImpactoExclusaoConta(); bhCarregarPlanoConta(); bhCarregarSessoesConta(); bhCarregarConsentimentosConta(); bhCarregarExclusaoConta();

  document.getElementById("contaTelefone")?.addEventListener("input", event => { event.target.value = bhMascaraTelefone(event.target.value); });
  document.getElementById("contaAvatar")?.addEventListener("change", event => { if (event.target.files?.[0]) document.getElementById("contaAvatarPreview").src = URL.createObjectURL(event.target.files[0]); });
  document.getElementById("formConta")?.addEventListener("submit", async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button[type='submit']"); bhSetButtonLoading(button, true, "Salvando...");
    try {
      const input = document.getElementById("contaAvatar"); const file = window.bhArquivoImagem?.(input) || input.files?.[0]; const avatarUrl = file ? await bhUploadImagem(file, "perfil") : bhContaPerfil.avatar_url;
      const oldEmail = bhContaPerfil.email; const newEmail = document.getElementById("contaEmail").value.trim();
      bhContaPerfil = await bhAtualizarPerfil({ nome:document.getElementById("contaNome").value.trim(), telefone:document.getElementById("contaTelefone").value.trim(), avatar_url:avatarUrl });
      if (newEmail && newEmail !== oldEmail) { await bhAtualizarEmail(newEmail); mostrarToast("aviso", "Confirme o novo e-mail", "Enviamos uma confirmação para o endereço informado."); } else mostrarToast("sucesso", "Conta atualizada", "Seus dados foram salvos.");
    } catch (error) { mostrarToast("erro", "Falha ao atualizar conta", bhErroMensagem(error)); } finally { bhSetButtonLoading(button, false); }
  });
  document.getElementById("formSenhaConta")?.addEventListener("submit", async event => {
    event.preventDefault(); const password = document.getElementById("contaNovaSenha").value; const confirmation = document.getElementById("contaConfirmarSenha").value; const analysis = bhAnalisarSenha(password);
    if (!analysis.valida) return mostrarToast("erro", "Complete os requisitos da senha", analysis.mensagem); if (password !== confirmation) return mostrarToast("erro", "Senhas diferentes", "A confirmação precisa ser igual à nova senha.");
    const button = event.currentTarget.querySelector("button[type='submit']"); bhSetButtonLoading(button, true, "Atualizando...");
    try { await bhAtualizarSenha(password); event.currentTarget.reset(); mostrarToast("sucesso", "Senha atualizada", "Sua nova senha já está ativa."); } catch (error) { mostrarToast("erro", "Falha ao alterar senha", bhErroMensagem(error)); } finally { bhSetButtonLoading(button, false); }
  });
  document.getElementById("exportAccount111")?.addEventListener("click", async event => {
    const button = event.currentTarget; bhSetButtonLoading(button, true, "Preparando...");
    try { bhBaixarDadosConta(await window.bhBackendApi.accountExport()); mostrarToast("sucesso", "Arquivo preparado", "O download dos seus dados foi iniciado."); } catch (error) { mostrarToast("erro", "Não foi possível exportar", bhErroMensagem(error)); } finally { bhSetButtonLoading(button, false); }
  });
  document.getElementById("refreshSessions111")?.addEventListener("click", bhCarregarSessoesConta);
  document.getElementById("revokeOtherSessions111")?.addEventListener("click", async event => {
    if (!await bhConfirmar({ titulo:"Sair dos outros dispositivos", mensagem:"Este dispositivo continuará conectado.", confirmarTexto:"Encerrar outros acessos", trigger:event.currentTarget })) return;
    try { await bhContaExecutarComIdentidade(() => window.bhBackendApi.revokeOtherSessions(), "Encerrar outros acessos"); await bhCarregarSessoesConta(); mostrarToast("sucesso", "Outros acessos encerrados", "Sua sessão atual continua ativa."); } catch (error) { const message = bhContaMensagemAcaoProtegida(error); if (message) mostrarToast("erro", "Não foi possível encerrar", message); }
  });
  document.getElementById("revokeAllSessions111")?.addEventListener("click", async event => {
    if (!await bhConfirmar({ titulo:"Sair de todos os dispositivos", mensagem:"Você precisará entrar novamente neste e nos outros dispositivos.", confirmarTexto:"Sair de todos", perigo:true, trigger:event.currentTarget })) return;
    try { await bhContaExecutarComIdentidade(() => window.bhBackendApi.revokeAllSessions(), "Sair de todos os dispositivos"); try { await bhLogout(); } catch (_) { window.bhViewState?.clearAll?.(); } location.href = bhUrl("html/login.html?sessoes=encerradas"); } catch (error) { const message = bhContaMensagemAcaoProtegida(error); if (message) mostrarToast("erro", "Não foi possível encerrar", message); }
  });
  document.body.addEventListener("click", async event => {
    const cancelDeletion = event.target.closest("#cancelAccountDeletion111"); if (!cancelDeletion) return;
    if (!await bhConfirmar({ titulo:"Cancelar exclusão", mensagem:"Sua conta continuará ativa normalmente.", confirmarTexto:"Manter minha conta", trigger:cancelDeletion })) return;
    try { await bhContaExecutarComIdentidade(() => window.bhBackendApi.cancelAccountDeletion(), "Cancelar exclusão da conta"); await bhCarregarExclusaoConta(); mostrarToast("sucesso", "Exclusão cancelada", "Sua conta continuará ativa."); } catch (error) { const message = bhContaMensagemAcaoProtegida(error); if (message) mostrarToast("erro", "Não foi possível cancelar", message); }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const open = document.getElementById("abrirExclusaoConta"); const cancel = document.getElementById("cancelarExclusaoConta"); const form = document.getElementById("formExcluirConta");
  open?.addEventListener("click", () => { form.hidden = false; open.hidden = true; document.getElementById("excluirConfirmacao")?.focus(); });
  cancel?.addEventListener("click", () => { form.reset(); form.hidden = true; open.hidden = false; });
  form?.addEventListener("submit", async event => {
    event.preventDefault(); const confirmation = document.getElementById("excluirConfirmacao").value.trim(); const currentPassword = document.getElementById("excluirSenhaAtual").value;
    if (confirmation !== "EXCLUIR MINHA CONTA" || !document.getElementById("excluirCiente").checked) return mostrarToast("erro", "Confirmação incompleta", "Digite a frase indicada e confirme que entendeu o prazo.");
    if (!await bhConfirmar({ titulo:"Programar exclusão da conta", mensagem:"O pedido será executado em sete dias. Até lá, você poderá cancelá-lo nesta página.", confirmarTexto:"Programar para sete dias", perigo:true, trigger:form.querySelector("button[type='submit']") })) return;
    const button = form.querySelector("button[type='submit']"); bhSetButtonLoading(button, true, "Programando...");
    try { await bhContaReautenticar(currentPassword); await window.bhBackendApi.scheduleAccountDeletion({ confirmation, reason:document.getElementById("excluirMotivo").value || null }); form.reset(); form.hidden = true; await bhCarregarExclusaoConta(); mostrarToast("sucesso", "Exclusão programada", "Você pode cancelar o pedido durante os próximos sete dias."); }
    catch (error) { const message = bhContaMensagemAcaoProtegida(error); if (message) mostrarToast("erro", "Não foi possível programar", message); } finally { document.getElementById("excluirSenhaAtual").value = ""; bhSetButtonLoading(button, false); }
  });
});
