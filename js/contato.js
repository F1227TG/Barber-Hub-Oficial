async function bhRenderMeusTickets() {
  const box = document.getElementById("meusTickets");
  if (!box) return;
  try {
    const perfil = await bhGetPerfil();
    if (!perfil) {
      box.innerHTML = `<div class="empty compact">Entre na sua conta para acompanhar o histórico dos tickets.</div>`;
      return;
    }
    const tickets = await bhListarMeusTickets();
    box.innerHTML = tickets.length ? tickets.map(ticket => `
      <div class="ticket-card">
        <div><strong>#${ticket.id.slice(0, 8)} — ${escapeHTML(ticket.assunto)}</strong><span>${new Date(ticket.created_at).toLocaleString("pt-BR")} • ${escapeHTML(ticket.categoria)}</span></div>
        <span class="status ${ticket.status === "fechado" || ticket.status === "respondido" ? "concluido" : "pendente"}">${escapeHTML(ticket.status.replaceAll("_", " "))}</span>
        ${ticket.resposta ? `<p><strong>Resposta:</strong> ${escapeHTML(ticket.resposta)}</p>` : ""}
      </div>`).join("") : `<div class="empty compact">Você ainda não abriu tickets.</div>`;
  } catch (erro) {
    box.innerHTML = `<div class="empty compact">${escapeHTML(bhErroMensagem(erro))}</div>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("contato");
  const form = document.getElementById("formContato");
  try {
    const perfil = bhSupabasePronto() ? await bhGetPerfil() : null;
    if (perfil) {
      document.getElementById("nome").value = perfil.nome || "";
      document.getElementById("email").value = perfil.email || "";
    }
  } catch (_) {}
  await bhRenderMeusTickets();

  form.addEventListener("submit", async evento => {
    evento.preventDefault();
    const botao = form.querySelector("button[type='submit']");
    const dados = {
      nome: document.getElementById("nome").value.trim(),
      email: document.getElementById("email").value.trim(),
      categoria: document.getElementById("categoria").value,
      prioridade: document.getElementById("prioridade").value,
      assunto: document.getElementById("assunto").value.trim(),
      mensagem: document.getElementById("mensagem").value.trim()
    };
    if (!dados.nome || !dados.email || !dados.assunto || !dados.mensagem) {
      mostrarToast("erro", "Ticket incompleto", "Preencha os campos obrigatórios.");
      return;
    }
    bhSetButtonLoading(botao, true, "Enviando ticket...");
    try {
      const ticket = await bhCriarTicket(dados);
      mostrarToast("sucesso", "Ticket aberto", `Protocolo ${ticket.id.slice(0, 8)} criado com sucesso.`);
      form.reset();
      await bhRenderMeusTickets();
    } catch (erro) {
      mostrarToast("erro", "Falha ao enviar ticket", bhErroMensagem(erro));
    } finally {
      bhSetButtonLoading(botao, false);
    }
  });
});
