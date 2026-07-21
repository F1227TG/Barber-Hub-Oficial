/**
 * home.js
 * Interações e métricas apresentadas na página inicial.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("home");
  if (!bhSupabasePronto()) return;
  try {
    const estabelecimentos = await bhListarEstabelecimentos();
    const abertos = estabelecimentos.filter(item => bhCalcularStatus(item).aberta).length;
    const comAgenda = estabelecimentos.filter(item => item.aceitaAgendamento).length;
    const valores = {
      estabelecimentos: estabelecimentos.length,
      agendamentos: comAgenda,
      abertos
    };
    document.querySelectorAll("[data-stat]").forEach(elemento => {
      elemento.textContent = valores[elemento.dataset.stat] ?? 0;
    });
  } catch (erro) {
    console.warn("Não foi possível carregar as métricas públicas:", erro);
  }
});
