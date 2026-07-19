document.addEventListener("DOMContentLoaded", async () => {
  const perfil = await bhRequireAuth(["cliente", "barbeiro", "admin"]);
  if (!perfil) return;
  document.getElementById("contaNome").value = perfil.nome || "";
  document.getElementById("contaEmail").value = perfil.email || "";
  document.getElementById("contaTelefone").value = perfil.telefone || "";
  document.getElementById("contaTipo").value = perfil.tipo;
  document.getElementById("contaAvatarPreview").src = perfil.avatar_url || "../img/logomarcaTRANSPARENTE.png";
  document.getElementById("contaTelefone").addEventListener("input", evento => { evento.target.value = bhMascaraTelefone(evento.target.value); });
  document.getElementById("contaAvatar").addEventListener("change", evento => {
    if (evento.target.files?.[0]) document.getElementById("contaAvatarPreview").src = URL.createObjectURL(evento.target.files[0]);
  });

  document.getElementById("formConta").addEventListener("submit", async evento => {
    evento.preventDefault();
    const form = evento.currentTarget;
    const botao = form.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Salvando...");
    try {
      const arquivo = document.getElementById("contaAvatar").files?.[0];
      const avatarUrl = arquivo ? await bhUploadImagem(arquivo, "perfil") : perfil.avatar_url;
      const novoEmail = document.getElementById("contaEmail").value.trim();
      await bhAtualizarPerfil({
        nome: document.getElementById("contaNome").value.trim(),
        telefone: document.getElementById("contaTelefone").value.trim(),
        avatar_url: avatarUrl
      });
      if (novoEmail && novoEmail !== perfil.email) {
        await bhAtualizarEmail(novoEmail);
        mostrarToast("aviso", "Confirme o novo e-mail", "O Supabase enviou uma confirmação para o endereço informado.");
      } else {
        mostrarToast("sucesso", "Conta atualizada", "Seus dados foram salvos.");
      }
    } catch (erro) {
      mostrarToast("erro", "Falha ao atualizar conta", bhErroMensagem(erro));
    } finally {
      bhSetButtonLoading(botao, false);
    }
  });
  document.getElementById("formSenhaConta").addEventListener("submit", async evento => {
    evento.preventDefault();
    const senha = document.getElementById("contaNovaSenha").value;
    const confirmar = document.getElementById("contaConfirmarSenha").value;
    if (senha.length < 8) {
      mostrarToast("erro", "Senha muito curta", "Use pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      mostrarToast("erro", "Senhas diferentes", "A confirmação precisa ser igual à nova senha.");
      return;
    }
    const form = evento.currentTarget;
    const botao = form.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Atualizando...");
    try {
      await bhAtualizarSenha(senha);
      form.reset();
      mostrarToast("sucesso", "Senha atualizada", "Sua nova senha já está ativa.");
    } catch (erro) {
      mostrarToast("erro", "Falha ao alterar senha", bhErroMensagem(erro));
    } finally {
      bhSetButtonLoading(botao, false);
    }
  });

});

document.addEventListener("DOMContentLoaded", () => {
  const abrir = document.getElementById("abrirExclusaoConta");
  const cancelar = document.getElementById("cancelarExclusaoConta");
  const form = document.getElementById("formExcluirConta");
  abrir?.addEventListener("click", () => {
    form.hidden = false;
    abrir.hidden = true;
    document.getElementById("excluirSenhaAtual")?.focus();
  });
  cancelar?.addEventListener("click", () => {
    form.reset();
    form.hidden = true;
    abrir.hidden = false;
  });
  form?.addEventListener("submit", async evento => {
    evento.preventDefault();
    const confirmacao = document.getElementById("excluirConfirmacao").value.trim();
    const senha = document.getElementById("excluirSenhaAtual").value;
    const ciente = document.getElementById("excluirCiente").checked;
    if (confirmacao !== "EXCLUIR" || !ciente) {
      mostrarToast("erro", "Confirmação incompleta", "Digite EXCLUIR e marque a confirmação antes de continuar.");
      return;
    }
    if (!confirm("Última confirmação: deseja excluir sua conta permanentemente?")) return;
    const botao = form.querySelector("button[type='submit']");
    bhSetButtonLoading(botao, true, "Excluindo...");
    try {
      await bhExcluirMinhaConta(senha);
      localStorage.removeItem("bh_tema");
      mostrarToast("sucesso", "Conta excluída", "Seus dados de acesso foram removidos.");
      setTimeout(() => { location.href = bhUrl("index.html?conta=excluida"); }, 900);
    } catch (erro) {
      mostrarToast("erro", "Não foi possível excluir", bhErroMensagem(erro));
      bhSetButtonLoading(botao, false);
    }
  });
});
