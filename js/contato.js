/**
 * contato.js
 * Experiência da Central de Suporte e integração com a API própria.
 *
 * Responsabilidades:
 * - preencher dados do usuário autenticado;
 * - preparar o formulário por atalhos de assunto;
 * - consultar o estado da API;
 * - abrir e listar tickets com mensagens claras.
 */

const BH_SUPPORT_TEMPLATES = {
  acesso: {
    categoria: "suporte",
    assunto: "Problema com conta ou acesso",
    mensagem: "Explique em qual etapa do acesso ocorreu o problema e qual mensagem apareceu na tela."
  },
  agendamento: {
    categoria: "suporte",
    assunto: "Dúvida ou problema em um agendamento",
    mensagem: "Informe o estabelecimento, a data aproximada e a ação que estava tentando realizar."
  },
  negocio: {
    categoria: "cadastro",
    assunto: "Ajuda com o cadastro ou gestão do meu negócio",
    mensagem: "Informe qual área do painel ou configuração do estabelecimento precisa de ajuda."
  },
  sugestao: {
    categoria: "sugestao",
    assunto: "Sugestão para o Barber Hub",
    mensagem: "Descreva a melhoria, quem seria beneficiado e como você imagina o funcionamento."
  }
};

function bhSupportStatusLabel(status) {
  const labels = {
    aberto: "Aberto",
    em_analise: "Em análise",
    respondido: "Respondido",
    fechado: "Fechado"
  };
  return labels[status] || String(status || "aberto").replaceAll("_", " ");
}

function bhRenderTicket(ticket) {
  const concluido = ["fechado", "respondido"].includes(ticket.status);
  const data = ticket.created_at ? new Date(ticket.created_at).toLocaleString("pt-BR") : "Agora";
  return `
    <article class="ticket-card support-ticket-card">
      <div class="support-ticket-main">
        <div class="support-ticket-icon"><i class="bi bi-ticket-perforated"></i></div>
        <div>
          <strong>#${escapeHTML(String(ticket.id || "").slice(0, 8))} — ${escapeHTML(ticket.assunto)}</strong>
          <span>${escapeHTML(data)} • ${escapeHTML(ticket.categoria || "suporte")}</span>
        </div>
      </div>
      <span class="status ${concluido ? "concluido" : "pendente"}">${escapeHTML(bhSupportStatusLabel(ticket.status))}</span>
      ${ticket.resposta ? `<div class="support-ticket-response"><i class="bi bi-chat-left-text"></i><p><strong>Resposta da equipe</strong>${escapeHTML(ticket.resposta)}</p></div>` : ""}
    </article>`;
}

async function bhRenderMeusTickets() {
  const box = document.getElementById("meusTickets");
  if (!box) return;

  box.innerHTML = `
    <div class="support-ticket-skeleton" aria-label="Carregando tickets">
      <span></span><span></span><span></span>
    </div>`;

  try {
    const perfil = await bhGetPerfil();
    if (!perfil) {
      box.innerHTML = `
        <div class="empty support-empty-state">
          <i class="bi bi-person-lock"></i>
          <strong>Entre para acompanhar seus tickets</strong>
          <p>Solicitações enviadas com a conta conectada aparecem aqui com status e resposta.</p>
          <a class="btn btn-outline btn-small" href="login.html">Entrar na conta</a>
        </div>`;
      return;
    }

    const tickets = await bhListarMeusTickets();
    box.innerHTML = tickets.length
      ? tickets.map(bhRenderTicket).join("")
      : `<div class="empty support-empty-state"><i class="bi bi-inbox"></i><strong>Nenhum ticket aberto</strong><p>Quando precisar, use o formulário acima. O protocolo aparecerá aqui.</p></div>`;
  } catch (erro) {
    box.innerHTML = `<div class="empty compact">${escapeHTML(bhErroMensagem(erro))}</div>`;
  }
}

async function bhVerificarApiSuporte() {
  const box = document.querySelector("[data-api-status]");
  if (!box) return;

  try {
    const status = await window.bhBackendApi?.health();
    const ready = status?.status === "ready";
    box.className = `support-api-state ${ready ? "is-ready" : "is-warning"}`;
    box.innerHTML = `
      <span class="support-api-dot"></span>
      <div>
        <strong>${ready ? "API própria operacional" : "Configuração do backend pendente"}</strong>
        <small>${ready ? "Tickets e validações estão passando pelo servidor." : "Configure as variáveis protegidas na Vercel."}</small>
      </div>`;
  } catch (_) {
    box.className = "support-api-state is-local";
    box.innerHTML = `
      <span class="support-api-dot"></span>
      <div><strong>Modo de desenvolvimento local</strong><small>Use “vercel dev” para testar as rotas /api no computador.</small></div>`;
  }
}

function bhConfigurarAtalhosSuporte() {
  document.querySelectorAll("[data-support-template]").forEach(button => {
    button.addEventListener("click", () => {
      const template = BH_SUPPORT_TEMPLATES[button.dataset.supportTemplate];
      if (!template) return;

      document.getElementById("categoria").value = template.categoria;
      document.getElementById("assunto").value = template.assunto;
      const mensagem = document.getElementById("mensagem");
      if (!mensagem.value.trim()) mensagem.value = template.mensagem;
      mensagem.dispatchEvent(new Event("input", { bubbles: true }));

      document.querySelectorAll("[data-support-template]").forEach(item => item.classList.remove("ativo"));
      button.classList.add("ativo");
      document.getElementById("abrir-ticket").scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => document.getElementById("assunto").focus(), 450);
    });
  });
}

function bhConfigurarContadorMensagem() {
  const field = document.getElementById("mensagem");
  const counter = document.querySelector("[data-message-count]");
  if (!field || !counter) return;
  const update = () => { counter.textContent = `${field.value.length}/4000`; };
  field.addEventListener("input", update);
  update();
}

async function bhPreencherPerfilSuporte() {
  try {
    const perfil = bhSupabasePronto() ? await bhGetPerfil() : null;
    if (!perfil) return;
    document.getElementById("nome").value = perfil.nome || "";
    document.getElementById("email").value = perfil.email || "";
  } catch (_) {
    // O formulário continua disponível para visitantes.
  }
}

function bhDadosTicket() {
  return {
    nome: document.getElementById("nome").value.trim(),
    email: document.getElementById("email").value.trim(),
    categoria: document.getElementById("categoria").value,
    prioridade: document.getElementById("prioridade").value,
    assunto: document.getElementById("assunto").value.trim(),
    mensagem: document.getElementById("mensagem").value.trim(),
    website: document.getElementById("website").value.trim()
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("contato");
  bhConfigurarAtalhosSuporte();
  bhConfigurarContadorMensagem();
  await Promise.all([bhPreencherPerfilSuporte(), bhRenderMeusTickets(), bhVerificarApiSuporte()]);

  const form = document.getElementById("formContato");
  form?.addEventListener("submit", async evento => {
    evento.preventDefault();
    const botao = form.querySelector("button[type='submit']");
    const dados = bhDadosTicket();

    if (!dados.nome || !dados.email || !dados.assunto || dados.mensagem.length < 15) {
      mostrarToast("erro", "Revise o ticket", "Preencha os campos obrigatórios e descreva melhor o problema.");
      return;
    }

    bhSetButtonLoading(botao, true, "Enviando ticket...");
    try {
      const ticket = await bhCriarTicket(dados);
      mostrarToast("sucesso", "Ticket aberto", `Protocolo ${String(ticket.id).slice(0, 8)} criado com sucesso.`);

      const nome = document.getElementById("nome").value;
      const email = document.getElementById("email").value;
      form.reset();
      document.getElementById("nome").value = nome;
      document.getElementById("email").value = email;
      document.querySelectorAll("[data-support-template]").forEach(item => item.classList.remove("ativo"));
      document.getElementById("mensagem").dispatchEvent(new Event("input"));
      await bhRenderMeusTickets();
      document.getElementById("meus-atendimentos").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (erro) {
      mostrarToast("erro", "Falha ao enviar ticket", bhErroMensagem(erro));
    } finally {
      bhSetButtonLoading(botao, false);
    }
  });
});
