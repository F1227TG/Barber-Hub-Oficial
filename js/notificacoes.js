/**
 * notificacoes.js
 * Listagem, leitura e atualização das notificações.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

let bhNotificacoes = [];
let bhFiltroNotificacoes = "todas";
let bhPerfilNotificacoes = null;
let bhNotificacoesHasMore = false;
let bhNaoLidasTotal = 0;
const BH_NOTIFICACOES_PAGE = 30;

const BH_ICONE_NOTIFICACAO = {
  agendamento: "bi-calendar2-check",
  avaliacao: "bi-star",
  suporte: "bi-headset",
  portfolio: "bi-images",
  sistema: "bi-megaphone"
};

function bhTempoRelativo(data) {
  const segundos = Math.floor((Date.now() - new Date(data).getTime()) / 1000);
  if (segundos < 60) return "agora";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `há ${dias} dia${dias > 1 ? "s" : ""}`;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(data));
}

function bhNotificacoesFiltradas() {
  return bhNotificacoes;
}

function bhNotificacoesItens(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function bhNotificacaoUrlSegura(value) {
  const raw = String(value || "").trim();
  if (!raw || /^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith("//") || raw.includes("\\")) return null;
  try {
    const url = new URL(bhUrl(raw), location.href);
    return url.origin === location.origin || location.protocol === "file:" ? url.href : null;
  } catch {
    return null;
  }
}

function bhRotuloDiaNotificacao(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Data não informada";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((startToday - startDate) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", { weekday:"long", day:"2-digit", month:"long" }).format(date);
}

function bhAgruparNotificacoes(itens) {
  const groups = new Map();
  itens.forEach(item => {
    const date = new Date(item.created_at);
    const key = Number.isFinite(date.getTime()) ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : "unknown";
    if (!groups.has(key)) groups.set(key, { label:bhRotuloDiaNotificacao(item.created_at), items:[] });
    groups.get(key).items.push(item);
  });
  return [...groups.values()];
}

function bhRenderNotificacoes() {
  const lista = document.getElementById("listaNotificacoes");
  const itens = bhNotificacoesFiltradas();
  document.getElementById("resumoNotificacoes").innerHTML = `<strong>${bhNaoLidasTotal}</strong><span>não lida${bhNaoLidasTotal === 1 ? "" : "s"}</span><span>•</span><strong>${bhNotificacoes.length}</strong><span>exibida${bhNotificacoes.length === 1 ? "" : "s"}</span>`;
  document.getElementById("marcarTodasLidas").disabled = bhNaoLidasTotal === 0;
  document.getElementById("notificacoesMais110").hidden = !bhNotificacoesHasMore;
  if (!itens.length) {
    lista.innerHTML = `<div class="empty"><i class="bi bi-bell-slash big"></i><h3>Nenhuma notificação aqui</h3><p>${bhFiltroNotificacoes === "nao_lidas" ? "Você já leu todas as atualizações." : "Novos avisos aparecerão nesta central."}</p></div>`;
    return;
  }
  lista.innerHTML = bhAgruparNotificacoes(itens).map(group => `<section class="notification-day-group111"><h2>${escapeHTML(group.label)}</h2><div>${group.items.map(item => {
    const target = bhNotificacaoUrlSegura(item.url);
    return `
    <article class="notification-item ${item.lida_em ? "lida" : "nao-lida"}" data-notificacao-id="${item.id}">
      <div class="notification-icon"><i class="bi ${BH_ICONE_NOTIFICACAO[item.tipo] || "bi-bell"}"></i></div>
      <div class="notification-content">
        <div class="notification-head"><strong>${escapeHTML(item.titulo || "Atualização")}</strong><time datetime="${escapeHTML(item.created_at || "")}">${bhTempoRelativo(item.created_at)}</time></div>
        <p>${escapeHTML(item.mensagem || "")}</p>
        <div class="notification-actions">
          ${target ? `<a class="btn btn-primary btn-small" data-abrir-notificacao href="${escapeHTML(target)}">Abrir</a>` : ""}
          ${!item.lida_em ? `<button class="btn btn-outline btn-small" data-marcar-lida>Marcar como lida</button>` : `<span class="read-label"><i class="bi bi-check2-all"></i> Lida</span>`}
        </div>
      </div>
    </article>`;
  }).join("")}</div></section>`).join("");
}

async function bhCarregarNotificacoes(reset = true) {
  const filtroTipo = ["todas", "nao_lidas"].includes(bhFiltroNotificacoes) ? null : bhFiltroNotificacoes;
  const resposta = await bhListarNotificacoes({ somenteNaoLidas:bhFiltroNotificacoes === "nao_lidas", tipo:filtroTipo, offset:reset ? 0 : bhNotificacoes.length, limite:BH_NOTIFICACOES_PAGE });
  const pagina = bhNotificacoesItens(resposta);
  bhNotificacoes = reset ? pagina : [...bhNotificacoes, ...pagina];
  bhNotificacoesHasMore = pagina.length === BH_NOTIFICACOES_PAGE;
  bhNaoLidasTotal = await bhContarNotificacoesNaoLidas();
  bhRenderNotificacoes();
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("notificacoes");
  bhPerfilNotificacoes = await bhRequireAuth(["cliente", "barbeiro", "admin"]);
  if (!bhPerfilNotificacoes) return;
  try { await bhCarregarNotificacoes(); }
  catch (erro) { mostrarToast("erro", "Falha ao carregar notificações", bhErroMensagem(erro)); }

  document.querySelectorAll("[data-notificacao-filtro]").forEach(botao => botao.addEventListener("click", async () => {
    bhFiltroNotificacoes = botao.dataset.notificacaoFiltro;
    document.querySelectorAll("[data-notificacao-filtro]").forEach(item => item.classList.toggle("ativo", item === botao));
    try { await bhCarregarNotificacoes(true); } catch (erro) { mostrarToast("erro", "Filtro indisponível", bhErroMensagem(erro)); }
  }));
  document.getElementById("notificacoesMais110")?.addEventListener("click", () => bhCarregarNotificacoes(false).catch(erro => mostrarToast("erro", "Não foi possível carregar mais", bhErroMensagem(erro))));

  document.getElementById("marcarTodasLidas").addEventListener("click", async () => {
    const anteriores = bhNotificacoes.map(item => ({ id:item.id, lida_em:item.lida_em }));
    const totalAnterior = bhNaoLidasTotal;
    const agora = new Date().toISOString();
    bhNotificacoes.forEach(item => { item.lida_em ||= agora; });
    bhNaoLidasTotal = 0;
    bhRenderNotificacoes();
    try {
      await bhMarcarTodasNotificacoesLidas();
      bhAtualizarNavegacao?.(bhPerfilNotificacoes);
      document.dispatchEvent(new CustomEvent("bh:notifications-changed"));
    } catch (erro) {
      anteriores.forEach(anterior => { const item = bhNotificacoes.find(atual => atual.id === anterior.id); if (item) item.lida_em = anterior.lida_em; });
      bhNaoLidasTotal = totalAnterior;
      bhRenderNotificacoes();
      mostrarToast("erro", "Não foi possível atualizar", "Nada foi perdido. Tente novamente.");
    }
  });

  document.getElementById("listaNotificacoes").addEventListener("click", async evento => {
    const item = evento.target.closest("[data-notificacao-id]");
    if (!item) return;
    const id = item.dataset.notificacaoId;
    const abrirLink = evento.target.closest("[data-abrir-notificacao]");
    if (abrirLink) evento.preventDefault();
    if (evento.target.closest("[data-marcar-lida]") || abrirLink) {
      const notificacao = bhNotificacoes.find(n => String(n.id) === String(id));
      const anterior = notificacao?.lida_em || null;
      if (notificacao && !notificacao.lida_em) {
        notificacao.lida_em = new Date().toISOString();
        bhNaoLidasTotal = Math.max(0, bhNaoLidasTotal - 1);
        bhRenderNotificacoes();
      }
      try {
        await bhMarcarNotificacaoLida(id);
        document.dispatchEvent(new CustomEvent("bh:notifications-changed"));
        if (abrirLink) location.href = abrirLink.href;
      } catch (erro) {
        if (notificacao) notificacao.lida_em = anterior;
        if (!anterior) bhNaoLidasTotal += 1;
        bhRenderNotificacoes();
        mostrarToast("erro", "Não foi possível marcar como lida", "O aviso continua na sua lista de não lidos.");
        if (abrirLink) setTimeout(() => { location.href = abrirLink.href; }, 250);
      }
    }
  });

  document.addEventListener("bh:notifications-changed", () => bhCarregarNotificacoes(true).catch(() => {}));

  window.supabaseClient?.channel(`central-notificacoes-${bhPerfilNotificacoes.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${bhPerfilNotificacoes.id}` }, () => bhCarregarNotificacoes(true))
    .subscribe();
});
