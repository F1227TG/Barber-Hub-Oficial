/**
 * conta.js
 * Configurações de perfil, acessibilidade e exclusão de conta.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */


function bhMontarHubConta(perfil) {
  const container = document.querySelector(".page-conta main > .section > .container");
  if (!container || container.dataset.accountHubReady === "1") return;
  container.dataset.accountHubReady = "1";
  container.classList.remove("narrow-container");
  container.classList.add("account-hub-container");

  const formPerfil = document.getElementById("formConta");
  const formSenha = document.getElementById("formSenhaConta");
  const danger = document.querySelector(".danger-zone");
  if (!formPerfil || !formSenha || !danger) return;

  const foto = formPerfil.querySelector(".profile-photo-edit");
  const layout = document.createElement("div");
  layout.className = "account-hub-layout";
  const sidebar = document.createElement("aside");
  sidebar.className = "account-hub-sidebar";
  const tipoLabel = perfil.tipo === "barbeiro" ? "Profissional" : perfil.tipo === "admin" ? "Administrador" : "Cliente";
  const inicial = (perfil.nome || "B").trim().slice(0, 1).toUpperCase();
  sidebar.innerHTML = `
    <div class="account-hub-profile">
      <div class="account-hub-avatar-fallback">${escapeHTML(inicial)}</div>
      <div><span>${escapeHTML(tipoLabel)}</span><strong>${escapeHTML(perfil.nome || "Minha conta")}</strong><small>${escapeHTML(perfil.email || "")}</small></div>
    </div>
    <nav class="account-hub-menu" aria-label="Configurações da conta">
      <button type="button" class="ativo" data-account-panel="perfil"><i class="bi bi-person"></i><span>Perfil</span></button>
      <button type="button" data-account-panel="seguranca"><i class="bi bi-shield-lock"></i><span>Segurança</span></button>
      <button type="button" data-account-panel="privacidade"><i class="bi bi-shield-exclamation"></i><span>Privacidade</span></button>
    </nav>
    <div class="account-hub-links"></div>`;

  const links = sidebar.querySelector(".account-hub-links");
  if (perfil.tipo === "barbeiro") {
    links.innerHTML = `<a href="${bhUrl("html/painel.html#config")}"><i class="bi bi-shop"></i> Meu negócio</a><a href="${bhUrl("html/planos.html")}"><i class="bi bi-stars"></i> Plano</a>`;
  } else if (perfil.tipo === "admin") {
    links.innerHTML = `<a href="${bhUrl("html/admin.html")}"><i class="bi bi-shield-check"></i> Administração</a><a href="${bhUrl("html/admin-assinaturas.html")}"><i class="bi bi-credit-card"></i> Assinaturas</a>`;
  } else {
    links.innerHTML = `<a href="${bhUrl("html/cliente.html")}"><i class="bi bi-calendar2-check"></i> Minha agenda</a><a href="${bhUrl("html/portal.html")}"><i class="bi bi-compass"></i> Explorar</a>`;
  }

  const workspace = document.createElement("div");
  workspace.className = "account-hub-workspace";
  formPerfil.classList.add("account-hub-panel", "ativo");
  formPerfil.dataset.accountPanelId = "perfil";
  formSenha.classList.add("account-hub-panel");
  formSenha.dataset.accountPanelId = "seguranca";
  danger.classList.add("account-hub-panel");
  danger.dataset.accountPanelId = "privacidade";

  const section = container.parentElement;
  layout.append(sidebar, workspace);
  container.appendChild(layout);
  workspace.append(formPerfil, formSenha, danger);
  if (foto) sidebar.querySelector(".account-hub-profile").insertAdjacentElement("afterend", foto);

  const activate = id => {
    workspace.querySelectorAll(".account-hub-panel").forEach(panel => panel.classList.toggle("ativo", panel.dataset.accountPanelId === id));
    sidebar.querySelectorAll("[data-account-panel]").forEach(button => button.classList.toggle("ativo", button.dataset.accountPanel === id));
    if (document.body.classList.contains("mobile-native")) workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  sidebar.querySelectorAll("[data-account-panel]").forEach(button => button.addEventListener("click", () => activate(button.dataset.accountPanel)));

  const preview = document.getElementById("contaAvatarPreview");
  const fallback = sidebar.querySelector(".account-hub-avatar-fallback");
  if (preview && fallback) {
    fallback.replaceWith(preview);
    preview.classList.add("account-hub-avatar");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const perfil = await bhRequireAuth(["cliente", "barbeiro", "admin"]);
  if (!perfil) return;
  document.getElementById("contaNome").value = perfil.nome || "";
  document.getElementById("contaEmail").value = perfil.email || "";
  document.getElementById("contaTelefone").value = perfil.telefone || "";
  document.getElementById("contaTipo").value = perfil.tipo;
  document.getElementById("contaAvatarPreview").src = perfil.avatar_url || "../img/logomarcaTRANSPARENTE.png";
  bhMontarHubConta(perfil);
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
      const arquivo = window.bhArquivoImagem?.(document.getElementById("contaAvatar")) || document.getElementById("contaAvatar").files?.[0];
      const avatarUrl = arquivo ? await bhUploadImagem(arquivo, "perfil") : perfil.avatar_url;
      const novoEmail = document.getElementById("contaEmail").value.trim();
      await bhAtualizarPerfil({
        nome: document.getElementById("contaNome").value.trim(),
        telefone: document.getElementById("contaTelefone").value.trim(),
        avatar_url: avatarUrl
      });
      if (novoEmail && novoEmail !== perfil.email) {
        await bhAtualizarEmail(novoEmail);
        mostrarToast("aviso", "Confirme o novo e-mail", "Enviamos uma confirmação para o endereço informado.");
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
    const analiseSenha = bhAnalisarSenha(senha);
    if (!analiseSenha.valida) {
      mostrarToast("erro", "Complete os requisitos da senha", analiseSenha.mensagem);
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
    if (confirmacao !== "EXCLUIR MINHA CONTA" || !ciente) {
      mostrarToast("erro", "Confirmação incompleta", "Digite EXCLUIR MINHA CONTA e marque a confirmação antes de continuar.");
      return;
    }
    if (!await bhConfirmar({ titulo: "Excluir conta permanentemente", mensagem: "Esta ação remove seu acesso e seus dados pessoais. Ela não poderá ser desfeita.", confirmarTexto: "Excluir minha conta", perigo: true, trigger: form.querySelector("button[type=\'submit\']") })) return;
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
