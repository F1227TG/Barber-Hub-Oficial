/**
 * redefinir-senha.js
 * Definição segura de uma nova senha.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("formRedefinirSenha");
  let sessao = null;
  try { sessao = await bhGetSession(); } catch (_) { sessao = null; }
  if (!sessao) {
    form.classList.add("hidden");
    document.getElementById("recuperacaoInvalida").classList.remove("hidden");
    return;
  }
  form.addEventListener("submit", async evento => {
    evento.preventDefault();
    const senha = document.getElementById("novaSenha").value;
    const confirmar = document.getElementById("confirmarNovaSenha").value;
    if (senha.length < 8) { mostrarToast("erro", "Senha muito curta", "Use pelo menos 8 caracteres."); return; }
    if (senha !== confirmar) { mostrarToast("erro", "Senhas diferentes", "A confirmação precisa ser igual à nova senha."); return; }
    const botao = form.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Salvando...");
    try {
      await bhAtualizarSenha(senha);
      mostrarToast("sucesso", "Senha redefinida", "Você já pode entrar com a nova senha.");
      setTimeout(() => { location.href = "login.html"; }, 800);
    } catch (erro) {
      mostrarToast("erro", "Não foi possível redefinir", bhErroMensagem(erro));
    } finally { bhSetButtonLoading(botao, false); }
  });
});
