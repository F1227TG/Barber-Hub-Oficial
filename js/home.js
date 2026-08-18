/**
 * home.js
 * Interações e métricas apresentadas na página inicial.
 *
 * Organização: consulta das métricas públicas → animação dos indicadores →
 * tratamento de indisponibilidade sem bloquear o restante da página.
 */

function bhAnimarMetrica(elemento, valorFinal) {
  const reduzido = document.body.classList.contains("reduzir-movimento")
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduzido) {
    elemento.textContent = String(valorFinal);
    return;
  }

  const inicio = performance.now();
  const duracao = 650;
  const atualizar = agora => {
    const progresso = Math.min(1, (agora - inicio) / duracao);
    const suavizado = 1 - Math.pow(1 - progresso, 3);
    elemento.textContent = String(Math.round(valorFinal * suavizado));
    if (progresso < 1) requestAnimationFrame(atualizar);
  };
  requestAnimationFrame(atualizar);
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("home");
  if (!bhSupabasePronto()) return;

  try {
    // As contagens gerais vêm da API própria. A lista pública permanece no
    // frontend para calcular o status em tempo real conforme o horário local.
    const [metricas, estabelecimentos] = await Promise.all([
      bhMetricasPublicas(),
      bhListarEstabelecimentos()
    ]);
    const abertos = estabelecimentos.filter(item => bhCalcularStatus(item).aberta).length;
    const valores = {
      estabelecimentos: Number(metricas?.estabelecimentos ?? estabelecimentos.length),
      agendamentos: Number(metricas?.agendamentos ?? metricas?.com_agenda ?? 0),
      abertos
    };

    document.querySelectorAll("[data-stat]").forEach(elemento => {
      bhAnimarMetrica(elemento, Number(valores[elemento.dataset.stat] ?? 0));
    });
  } catch (erro) {
    console.warn("Não foi possível carregar as métricas públicas:", erro);
  }
});
