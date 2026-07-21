/**
 * cadastro.js
 * Cadastro de clientes e profissionais.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

document.addEventListener("DOMContentLoaded", () => {
  marcarMenuAtivo("cadastro");
  const form = document.getElementById("formCadastro");
  const tipo = document.getElementById("tipo");
  const cards = document.querySelectorAll("[data-tipo-conta]");
  const telefone = document.getElementById("telefone");

  cards.forEach(card => card.addEventListener("click", () => {
    cards.forEach(item => item.classList.remove("ativo"));
    card.classList.add("ativo");
    tipo.value = card.dataset.tipoConta;
    document.getElementById("textoFluxoProfissional").classList.toggle("hidden", tipo.value !== "barbeiro");
  }));

  telefone?.addEventListener("input", () => { telefone.value = bhMascaraTelefone(telefone.value); });

  form?.addEventListener("submit", async evento => {
    evento.preventDefault();
    const botao = form.querySelector("button[type='submit']");
    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("email").value.trim();
    const telefoneValor = telefone.value.trim();
    const senha = document.getElementById("senha").value;
    const confirmar = document.getElementById("confirmarSenha").value;
    const termos = document.getElementById("termos").checked;

    if (!nome || !email || !telefoneValor || !senha || !tipo.value) {
      mostrarToast("erro", "Cadastro incompleto", "Preencha todos os campos obrigatórios.");
      return;
    }
    if (senha.length < 8) {
      mostrarToast("erro", "Senha muito curta", "Use pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      mostrarToast("erro", "Senhas diferentes", "A confirmação precisa ser igual à senha.");
      return;
    }
    if (!termos) {
      mostrarToast("aviso", "Termos necessários", "Confirme que leu as condições de uso do projeto.");
      return;
    }

    bhSetButtonLoading(botao, true, "Criando conta...");
    try {
      const resultado = await bhRegistrar({ nome, email, telefone: telefoneValor, senha, tipo: tipo.value });
      if (resultado.precisaConfirmarEmail) {
        form.classList.add("hidden");
        document.getElementById("confirmacaoEmail").classList.remove("hidden");
        document.getElementById("emailConfirmacao").textContent = email;
        mostrarToast("sucesso", "Conta criada", "Confira sua caixa de entrada para confirmar o e-mail.");
        return;
      }
      mostrarToast("sucesso", "Conta criada", tipo.value === "barbeiro" ? "Agora vamos cadastrar sua barbearia." : "Seu perfil de cliente está pronto.");
      setTimeout(() => { location.href = bhDestinoPerfil(resultado.perfil); }, 650);
    } catch (erro) {
      mostrarToast("erro", "Erro no cadastro", bhErroMensagem(erro));
    } finally {
      bhSetButtonLoading(botao, false);
    }
  });
});
