/**
 * recuperar-senha.js
 * Solicitação de recuperação de senha.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formRecuperarSenha");
  form.addEventListener("submit", async evento => {
    evento.preventDefault();
    const botao = form.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Enviando...");
    try {
      await bhSolicitarRecuperacaoSenha(document.getElementById("emailRecuperacao").value);
      form.classList.add("hidden");
      document.getElementById("recuperacaoEnviada").classList.remove("hidden");
    } catch (erro) {
      mostrarToast("erro", "Não foi possível enviar", bhErroMensagem(erro));
    } finally {
      bhSetButtonLoading(botao, false);
    }
  });
});
