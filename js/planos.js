function bhRenderizarStatsPlano(stats = []) {
  const alvo = document.getElementById("planoAtualStats");
  if (!alvo) return;
  alvo.innerHTML = stats.map(item => `
    <div class="summary-item">
      <strong>${escapeHTML(item.valor)}</strong>
      <span>${escapeHTML(item.label)}</span>
    </div>
  `).join("");
}

async function bhCarregarPlanoAtual() {
  const titulo = document.getElementById("planoAtualTitulo");
  const texto = document.getElementById("planoAtualTexto");
  const card = document.getElementById("cardPlanoAtual");
  if (!titulo || !texto || !card) return;

  try {
    const perfil = await bhGetPerfil();
    if (!perfil) {
      bhRenderizarStatsPlano([
        { valor: "10", label: "Publicações grátis" },
        { valor: "1", label: "Profissional grátis" },
        { valor: "Opcional", label: "Upgrade futuro" }
      ]);
      return;
    }

    if (perfil.tipo !== "barbeiro") {
      titulo.textContent = perfil.tipo === "admin"
        ? "Conta administrativa conectada."
        : "Conta de cliente conectada.";
      texto.textContent = "A visualização detalhada de plano fica disponível para contas de barbeiro com estabelecimento cadastrado.";
      bhRenderizarStatsPlano([
        { valor: "Portal", label: "Acesso disponível" },
        { valor: "Conta", label: "Perfil ativo" },
        { valor: "Planos", label: "Prontos para expansão" }
      ]);
      return;
    }

    const resumo = await bhObterResumoAssinaturaBarbeiro();
    if (!resumo) {
      titulo.textContent = "Cadastre sua barbearia para desbloquear o acompanhamento do plano.";
      texto.textContent = "Assim que o estabelecimento for criado, esta área mostrará o plano atual, seus limites e recomendações de upgrade.";
      bhRenderizarStatsPlano([
        { valor: "0", label: "Estabelecimentos" },
        { valor: "0", label: "Publicações" },
        { valor: "0", label: "Profissionais" }
      ]);
      return;
    }

    const planoNome = resumo.plano?.nome || "Perfil gratuito";
    const statusAssinatura = resumo.assinatura?.status || "gratuita";
    titulo.textContent = `${resumo.estabelecimento.nome} está no plano ${planoNome}.`;
    texto.textContent = statusAssinatura === "teste"
      ? "Seu estabelecimento está em período de teste. Este é um ótimo momento para validar agenda, galeria e rotina do painel."
      : `Status atual da assinatura: ${statusAssinatura}. Você pode usar esta página para apresentar upgrades e futuras opções de cobrança.`;
    card.classList.toggle("is-highlight", true);

    const limitePublicacoes = resumo.plano?.limite_publicacoes || 10;
    const limiteProfissionais = resumo.plano?.limite_profissionais || 1;
    bhRenderizarStatsPlano([
      { valor: `${resumo.uso.publicacoes}/${limitePublicacoes}`, label: "Publicações" },
      { valor: `${resumo.uso.profissionais}/${limiteProfissionais}`, label: "Profissionais" },
      { valor: resumo.uso.aceitaAgendamento ? "Ativa" : (resumo.plano?.permite_agenda ? "Disponível" : "Indisponível"), label: "Agenda online" }
    ]);
  } catch (erro) {
    console.warn("Falha ao carregar resumo do plano.", erro);
    titulo.textContent = "Plano atual indisponível no momento.";
    texto.textContent = "A estrutura de planos já foi adicionada, mas os dados da assinatura ainda podem depender da execução do SQL mais recente no Supabase.";
    bhRenderizarStatsPlano([
      { valor: "SQL", label: "Migração pendente" },
      { valor: "Planos", label: "Página pronta" },
      { valor: "Upgrade", label: "Preparado" }
    ]);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("planos");
  await bhCarregarPlanoAtual();
});
