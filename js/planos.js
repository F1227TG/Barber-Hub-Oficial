/**
 * planos.js
 * Leitura do plano atual e apresentação dos limites comerciais.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

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

function bhRenderizarRecursosPlano(recursos = []) {
  const alvo = document.getElementById("planoAtualRecursos");
  if (!alvo) return;
  const itens = Array.isArray(recursos) ? recursos.filter(Boolean) : [];
  const resumo = itens.slice(0, 5);
  alvo.innerHTML = resumo.length
    ? `${resumo.map(item => `<span><i class="bi bi-check2-circle"></i>${escapeHTML(item)}</span>`).join("")}${itens.length > resumo.length ? '<a class="plan-current-more111" href="#comparativo-planos">Ver todos os benefícios</a>' : ""}`
    : "";
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
        { valor: "Grátis", label: "Para começar" },
        { valor: "4", label: "Fases de crescimento" },
        { valor: "Em validação", label: "Planos" }
      ]);
      bhRenderizarRecursosPlano([]);
      return;
    }

    if (perfil.tipo !== "barbeiro") {
      card.hidden = true;
      document.body.classList.add("plans-without-account-summary111");
      return;
    }

    card.hidden = false;

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
    const statusLegivel = ({ ativa:"Ativa", teste:"Em teste", atrasada:"Pagamento pendente", pausada:"Pausada", cancelada:"Cancelada", expirada:"Expirada", gratuita:"Gratuita" })[statusAssinatura] || statusAssinatura;
    const periodoFim = resumo.assinatura?.periodo_atual_fim || resumo.assinatura?.teste_termina_em || resumo.entitlements?.assinatura_periodo_fim || null;
    const validade = periodoFim ? ` Válido até ${bhFormatarData(periodoFim)}.` : " Sem vencimento definido nesta fase.";
    titulo.textContent = `${resumo.estabelecimento.nome} está no plano ${planoNome}.`;
    texto.textContent = statusAssinatura === "teste"
      ? `Status: ${statusLegivel}.${validade} Use este período para validar agenda, galeria e rotina do painel; a oferta comercial permanece em desenvolvimento.`
      : `Status: ${statusLegivel}.${validade} Os recursos disponíveis aparecem automaticamente no seu painel; a oferta comercial permanece em desenvolvimento.`;
    card.classList.toggle("is-highlight", true);

    const limitePublicacoes = resumo.plano?.limite_publicacoes || 10;
    const limiteProfissionais = resumo.plano?.limite_profissionais || 1;
    bhRenderizarStatsPlano([
      { valor: `${resumo.uso.publicacoes}/${limitePublicacoes}`, label: "Publicações" },
      { valor: `${resumo.uso.profissionais}/${limiteProfissionais}`, label: "Profissionais" },
      { valor: resumo.uso.aceitaAgendamento ? "Ativa" : (resumo.plano?.permite_agenda ? "Disponível" : "Indisponível"), label: "Agenda online" },
      { valor: periodoFim ? bhFormatarData(periodoFim, { day:"2-digit", month:"short" }) : "Sem prazo", label: statusAssinatura === "teste" ? "Fim do teste" : "Validade" }
    ]);
    bhRenderizarRecursosPlano(resumo.entitlements?.recursos || resumo.plano?.recursos || []);
    const planKey = bhSlug(planoNome).replace("perfil-", "");
    document.querySelectorAll("[data-plan-key]").forEach(planCard => {
      const current = planCard.dataset.planKey === planKey;
      planCard.classList.toggle("is-current-plan111", current);
      planCard.querySelector(".current-plan-label111")?.remove();
      if (current) planCard.insertAdjacentHTML("afterbegin", '<span class="current-plan-label111"><i class="bi bi-check2-circle"></i> Seu plano atual</span>');
    });
  } catch (erro) {
    console.warn("Falha ao carregar resumo do plano.", erro);
    titulo.textContent = "Não foi possível carregar seu plano agora.";
    texto.textContent = "Atualize a página em alguns instantes. Seus dados e benefícios permanecem preservados.";
    bhRenderizarStatsPlano([
      { valor: "—", label: "Uso atual" },
      { valor: "—", label: "Benefícios" },
      { valor: "—", label: "Agenda online" }
    ]);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("planos");
  await bhCarregarPlanoAtual();
});
