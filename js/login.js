/**
 * login.js
 * Autenticação e redirecionamento após entrada.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("login");
  const form = document.getElementById("formLogin");
  const next = window.bhContinuation?.nextFromLocation?.();
  const cadastroLink = document.querySelector("[data-auth-signup]");
  if (cadastroLink && next) cadastroLink.href = `cadastro.html?next=${encodeURIComponent(next)}`;
  if (bhQueryParam("confirmado") === "1") {
    mostrarToast("sucesso", "E-mail confirmado", "Sua conta está pronta para entrar.");
  }
  const senha = document.getElementById("senha");
  const toggle = document.getElementById("toggleSenha");

  toggle?.addEventListener("click", () => {
    senha.type = senha.type === "password" ? "text" : "password";
    toggle.innerHTML = `<i class="bi ${senha.type === "password" ? "bi-eye" : "bi-eye-slash"}"></i>`;
  });

  form?.addEventListener("submit", async evento => {
    evento.preventDefault();
    const botao = form.querySelector("button[type='submit']");
    const email = document.getElementById("email").value.trim();
    const password = senha.value;

    if (!email || !password) {
      mostrarToast("erro", "Dados incompletos", "Informe e-mail e senha.");
      return;
    }

    bhSetButtonLoading(botao, true, "Entrando...");
    try {
      const captchaToken = await window.bhSecurity?.token?.(form);
      const resultado = await bhLogin(email, password, captchaToken);
      if (!resultado.perfil) throw new Error("Seu perfil ainda não foi criado. Tente novamente em alguns segundos.");
      mostrarToast("sucesso", "Login realizado", `Bem-vindo, ${resultado.perfil.nome}.`);
      const destino = bhDestinoPerfil(resultado.perfil, next);
      setTimeout(() => { location.href = destino; }, 550);
    } catch (erro) {
      window.bhSecurity?.reset?.(form);
      mostrarToast("erro", "Não foi possível entrar", bhErroMensagem(erro));
    } finally {
      bhSetButtonLoading(botao, false);
    }
  });
});
