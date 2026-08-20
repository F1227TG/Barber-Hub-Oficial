/**
 * product-redesign.js
 * --------------------------------------------------------------------------
 * Interações compartilhadas do redesign 1.5:
 * - chamada principal para instalar o PWA;
 * - instruções de instalação quando o navegador não oferece prompt nativo;
 * - pequenos ajustes de densidade e acessibilidade em telas móveis.
 * --------------------------------------------------------------------------
 */

(() => {
  "use strict";

  let installPrompt = null;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function installButtons() {
    return [...document.querySelectorAll("[data-install-app]")];
  }

  function updateInstallButtons() {
    const installed = isStandalone();
    installButtons().forEach(button => {
      button.classList.toggle("is-installed", installed);
      button.hidden = installed;
      button.toggleAttribute("hidden", installed);
      button.setAttribute("aria-disabled", installed ? "true" : "false");
      const label = button.querySelector("[data-install-label]");
      const helper = button.querySelector("[data-install-helper]");
      const labelText = installed ? "Barber Hub instalado" : "Instalar Barber Hub no celular";
      const helperText = installed
        ? "Você já está usando a experiência de aplicativo."
        : "Acesso rápido, tela cheia e atalho na tela inicial.";
      // textContent recria o nó de texto e dispara MutationObserver mesmo
      // quando o valor visual não mudou. Só escrevemos quando necessário para
      // impedir um ciclo infinito após as métricas animadas da Home atualizarem.
      if (label && label.textContent !== labelText) label.textContent = labelText;
      if (helper && helper.textContent !== helperText) helper.textContent = helperText;
    });
  }

  async function showInstallInstructions(trigger) {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const text = ios
      ? "No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”."
      : "Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.";

    if (typeof window.bhConfirmar === "function") {
      await window.bhConfirmar({
        titulo: "Instalar Barber Hub",
        mensagem: text,
        confirmarTexto: "Entendi",
        cancelarTexto: "Fechar",
        trigger
      });
      return;
    }
    window.mostrarToast?.("info", "Instalar Barber Hub", text);
  }

  async function installApp(trigger) {
    if (isStandalone()) {
      window.mostrarToast?.("info", "Aplicativo instalado", "O Barber Hub já está aberto no modo aplicativo.");
      return;
    }
    if (!installPrompt) {
      await showInstallInstructions(trigger);
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    updateInstallButtons();
  }

  function configureInstall() {
    const mobileNative = document.body.classList.contains("mobile-native") || location.pathname.includes("/mobile/");
    if (mobileNative) {
      document.querySelectorAll("[data-install-app]").forEach(node => node.remove());
      return;
    }
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      installPrompt = event;
      document.body.classList.add("pwa-install-available");
      updateInstallButtons();
    });

    window.addEventListener("appinstalled", () => {
      installPrompt = null;
      document.body.classList.add("pwa-installed");
      updateInstallButtons();
      window.mostrarToast?.("sucesso", "Barber Hub instalado", "O atalho foi adicionado ao seu dispositivo.");
    });

    document.addEventListener("click", event => {
      const button = event.target.closest("[data-install-app]");
      if (!button) return;
      event.preventDefault();
      installApp(button);
    });

    updateInstallButtons();
  }

  function labelDynamicTables() {
    document.querySelectorAll("table").forEach(table => {
      const labels = [...table.querySelectorAll("thead th")].map(item => item.textContent.trim());
      table.querySelectorAll("tbody tr").forEach(row => {
        [...row.children].forEach((cell, index) => {
          if (labels[index] && !cell.dataset.label) cell.dataset.label = labels[index];
        });
      });
    });
  }

  function observeDynamicContent() {
    const selector = "table, thead, tbody, tr, th, td, [data-install-app], [data-install-label], [data-install-helper]";
    const hasRelevantElement = node => node.nodeType === Node.ELEMENT_NODE && (
      node.matches?.(selector) || node.querySelector?.(selector)
    );
    const observer = new MutationObserver(records => {
      // Alterações em nós de texto (por exemplo, contadores animados) não
      // exigem reprocessar tabelas ou botões de instalação.
      if (!records.some(record => [...record.addedNodes].some(hasRelevantElement))) return;
      labelDynamicTables();
      updateInstallButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    configureInstall();
    labelDynamicTables();
    observeDynamicContent();
  });
})();
