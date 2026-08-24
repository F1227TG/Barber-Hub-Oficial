/** Melhoria 1.9.3: checklist acessível e em tempo real para criação de senha. */
(() => {
  "use strict";

  function montarChecklist(input) {
    if (!input || input.dataset.passwordPolicyReady === "true" || typeof bhAnalisarSenha !== "function") return;
    input.dataset.passwordPolicyReady = "true";

    const id = `${input.id || "senha"}Requisitos`;
    const painel = document.createElement("div");
    painel.className = "password-requirements";
    painel.id = id;
    painel.dataset.passwordRequirements = "";
    painel.setAttribute("aria-live", "polite");
    painel.innerHTML = `<strong>Sua senha precisa ter:</strong><ul>${BH_REGRAS_SENHA.map(regra => `<li data-password-rule="${regra.chave}"><i class="bi bi-circle" aria-hidden="true"></i><span>${regra.rotulo}</span></li>`).join("")}</ul>`;
    input.insertAdjacentElement("afterend", painel);
    input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), id].filter(Boolean).join(" "));

    const confirmacao = input.form?.querySelector(`[data-password-confirm-for="${input.id}"]`);
    let itemConfirmacao = null;
    if (confirmacao) {
      itemConfirmacao = document.createElement("small");
      itemConfirmacao.className = "password-match";
      itemConfirmacao.setAttribute("aria-live", "polite");
      confirmacao.insertAdjacentElement("afterend", itemConfirmacao);
    }

    const atualizar = () => {
      const analise = bhAnalisarSenha(input.value);
      analise.regras.forEach(regra => {
        const item = painel.querySelector(`[data-password-rule="${regra.chave}"]`);
        item?.classList.toggle("atendida", regra.atendida);
        const icone = item?.querySelector("i");
        if (icone) icone.className = `bi ${regra.atendida ? "bi-check-circle-fill" : "bi-circle"}`;
      });
      painel.classList.toggle("completa", analise.valida);
      input.setCustomValidity(input.value && !analise.valida ? analise.mensagem : "");

      if (confirmacao && itemConfirmacao) {
        const preenchida = Boolean(confirmacao.value);
        const coincide = preenchida && confirmacao.value === input.value;
        itemConfirmacao.textContent = preenchida ? (coincide ? "As senhas coincidem." : "As senhas ainda não coincidem.") : "";
        itemConfirmacao.classList.toggle("atendida", coincide);
        confirmacao.setCustomValidity(preenchida && !coincide ? "A confirmação precisa ser igual à nova senha." : "");
      }
    };

    input.addEventListener("input", atualizar);
    confirmacao?.addEventListener("input", atualizar);
    input.form?.addEventListener("reset", () => setTimeout(atualizar));
    atualizar();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-password-policy]").forEach(montarChecklist);
  });
})();
