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
  if (bhFiltroNotificacoes === "nao_lidas") return bhNotificacoes.filter(item => !item.lida_em);
  if (bhFiltroNotificacoes !== "todas") return bhNotificacoes.filter(item => item.tipo === bhFiltroNotificacoes);
  return bhNotificacoes;
}

function bhRenderNotificacoes() {
  const lista = document.getElementById("listaNotificacoes");
  const itens = bhNotificacoesFiltradas();
  const naoLidas = bhNotificacoes.filter(item => !item.lida_em).length;
  document.getElementById("resumoNotificacoes").innerHTML = `<strong>${naoLidas}</strong><span>não lida${naoLidas === 1 ? "" : "s"}</span><span>•</span><strong>${bhNotificacoes.length}</strong><span>no total</span>`;
  document.getElementById("marcarTodasLidas").disabled = naoLidas === 0;
  if (!itens.length) {
    lista.innerHTML = `<div class="empty"><i class="bi bi-bell-slash big"></i><h3>Nenhuma notificação aqui</h3><p>${bhFiltroNotificacoes === "nao_lidas" ? "Você já leu todas as atualizações." : "Novos avisos aparecerão nesta central."}</p></div>`;
    return;
  }
  lista.innerHTML = itens.map(item => `
    <article class="notification-item ${item.lida_em ? "lida" : "nao-lida"}" data-notificacao-id="${item.id}">
      <div class="notification-icon"><i class="bi ${BH_ICONE_NOTIFICACAO[item.tipo] || "bi-bell"}"></i></div>
      <div class="notification-content">
        <div class="notification-head"><strong>${escapeHTML(item.titulo)}</strong><time datetime="${item.created_at}">${bhTempoRelativo(item.created_at)}</time></div>
        <p>${escapeHTML(item.mensagem)}</p>
        <div class="notification-actions">
          ${item.url ? `<a class="btn btn-primary btn-small" data-abrir-notificacao href="${bhUrl(item.url)}">Abrir</a>` : ""}
          ${!item.lida_em ? `<button class="btn btn-outline btn-small" data-marcar-lida>Marcar como lida</button>` : `<span class="read-label"><i class="bi bi-check2-all"></i> Lida</span>`}
        </div>
      </div>
    </article>`).join("");
}

async function bhCarregarNotificacoes() {
  bhNotificacoes = await bhListarNotificacoes({ limite: 150 });
  bhRenderNotificacoes();
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("notificacoes");
  bhPerfilNotificacoes = await bhRequireAuth(["cliente", "barbeiro", "admin"]);
  if (!bhPerfilNotificacoes) return;
  try { await bhCarregarNotificacoes(); }
  catch (erro) { mostrarToast("erro", "Falha ao carregar notificações", bhErroMensagem(erro)); }

  document.querySelectorAll("[data-notificacao-filtro]").forEach(botao => botao.addEventListener("click", () => {
    bhFiltroNotificacoes = botao.dataset.notificacaoFiltro;
    document.querySelectorAll("[data-notificacao-filtro]").forEach(item => item.classList.toggle("ativo", item === botao));
    bhRenderNotificacoes();
  }));

  document.getElementById("marcarTodasLidas").addEventListener("click", async () => {
    try {
      await bhMarcarTodasNotificacoesLidas();
      bhNotificacoes.forEach(item => { item.lida_em ||= new Date().toISOString(); });
      bhRenderNotificacoes();
      bhAtualizarNavegacao?.(bhPerfilNotificacoes);
    } catch (erro) { mostrarToast("erro", "Não foi possível atualizar", bhErroMensagem(erro)); }
  });

  document.getElementById("listaNotificacoes").addEventListener("click", async evento => {
    const item = evento.target.closest("[data-notificacao-id]");
    if (!item) return;
    const id = item.dataset.notificacaoId;
    if (evento.target.closest("[data-marcar-lida]") || evento.target.closest("[data-abrir-notificacao]")) {
      try {
        await bhMarcarNotificacaoLida(id);
        const notificacao = bhNotificacoes.find(n => n.id === id);
        if (notificacao) notificacao.lida_em = new Date().toISOString();
        bhRenderNotificacoes();
      } catch (erro) { mostrarToast("erro", "Não foi possível marcar como lida", bhErroMensagem(erro)); }
    }
  });

  window.supabaseClient?.channel(`central-notificacoes-${bhPerfilNotificacoes.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${bhPerfilNotificacoes.id}` }, bhCarregarNotificacoes)
    .subscribe();
});
