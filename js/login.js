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
      const resultado = await bhLogin(email, password);
      if (!resultado.perfil) throw new Error("Seu perfil ainda não foi criado. Tente novamente em alguns segundos.");
      mostrarToast("sucesso", "Login realizado", `Bem-vindo, ${resultado.perfil.nome}.`);
      const next = bhQueryParam("next");
      const destino = next || bhDestinoPerfil(resultado.perfil);
      setTimeout(() => { location.href = destino; }, 550);
    } catch (erro) {
      mostrarToast("erro", "Não foi possível entrar", bhErroMensagem(erro));
    } finally {
      bhSetButtonLoading(botao, false);
    }
  });
});
